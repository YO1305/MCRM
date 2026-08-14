import { jsPDF } from 'jspdf'
import type { FabricLabel, LabelLocale } from '@/types/label.types'
import {
  LABEL_HEIGHT_MM,
  LABEL_PDF,
  LABEL_WIDTH_MM,
  isLabelReady,
} from '@/types/label.types'

/** ~300 DPI. Горизонтально: 70×50 мм. */
const DPI = 300
const PX_W = Math.round((LABEL_WIDTH_MM / 25.4) * DPI)
const PX_H = Math.round((LABEL_HEIGHT_MM / 25.4) * DPI)
const FONT = 'Arial, "Segoe UI", sans-serif'

function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
): string[] {
  const words = text.trim().split(/\s+/)
  if (words.length === 0 || !text.trim()) return []
  const lines: string[] = []
  let line = words[0]
  for (let i = 1; i < words.length; i++) {
    const test = `${line} ${words[i]}`
    if (ctx.measureText(test).width <= maxWidth) {
      line = test
    } else {
      lines.push(line)
      line = words[i]
    }
  }
  lines.push(line)
  return lines
}

function fitFontSize(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  preferred: number,
  min: number,
  weight: '400' | '700',
): number {
  let size = preferred
  while (size > min) {
    ctx.font = `${weight} ${size}px ${FONT}`
    if (ctx.measureText(text).width <= maxWidth) return size
    size -= 1
  }
  return min
}

function formatWidth(raw: string, locale: LabelLocale): string {
  const copy = LABEL_PDF[locale]
  const v = raw.trim()
  if (!v) return ''
  if (/см|mm|мм|cm/i.test(v)) return v
  return `${v} ${copy.widthUnit}`
}

function densityNumber(raw: string): string {
  const v = raw.trim()
  if (!v) return ''
  return (
    v
      .replace(/\s*(гр|г|g)\s*\/?\s*m\s*²?/gi, '')
      .replace(/\s*(гр|г)\s*\/?\s*м\s*²?/gi, '')
      .trim() || v
  )
}

type BodyItem =
  | { kind: 'text'; text: string }
  | { kind: 'density'; num: string }

function collectBody(label: FabricLabel, locale: LabelLocale): BodyItem[] {
  const copy = LABEL_PDF[locale]
  const items: BodyItem[] = []
  const code = label.code.trim()
  if (code) items.push({ kind: 'text', text: `${copy.code}: ${code}` })

  const width = formatWidth(label.width, locale)
  if (width) items.push({ kind: 'text', text: `${copy.width}: ${width}` })

  const densRaw = label.density.trim()
  if (densRaw) items.push({ kind: 'density', num: densityNumber(densRaw) })

  const composition = label.composition.trim()
  if (composition) items.push({ kind: 'text', text: `${copy.composition}: ${composition}` })

  return items
}

interface LayoutSizes {
  name: number
  finish: number
  body: number
  manuf: number
  gapAfterName: number
  gapAfterFinish: number
  gapBeforeManuf: number
  nameLh: number
  finishLh: number
  bodyLh: number
  manufLh: number
}

function measureLayout(
  ctx: CanvasRenderingContext2D,
  label: FabricLabel,
  locale: LabelLocale,
  contentW: number,
  sizes: LayoutSizes,
): { height: number; nameLines: string[]; finishLines: string[]; manufLines: string[] } {
  const copy = LABEL_PDF[locale]
  const finishes = [label.finish1, label.finish2].map((f) => f.trim()).filter(Boolean)
  const body = collectBody(label, locale)

  ctx.font = `700 ${sizes.name}px ${FONT}`
  const nameLines = wrapText(ctx, label.name.trim().toUpperCase(), contentW).slice(0, 2)

  ctx.font = `400 ${sizes.finish}px ${FONT}`
  const finishLines: string[] = []
  for (const f of finishes) {
    finishLines.push(...wrapText(ctx, f, contentW).slice(0, 1))
  }

  ctx.font = `400 ${sizes.manuf}px ${FONT}`
  const manufLines = wrapText(
    ctx,
    `${copy.manufacturer}: ${copy.manufacturerName}`,
    contentW,
  )

  let h = 0
  h += nameLines.length * sizes.nameLh
  if (finishLines.length > 0) {
    h += sizes.gapAfterName
    h += finishLines.length * sizes.finishLh
  }
  if (body.length > 0) {
    h += sizes.gapAfterFinish
    ctx.font = `400 ${sizes.body}px ${FONT}`
    for (const item of body) {
      if (item.kind === 'density') {
        h += sizes.bodyLh
      } else {
        const lines = wrapText(ctx, item.text, contentW)
        h += Math.min(lines.length, 2) * sizes.bodyLh
      }
    }
  }
  h += sizes.gapBeforeManuf
  h += manufLines.length * sizes.manufLh

  return { height: h, nameLines, finishLines, manufLines }
}

