const NS_CFDI = 'http://www.sat.gob.mx/cfd/4'
const NS_TFD  = 'http://www.sat.gob.mx/TimbreFiscalDigital'

export function parseCFDI(xmlText) {
  const parser = new DOMParser()
  const doc    = parser.parseFromString(xmlText, 'application/xml')

  const comprobante = doc.getElementsByTagNameNS(NS_CFDI, 'Comprobante')[0]
  if (!comprobante) return []

  const tfd = doc.getElementsByTagNameNS(NS_TFD, 'TimbreFiscalDigital')[0]
  const uuid = tfd ? tfd.getAttribute('UUID') : ''

  const fechaStr = comprobante.getAttribute('Fecha') || ''
  const fecha    = fechaStr ? new Date(fechaStr) : null

  const folio = (comprobante.getAttribute('Serie') || '') + (comprobante.getAttribute('Folio') || '')

  const emisorEl   = comprobante.getElementsByTagNameNS(NS_CFDI, 'Emisor')[0]
  const receptorEl = comprobante.getElementsByTagNameNS(NS_CFDI, 'Receptor')[0]

  const emisor       = emisorEl   ? emisorEl.getAttribute('Nombre')   : ''
  const rfcEmisor    = emisorEl   ? emisorEl.getAttribute('Rfc')      : ''
  const receptor     = receptorEl ? receptorEl.getAttribute('Nombre') : ''
  const rfcReceptor  = receptorEl ? receptorEl.getAttribute('Rfc')    : ''

  const conceptos = comprobante.getElementsByTagNameNS(NS_CFDI, 'Concepto')
  const rows = []

  for (const c of conceptos) {
    rows.push({
      EMISOR:        emisor,
      RFC_EMISOR:    rfcEmisor,
      FECHA:         fecha,
      FACTURA:       folio,
      RECEPTOR:      receptor,
      RFC_RECEPTOR:  rfcReceptor,
      CODIGO_PRODUCTO: c.getAttribute('NoIdentificacion') || '',
      PRODUCTO:      (c.getAttribute('Descripcion') || '').trim(),
      CANTIDAD:      parseFloat(c.getAttribute('Cantidad') || 0),
      TOTAL:         parseFloat(c.getAttribute('Importe')  || 0),
      DOCUMENTO:     uuid,
    })
  }

  return rows
}

export async function parseFiles(files) {
  const seenUUIDs = new Set()
  const allRows   = []

  for (const file of files) {
    const text = await file.text()
    const rows = parseCFDI(text)
    if (!rows.length) continue

    const uuid = rows[0].DOCUMENTO?.toUpperCase()
    if (uuid && seenUUIDs.has(uuid)) continue
    if (uuid) seenUUIDs.add(uuid)

    allRows.push(...rows)
  }

  return allRows
}
