import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { LEAD_CATEGORIES } from '@/constants/clientMeta'
import { TEAM_GUIDE_INTRO, TEAM_GUIDE_SECTIONS, TEAM_GUIDE_TITLE } from '@/constants/kpiTeamGuide'
import { groqActivityIsCurrent, kpiMonthIsCurrent } from '@/utils/groqLeadActivity'
import type { Client } from '@/types/client.types'
import type { KpiLeadLog, LeadCategory } from '@/types/kpiLead.types'
import { stageLabel } from '@/constants/clientStages'

function formatMonthLabel(month: string) {
  const [y, m] = month.split('-').map(Number)
  return new Date(y, (m || 1) - 1, 1).toLocaleDateString('ru-RU', {
    month: 'long',
    year: 'numeric',
  })
}

function cats(c: Pick<Client, 'categories' | 'category'> | KpiLeadLog) {
  const list =
    'categories' in c && c.categories?.length
      ? c.categories
      : 'category' in c && c.category
        ? [c.category]
        : []
  return (list as LeadCategory[]).map((x) => LEAD_CATEGORIES[x] || x).join(' + ') || '—'
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function clientRowHtml(c: Client, extra: string) {
  return `<tr>
    <td>${escapeHtml(c.name || c.company || '—')}</td>
    <td>${escapeHtml(c.assignedToName || '—')}</td>
    <td>${escapeHtml(stageLabel(c.stage))}</td>
    <td>${c.activeDaysThisMonth ?? '—'}</td>
    <td>${escapeHtml(extra)}</td>
  </tr>`
}

export function KpiTeamGuide({
  month,
  clients,
  leads,
}: {
  month: string
  clients: Client[]
  leads: KpiLeadLog[]
}) {
  const groups = useMemo(() => {
    const inMonth = clients.filter((c) => groqActivityIsCurrent(c, month))
    const active = inMonth.filter((c) => c.activityLabel === 'active')
    const passive = inMonth.filter((c) => c.activityLabel === 'passive')
    const paused = inMonth.filter((c) => c.activityLabel === 'paused')
    const kpiYes = active.filter((c) => c.kpiQualified === true && kpiMonthIsCurrent(c, month))
    const kpiNo = active.filter((c) => !(c.kpiQualified === true && kpiMonthIsCurrent(c, month)))
    const byName = (a: Client, b: Client) => a.name.localeCompare(b.name, 'ru')
    return {
      active: [...active].sort(byName),
      passive: [...passive].sort(byName),
      paused: [...paused].sort(byName),
      kpiYes: [...kpiYes].sort(byName),
      kpiNo: [...kpiNo].sort(byName),
    }
  }, [clients, month])

  function downloadWord() {
    const methodology = TEAM_GUIDE_SECTIONS.map(
      (s) => `<h2>${escapeHtml(s.title)}</h2><p>${escapeHtml(s.body).replace(/\n\n/g, '</p><p>').replace(/\n/g, '<br/>')}</p>`,
    ).join('')

    const table = (title: string, rows: string, note: string) =>
      `<h2>${escapeHtml(title)}</h2><p><i>${escapeHtml(note)}</i></p>
       <table border="1" cellpadding="6" cellspacing="0" width="100%">
         <tr><th>Клиент</th><th>Менеджер</th><th>Этап</th><th>Дней с записями</th><th>Почему так</th></tr>
         ${rows || '<tr><td colspan="5">В этом месяце пока никого</td></tr>'}
       </table>`

    const html = `<html xmlns:o="urn:schemas-microsoft-com:office:office"
      xmlns:w="urn:schemas-microsoft-com:office:word" lang="ru">
      <head><meta charset="utf-8"><title>${escapeHtml(TEAM_GUIDE_TITLE)}</title></head>
      <body style="font-family:Calibri,Arial,sans-serif;font-size:12pt;line-height:1.4">
        <h1>${escapeHtml(TEAM_GUIDE_TITLE)}</h1>
        <p>Месяц примеров: <b>${escapeHtml(formatMonthLabel(month))}</b>. Документ выгружен из CRM Bahmal.</p>
        <p>${escapeHtml(TEAM_GUIDE_INTRO)}</p>
        ${methodology}
        <h1>Живые примеры за ${escapeHtml(formatMonthLabel(month))}</h1>
        <p>Имена — реальные клиенты из CRM на момент выгрузки. Сводка: активных ${groups.active.length},
        пассивных ${groups.passive.length}, на паузе ${groups.paused.length},
        KPI-лидов ${groups.kpiYes.length} (в журнале ${leads.length}).</p>
        ${table(
          'Активные, которые пошли в KPI-лиды',
          groups.kpiYes
            .map((c) =>
              clientRowHtml(
                c,
                `${cats(c)}. ${c.kpiQualificationReason || 'Засчитан в KPI.'}${
                  typeof c.kpiSignificantMoments === 'number'
                    ? c.kpiSignificantMoments >= 900
                      ? ' Сделка в 1-м месяце.'
                      : ` Шагов по лиду: ${c.kpiSignificantMoments}.`
                    : ''
                }`,
              ),
            )
            .join(''),
          'Ступень 1 пройдена (есть работа в истории) и ступень 2 тоже (3 шага менеджера по клиенту или сделка в 1-м месяце).',
        )}
        ${table(
          'Активные, которые в KPI не пошли',
          groups.kpiNo
            .map((c) =>
              clientRowHtml(
                c,
                c.kpiQualificationReason ||
                  'Работа есть, но меньше 3 шагов менеджера по клиенту (или 4-й месяц, или анализ ещё не закрыл отказ).',
              ),
            )
            .join(''),
          'Их ведут, история есть, но в зарплатный лид не засчитываем.',
        )}
        ${table(
          'Пассивные в этом месяце',
          groups.passive
            .map((c) =>
              clientRowHtml(c, c.activityReason || 'За месяц в истории нет работы по лиду.'),
            )
            .join(''),
          'В журнале за месяц пусто. До KPI-лида они даже не рассматриваются.',
        )}
        ${table(
          'На паузе',
          groups.paused
            .map((c) => clientRowHtml(c, c.activityReason || 'В карточке «на паузе», другой работы нет.')).join(''),
          'Стоит ожидание «на паузе» и больше записей за месяц нет.',
        )}
      </body></html>`

    const blob = new Blob(['\uFEFF', html], { type: 'application/msword' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `Kak_otbirayutsya_lidy_${month}.doc`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-4 print:space-y-3">
      <Card className="space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-text">{TEAM_GUIDE_TITLE}</h2>
            <p className="mt-1 text-sm text-muted">{TEAM_GUIDE_INTRO}</p>
          </div>
          <div className="flex flex-wrap gap-2 print:hidden">
            <a
              href="/Kak_otbor_aktivnost_i_lidy.doc"
              download="Kak_otbor_aktivnost_i_kpi_lid.doc"
              className="inline-flex items-center rounded-lg bg-secondary px-3 py-2 text-sm font-medium text-white"
            >
              Скачать полную инструкцию Word
            </a>
            <Button type="button" variant="secondary" onClick={() => downloadWord()}>
              Word с примерами этого месяца
            </Button>
            <Button type="button" variant="ghost" onClick={() => window.print()}>
              Печать
            </Button>
          </div>
        </div>
        <p className="text-xs text-muted">
          Файл «полная инструкция» — все статусы, типы записей и исходы без имён клиентов.
          «Примеры месяца» добавляет живые карточки за {formatMonthLabel(month)}. Правила также:{' '}
          <a className="text-secondary underline" href="/kak-otbirayutsya-lidy.html" target="_blank" rel="noreferrer">
            kak-otbirayutsya-lidy.html
          </a>
          — откройте в Word через Файл → Сохранить как.
        </p>
      </Card>

      {TEAM_GUIDE_SECTIONS.map((s) => (
        <Card key={s.title} className="space-y-2">
          <h3 className="text-base font-semibold text-text">{s.title}</h3>
          {s.body.split('\n\n').map((p, i) => (
            <p key={i} className="whitespace-pre-line text-sm leading-relaxed text-text">
              {p}
            </p>
          ))}
        </Card>
      ))}

      <Card className="space-y-3 bg-slate-50/80">
        <h3 className="text-base font-semibold text-text">
          Живые примеры · {formatMonthLabel(month)}
        </h3>
        <p className="text-sm text-muted">
          Активных: {groups.active.length} · пассивных: {groups.passive.length} · на паузе:{' '}
          {groups.paused.length} · в KPI-лидах: {groups.kpiYes.length} (записей в журнале {leads.length})
        </p>
        <ExampleList
          title="Пошли в KPI-лиды"
          empty="Пока никто не квалифицирован за этот месяц."
          items={groups.kpiYes}
          badge="KPI-лид"
          badgeClass="bg-emerald-50 text-emerald-700"
          reason={(c) =>
            `${cats(c)}. ${c.kpiQualificationReason || 'Засчитан.'}${
              typeof c.kpiSignificantMoments === 'number'
                ? c.kpiSignificantMoments >= 900
                  ? ' Сделка в 1-м месяце.'
                  : ` Шагов по лиду: ${c.kpiSignificantMoments}.`
                : ''
            }`
          }
        />
        <ExampleList
          title="Активные, но не KPI-лиды"
          empty="Все активные этого месяца уже в факте — или активных нет."
          items={groups.kpiNo}
          badge="активный ≠ лид"
          badgeClass="bg-amber-50 text-amber-800"
          reason={(c) =>
            c.kpiQualificationReason ||
            'Работа в истории есть. Меньше 3 шагов менеджера по клиенту, либо 4-й месяц, либо анализ ещё не закрыл отказ.'
          }
        />
        <ExampleList
          title="Пассивные"
          empty="Пассивных за месяц нет."
          items={groups.passive}
          badge="пассивный"
          badgeClass="bg-gray-100 text-gray-700"
          reason={(c) => c.activityReason || 'За месяц в истории нет работы.'}
        />
        <ExampleList
          title="На паузе"
          empty="Сейчас никого с чистой паузой."
          items={groups.paused}
          badge="пауза"
          badgeClass="bg-slate-200 text-slate-700"
          reason={(c) => c.activityReason || '«На паузе» и другой работы нет.'}
        />
      </Card>
    </div>
  )
}

function ExampleList({
  title,
  empty,
  items,
  badge,
  badgeClass,
  reason,
}: {
  title: string
  empty: string
  items: Client[]
  badge: string
  badgeClass: string
  reason: (c: Client) => string
}) {
  return (
    <div className="rounded-lg bg-white p-3 shadow-sm">
      <p className="text-sm font-semibold text-text">
        {title}{' '}
        <span className="font-normal text-muted">({items.length})</span>
      </p>
      {items.length === 0 ? (
        <p className="mt-1 text-sm text-muted">{empty}</p>
      ) : (
        <ul className="mt-2 divide-y divide-gray-100">
          {items.map((c) => (
            <li key={c.id} className="py-2.5">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <Link to={`/crm?client=${c.id}`} className="font-medium text-secondary hover:underline">
                  {c.name}
                </Link>
                <span className={`rounded-md px-2 py-0.5 text-xs font-medium ${badgeClass}`}>{badge}</span>
              </div>
              <p className="text-xs text-muted">
                {c.assignedToName || 'без менеджера'} · {stageLabel(c.stage)} · дней с
                записями: {c.activeDaysThisMonth ?? '—'}
              </p>
              <p className="mt-1 text-sm leading-relaxed text-text">{reason(c)}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
