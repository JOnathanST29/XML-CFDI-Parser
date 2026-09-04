/**
 * Catálogos del SAT usados para mostrar nombres legibles en lugar de claves.
 * Solo los valores frecuentes; una clave desconocida se muestra tal cual.
 */

export const TIPO_COMPROBANTE = {
  I: 'Ingreso',
  E: 'Egreso',
  T: 'Traslado',
  N: 'Nómina',
  P: 'Pago',
}

export const METODO_PAGO = {
  PUE: 'PUE · Pago en una sola exhibición',
  PPD: 'PPD · Pago en parcialidades o diferido',
}

export const FORMA_PAGO = {
  '01': 'Efectivo',
  '02': 'Cheque nominativo',
  '03': 'Transferencia electrónica',
  '04': 'Tarjeta de crédito',
  '05': 'Monedero electrónico',
  '06': 'Dinero electrónico',
  '08': 'Vales de despensa',
  '12': 'Dación en pago',
  '13': 'Pago por subrogación',
  '14': 'Pago por consignación',
  '15': 'Condonación',
  '17': 'Compensación',
  '23': 'Novación',
  '24': 'Confusión',
  '25': 'Remisión de deuda',
  '26': 'Prescripción o caducidad',
  '27': 'A satisfacción del acreedor',
  '28': 'Tarjeta de débito',
  '29': 'Tarjeta de servicios',
  '30': 'Aplicación de anticipos',
  '31': 'Intermediario pagos',
  '99': 'Por definir',
}

export const IMPUESTO = {
  '001': 'ISR',
  '002': 'IVA',
  '003': 'IEPS',
}

export const USO_CFDI = {
  G01: 'Adquisición de mercancías',
  G02: 'Devoluciones, descuentos o bonificaciones',
  G03: 'Gastos en general',
  I01: 'Construcciones',
  I02: 'Mobiliario y equipo de oficina',
  I03: 'Equipo de transporte',
  I04: 'Equipo de cómputo',
  I05: 'Dados, troqueles, moldes',
  I06: 'Comunicaciones telefónicas',
  I07: 'Comunicaciones satelitales',
  I08: 'Otra maquinaria y equipo',
  D01: 'Honorarios médicos',
  D02: 'Gastos médicos por incapacidad',
  D03: 'Gastos funerales',
  D04: 'Donativos',
  D05: 'Intereses hipotecarios',
  D06: 'Aportaciones voluntarias SAR',
  D07: 'Primas de seguros de gastos médicos',
  D08: 'Transporte escolar',
  D09: 'Depósitos en cuentas para el ahorro',
  D10: 'Pagos por servicios educativos',
  S01: 'Sin efectos fiscales',
  CP01: 'Pagos',
  CN01: 'Nómina',
  P01: 'Por definir',
}

export const REGIMEN_FISCAL = {
  601: 'General de Ley Personas Morales',
  603: 'Personas Morales con Fines no Lucrativos',
  605: 'Sueldos y Salarios',
  606: 'Arrendamiento',
  607: 'Enajenación o adquisición de bienes',
  608: 'Demás ingresos',
  610: 'Residentes en el Extranjero',
  611: 'Ingresos por Dividendos',
  612: 'Personas Físicas con Actividades Empresariales',
  614: 'Ingresos por intereses',
  615: 'Ingresos por premios',
  616: 'Sin obligaciones fiscales',
  620: 'Sociedades Cooperativas de Producción',
  621: 'Incorporación Fiscal',
  622: 'Actividades Agrícolas, Ganaderas, Silvícolas y Pesqueras',
  623: 'Opcional para Grupos de Sociedades',
  624: 'Coordinados',
  625: 'Actividades Empresariales a través de Plataformas Tecnológicas',
  626: 'Régimen Simplificado de Confianza (RESICO)',
}

export const nombreTipo   = (c) => TIPO_COMPROBANTE[c] || c || ''
export const nombreMetodo = (c) => METODO_PAGO[c] || c || ''
export const nombreForma  = (c) => (c ? `${c} · ${FORMA_PAGO[c] || 'Otra'}` : '')
export const nombreUso    = (c) => (c ? `${c} · ${USO_CFDI[c] || ''}`.replace(/ · $/, '') : '')
export const nombreRegimen= (c) => (c ? `${c} · ${REGIMEN_FISCAL[c] || ''}`.replace(/ · $/, '') : '')
