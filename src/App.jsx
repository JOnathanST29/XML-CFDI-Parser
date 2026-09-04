import { useState, useCallback, useMemo, useRef, useEffect } from 'react'
import { parseFiles, mergeTaxColumns } from './cfdiParser'
import { exportExcel } from './exporter'
import { conceptoColumns, facturaColumns, fmtMoney } from './columns'
import DataGrid from './DataGrid'
import Privacy from './Privacy'
import WelcomeDialog from './WelcomeDialog'
import HowToCard from './HowToCard'
import './App.css'

const WELCOME_KEY = 'cfdi-parser:welcome-seen'
const EMPTY = { conceptos: [], facturas: [], taxColumns: [] }
const isMobile = () => typeof navigator !== 'undefined' && /Android|iPhone|iPad|Mobile/i.test(navigator.userAgent)

/** KPIs sobre las facturas visibles. Ingresos suman, egresos (notas de crédito) restan, nómina/pago/traslado se excluyen. */
function computeStats(visible, mode) {
  const byUuid = new Map()
  for (const r of visible) if (r.UUID && !byUuid.has(r.UUID)) byUuid.set(r.UUID, r)
  const facturas = [...byUuid.values()]
  const excluidos = { N: 0, P: 0, T: 0 }
  let egresos = 0, subtotal = 0, impuestos = 0, total = 0
  for (const f of facturas) {
    const sign = f.TIPO === 'I' ? 1 : f.TIPO === 'E' ? -1 : 0
    if (sign === 0) { if (f.TIPO in excluidos) excluidos[f.TIPO]++; continue }
    if (f.TIPO === 'E') egresos++
    const tc = f.TIPO_CAMBIO ?? (f.MONEDA === 'MXN' ? 1 : 0)
    subtotal  += sign * ((f.SUBTOTAL || 0) - (f.DESCUENTO || 0)) * tc
    impuestos += sign * ((f.IMPUESTOS_TRASLADADOS || 0) - (f.IMPUESTOS_RETENIDOS || 0)) * tc
    total     += sign * (f.TOTAL_MXN ?? ((f.TOTAL || 0) * tc))
  }
  const conceptos = mode === 'conceptos' ? visible.length : facturas.reduce((s, f) => s + (f.NUM_CONCEPTOS || 0), 0)
  const emisores = new Set(facturas.map(f => f.RFC_EMISOR)).size
  const sinTipoCambio = facturas.filter(f => f.MONEDA !== 'MXN' && f.TIPO_CAMBIO == null && (f.TIPO === 'I' || f.TIPO === 'E')).length
  return { facturas: facturas.length, conceptos, emisores, egresos, subtotal, impuestos, total, excluidos, sinTipoCambio }
}

