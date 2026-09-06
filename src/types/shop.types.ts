export interface ShopManager {
  name: string
  phone: string
}

export interface Shop {
  id: string
  name: string
  locationUrl: string
  managers: ShopManager[]
  createdBy: string
  createdByName: string
  createdAt?: unknown
  updatedAt?: unknown
}

export interface ShopInput {
  name: string
  locationUrl: string
  managers: ShopManager[]
}

export interface ShopSaleLine {
  article: string
  name: string
  qty: number
  unitCost: number
  sales: number
  cost: number
  margin: number
}

export interface ShopSalesDay {
  id: string
  shopId: string
  date: string
  lines: ShopSaleLine[]
  qty: number
  cost: number
  sales: number
  margin: number
  uploadedBy: string
  uploadedByName: string
  fileName: string
  createdAt?: unknown
  updatedAt?: unknown
}

export type AbcClass = 'A' | 'B' | 'C'

export interface ShopAbcRow {
  article: string
  name: string
  qty: number
  sales: number
  cost: number
  margin: number
  share: number
  abc: AbcClass
}

export type ShopPeriodMode = 'day' | 'month' | 'range'

export interface ShopPeriod {
  mode: ShopPeriodMode
  day: string
  month: string
  from: string
  to: string
}

export interface ShopStockLine {
  article: string
  name: string
  qty: number
  unitCost: number
  salePrice: number
  cost: number
  saleValue: number
  margin: number
}

export interface ShopStock {
  id: string
  shopId: string
  lines: ShopStockLine[]
  qty: number
  cost: number
  saleValue: number
  margin: number
  uploadedBy: string
  uploadedByName: string
  fileName: string
  createdAt?: unknown
  updatedAt?: unknown
}
