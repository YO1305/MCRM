import { useEffect, useState } from 'react'
import { where } from 'firebase/firestore'
import {
  subscribeToCollection,
  createDocument,
  updateDocument,
  removeDocument,
} from '@/firebase/firestore'
import { useAuth } from '@/hooks/useAuth'
import type { Client, ClientInput, ProductKind, SamplesShipmentInput } from '@/types/client.types'
import type { ClientStage } from '@/constants/clientStages'
import {
  stageCountsAsKpiLead,
  stageIsClosed,
  stageLabel,
  stageKpiBucket,
} from '@/constants/clientStages'
import type { LeadCategory } from '@/types/kpiLead.types'
import { getCurrentMonth, todayISO } from '@/utils/dates'
import { clientActionDeadline } from '@/utils/clientWork'
import { activityPatch } from '@/utils/leadActivity'
import {
  primaryKpiCategory,
  resolveKpiCategories,
} from '@/constants/leadProducts'
import { upsertContactFromLead, markContactActive } from '@/firebase/contactsSync'

function normalizeProducts(products: ProductKind[] | undefined): ProductKind[] {
  if (!products?.length) return []
  return [...new Set(products)]
}

function sortClients(data: Client[]) {
  return [...data].sort((a, b) => {
    const aDeadline = clientActionDeadline(a) || '9999'
    const bDeadline = clientActionDeadline(b) || '9999'
    if (aDeadline !== bDeadline) return aDeadline.localeCompare(bDeadline)
    return a.name.localeCompare(b.name, 'ru')
  })
}

function mergeClients(...lists: Client[][]) {
  const map = new Map<string, Client>()
  for (const list of lists) {
    for (const c of list) map.set(c.id, c)
  }
  return sortClients([...map.values()])
}

const emptySales = {
  salesDepartment: null as string | null,
  salesManagerId: null as string | null,
  salesManagerName: null as string | null,
  waitStatus: null as string | null,
  nextStep: null as string | null,
  nextStepDeadline: null as string | null,
  visitDate: null as string | null,
  visitNote: null as string | null,
}

async function fixKpiLeadIfNeeded(
  client: Client,
  newStage: ClientStage,
  author?: { id: string; name: string },
  previousStage?: ClientStage,
) {
  if (!stageCountsAsKpiLead(newStage)) return
  if (client.kpiLeadCounted) return

  const month = getCurrentMonth()
  const categories = resolveKpiCategories(client.country, client.products || [])
  const category = primaryKpiCategory(categories)

  await updateDocument('clients', client.id, {
    kpiLeadCounted: true,
    kpiLeadMonth: month,
    category,
    categories,
  })

  await createDocument('kpi_lead_log', {
    clientId: client.id,
    clientName: client.name,
    assignedTo: client.assignedTo,
    assignedToName: client.assignedToName,
    category,
    categories,
    country: client.country || null,
    month,
    fixedAt: new Date().toISOString(),
    stage: newStage,
  })

  if (author) {
    await createDocument('client_history', {
      clientId: client.id,
      type: 'stage_change',
      text: `Контакт зафиксирован как лид в KPI (${stageLabel(newStage)}) — ${month}`,
      fromStage: previousStage || null,
      toStage: newStage,
      authorId: author.id,
      authorName: author.name,
    })
  }
}

