import { useEffect, useState } from 'react'
import { collection, getDocs, query, where } from 'firebase/firestore'
import { db } from '@/firebase/config'
import {
  subscribeToCollection,
  createDocument,
  updateDocument,
  removeDocument,
} from '@/firebase/firestore'
import type {
  Department,
  DepartmentInput,
  DepartmentMember,
} from '@/types/department.types'

async function syncClientsForMember(
  memberId: string,
  patch: { salesManagerName?: string; salesDepartment?: string; salesDepartmentName?: string },
) {
  const snap = await getDocs(
    query(collection(db, 'clients'), where('salesManagerId', '==', memberId)),
  )
  if (!snap.docs.length) return
  await Promise.all(
    snap.docs.map((d) => updateDocument('clients', d.id, patch as Record<string, unknown>)),
  )
}

export function useDepartments() {
  const [departments, setDepartments] = useState<Department[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const unsubscribe = subscribeToCollection<Department>(
      'departments',
      [],
      (data) => {
        setDepartments(
          [...data].sort((a, b) => a.name.localeCompare(b.name, 'ru')),
        )
        setLoading(false)
      },
      () => setLoading(false),
    )
    return unsubscribe
  }, [])

  async function createDepartment(input: DepartmentInput) {
    return createDocument('departments', {
      name: input.name.trim(),
      type: input.type,
      members: input.members || [],
    })
  }

  async function updateDepartment(id: string, data: Partial<Department>) {
    const { id: _id, ...rest } = data as Department
    void _id
    await updateDocument('departments', id, rest as Record<string, unknown>)
  }

  async function deleteDepartment(id: string) {
    await removeDocument('departments', id)
  }

  async function addMember(deptId: string, member: DepartmentMember) {
    const dept = departments.find((d) => d.id === deptId)
    if (!dept) throw new Error('Department not found')
    const members = [...(dept.members || []), member]
    await updateDocument('departments', deptId, { members })
  }

  async function updateMember(
    deptId: string,
    memberId: string,
    data: { name: string },
  ) {
    const dept = departments.find((d) => d.id === deptId)
    if (!dept) throw new Error('Department not found')
    const name = data.name.trim()
    if (!name) throw new Error('Укажите ФИО')
    const members = (dept.members || []).map((m) =>
      m.id === memberId ? { ...m, name } : m,
    )
    await updateDocument('departments', deptId, { members })
    await syncClientsForMember(memberId, { salesManagerName: name })
  }

  async function moveMember(fromDeptId: string, toDeptId: string, memberId: string) {
    if (fromDeptId === toDeptId) return
    const from = departments.find((d) => d.id === fromDeptId)
    const to = departments.find((d) => d.id === toDeptId)
    if (!from || !to) throw new Error('Department not found')
    const member = (from.members || []).find((m) => m.id === memberId)
    if (!member) throw new Error('Member not found')
    await updateDocument('departments', fromDeptId, {
      members: (from.members || []).filter((m) => m.id !== memberId),
    })
    await updateDocument('departments', toDeptId, {
      members: [...(to.members || []), member],
    })
    await syncClientsForMember(memberId, {
      salesDepartment: to.id,
      salesDepartmentName: to.name,
    })
  }

  async function removeMember(deptId: string, memberId: string) {
    const dept = departments.find((d) => d.id === deptId)
    if (!dept) throw new Error('Department not found')
    const members = (dept.members || []).filter((m) => m.id !== memberId)
    await updateDocument('departments', deptId, { members })
  }

  return {
    departments,
    loading,
    createDepartment,
    updateDepartment,
    deleteDepartment,
    addMember,
    updateMember,
    moveMember,
    removeMember,
  }
}
