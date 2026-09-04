/**
 * Parser de CFDI (3.3 y 4.0) con todos los datos fiscales del comprobante.
 *
 * Devuelve dos vistas de los mismos datos:
 *  - conceptos: una fila por concepto (con los datos de cabecera repetidos)
 *  - facturas:  una fila por comprobante (UUID) con totales e impuestos por tipo y tasa
 *
 * Los impuestos son columnas dinámicas: se crea una por cada combinación
 * (traslado/retención, impuesto, tasa) que aparezca en los XML cargados.
 * Ver `taxColumns` en el resultado de parseFiles.
 */
import { IMPUESTO, nombreTipo } from './catalogos'

const NS = {
  cfdi4:   'http://www.sat.gob.mx/cfd/4',
  cfdi3:   'http://www.sat.gob.mx/cfd/3',
  tfd:     'http://www.sat.gob.mx/TimbreFiscalDigital',
  implocal:'http://www.sat.gob.mx/implocal',
  pago20:  'http://www.sat.gob.mx/Pagos20',
  pago10:  'http://www.sat.gob.mx/Pagos',
  nomina:  'http://www.sat.gob.mx/nomina12',
}

const num  = (v) => { const n = parseFloat(v); return Number.isFinite(n) ? n : 0 }
const numN = (v) => { if (v == null || v === '') return null; const n = parseFloat(v); return Number.isFinite(n) ? n : null }
const attr = (el, name) => (el ? el.getAttribute(name) : null)
const round2 = (n) => Math.round(n * 100) / 100

// Fecha del CFDI ("2026-01-15T19:30:00") se interpreta en hora local, sin desfase UTC.
function parseFecha(s) {
  if (!s) return null
  const m = /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2})(?::(\d{2}))?)?/.exec(s)
  if (!m) return null
  return new Date(+m[1], +m[2] - 1, +m[3], +(m[4] || 0), +(m[5] || 0), +(m[6] || 0))
}

/** Clave de columna y etiqueta para un impuesto trasladado/retenido. */
function taxKey(kind, impuesto, tipoFactor, tasa) {
  const nombre = IMPUESTO[impuesto] || impuesto || 'IMP'
  let tasaKey, tasaLabel
  // Retenciones: se agrupan solo por impuesto. A nivel comprobante el SAT no incluye la tasa,
  // y así la columna "Ret. ISR" coincide entre la vista de conceptos y la de facturas.
  if (kind === 'ret') { tasaKey = ''; tasaLabel = '' }
  else if (tipoFactor === 'Exento') { tasaKey = 'EXENTO'; tasaLabel = 'exento' }
  else if (tipoFactor === 'Cuota') { tasaKey = 'CUOTA'; tasaLabel = 'cuota' }
  else if (tasa == null) { tasaKey = 'X'; tasaLabel = '' }
  else {
    const pct = round2(tasa * 100)
    tasaKey = String(pct).replace('.', '_')
    tasaLabel = `${pct}%`
  }
  const prefix = kind === 'ret' ? 'RET' : 'TRAS'
  const key = tasaKey ? `${prefix}_${nombre}_${tasaKey}` : `${prefix}_${nombre}`
  const label = kind === 'ret'
    ? `Ret. ${nombre}${tasaLabel ? ' ' + tasaLabel : ''}`
    : `${nombre}${tasaLabel ? ' ' + tasaLabel : ''}`
  return { key, label, kind, impuesto: nombre, tasa: tasaLabel, base: kind === 'ret' ? 'retencion' : 'traslado' }
}

/**
 * Lee cfdi:Impuestos (de un concepto o del comprobante) y devuelve
 * { montos: {key: importe}, meta: {key: {label,...}}, trasladados, retenidos }
 */
