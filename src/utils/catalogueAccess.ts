import type { Position } from '@/types/user.types'
import type { Catalogue, CatalogueType } from '@/types/catalogue.types'

export function canManageCatalogues(opts: {
  isAdmin: boolean
  position?: Position | null
}): boolean {
  if (opts.isAdmin) return true
  return (
    opts.position === 'designer' ||
    opts.position === 'head' ||
    opts.position === 'leads_manager_1' ||
    opts.position === 'leads_manager_2'
  )
}

export function canCreateGeneralCatalogue(opts: {
  isAdmin: boolean
  position?: Position | null
}): boolean {
  return opts.isAdmin || opts.position === 'designer' || opts.position === 'head'
}

export function canCreatePersonalKp(opts: {
  isAdmin: boolean
  position?: Position | null
}): boolean {
  return canManageCatalogues(opts)
}

export function canUpdateCatalogueExcel(opts: {
  isAdmin: boolean
  position?: Position | null
}): boolean {
  return opts.isAdmin || opts.position === 'designer' || opts.position === 'head'
}

export function canDeactivateCatalogue(opts: {
  isAdmin: boolean
  position?: Position | null
}): boolean {
  return opts.isAdmin || opts.position === 'head'
}

export function canDeleteCatalogue(opts: {
  isAdmin: boolean
  position?: Position | null
}): boolean {
  return opts.isAdmin || opts.position === 'head'
}

export function canCreateType(
  type: CatalogueType,
  opts: { isAdmin: boolean; position?: Position | null },
): boolean {
  return type === 'general' ? canCreateGeneralCatalogue(opts) : canCreatePersonalKp(opts)
}

export function catalogueKindLabel(c: Pick<Catalogue, 'type'>): string {
  return c.type === 'personal' ? 'Персональное КП' : 'Общий каталог'
}
