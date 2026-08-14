import { useEffect, useState } from 'react'
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
    removeMember,
  }
}