function readImpuestos(impuestosEl, ns) {
  const montos = {}, meta = {}
  let trasladados = 0, retenidos = 0
  if (!impuestosEl) return { montos, meta, trasladados, retenidos }
  const add = (kind, el) => {
    const tipoFactor = attr(el, 'TipoFactor')
    const tasa = numN(attr(el, 'TasaOCuota'))
    const importe = num(attr(el, 'Importe'))
    const t = taxKey(kind, attr(el, 'Impuesto'), tipoFactor, tasa)
    montos[t.key] = round2((montos[t.key] || 0) + importe)
    meta[t.key] = t
    if (kind === 'ret') retenidos += importe; else trasladados += importe
  }
  // Solo hijos directos: el nodo Impuestos del comprobante no debe mezclar los de conceptos
  for (const child of impuestosEl.children) {
    if (child.namespaceURI !== ns) continue
    if (child.localName === 'Traslados')   for (const t of child.children) if (t.localName === 'Traslado')  add('tras', t)
    if (child.localName === 'Retenciones') for (const r of child.children) if (r.localName === 'Retencion') add('ret', r)
  }
  return { montos, meta, trasladados: round2(trasladados), retenidos: round2(retenidos) }
}

/** Impuestos locales (complemento implocal): ISH, cedulares, etc. */
function readImpuestosLocales(doc) {
  const montos = {}, meta = {}
  let trasladados = 0, retenidos = 0
  const el = doc.getElementsByTagNameNS(NS.implocal, 'ImpuestosLocales')[0]
  if (!el) return { montos, meta, trasladados, retenidos }
  const add = (kind, nombre, tasa, importe) => {
    const clean = (nombre || 'LOCAL').toUpperCase().replace(/[^A-Z0-9]+/g, '_').replace(/^_|_$/g, '')
    const key = `${kind === 'ret' ? 'RET' : 'TRAS'}_LOCAL_${clean}`
    const label = `${kind === 'ret' ? 'Ret. ' : ''}${nombre}${tasa != null ? ' ' + round2(tasa) + '%' : ''} (local)`
    montos[key] = round2((montos[key] || 0) + importe)
    meta[key] = { key, label, kind, impuesto: nombre, tasa: tasa != null ? `${round2(tasa)}%` : '', base: kind === 'ret' ? 'retencion' : 'traslado', local: true }
    if (kind === 'ret') retenidos += importe; else trasladados += importe
  }
  for (const t of el.getElementsByTagNameNS(NS.implocal, 'TrasladosLocales'))
    add('tras', attr(t, 'ImpLocTrasladado'), numN(attr(t, 'TasadeTraslado')), num(attr(t, 'Importe')))
  for (const r of el.getElementsByTagNameNS(NS.implocal, 'RetencionesLocales'))
    add('ret', attr(r, 'ImpLocRetenido'), numN(attr(r, 'TasadeRetencion')), num(attr(r, 'Importe')))
  return { montos, meta, trasladados: round2(trasladados), retenidos: round2(retenidos) }
}

/** Complemento de nómina: percepciones, deducciones, ISR retenido. */
function readNomina(doc) {
  const el = doc.getElementsByTagNameNS(NS.nomina, 'Nomina')[0]
  if (!el) return null
  let isr = 0
  for (const d of el.getElementsByTagNameNS(NS.nomina, 'Deduccion'))
    if (attr(d, 'TipoDeduccion') === '002') isr += num(attr(d, 'Importe'))
  return {
    NOMINA_PERCEPCIONES: numN(attr(el, 'TotalPercepciones')),
    NOMINA_DEDUCCIONES:  numN(attr(el, 'TotalDeducciones')),
    NOMINA_OTROS_PAGOS:  numN(attr(el, 'TotalOtrosPagos')),
    NOMINA_ISR_RETENIDO: round2(isr),
  }
}

