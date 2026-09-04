/**
 * Exportación a Excel con AG Grid Enterprise.
 *
 * - Respeta filtro, búsqueda y orden de cada vista (lo que se ve es lo que se exporta).
 * - Incluye TODAS las columnas, también las ocultas en pantalla: el Excel es para cuadrar,
 *   y ahí se necesita el folio fiscal, RFC, tipo y método de pago aunque en pantalla estorben.
 * - Dos hojas: "Conceptos" (una fila por renglón) y "Facturas" (una fila por comprobante).
 * - Fechas como fecha real de Excel y montos como número con formato #,##0.00.
 */

// Umami custom event helper (no-op si Umami no está cargado)
function track(event, data = {}) {
  try { window.umami?.track?.(event, data) } catch { /* ignore */ }
}

const pad = (n) => String(n).padStart(2, '0')
const localIso = (d) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`

function sheetParams(sheetName, uuids) {
  return {
    sheetName,
    allColumns: true,
    skipPinnedBottom: true,
    skipColumnGroupHeaders: true,
    headerRowHeight: 22,
    // Ambas hojas se limitan a las facturas visibles en la pestaña activa,
    // para que "Conceptos" y "Facturas" cuadren entre sí.
    shouldRowBeSkipped: uuids ? ({ node }) => !!node.data && !uuids.has(node.data.UUID) : undefined,
    processCellCallback: ({ column, value }) => {
      const ctx = column.getColDef().context || {}
      if (value == null) return ''
      if (value instanceof Date) return localIso(value)
      if (ctx.excel === 'money' || ctx.excel === 'number') return value === '' ? '' : Number(value)
      return String(value)
    },
  }
}

export function ensureXlsx(name) {
  const clean = (name || '').trim() || 'CFDI'
  return clean.toLowerCase().endsWith('.xlsx') ? clean : `${clean}.xlsx`
}

/**
 * Genera el archivo con las dos hojas.
 * Devuelve { fileName, filas: { conceptos, facturas }, shared } o lanza si el grid no está listo.
 */
export async function exportExcel({ conceptosApi, facturasApi, filename, activeTab = 'conceptos', share = false }) {
  if (!conceptosApi || !facturasApi) throw new Error('La tabla no está lista')
  const fileName = ensureXlsx(filename)

  // Facturas visibles en la pestaña activa: define el alcance de las dos hojas
  const activeApi = activeTab === 'facturas' ? facturasApi : conceptosApi
  const uuids = new Set()
  activeApi.forEachNodeAfterFilter(node => { if (!node.group && node.data?.UUID) uuids.add(node.data.UUID) })

  const conceptosRows = countVisible(conceptosApi, uuids)
  const facturasRows  = countVisible(facturasApi, uuids)

  const sheets = [
    conceptosApi.getSheetDataForExcel(sheetParams('Conceptos', uuids)),
    facturasApi.getSheetDataForExcel(sheetParams('Facturas', uuids)),
  ].filter(Boolean)

  let shared = false
  if (share && typeof navigator !== 'undefined' && navigator.canShare) {
    // Celular: ofrecer "Compartir" (WhatsApp, correo) en lugar de una descarga que no se ve
    const blob = conceptosApi.getMultipleSheetsAsExcel({ data: sheets, fileName })
    const file = new File([blob], fileName, { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
    if (navigator.canShare({ files: [file] })) {
      try { await navigator.share({ files: [file], title: fileName }); shared = true } catch { shared = false }
    }
  }
  if (!shared) conceptosApi.exportMultipleSheetsAsExcel({ data: sheets, fileName })

  const bucket = conceptosRows <= 10 ? '1-10' : conceptosRows <= 50 ? '11-50' : conceptosRows <= 200 ? '51-200' : '201+'
  track('download_xlsx', { rows: conceptosRows, bucket, shared })

  return { fileName, filas: { conceptos: conceptosRows, facturas: facturasRows }, shared }
}

function countVisible(api, uuids) {
  let n = 0
  api.forEachNodeAfterFilter(node => { if (!node.group && node.data && uuids.has(node.data.UUID)) n++ })
  return n
}
