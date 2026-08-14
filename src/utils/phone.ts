/** Keep digits only for phone matching. */
export function normalizePhone(phone: string): string {
  return (phone || '').replace(/\D/g, '')
}