/** Complemento de pago (1.0 y 2.0): monto pagado y documentos relacionados. */
function readPagos(doc) {
  const ns = doc.getElementsByTagNameNS(NS.pago20, 'Pagos')[0] ? NS.pago20
           : doc.getElementsByTagNameNS(NS.pago10, 'Pagos')[0] ? NS.pago10 : null
  if (!ns) return null
  let monto = 0
  const doctos = []
  for (const p of doc.getElementsByTagNameNS(ns, 'Pago')) {
    monto += num(attr(p, 'Monto'))
    for (const d of p.getElementsByTagNameNS(ns, 'DoctoRelacionado'))
      doctos.push(`${(attr(d, 'IdDocumento') || '').toUpperCase()}: ${num(attr(d, 'ImpPagado')).toFixed(2)}`)
  }
  return { PAGO_MONTO: round2(monto), PAGO_DOCUMENTOS: doctos.join('; '), PAGO_NUM_DOCTOS: doctos.length }
}

/**
 * Parsea un XML. Devuelve { ok, motivo?, factura?, conceptos?, taxMeta? }
 */
export function parseCFDI(xmlText, archivo = '') {
  const doc = new DOMParser().parseFromString(xmlText, 'application/xml')
  if (doc.getElementsByTagName('parsererror').length) return { ok: false, motivo: 'No es un XML válido' }

  let ns = NS.cfdi4
  let comprobante = doc.getElementsByTagNameNS(NS.cfdi4, 'Comprobante')[0]
  if (!comprobante) { ns = NS.cfdi3; comprobante = doc.getElementsByTagNameNS(NS.cfdi3, 'Comprobante')[0] }
  if (!comprobante) return { ok: false, motivo: 'No es un CFDI del SAT' }

  const version = attr(comprobante, 'Version') || attr(comprobante, 'version') || ''
  if (version && parseFloat(version) < 3.3) return { ok: false, motivo: `CFDI versión ${version} no soportada (solo 3.3 y 4.0)` }

  const tfd  = doc.getElementsByTagNameNS(NS.tfd, 'TimbreFiscalDigital')[0]
  const uuid = (attr(tfd, 'UUID') || '').toUpperCase()
  if (!uuid) return { ok: false, motivo: 'Sin timbre fiscal (no tiene UUID)' }

  const get = (name) => comprobante.getElementsByTagNameNS(ns, name)[0]
  const emisor   = get('Emisor')
  const receptor = get('Receptor')
  const tipo     = attr(comprobante, 'TipoDeComprobante') || ''
  const moneda   = attr(comprobante, 'Moneda') || 'MXN'
  const tipoCambio = numN(attr(comprobante, 'TipoCambio')) ?? (moneda === 'MXN' ? 1 : null)
  const subtotal = num(attr(comprobante, 'SubTotal'))
  const descuento = num(attr(comprobante, 'Descuento'))
  const total    = num(attr(comprobante, 'Total'))
  const fecha    = parseFecha(attr(comprobante, 'Fecha'))

  // Impuestos del comprobante: hijo directo cfdi:Impuestos (no los de conceptos)
  const impuestosComprobante = [...comprobante.children].find(c => c.namespaceURI === ns && c.localName === 'Impuestos')
  const impC = readImpuestos(impuestosComprobante, ns)
  const impL = readImpuestosLocales(doc)

  const cabecera = {
    VERSION:        version,
    TIPO:           tipo,
    TIPO_NOMBRE:    nombreTipo(tipo),
    SERIE:          attr(comprobante, 'Serie') || '',
    FOLIO:          attr(comprobante, 'Folio') || '',
    FACTURA:        (attr(comprobante, 'Serie') || '') + (attr(comprobante, 'Folio') || ''),
    FECHA:          fecha,
    FECHA_TIMBRADO: parseFecha(attr(tfd, 'FechaTimbrado')),
    EMISOR:         attr(emisor, 'Nombre') || '',
    RFC_EMISOR:     (attr(emisor, 'Rfc') || '').toUpperCase(),
    REGIMEN_EMISOR: attr(emisor, 'RegimenFiscal') || '',
    RECEPTOR:       attr(receptor, 'Nombre') || '',
    RFC_RECEPTOR:   (attr(receptor, 'Rfc') || '').toUpperCase(),
    USO_CFDI:       attr(receptor, 'UsoCFDI') || '',
    REGIMEN_RECEPTOR: attr(receptor, 'RegimenFiscalReceptor') || '',
    MONEDA:         moneda,
    TIPO_CAMBIO:    tipoCambio,
    METODO_PAGO:    attr(comprobante, 'MetodoPago') || '',
    FORMA_PAGO:     attr(comprobante, 'FormaPago') || '',
    LUGAR_EXPEDICION: attr(comprobante, 'LugarExpedicion') || '',
    SUBTOTAL:       subtotal,
    DESCUENTO:      descuento,
    IMPUESTOS_TRASLADADOS: round2(numN(attr(impuestosComprobante, 'TotalImpuestosTrasladados')) ?? impC.trasladados) + impL.trasladados,
    IMPUESTOS_RETENIDOS:   round2(numN(attr(impuestosComprobante, 'TotalImpuestosRetenidos'))   ?? impC.retenidos)   + impL.retenidos,
    TOTAL:          total,
    TOTAL_MXN:      tipoCambio != null ? round2(total * tipoCambio) : null,
    UUID:           uuid,
    ARCHIVO:        archivo,
    ...impC.montos,
    ...impL.montos,
  }
  const nomina = tipo === 'N' ? readNomina(doc) : null
  const pagos  = tipo === 'P' ? readPagos(doc)  : null
  if (nomina) Object.assign(cabecera, nomina)
  if (pagos)  Object.assign(cabecera, pagos)

  const taxMeta = { ...impC.meta, ...impL.meta }

  // Conceptos
  const conceptos = []
  const conceptosEl = get('Conceptos')
  const list = conceptosEl ? [...conceptosEl.children].filter(c => c.namespaceURI === ns && c.localName === 'Concepto') : []
  list.forEach((c, i) => {
    const impuestosConcepto = [...c.children].find(x => x.namespaceURI === ns && x.localName === 'Impuestos')
    const imp = readImpuestos(impuestosConcepto, ns)
    Object.assign(taxMeta, imp.meta)
    const importe = num(attr(c, 'Importe'))
    const descC   = num(attr(c, 'Descuento'))
    conceptos.push({
      // Datos de cabecera (repetidos por fila para filtrar/agrupar)
      TIPO: cabecera.TIPO, TIPO_NOMBRE: cabecera.TIPO_NOMBRE, VERSION: cabecera.VERSION,
      FACTURA: cabecera.FACTURA, SERIE: cabecera.SERIE, FOLIO: cabecera.FOLIO,
      FECHA: cabecera.FECHA, UUID: cabecera.UUID, ARCHIVO: cabecera.ARCHIVO,
      EMISOR: cabecera.EMISOR, RFC_EMISOR: cabecera.RFC_EMISOR,
      RECEPTOR: cabecera.RECEPTOR, RFC_RECEPTOR: cabecera.RFC_RECEPTOR, USO_CFDI: cabecera.USO_CFDI,
      MONEDA: cabecera.MONEDA, TIPO_CAMBIO: cabecera.TIPO_CAMBIO,
      METODO_PAGO: cabecera.METODO_PAGO, FORMA_PAGO: cabecera.FORMA_PAGO,
      // Concepto
      NUM_CONCEPTO:    i + 1,
      CLAVE_PROD_SERV: attr(c, 'ClaveProdServ') || '',
      CODIGO_PRODUCTO: attr(c, 'NoIdentificacion') || '',
      PRODUCTO:        (attr(c, 'Descripcion') || '').trim(),
      CANTIDAD:        num(attr(c, 'Cantidad')),
      CLAVE_UNIDAD:    attr(c, 'ClaveUnidad') || '',
      UNIDAD:          attr(c, 'Unidad') || attr(c, 'ClaveUnidad') || '',
      VALOR_UNITARIO:  num(attr(c, 'ValorUnitario')),
      IMPORTE:         importe,
      DESCUENTO_CONCEPTO: descC,
      OBJETO_IMP:      attr(c, 'ObjetoImp') || '',
      ...imp.montos,
      IMPUESTOS_TRASLADADOS_CONCEPTO: imp.trasladados,
      IMPUESTOS_RETENIDOS_CONCEPTO:   imp.retenidos,
      IMPORTE_CON_IMPUESTOS: round2(importe - descC + imp.trasladados - imp.retenidos),
      // Totales de la factura (repetidos)
      SUBTOTAL: cabecera.SUBTOTAL, DESCUENTO: cabecera.DESCUENTO,
      IMPUESTOS_TRASLADADOS: cabecera.IMPUESTOS_TRASLADADOS, IMPUESTOS_RETENIDOS: cabecera.IMPUESTOS_RETENIDOS,
      TOTAL: cabecera.TOTAL, TOTAL_MXN: cabecera.TOTAL_MXN,
    })
  })
  cabecera.NUM_CONCEPTOS = conceptos.length

  return { ok: true, factura: cabecera, conceptos, taxMeta }
}

