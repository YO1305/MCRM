/** Fabric hang-tag / label for print — горизонтально 7×5 см. */
export interface FabricLabel {
  id: string
  /** Название ткани / Fabric name */
  name: string
  /** Отделка 1 / Finish 1 */
  finish1: string
  /** Отделка 2 — необязательно */
  finish2: string
  /** Код — необязательно; если пусто — не печатается */
  code: string
  /** Ширина (число или с единицей) */
  width: string
  /** Плотность (число или с единицей) */
  density: string
  /** Состав */
  composition: string
}

export type LabelLocale = 'ru' | 'en'

export const LABEL_MANUFACTURER_RU = 'ООО "Ургенч Бахмал"'
export const LABEL_MANUFACTURER_EN = 'Urgench Bahmal LLC'

/** @deprecated use LABEL_MANUFACTURER_RU */
export const LABEL_MANUFACTURER = LABEL_MANUFACTURER_RU

/** Горизонтальная бирка: ширина 7 см × высота 5 см */
export const LABEL_WIDTH_MM = 70
export const LABEL_HEIGHT_MM = 50

export interface LabelUiCopy {
  pageTitle: string
  pageHint: string
  add: string
  pdf: string
  bulkAdd: string
  clearEmpty: string
  labelN: (n: number) => string
  duplicate: string
  remove: string
  name: string
  namePh: string
  finish1: string
  finish1Ph: string
  finish2: string
  finish2Ph: string
  code: string
  codePh: string
  width: string
  widthPh: string
  density: string
  densityPh: string
  composition: string
  compositionPh: string
  unitsHint: string
  moreLabel: string
  downloadPdf: (count: number) => string
  langRu: string
  langEn: string
  fillHint: string
}

export interface LabelPdfCopy {
  code: string
  width: string
  density: string
  densityUnit: string
  composition: string
  manufacturer: string
  manufacturerName: string
  widthUnit: string
}

export const LABEL_UI: Record<LabelLocale, LabelUiCopy> = {
  ru: {
    pageTitle: 'Печать бирок',
    pageHint:
      'Макет горизонтальный 7×5 см, без рамки. Текст сам подстраивается под бирку. Код и вторая отделка — только если заполнены.',
    add: 'Добавить',
    pdf: 'PDF',
    bulkAdd: 'Массово добавить пустые строки:',
    clearEmpty: 'Убрать пустые',
    labelN: (n) => `Бирка ${n}`,
    duplicate: 'Дублировать',
    remove: 'Удалить',
    name: 'Название ткани *',
    namePh: 'Например: Сатин премиум',
    finish1: 'Отделка 1',
    finish1Ph: 'Крашение',
    finish2: 'Отделка 2 (необяз.)',
    finish2Ph: 'Мерсеризация',
    code: 'Код (необяз.)',
    codePh: 'Если пусто — на бирке не будет',
    width: 'Ширина',
    widthPh: '220',
    density: 'Плотность',
    densityPh: '110',
    composition: 'Состав',
    compositionPh: '100% хлопок',
    unitsHint: 'На PDF: Ширина → «см», Плотность → «гр/м²». Производитель всегда внизу.',
    moreLabel: 'Ещё бирка',
    downloadPdf: (count) => `Скачать PDF · ${count} шт · 7×5 см`,
    langRu: 'Русский',
    langEn: 'English',
    fillHint: 'Заполняйте поля на выбранном языке — так же будет на бирке.',
  },
  en: {
    pageTitle: 'Label printing',
    pageHint:
      'Horizontal layout 7×5 cm, no border. Text auto-fits. Code and second finish print only if filled.',
    add: 'Add',
    pdf: 'PDF',
    bulkAdd: 'Bulk add empty rows:',
    clearEmpty: 'Remove empty',
    labelN: (n) => `Label ${n}`,
    duplicate: 'Duplicate',
    remove: 'Delete',
    name: 'Fabric name *',
    namePh: 'e.g. Premium satin',
    finish1: 'Finish 1',
    finish1Ph: 'Dyeing',
    finish2: 'Finish 2 (optional)',
    finish2Ph: 'Mercerizing',
    code: 'Code (optional)',
    codePh: 'Leave empty to hide on label',
    width: 'Width',
    widthPh: '220',
    density: 'Density',
    densityPh: '110',
    composition: 'Composition',
    compositionPh: '100% cotton',
    unitsHint: 'On PDF: Width → “cm”, Density → “g/m²”. Manufacturer always at the bottom.',
    moreLabel: 'Add another label',
    downloadPdf: (count) => `Download PDF · ${count} pcs · 7×5 cm`,
    langRu: 'Русский',
    langEn: 'English',
    fillHint: 'Fill all fields in English — the printed label will be in English.',
  },
}

export const LABEL_PDF: Record<LabelLocale, LabelPdfCopy> = {
  ru: {
    code: 'Код',
    width: 'Ширина',
    density: 'Плотность',
    densityUnit: 'гр/м',
    composition: 'Состав',
    manufacturer: 'Производитель',
    manufacturerName: LABEL_MANUFACTURER_RU,
    widthUnit: 'см',
  },
  en: {
    code: 'Code',
    width: 'Width',
    density: 'Density',
    densityUnit: 'g/m',
    composition: 'Composition',
    manufacturer: 'Manufacturer',
    manufacturerName: LABEL_MANUFACTURER_EN,
    widthUnit: 'cm',
  },
}

export function emptyLabel(): FabricLabel {
  return {
    id: crypto.randomUUID(),
    name: '',
    finish1: '',
    finish2: '',
    code: '',
    width: '',
    density: '',
    composition: '',
  }
}

export function isLabelFilled(label: FabricLabel): boolean {
  return Boolean(
    label.name.trim() ||
      label.finish1.trim() ||
      label.finish2.trim() ||
      label.code.trim() ||
      label.width.trim() ||
      label.density.trim() ||
      label.composition.trim(),
  )
}

export function isLabelReady(label: FabricLabel): boolean {
  return Boolean(label.name.trim())
}
