import * as XLSX from 'xlsx'

const COLUMNS = ['EMISOR','RFC_EMISOR','FECHA','FACTURA','RECEPTOR','RFC_RECEPTOR','CODIGO_PRODUCTO','PRODUCTO','CANTIDAD','TOTAL','DOCUMENTO']

// Umami custom event helper (no-op si Umami no está cargado)
function track(event, data = {}) {
  try {
    if (typeof window !== 'undefined' && window.umami?.track) {
      window.umami.track(event, data)
    }
  } catch { /* ignore */ }
}

export function exportToExcel(rows, filename = 'COMPRAS_CFDI.xlsx') {
  if (!filename.toLowerCase().endsWith('.xlsx')) filename += '.xlsx'
  const data = rows.map(r => ({
    ...r,
    FECHA: r.FECHA instanceof Date
      ? r.FECHA.toISOString().slice(0, 10)
      : (r.FECHA || ''),
  }))

  const ws = XLSX.utils.json_to_sheet(data, { header: COLUMNS })
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'COMPRAS_CFDI')
  XLSX.writeFile(wb, filename)

  // Tracking: cuántas filas exportó (orden de magnitud, no PII)
  const bucket =
    rows.length <= 10  ? '1-10'   :
    rows.length <= 50  ? '11-50'  :
    rows.length <= 200 ? '51-200' :
                         '201+'
  track('download_xlsx', { rows: rows.length, bucket })
}