export default function App() {
  const [data, setData]         = useState(EMPTY)
  const [recibo, setRecibo]     = useState(null)      // resumen de la última carga
  const [reciboOpen, setReciboOpen] = useState(false)
  const [dragging, setDragging] = useState(false)
  const [loading, setLoading]   = useState(false)
  const [filename, setFilename] = useState('COMPRAS_CFDI.xlsx')
  const [privacyOpen, setPrivacyOpen] = useState(false)
  const [showWelcome, setShowWelcome] = useState(() => !localStorage.getItem(WELCOME_KEY))
  const [tab, setTab]           = useState('conceptos')
  const [quick, setQuick]       = useState('')
  const [visibleC, setVisibleC] = useState([])
  const [visibleF, setVisibleF] = useState([])
  const [confirmClear, setConfirmClear] = useState(false)
  const [downloadMsg, setDownloadMsg]   = useState(null)

  const conceptosRef = useRef(null)
  const facturasRef  = useRef(null)
  const fileInputRef = useRef(null)

  const dismissWelcome = () => { localStorage.setItem(WELCOME_KEY, '1'); setShowWelcome(false) }

  // ── Carga ──
  const processFiles = useCallback(async (fileList) => {
    const files = [...fileList]
    if (!files.length) return
    setLoading(true)
    setDownloadMsg(null)
    try {
      const existing = new Set(data.facturas.map(f => f.UUID))
      const r = await parseFiles(files, existing)
      setData(prev => ({
        conceptos: [...prev.conceptos, ...r.conceptos],
        facturas:  [...prev.facturas, ...r.facturas],
        taxColumns: mergeTaxColumns(prev.taxColumns, r.taxColumns),
      }))
      setRecibo(r.resumen)
      setReciboOpen(r.resumen.omitidas.length > 0 && r.resumen.leidas === 0)
      try { window.umami?.track?.('files_loaded', { count: r.resumen.leidas }) } catch { /* ignore */ }
    } finally {
      setLoading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }, [data.facturas])

  const onDrop = useCallback((e) => {
    e.preventDefault(); setDragging(false)
    processFiles(e.dataTransfer.files)
  }, [processFiles])

  // ── Limpiar (con confirmación en sitio; no borra el nombre del archivo) ──
  const clearAll = () => {
    setData(EMPTY); setRecibo(null); setQuick(''); setDownloadMsg(null); setConfirmClear(false)
  }
  useEffect(() => {
    if (!confirmClear) return
    const t = setTimeout(() => setConfirmClear(false), 6000)
    return () => clearTimeout(t)
  }, [confirmClear])

  // ── Columnas y filas ──
  const conceptoDefs = useMemo(() => conceptoColumns(data.taxColumns), [data.taxColumns])
  const facturaDefs  = useMemo(() => facturaColumns(data.taxColumns), [data.taxColumns])
  const rowIdC = useCallback(r => `${r.UUID}#${r.NUM_CONCEPTO}`, [])
  const rowIdF = useCallback(r => r.UUID, [])
  const onConceptosChange = useCallback(rows => setData(prev => ({ ...prev, conceptos: rows })), [])
  const onFacturasChange  = useCallback(rows => setData(prev => ({ ...prev, facturas: rows })), [])

  const hasData = data.facturas.length > 0
  const stats = useMemo(
    () => computeStats(tab === 'conceptos' ? visibleC : visibleF, tab),
    [tab, visibleC, visibleF],
  )
  const totalStats = useMemo(() => computeStats(data.facturas, 'facturas'), [data.facturas])
  const filtered = stats.facturas !== totalStats.facturas || (tab === 'conceptos' && visibleC.length !== data.conceptos.length)
  const visibleCount = tab === 'conceptos' ? visibleC.length : visibleF.length
  const totalCount   = tab === 'conceptos' ? data.conceptos.length : data.facturas.length

  // ── Descargar ──
  const onDownload = async () => {
    try {
      const r = await exportExcel({
        conceptosApi: conceptosRef.current?.api,
        facturasApi:  facturasRef.current?.api,
        filename,
        activeTab: tab,
        share: isMobile(),
      })
      setDownloadMsg({
        ok: true,
        text: `${r.shared ? 'Compartido' : 'Descargado'} ${r.fileName}: ${r.filas.facturas.toLocaleString('es-MX')} facturas con ${r.filas.conceptos.toLocaleString('es-MX')} conceptos, en 2 hojas (Conceptos y Facturas), con todas las columnas.`,
      })
    } catch (e) {
      setDownloadMsg({ ok: false, text: `No se pudo generar el Excel: ${e.message}` })
    }
  }

  const resetFilters = () => {
    setQuick('')
    conceptosRef.current?.api?.setFilterModel(null)
    facturasRef.current?.api?.setFilterModel(null)
  }

  return (
    <>
      {showWelcome && (
        <WelcomeDialog
          onClose={dismissWelcome}
          onShowFull={() => setPrivacyOpen(true)}
        />
      )}

      {privacyOpen && (
        <div className="privacy-layer" role="dialog" aria-label="Aviso de privacidad">
          <Privacy onBack={() => setPrivacyOpen(false)} />
        </div>
      )}

      <div className="shell-header">
        <span className="shell-logo" onClick={() => setPrivacyOpen(false)} style={{ cursor: 'pointer' }}>
          XML · CFDI Parser
        </span>
      </div>

      <div className="app">
        <div className="page-header">
          <h1>Convertir CFDI a Excel</h1>
          <p>
            Arrastra tus facturas XML del SAT (CFDI 3.3 y 4.0) y obtén un Excel con conceptos, subtotal, IVA,
            retenciones y totales por factura. <strong>Todo se procesa en tu navegador:</strong> los XML nunca se
            suben a ningún servidor. Puedes desconectar tu internet y sigue funcionando. Gratis, sin registro.
          </p>
        </div>

        {/* Zona de carga: grande sin datos, compacta con datos */}
        <div className={`upload-card${hasData ? ' upload-card--compact' : ''}`}>
          {!hasData && <div className="upload-card-header">Cargar archivos</div>}
          <div
            className={`dropzone${dragging ? ' dragging' : ''}${hasData ? ' dropzone--compact' : ''}`}
            onDrop={onDrop}
            onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
            onDragLeave={() => setDragging(false)}
            onClick={() => fileInputRef.current?.click()}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path strokeLinecap="round" strokeLinejoin="round"
                d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
            </svg>
            <p>
              {loading ? 'Leyendo archivos…'
                : hasData ? 'Arrastra más XML aquí o haz clic para agregar'
                : 'Arrastra tus archivos XML aquí o haz clic para seleccionar'}
            </p>
            {!hasData && (
              <span>
                Solo archivos <strong>.xml</strong> (el PDF no sirve). Puedes soltar varios lotes: se acumulan y
                los repetidos se omiten.
              </span>
            )}
            <input ref={fileInputRef} id="fileInput" type="file" accept=".xml" multiple onChange={e => processFiles(e.target.files)} />
          </div>

          {recibo && (
            <Recibo recibo={recibo} open={reciboOpen} onToggle={() => setReciboOpen(o => !o)} />
          )}
        </div>

        {!hasData && !loading && <HowToCard />}

        {hasData && (
          <>
            <div className="stats">
              <Stat value={stats.facturas} label="Facturas" hint={stats.egresos ? `${stats.egresos} nota${stats.egresos > 1 ? 's' : ''} de crédito` : null} />
              <Stat value={stats.conceptos} label="Conceptos" />
              <Stat value={stats.emisores} label="Emisores" hint="proveedores o clientes" />
              <Stat value={fmtMoney(stats.subtotal)} label="Subtotal MXN" hint="sin impuestos, menos descuentos" />
              <Stat value={fmtMoney(stats.impuestos)} label="Impuestos MXN" hint="trasladados − retenidos" />
              <Stat value={fmtMoney(stats.total)} label="Total MXN" hint="con impuestos" accent />
            </div>
            <div className="stats-note">
              {filtered ? <strong>Cifras de lo filtrado. </strong> : null}
              Ingresos suman y notas de crédito restan.
              {(stats.excluidos.N || stats.excluidos.P || stats.excluidos.T) ? (
                <> Excluidos del total: {[
                  stats.excluidos.N && `${stats.excluidos.N} nómina`,
                  stats.excluidos.P && `${stats.excluidos.P} pago${stats.excluidos.P > 1 ? 's' : ''}`,
                  stats.excluidos.T && `${stats.excluidos.T} traslado${stats.excluidos.T > 1 ? 's' : ''}`,
                ].filter(Boolean).join(' · ')}.</>
              ) : null}
              {stats.sinTipoCambio ? <> <strong>{stats.sinTipoCambio} factura{stats.sinTipoCambio > 1 ? 's' : ''} en otra moneda sin tipo de cambio</strong> no entran al total MXN.</> : null}
            </div>

            <div className="toolbar">
              <div className="tabs" role="tablist">
                <button role="tab" aria-selected={tab === 'conceptos'} className={tab === 'conceptos' ? 'active' : ''} onClick={() => setTab('conceptos')}>
                  Conceptos <span className="tab-count">{data.conceptos.length.toLocaleString('es-MX')}</span>
                </button>
                <button role="tab" aria-selected={tab === 'facturas'} className={tab === 'facturas' ? 'active' : ''} onClick={() => setTab('facturas')}>
                  Facturas <span className="tab-count">{data.facturas.length.toLocaleString('es-MX')}</span>
                </button>
              </div>
              <input
                className="grid-quick-filter"
                type="search"
                placeholder="Buscar en todas las columnas…"
                value={quick}
                onChange={e => setQuick(e.target.value)}
              />
              <span className="grid-count">
                {visibleCount.toLocaleString('es-MX')} de {totalCount.toLocaleString('es-MX')}
              </span>
              <button className="btn-ghost" type="button" onClick={resetFilters} disabled={!filtered && !quick}>
                Quitar filtros
              </button>
            </div>

            <div className="sheet-wrap">
              <div className="grid-body" hidden={tab !== 'conceptos'}>
                <DataGrid
                  ref={conceptosRef}
                  columnDefs={conceptoDefs}
                  rowData={data.conceptos}
                  getRowId={rowIdC}
                  labelField="PRODUCTO"
                  quickFilterText={quick}
                  onVisibleRows={setVisibleC}
                  onChange={onConceptosChange}
                />
              </div>
              <div className="grid-body" hidden={tab !== 'facturas'}>
                <DataGrid
                  ref={facturasRef}
                  columnDefs={facturaDefs}
                  rowData={data.facturas}
                  getRowId={rowIdF}
                  labelField="EMISOR"
                  quickFilterText={quick}
                  onVisibleRows={setVisibleF}
                  onChange={onFacturasChange}
                />
              </div>
            </div>

            <div className="export-bar">
              <input
                className="filename-input"
                value={filename}
                onChange={e => setFilename(e.target.value)}
                placeholder="nombre-archivo.xlsx"
                aria-label="Nombre del archivo"
              />
              <button className="btn-export" onClick={onDownload}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round"
                    d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
                </svg>
                {isMobile() ? 'Compartir Excel' : 'Descargar Excel'}
                <span className="btn-export-count">
                  {filtered ? `${visibleCount.toLocaleString('es-MX')} de ${totalCount.toLocaleString('es-MX')}` : totalCount.toLocaleString('es-MX')} {tab}
                </span>
              </button>
              <span className="export-hint">
                Se exporta lo que ves: las facturas que pasan el filtro de esta pestaña, en el orden actual,
                con todas las columnas (también las ocultas), en 2 hojas: Conceptos y Facturas.
              </span>
              <div className="export-clear">
                {confirmClear ? (
                  <>
                    <span className="confirm-text">¿Borrar las {data.facturas.length} facturas cargadas?</span>
                    <button className="btn-danger" type="button" onClick={clearAll}>Sí, borrar todo</button>
                    <button className="btn-ghost" type="button" onClick={() => setConfirmClear(false)}>Cancelar</button>
                  </>
                ) : (
                  <button className="btn-ghost" type="button" onClick={() => setConfirmClear(true)}>Limpiar todo</button>
                )}
              </div>
            </div>
            {downloadMsg && (
              <div className={`download-msg ${downloadMsg.ok ? 'ok' : 'error'}`} role="status">{downloadMsg.text}</div>
            )}

            <div className="how-to-bottom">
              <HowToCard compact />
            </div>
          </>
        )}
      </div>

      <footer className="footer">
        <div className="footer-inner">
          <span className="footer-brand">XML · CFDI Parser</span>
          <span className="footer-sep">·</span>
          <span className="footer-tag">Sin servidor · Sin cookies · Conteo anónimo de visitas</span>
          <span className="footer-sep">·</span>
          <button className="footer-link" onClick={() => setPrivacyOpen(true)}>
            Aviso de Privacidad
          </button>
        </div>
      </footer>
    </>
  )
}

function Stat({ value, label, hint, accent }) {
  return (
    <div className={`stat${accent ? ' stat--accent' : ''}`}>
      <span className="stat-value">{typeof value === 'number' ? value.toLocaleString('es-MX') : value}</span>
      <span className="stat-label">{label}</span>
      {hint && <span className="stat-hint">{hint}</span>}
    </div>
  )
}

/** Recibo de la última carga: qué entró, qué se omitió y por qué. */
function Recibo({ recibo, open, onToggle }) {
  const { leidas, conceptos, omitidas, duplicadas, noXml, porTipo } = recibo
  const nada = leidas === 0
  const tipos = Object.entries(porTipo).map(([t, n]) => `${n} ${({ I: 'ingreso', E: 'egreso', N: 'nómina', P: 'pago', T: 'traslado' })[t] || t}`).join(', ')
  const detalles = omitidas.length + duplicadas.length + noXml
  return (
    <div className={`recibo${nada ? ' recibo--warn' : ''}`} role="status">
      <span className="recibo-main">
        {nada
          ? 'No se cargó ninguna factura.'
          : <><strong>{leidas} factura{leidas !== 1 ? 's' : ''} leída{leidas !== 1 ? 's' : ''}</strong> ({conceptos} conceptos{tipos ? `: ${tipos}` : ''})</>}
        {duplicadas.length > 0 && <> · {duplicadas.length} repetida{duplicadas.length > 1 ? 's' : ''} (ya estaba{duplicadas.length > 1 ? 'n' : ''})</>}
        {omitidas.length > 0 && <> · <strong>{omitidas.length} omitida{omitidas.length > 1 ? 's' : ''}</strong></>}
        {noXml > 0 && <> · {noXml} archivo{noXml > 1 ? 's' : ''} que no {noXml > 1 ? 'son' : 'es'} .xml (PDF u otros) ignorado{noXml > 1 ? 's' : ''}</>}
      </span>
      {detalles > 0 && (
        <button type="button" className="recibo-toggle" onClick={onToggle}>{open ? 'Ocultar detalle' : 'Ver detalle'}</button>
      )}
      {open && detalles > 0 && (
        <ul className="recibo-list">
          {omitidas.map((o, i) => <li key={`o${i}`}><code>{o.archivo}</code> — {o.motivo}</li>)}
          {duplicadas.map((d, i) => <li key={`d${i}`}><code>{d.archivo}</code> — repetida, UUID {d.uuid}</li>)}
          {noXml > 0 && <li>{noXml} archivo{noXml > 1 ? 's' : ''} sin extensión .xml. El PDF de la factura no sirve: necesitas el XML que llega junto con él.</li>}
        </ul>
      )}
    </div>
  )
}