export function useClients() {
  const { user, isAdmin } = useAuth()
  const [clients, setClients] = useState<Client[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!user) {
      setClients([])
      setLoading(false)
      return
    }

    setLoading(true)

    if (isAdmin) {
      return subscribeToCollection<Client>(
        'clients',
        [],
        (data) => {
          setClients(sortClients(data))
          setLoading(false)
          setError(null)
        },
        (err) => {
          console.error(err)
          setError('Не удалось загрузить клиентов')
          setLoading(false)
        },
      )
    }

    let asLead: Client[] = []
    let asSales: Client[] = []
    let leadReady = false
    let salesReady = false

    function publish() {
      if (!leadReady || !salesReady) return
      setClients(mergeClients(asLead, asSales))
      setLoading(false)
      setError(null)
    }

    const unsubLead = subscribeToCollection<Client>(
      'clients',
      [where('assignedTo', '==', user.id)],
      (data) => {
        asLead = data
        leadReady = true
        publish()
      },
      (err) => {
        console.error(err)
        leadReady = true
        publish()
        setError('Не удалось загрузить клиентов')
      },
    )

    const unsubSales = subscribeToCollection<Client>(
      'clients',
      [where('salesManagerId', '==', user.id)],
      (data) => {
        asSales = data
        salesReady = true
        publish()
      },
      (err) => {
        console.error(err)
        salesReady = true
        publish()
      },
    )

    return () => {
      unsubLead()
      unsubSales()
    }
  }, [user, isAdmin])

  async function createClient(
    input: ClientInput,
    assignee: { id: string; name: string },
  ) {
    if (!user) throw new Error('Not authenticated')
    if (!input.country) throw new Error('Country required')
    const products = normalizeProducts(input.products)
    if (!products.length) throw new Error('Products required')

    const fabricTypes = products.includes('fabric') ? input.fabricTypes || [] : []
    const gpTypes = products.includes('finished') ? input.gpTypes || [] : []
    const categories = resolveKpiCategories(input.country, products)
    const category = primaryKpiCategory(categories)
    const stage = input.stage || 'contact'
    const today = todayISO()
    const openedMonth = getCurrentMonth()

    const clientId = await createDocument('clients', {
      name: input.name.trim(),
      phone: input.phone.trim(),
      company: (input.company || '').trim(),
      email: (input.email || '').trim(),
      stage,
      source: input.source || 'other',
      exhibitionName: (input.exhibitionName || '').trim(),
      exhibitionDate: input.exhibitionDate || null,
      notes: (input.notes || '').trim(),
      assignedTo: assignee.id,
      assignedToName: assignee.name,
      createdBy: user.id,
      createdByName: user.name,
      nextContactDate: input.nextContactDate || null,
      dealAmount: input.dealAmount ?? null,
      country: input.country,
      products,
      fabricTypes,
      gpTypes,
      category,
      categories,
      kpiLeadCounted: false,
      kpiLeadMonth: null,
      lastTouchDate: today,
      lastStageChangeDate: today,
      openedMonth,
      activityStatus: 'new',
      activeMonthsCount: 1,
      ...emptySales,
    })

    // Sync into contacts base (create or update by phone)
    try {
      const contactId = await upsertContactFromLead({
        name: input.name.trim(),
        phone: input.phone.trim(),
        company: input.company,
        email: input.email,
        country: input.country,
        notes: input.notes,
        source: input.source || 'other',
        exhibitionName: input.exhibitionName,
        exhibitionDate: input.exhibitionDate,
        leadId: clientId,
        userId: user.id,
        userName: user.name,
        asPartner: stageKpiBucket(stage) === 'deal' || stage === 'deal',
      })
      if (contactId) {
        await updateDocument('clients', clientId, { contactId })
      }
    } catch (err) {
      console.error('Contact base sync failed', err)
    }

    await createDocument('client_history', {
      clientId,
      type: 'created',
      text: `Клиент создан · этап «${stageLabel(stage)}»`,
      fromStage: null,
      toStage: stage,
      authorId: user.id,
      authorName: user.name,
    })

    if (stageCountsAsKpiLead(stage)) {
      await fixKpiLeadIfNeeded(
        {
          id: clientId,
          name: input.name.trim(),
          phone: input.phone.trim(),
          company: (input.company || '').trim(),
          email: (input.email || '').trim(),
          stage,
          source: input.source || 'other',
          notes: (input.notes || '').trim(),
          assignedTo: assignee.id,
          assignedToName: assignee.name,
          createdBy: user.id,
          createdByName: user.name,
          nextContactDate: input.nextContactDate || null,
          dealAmount: input.dealAmount ?? null,
          country: input.country,
          products,
          fabricTypes,
          gpTypes,
          category,
          categories,
          kpiLeadCounted: false,
          kpiLeadMonth: null,
          ...emptySales,
          createdAt: null,
          updatedAt: null,
        },
        stage,
        { id: user.id, name: user.name },
      )
    }

    return clientId
  }

  async function updateClient(
    clientId: string,
    data: Partial<{
      name: string
      phone: string
      company: string
      email: string
      stage: ClientStage
      source: Client['source']
      exhibitionName?: string
      exhibitionDate?: string | null
      notes: string
      nextContactDate: string | null
      dealAmount: number | null
      assignedTo: string
      assignedToName: string
      country: string | null
      products: ProductKind[]
      fabricTypes: string[]
      gpTypes: string[]
      category: LeadCategory | null
      categories: LeadCategory[]
    }>,
    opts?: { previousStage?: ClientStage },
  ) {
    if (!user) throw new Error('Not authenticated')

    const client = clients.find((c) => c.id === clientId)
    const nextCountry = data.country !== undefined ? data.country : client?.country
    const nextProducts =
      data.products !== undefined ? normalizeProducts(data.products) : client?.products || []

    const patch: Record<string, unknown> = { ...data }
    if (data.country !== undefined || data.products !== undefined) {
      const cats = resolveKpiCategories(nextCountry, nextProducts)
      patch.categories = cats
      patch.category = primaryKpiCategory(cats)
      if (data.products !== undefined) patch.products = nextProducts
    }

    const stageChanged = Boolean(
      data.stage && opts?.previousStage && data.stage !== opts.previousStage,
    )
    const dealChanged =
      data.dealAmount !== undefined && data.dealAmount !== client?.dealAmount
    Object.assign(
      patch,
      activityPatch(client, patch, {
        movement: stageChanged || dealChanged,
        touch: stageChanged || dealChanged,
      }),
    )

    await updateDocument('clients', clientId, patch)

    if (data.stage && opts?.previousStage && data.stage !== opts.previousStage) {
      await createDocument('client_history', {
        clientId,
        type: 'stage_change',
        text: `${stageLabel(opts.previousStage)} → ${stageLabel(data.stage)}`,
        fromStage: opts.previousStage,
        toStage: data.stage,
        authorId: user.id,
        authorName: user.name,
      })

      if (client) {
        await fixKpiLeadIfNeeded(
          {
            ...client,
            ...emptySales,
            ...client,
            country: (nextCountry as string | null) ?? client.country,
            products: nextProducts,
            categories: (patch.categories as LeadCategory[]) || client.categories || [],
            category: (patch.category as LeadCategory) || client.category,
            fabricTypes:
              data.fabricTypes !== undefined ? data.fabricTypes : client.fabricTypes || [],
            gpTypes: data.gpTypes !== undefined ? data.gpTypes : client.gpTypes || [],
          },
          data.stage,
          { id: user.id, name: user.name },
          opts.previousStage,
        )

        if (!stageIsClosed(data.stage)) {
          void markContactActive({
            contactId: client.contactId,
            phone: client.phone,
            asPartner: stageKpiBucket(data.stage) === 'deal' || data.stage === 'deal',
          }).catch((err) => console.error('markContactActive failed', err))
        }
      }
    }
  }

  async function setStage(clientId: string, stage: ClientStage, previousStage: ClientStage) {
    if (!user) throw new Error('Not authenticated')
    const client = clients.find((c) => c.id === clientId)
    if (!client) return

    await updateDocument(
      'clients',
      clientId,
      activityPatch(client, { stage }, { movement: true, touch: true }),
    )

    if (previousStage !== stage) {
      const archived = stageIsClosed(stage)
      await createDocument('client_history', {
        clientId,
        type: 'stage_change',
        text: archived
          ? `В архив: ${stageLabel(previousStage)} → ${stageLabel(stage)}`
          : `${stageLabel(previousStage)} → ${stageLabel(stage)}`,
        fromStage: previousStage,
        toStage: stage,
        authorId: user.id,
        authorName: user.name,
      })
    }

    await fixKpiLeadIfNeeded(
      {
        ...client,
        products: client.products || [],
        fabricTypes: client.fabricTypes || [],
        gpTypes: client.gpTypes || [],
        categories: client.categories || (client.category ? [client.category] : []),
      },
      stage,
      { id: user.id, name: user.name },
      previousStage,
    )

    if (!stageIsClosed(stage)) {
      void markContactActive({
        contactId: client.contactId,
        phone: client.phone,
        asPartner: stageKpiBucket(stage) === 'deal' || stage === 'deal',
      }).catch((err) => console.error('markContactActive failed', err))
    }
  }

  async function addNote(clientId: string, text: string) {
    if (!user) throw new Error('Not authenticated')
    const trimmed = text.trim()
    if (!trimmed) return
    await createDocument('client_history', {
      clientId,
      type: 'note',
      text: trimmed,
      fromStage: null,
      toStage: null,
      authorId: user.id,
      authorName: user.name,
    })
    const client = clients.find((c) => c.id === clientId)
    await updateDocument('clients', clientId, activityPatch(client, {}, { touch: true }))
  }

  async function addSalesNote(clientId: string, text: string) {
    if (!user) throw new Error('Not authenticated')
    const trimmed = text.trim()
    if (!trimmed) return
    await createDocument('client_history', {
      clientId,
      type: 'sales_note',
      text: trimmed,
      fromStage: null,
      toStage: null,
      authorId: user.id,
      authorName: user.name,
    })
    const client = clients.find((c) => c.id === clientId)
    await updateDocument('clients', clientId, activityPatch(client, {}, { touch: true }))
  }

  async function assignSalesManager(
    clientId: string,
    data: {
      salesDepartment: string
      salesDepartmentName: string
      salesManagerId: string
      salesManagerName: string
    },
  ) {
    if (!user) throw new Error('Not authenticated')
    const client = clients.find((c) => c.id === clientId)
    await updateDocument(
      'clients',
      clientId,
      activityPatch(client, {
        salesDepartment: data.salesDepartment,
        salesManagerId: data.salesManagerId,
        salesManagerName: data.salesManagerName,
      }),
    )
    await createDocument('client_history', {
      clientId,
      type: 'sales_assigned',
      text: `Подключён менеджер по продажам: ${data.salesManagerName} (${data.salesDepartmentName})`,
      fromStage: null,
      toStage: null,
      authorId: user.id,
      authorName: user.name,
    })
  }

  async function setWaitStatus(clientId: string, status: string | null) {
    if (!user) throw new Error('Not authenticated')
    const client = clients.find((c) => c.id === clientId)
    await updateDocument(
      'clients',
      clientId,
      activityPatch(client, { waitStatus: status }, { movement: !!status, touch: !!status }),
    )
    if (status) {
      await createDocument('client_history', {
        clientId,
        type: 'wait_status',
        text: `Статус: ${status}`,
        fromStage: null,
        toStage: null,
        authorId: user.id,
        authorName: user.name,
      })
    }
  }

  async function setNextStep(
    clientId: string,
    nextStep: string,
    nextStepDeadline: string | null,
  ) {
    if (!user) throw new Error('Not authenticated')
    const text = nextStep.trim()
    const client = clients.find((c) => c.id === clientId)
    await updateDocument(
      'clients',
      clientId,
      activityPatch(
        client,
        {
          nextStep: text || null,
          nextStepDeadline: nextStepDeadline || null,
        },
        { touch: true },
      ),
    )
    if (text) {
      const deadlinePart = nextStepDeadline ? ` (до ${nextStepDeadline})` : ''
      await createDocument('client_history', {
        clientId,
        type: 'next_step',
        text: `Следующий шаг: ${text}${deadlinePart}`,
        fromStage: null,
        toStage: null,
        authorId: user.id,
        authorName: user.name,
      })
    }
  }

  async function completeNextStep(clientId: string) {
    if (!user) throw new Error('Not authenticated')
    const client = clients.find((c) => c.id === clientId)
    const prev = client?.nextStep?.trim()
    const deadline = client?.nextStepDeadline
    await updateDocument(
      'clients',
      clientId,
      activityPatch(
        client,
        {
          nextStep: null,
          nextStepDeadline: null,
        },
        { touch: true },
      ),
    )
    if (prev) {
      const deadlinePart = deadline ? ` (срок был ${deadline})` : ''
      await createDocument('client_history', {
        clientId,
        type: 'next_step',
        text: `Шаг выполнен: ${prev}${deadlinePart}`,
        fromStage: null,
        toStage: null,
        authorId: user.id,
        authorName: user.name,
      })
    }
  }

  async function setVisit(
    clientId: string,
    visitDate: string | null,
    visitNote: string | null,
  ) {
    if (!user) throw new Error('Not authenticated')
    const date = visitDate || null
    const note = (visitNote || '').trim() || null
    const client = clients.find((c) => c.id === clientId)
    await updateDocument(
      'clients',
      clientId,
      activityPatch(client, {
        visitDate: date,
        visitNote: note,
      }),
    )
    if (date) {
      const notePart = note ? ` · ${note}` : ''
      await createDocument('client_history', {
        clientId,
        type: 'visit',
        text: `Приезд клиента: ${date}${notePart}`,
        fromStage: null,
        toStage: null,
        authorId: user.id,
        authorName: user.name,
      })
    } else {
      await createDocument('client_history', {
        clientId,
        type: 'visit',
        text: 'Приезд клиента отменён',
        fromStage: null,
        toStage: null,
        authorId: user.id,
        authorName: user.name,
      })
    }
  }

  async function logCall(clientId: string, text: string) {
    if (!user) throw new Error('Not authenticated')
    const trimmed = text.trim() || 'Звонок'
    await createDocument('client_history', {
      clientId,
      type: 'call',
      text: trimmed,
      fromStage: null,
      toStage: null,
      authorId: user.id,
      authorName: user.name,
    })
    await createDocument('call_logs', {
      clientId,
      text: trimmed,
      authorId: user.id,
      authorName: user.name,
    })
    const client = clients.find((c) => c.id === clientId)
    await updateDocument('clients', clientId, activityPatch(client, {}, { touch: true }))
  }

  async function logSamplesSent(clientId: string, shipment: SamplesShipmentInput) {
    if (!user) throw new Error('Not authenticated')
    const items = shipment.items
      .map((i) => ({
        name: i.name.trim(),
        params: (i.params || '').trim(),
      }))
      .filter((i) => i.name)
    if (!items.length) throw new Error('Добавьте хотя бы один образец')

    const sentDate = shipment.sentDate || todayISO()
    const lines = items.map(
      (i, idx) => `${idx + 1}. ${i.name}${i.params ? ` — ${i.params}` : ''}`,
    )
    const note = (shipment.note || '').trim()
    const text = [
      `Отправлены образцы (${sentDate}), позиций: ${items.length}`,
      ...lines,
      note ? `Комментарий: ${note}` : '',
    ]
      .filter(Boolean)
      .join('\n')

    await createDocument('client_history', {
      clientId,
      type: 'samples_sent',
      text,
      sentDate,
      sampleItems: items,
      fromStage: null,
      toStage: null,
      authorId: user.id,
      authorName: user.name,
    })

    const client = clients.find((c) => c.id === clientId)
    await updateDocument(
      'clients',
      clientId,
      activityPatch(client, {
        lastSamplesSentAt: sentDate,
        lastSamplesCount: items.length,
      }),
    )
  }

  async function deleteClient(clientId: string) {
    if (!user) throw new Error('Not authenticated')
    if (!isAdmin) throw new Error('Only admin can delete clients')
    await removeDocument('clients', clientId)
  }

  return {
    clients,
    loading,
    error,
    createClient,
    updateClient,
    setStage,
    addNote,
    addSalesNote,
    assignSalesManager,
    setWaitStatus,
    setNextStep,
    completeNextStep,
    setVisit,
    logCall,
    logSamplesSent,
    deleteClient,
  }
}
