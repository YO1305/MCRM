const RU_TO_EN: Record<string, string> = {
  а: 'a',
  б: 'b',
  в: 'v',
  г: 'g',
  д: 'd',
  е: 'e',
  ё: 'yo',
  ж: 'zh',
  з: 'z',
  и: 'i',
  й: 'y',
  к: 'k',
  л: 'l',
  м: 'm',
  н: 'n',
  о: 'o',
  п: 'p',
  р: 'r',
  с: 's',
  т: 't',
  у: 'u',
  ф: 'f',
  х: 'h',
  ц: 'ts',
  ч: 'ch',
  ш: 'sh',
  щ: 'sch',
  ъ: '',
  ы: 'y',
  ь: '',
  э: 'e',
  ю: 'yu',
  я: 'ya',
}

export function generateSlug(title: string): string {
  const base = title
    .toLowerCase()
    .split('')
    .map((ch) => RU_TO_EN[ch] || ch)
    .join('')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 50)
  const random = Math.random().toString(36).slice(2, 7)
  return `${base || 'catalogue'}-${random}`
}

export function cataloguePublicPath(slug: string): string {
  return `/c/${slug}`
}

export function cataloguePublicUrl(slug: string): string {
  if (typeof window !== 'undefined' && window.location?.origin) {
    return `${window.location.origin}/c/${slug}`
  }
  return `https://mcrm-ecru.vercel.app/c/${slug}`
}