/**
 * Parsea varios archivos. `existingUUIDs` permite omitir facturas ya cargadas en lotes anteriores.
 * Devuelve { conceptos, facturas, taxColumns, resumen }.
 */
export async function parseFiles(files, existingUUIDs = new Set()) {
  const seen = new Set(existingUUIDs)
  const conceptos = [], facturas = []
  const taxMeta = {}
  const resumen = {
    archivos: files.length,
    noXml: 0,
    leidas: 0,
    conceptos: 0,
    duplicadas: [],   // { archivo, uuid }
    omitidas: [],     // { archivo, motivo }
    porTipo: {},      // { I: n, E: n, ... }
  }

  for (const file of files) {
    const name = file.name || ''
    if (!name.toLowerCase().endsWith('.xml')) { resumen.noXml++; continue }
    let text
    try { text = await file.text() } catch { resumen.omitidas.push({ archivo: name, motivo: 'No se pudo leer el archivo' }); continue }
    const r = parseCFDI(text, name)
    if (!r.ok) { resumen.omitidas.push({ archivo: name, motivo: r.motivo }); continue }
    if (seen.has(r.factura.UUID)) { resumen.duplicadas.push({ archivo: name, uuid: r.factura.UUID }); continue }
    seen.add(r.factura.UUID)
    facturas.push(r.factura)
    conceptos.push(...r.conceptos)
    Object.assign(taxMeta, r.taxMeta)
    resumen.leidas++
    resumen.conceptos += r.conceptos.length
    resumen.porTipo[r.factura.TIPO] = (resumen.porTipo[r.factura.TIPO] || 0) + 1
  }

  return { conceptos, facturas, taxColumns: sortTaxColumns(Object.values(taxMeta)), resumen }
}

/** Orden estable: traslados (IVA, IEPS, otros, locales) y luego retenciones (ISR, IVA, IEPS, locales). */
export function sortTaxColumns(cols) {
  const rank = (c) => {
    const base = c.kind === 'ret' ? 100 : 0
    const imp = c.local ? 50 : c.impuesto === 'IVA' ? 0 : c.impuesto === 'IEPS' ? 10 : c.impuesto === 'ISR' ? 5 : 20
    return base + imp
  }
  return [...cols].sort((a, b) => rank(a) - rank(b) || a.label.localeCompare(b.label, 'es'))
}

/** Une metadatos de impuestos de dos lotes (para cargas acumuladas). */
export function mergeTaxColumns(a, b) {
  const map = new Map()
  for (const c of [...a, ...b]) map.set(c.key, c)
  return sortTaxColumns([...map.values()])
}
