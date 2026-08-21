interface PdfViewerProps {
  url: string
  title?: string
}

/** Embedded PDF. iframe is more reliable with Firebase Storage than react-pdf + worker. */
export function PdfViewer({ url, title }: PdfViewerProps) {
  const src = `${url}#view=FitH`
  return (
    <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
      <iframe title={title || 'Каталог PDF'} src={src} className="h-[75vh] w-full min-h-[480px]" />
      <div className="border-t border-gray-100 px-3 py-2 text-center">
        <a
          href={url}
          target="_blank"
          rel="noreferrer"
          className="text-sm font-medium text-secondary hover:underline"
        >
          Открыть PDF в новой вкладке
        </a>
      </div>
    </div>
  )
}