function drawLabel(label: FabricLabel, locale: LabelLocale): HTMLCanvasElement {
  const canvas = document.createElement('canvas')
  canvas.width = PX_W
  canvas.height = PX_H
  const raw = canvas.getContext('2d')
  if (!raw) throw new Error('Canvas unavailable')
  const ctx: CanvasRenderingContext2D = raw
  const copy = LABEL_PDF[locale]

  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, PX_W, PX_H)

  const padX = Math.round(PX_W * 0.06)
  const padY = Math.round(PX_H * 0.06)
  const contentW = PX_W - padX * 2
  const availH = PX_H - padY * 2

  const body = collectBody(label, locale)
  const nameRaw = label.name.trim().toUpperCase()

  const nameSize = fitFontSize(
    ctx,
    nameRaw,
    contentW,
    Math.round(PX_H * 0.15),
    Math.round(PX_H * 0.08),
    '700',
  )

  let sizes: LayoutSizes = {
    name: nameSize,
    finish: Math.round(PX_H * 0.09),
    body: Math.round(PX_H * 0.082),
    manuf: Math.round(PX_H * 0.06),
    gapAfterName: Math.round(PX_H * 0.028),
    gapAfterFinish: Math.round(PX_H * 0.055),
    gapBeforeManuf: Math.round(PX_H * 0.045),
    nameLh: 0,
    finishLh: 0,
    bodyLh: 0,
    manufLh: 0,
  }
  sizes.nameLh = sizes.name * 1.12
  sizes.finishLh = sizes.finish * 1.18
  sizes.bodyLh = sizes.body * 1.32
  sizes.manufLh = sizes.manuf * 1.22

  let measured = measureLayout(ctx, label, locale, contentW, sizes)

  if (measured.height > availH) {
    const scale = Math.max(0.55, availH / measured.height)
    sizes = {
      name: Math.max(11, Math.round(sizes.name * scale)),
      finish: Math.max(9, Math.round(sizes.finish * scale)),
      body: Math.max(9, Math.round(sizes.body * scale)),
      manuf: Math.max(8, Math.round(sizes.manuf * scale)),
      gapAfterName: Math.max(3, Math.round(sizes.gapAfterName * scale)),
      gapAfterFinish: Math.max(5, Math.round(sizes.gapAfterFinish * scale)),
      gapBeforeManuf: Math.max(4, Math.round(sizes.gapBeforeManuf * scale)),
      nameLh: 0,
      finishLh: 0,
      bodyLh: 0,
      manufLh: 0,
    }
    sizes.nameLh = sizes.name * 1.12
    sizes.finishLh = sizes.finish * 1.18
    sizes.bodyLh = sizes.body * 1.32
    sizes.manufLh = sizes.manuf * 1.22
    measured = measureLayout(ctx, label, locale, contentW, sizes)
  }

  if (measured.height > availH) {
    const overflow = measured.height - availH
    const cut = overflow / 3
    sizes.gapAfterName = Math.max(2, sizes.gapAfterName - cut)
    sizes.gapAfterFinish = Math.max(3, sizes.gapAfterFinish - cut)
    sizes.gapBeforeManuf = Math.max(3, sizes.gapBeforeManuf - cut)
    measured = measureLayout(ctx, label, locale, contentW, sizes)
  }

  let y = padY + Math.max(0, (availH - measured.height) / 2) + sizes.name * 0.82

  ctx.fillStyle = '#111111'
  ctx.textBaseline = 'alphabetic'
  ctx.textAlign = 'center'
  ctx.font = `700 ${sizes.name}px ${FONT}`
  for (const line of measured.nameLines) {
    ctx.fillText(line, PX_W / 2, y)
    y += sizes.nameLh
  }

  if (measured.finishLines.length > 0) {
    y += sizes.gapAfterName - sizes.nameLh * 0.12
    ctx.font = `400 ${sizes.finish}px ${FONT}`
    for (const line of measured.finishLines) {
      ctx.fillText(line, PX_W / 2, y)
      y += sizes.finishLh
    }
  }

  if (body.length > 0) {
    y += sizes.gapAfterFinish
    ctx.textAlign = 'left'
    ctx.font = `400 ${sizes.body}px ${FONT}`

    for (const item of body) {
      if (item.kind === 'density') {
        const prefix = `${copy.density}: ${item.num} ${copy.densityUnit}`
        ctx.fillText(prefix, padX, y)
        const prefixW = ctx.measureText(prefix).width
        const supSize = Math.max(7, Math.round(sizes.body * 0.62))
        ctx.font = `400 ${supSize}px ${FONT}`
        ctx.fillText('2', padX + prefixW + 1, y - Math.round(sizes.body * 0.32))
        ctx.font = `400 ${sizes.body}px ${FONT}`
        y += sizes.bodyLh
      } else {
        for (const line of wrapText(ctx, item.text, contentW).slice(0, 2)) {
          ctx.fillText(line, padX, y)
          y += sizes.bodyLh
        }
      }
    }
  }

  y += sizes.gapBeforeManuf
  ctx.textAlign = 'center'
  ctx.font = `400 ${sizes.manuf}px ${FONT}`
  for (const line of measured.manufLines) {
    ctx.fillText(line, PX_W / 2, y)
    y += sizes.manufLh
  }

  return canvas
}

