export type DepartmentType = 'fabric' | 'finished' | 'export' | 'other'

export interface DepartmentMember {
  id: string
  name: string
  phone?: string
  email?: string
}

export interface Department {
  id: string
  name: string
  type: DepartmentType
  members: DepartmentMember[]
  createdAt?: unknown
  updatedAt?: unknown
}

export interface DepartmentInput {
  name: string
  type: DepartmentType
  members?: DepartmentMember[]
}

export const DEPARTMENT_TYPE_LABELS: Record<DepartmentType, string> = {
  fabric: 'Ткань',
  finished: 'ГП',
  export: 'Экспорт',
  other: 'Другое',
}
