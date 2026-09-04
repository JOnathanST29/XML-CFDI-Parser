/**
 * Definiciones de columnas para las dos vistas (conceptos y facturas).
 *
 * Convenciones en colDef.context:
 *   sum: true        → se suma en la fila de totales y en el Excel
 *   excel: 'money' | 'number' | 'date' | 'text'  → formato en el Excel exportado
 *
 * Columnas con hide: true no se ven por default pero SIEMPRE se exportan
 * (los contadores necesitan el Excel completo aunque en pantalla vean menos).
 */
import SetFilter from './SetFilter'
import { nombreMetodo, nombreForma, nombreUso, nombreTipo } from './catalogos'

export const fmtMoney = (v) => {
  if (v == null || v === '') return ''
  const n = Number(v)
  const abs = Math.abs(n).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  return n < 0 ? `-$${abs}` : `$${abs}`
}
export const fmtNumber = (v) =>
  v == null || v === '' ? '' : Number(v).toLocaleString('es-MX', { maximumFractionDigits: 4 })
export const fmtDate = (v) => {
  if (!v) return ''
  const d = v instanceof Date ? v : new Date(v)
  if (isNaN(d)) return String(v)
  // Hora local, nunca toISOString (desfase UTC)
  const p = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

const money = (field, headerName, extra = {}) => {
  const col = {
    field, headerName, width: 130, type: 'numericColumn',
    filterParams: { kind: 'number', format: fmtMoney },
    valueFormatter: p => fmtMoney(p.value),
    cellEditor: 'agNumberCellEditor', cellEditorParams: { precision: 2 },
    cellClass: 'xl-money',
    context: { sum: true, excel: 'money' },
    ...extra,
  }
  // Al agrupar por proveedor/cliente (arrastrando un encabezado), las columnas que se suman muestran su suma
  if (col.context?.sum) col.aggFunc = 'sum'
  return col
}
const text = (field, headerName, extra = {}) => ({ field, headerName, enableRowGroup: true, context: { excel: 'text' }, ...extra })
const date = (field, headerName, extra = {}) => ({
  field, headerName, width: 115, editable: false,
  filterParams: { kind: 'date' },
  valueFormatter: p => fmtDate(p.value),
  cellClass: 'xl-date',
  context: { excel: 'date' },
  ...extra,
})

const tipoCol = {
  field: 'TIPO', headerName: 'Tipo', width: 105, editable: false, enableRowGroup: true,
  valueFormatter: p => nombreTipo(p.value),
  filterParams: { kind: 'text', format: nombreTipo },
  cellClassRules: {
    'cell-tipo-egreso': p => p.value === 'E',
    'cell-tipo-otro':   p => p.value === 'N' || p.value === 'P' || p.value === 'T',
  },
  headerTooltip: 'Tipo de comprobante: Ingreso (factura), Egreso (nota de crédito), Nómina, Pago, Traslado',
  context: { excel: 'text' },
}
const uuidCol = text('UUID', 'Folio fiscal (UUID)', {
  width: 300, editable: false,
  cellStyle: { fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: 12 },
  headerTooltip: 'Identificador único del comprobante asignado por el SAT al timbrar',
})
const receptorCols = [
  text('RECEPTOR', 'Receptor', { minWidth: 180, flex: 2, hide: true, headerTooltip: 'A quién se emite la factura. Si son tus compras, eres tú' }),
  text('RFC_RECEPTOR', 'RFC Receptor', { width: 140 }),
  text('USO_CFDI', 'Uso CFDI', { width: 200, hide: true, valueFormatter: p => nombreUso(p.value), filterParams: { kind: 'text', format: nombreUso } }),
]
const pagoCols = [
  text('MONEDA', 'Moneda', { width: 95, editable: false }),
  { field: 'TIPO_CAMBIO', headerName: 'Tipo de cambio', width: 120, hide: true, type: 'numericColumn', editable: false,
    valueFormatter: p => (p.value == null ? '' : fmtNumber(p.value)), filterParams: { kind: 'number', format: fmtNumber }, context: { excel: 'number' } },
  text('METODO_PAGO', 'Método de pago', { width: 120, hide: true, valueFormatter: p => (p.value ? p.value : ''), headerTooltip: 'PUE: pago en una exhibición · PPD: en parcialidades o diferido', filterParams: { kind: 'text', format: nombreMetodo } }),
  text('FORMA_PAGO', 'Forma de pago', { width: 200, hide: true, valueFormatter: p => nombreForma(p.value), filterParams: { kind: 'text', format: nombreForma } }),
]

/** Columnas de impuestos dinámicas (una por impuesto/tasa presente en los XML). */
const taxCols = (taxColumns) =>
  taxColumns.map(t => money(t.key, t.label, {
    width: 120,
    hide: !!t.local, // los locales (ISH, cedulares) van ocultos por default; se activan en "Columnas"
    editable: false,
    headerTooltip: t.kind === 'ret' ? `Impuesto retenido: ${t.label}` : `Impuesto trasladado: ${t.label}`,
  }))

/** Vista por concepto: una fila por renglón de factura. */
export function conceptoColumns(taxColumns) {
  return [
    { headerName: 'Factura', marryChildren: true, children: [
      { ...tipoCol, width: 95 },
      text('FACTURA', 'Factura', { width: 100 }),
      date('FECHA', 'Fecha', { width: 105 }),
      text('EMISOR', 'Emisor', { minWidth: 180, flex: 2, headerTooltip: 'Quien emite la factura. Si son tus compras, es tu proveedor' }),
    ]},
    { headerName: 'Concepto', marryChildren: true, children: [
      { field: 'NUM_CONCEPTO', headerName: '#', width: 60, hide: true, editable: false, type: 'numericColumn', context: { excel: 'number' } },
      text('CLAVE_PROD_SERV', 'Clave SAT', { width: 110, hide: true, headerTooltip: 'ClaveProdServ del catálogo del SAT' }),
      text('CODIGO_PRODUCTO', 'Código', { width: 100, hide: true, headerTooltip: 'NoIdentificacion: código interno que pone el emisor' }),
      text('PRODUCTO', 'Producto / servicio', { minWidth: 200, flex: 3 }),
      { field: 'CANTIDAD', headerName: 'Cantidad', width: 95, type: 'numericColumn',
        valueFormatter: p => fmtNumber(p.value), filterParams: { kind: 'number', format: fmtNumber },
        cellEditor: 'agNumberCellEditor', context: { sum: true, excel: 'number' } },
      text('UNIDAD', 'Unidad', { width: 85, editable: false }),
      money('VALOR_UNITARIO', 'Precio unitario', { hide: true, editable: false, context: { excel: 'money' } }),
      money('IMPORTE', 'Importe (sin impuestos)', { width: 145, headerTooltip: 'Cantidad × precio unitario, antes de impuestos y descuentos' }),
      money('DESCUENTO_CONCEPTO', 'Descuento', { hide: true, editable: false }),
      ...taxCols(taxColumns).map(c => ({ ...c, width: 110 })),
      money('IMPORTE_CON_IMPUESTOS', 'Importe con impuestos', { width: 150, editable: false, headerTooltip: 'Importe − descuento + trasladados − retenidos, de este renglón' }),
    ]},
    { headerName: 'Totales de la factura', marryChildren: true, children: [
      money('SUBTOTAL', 'Subtotal', { hide: true, editable: false, context: { excel: 'money' } }),
      money('DESCUENTO', 'Descuento', { hide: true, editable: false, context: { excel: 'money' } }),
      money('IMPUESTOS_TRASLADADOS', 'Impuestos trasladados', { hide: true, editable: false, width: 150, context: { excel: 'money' } }),
      money('IMPUESTOS_RETENIDOS', 'Impuestos retenidos', { hide: true, editable: false, width: 150, context: { excel: 'money' } }),
      money('TOTAL', 'Total factura', { hide: true, editable: false, headerTooltip: 'Total del comprobante (con impuestos). Se repite en cada renglón de la misma factura; ver pestaña Facturas', context: { excel: 'money' } }),
      money('TOTAL_MXN', 'Total factura MXN', { hide: true, editable: false, width: 150, context: { excel: 'money' } }),
    ]},
    { headerName: 'Datos fiscales', marryChildren: true, children: [
      text('RFC_EMISOR', 'RFC Emisor', { width: 135 }),
      ...receptorCols,
      ...pagoCols,
      uuidCol,
      text('VERSION', 'Versión CFDI', { width: 100, hide: true, editable: false }),
      text('ARCHIVO', 'Archivo', { width: 220, hide: true, editable: false }),
    ]},
  ]
}

/** Vista por factura: una fila por comprobante. */
export function facturaColumns(taxColumns) {
  return [
    { headerName: 'Comprobante', marryChildren: true, children: [
      { ...tipoCol, width: 95 },
      text('FACTURA', 'Factura', { width: 100 }),
      date('FECHA', 'Fecha', { width: 105 }),
      date('FECHA_TIMBRADO', 'Fecha timbrado', { hide: true }),
      text('EMISOR', 'Emisor', { minWidth: 180, flex: 2, headerTooltip: 'Quien emite la factura. Si son tus compras, es tu proveedor' }),
      { field: 'NUM_CONCEPTOS', headerName: 'Conceptos', width: 95, hide: true, type: 'numericColumn', editable: false, context: { sum: true, excel: 'number' } },
    ]},
    { headerName: 'Importes', marryChildren: true, children: [
      money('SUBTOTAL', 'Subtotal', { editable: false }),
      money('DESCUENTO', 'Descuento', { hide: true, editable: false }),
      ...taxCols(taxColumns).map(c => ({ ...c, width: 115 })),
      money('IMPUESTOS_TRASLADADOS', 'Impuestos trasladados', { hide: true, editable: false, width: 150 }),
      money('IMPUESTOS_RETENIDOS', 'Impuestos retenidos', { hide: true, editable: false, width: 150 }),
      money('TOTAL', 'Total', { editable: false, headerTooltip: 'Total del comprobante en su moneda' }),
      money('TOTAL_MXN', 'Total MXN', { editable: false, headerTooltip: 'Total × tipo de cambio (igual al Total si la moneda es MXN)' }),
    ]},
    { headerName: 'Datos fiscales', marryChildren: true, children: [
      text('RFC_EMISOR', 'RFC Emisor', { width: 135 }),
      text('REGIMEN_EMISOR', 'Régimen emisor', { width: 110, hide: true }),
      ...receptorCols,
      ...pagoCols.map(c => (c.field === 'METODO_PAGO' ? { ...c, hide: false } : c)),
      text('LUGAR_EXPEDICION', 'Lugar expedición', { width: 110, hide: true }),
      uuidCol,
      text('VERSION', 'Versión CFDI', { width: 100, hide: true }),
      text('ARCHIVO', 'Archivo', { width: 220, hide: true }),
    ]},
    { headerName: 'Nómina', marryChildren: true, children: [
      money('NOMINA_PERCEPCIONES', 'Percepciones', { hide: true, editable: false }),
      money('NOMINA_DEDUCCIONES', 'Deducciones', { hide: true, editable: false }),
      money('NOMINA_ISR_RETENIDO', 'ISR retenido (nómina)', { hide: true, editable: false, width: 150 }),
    ]},
    { headerName: 'Complemento de pago', marryChildren: true, children: [
      money('PAGO_MONTO', 'Monto pagado', { hide: true, editable: false }),
      { field: 'PAGO_NUM_DOCTOS', headerName: 'Docs. pagados', width: 110, hide: true, editable: false, type: 'numericColumn', context: { excel: 'number' } },
      text('PAGO_DOCUMENTOS', 'Documentos pagados (UUID: importe)', { width: 320, hide: true, editable: false }),
    ]},
  ]
}

export const DEFAULT_COL_DEF = {
  sortable: true,
  resizable: true,
  editable: true,
  filter: SetFilter,
  filterParams: { kind: 'text' },
  floatingFilter: false,
  suppressHeaderMenuButton: true,
  enableCellChangeFlash: false,
  wrapHeaderText: false,
}

/** Recorre colDefs (con grupos) y devuelve la lista plana de columnas hoja. */
export function flatColumns(defs) {
  return defs.flatMap(d => (d.children ? flatColumns(d.children) : [d]))
}