/** Одна бирка = страница 70×50 мм (горизонтально: верх/низ 7 см, бока 5 см). */
export async function downloadLabelsPdf(
  labels: FabricLabel[],
  filename = 'birki-bahmal.pdf',
  locale: LabelLocale = 'ru',
) {
  const ready = labels.filter(isLabelReady)
  if (ready.length === 0) {
    throw new Error(
      locale === 'en'
        ? 'Add at least one label with a fabric name'
        : 'Добавьте хотя бы одну бирку с названием',
    )
  }

  const pdf = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: [LABEL_WIDTH_MM, LABEL_HEIGHT_MM],
    compress: true,
  })

  const pageW = pdf.internal.pageSize.getWidth()
  const pageH = pdf.internal.pageSize.getHeight()
  if (Math.abs(pageW - LABEL_WIDTH_MM) > 1 || Math.abs(pageH - LABEL_HEIGHT_MM) > 1) {
    const pdfFix = new jsPDF({
      orientation: 'l',
      unit: 'mm',
      format: [LABEL_HEIGHT_MM, LABEL_WIDTH_MM],
      compress: true,
    })
    ready.forEach((label, index) => {
      if (index > 0) pdfFix.addPage([LABEL_HEIGHT_MM, LABEL_WIDTH_MM], 'l')
      const canvas = drawLabel(label, locale)
      pdfFix.addImage(
        canvas.toDataURL('image/png'),
        'PNG',
        0,
        0,
        LABEL_WIDTH_MM,
        LABEL_HEIGHT_MM,
      )
    })
    pdfFix.save(filename)
    return
  }

  ready.forEach((label, index) => {
    if (index > 0) pdf.addPage([LABEL_WIDTH_MM, LABEL_HEIGHT_MM], 'landscape')
    const canvas = drawLabel(label, locale)
    pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 0, 0, LABEL_WIDTH_MM, LABEL_HEIGHT_MM)
  })

  pdf.save(filename)
}
