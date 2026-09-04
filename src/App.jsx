import { useState, useCallback, useEffect } from 'react'
import { parseFiles } from './cfdiParser'
import { exportToExcel } from './exporter'
import CfdiGrid from './CfdiGrid'
import Privacy from './Privacy'
import WelcomeDialog from './WelcomeDialog'
import HowToCard from './HowToCard'
import './App.css'

const WELCOME_KEY = 'cfdi-parser:welcome-seen'

export default function App() {
  const [rows, setRows]         = useState([])
  const [dragging, setDragging] = useState(false)
  const [loading, setLoading]   = useState(false)
  const [filename, setFilename] = useState('COMPRAS_CFDI.xlsx')
  const [view, setView]         = useState('home')
  const [showWelcome, setShowWelcome] = useState(false)

  useEffect(() => {
    if (!localStorage.getItem(WELCOME_KEY)) setShowWelcome(true)
  }, [])

  const dismissWelcome = () => {
    localStorage.setItem(WELCOME_KEY, '1')
    setShowWelcome(false)
  }

  const processFiles = useCallback(async (files) => {
    const xmlFiles = [...files].filter(f => f.name.toLowerCase().endsWith('.xml'))
    if (!xmlFiles.length) return
    setLoading(true)
    const parsed = await parseFiles(xmlFiles)
    setRows(prev => {
      const existing = new Set(prev.map(r => r.DOCUMENTO?.toUpperCase()))
      return [...prev, ...parsed.filter(r => !existing.has(r.DOCUMENTO?.toUpperCase()))]
    })
    setLoading(false)
    // Umami: cuántos XMLs cargó este lote
    try {
      window.umami?.track?.('files_loaded', { count: xmlFiles.length })
    } catch { /* ignore */ }
  }, [])

  const onDrop = useCallback((e) => {
    e.preventDefault()
    setDragging(false)
    processFiles(e.dataTransfer.files)
  }, [processFiles])

  const totalCantidad = rows.reduce((s, r) => s + (r.CANTIDAD || 0), 0)
  const totalImporte  = rows.reduce((s, r) => s + (r.TOTAL    || 0), 0)
  const proveedores   = new Set(rows.map(r => r.EMISOR)).size

  return (
    <>
      {showWelcome && (
        <WelcomeDialog
          onClose={dismissWelcome}
          onShowFull={() => { dismissWelcome(); setView('privacy') }}
        />
      )}

      <div className="shell-header">
        <span className="shell-logo" onClick={() => setView('home')} style={{ cursor: 'pointer' }}>
          XML · CFDI Parser
        </span>
      </div>

      {view === 'privacy' ? (
        <Privacy onBack={() => setView('home')} />
      ) : (
    <div className="app">
      <div className="privacy-banner">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.955 11.955 0 003 12c0 6.627 5.373 12 12 12s12-5.373 12-12c0-2.045-.51-3.97-1.407-5.658" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 3c-1.352 0-2.657.177-3.898.507A12.006 12.006 0 003.598 6" />
        </svg>
        <span>
          <strong>Sin servidor, sin promesas: solo tu navegador.</strong> Tus XMLs nunca salen de tu computadora
          porque no hay servidor a dónde enviarlos. Puedes desconectar tu internet después de cargar la página
          y la herramienta sigue funcionando perfectamente.
        </span>
      </div>

      <div className="page-header">
        <h1>Convertir CFDI a Excel</h1>
        <p>Convierte facturas CFDI 4.0 (XML del SAT) a un Excel listo para revisar, filtrar y compartir. Todo se procesa en tu navegador — los XMLs nunca se suben a ningún servidor. Gratis, sin registro y sin límite de archivos.</p>
      </div>

      <div className="upload-card">
        <div className="upload-card-header">Cargar archivos</div>
        <div
          className={`dropzone${dragging ? ' dragging' : ''}`}
        onDrop={onDrop}
        onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onClick={() => document.getElementById('fileInput').click()}
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path strokeLinecap="round" strokeLinejoin="round"
            d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
        </svg>
        <p>{loading ? 'Procesando…' : 'Arrastra tus archivos XML aquí o haz clic para seleccionar'}</p>
        <span>
          Solo .xml · Los archivos se <strong>acumulan</strong> en cada carga (duplicados omitidos por UUID).
          {rows.length > 0 && ' Usa "Limpiar" para empezar desde cero.'}
        </span>
          <input id="fileInput" type="file" accept=".xml" multiple onChange={e => processFiles(e.target.files)} />
        </div>
      </div>

      {rows.length === 0 && <HowToCard />}

      {rows.length > 0 && (
        <>
          <div className="stats">
            {[
              { value: rows.length.toLocaleString('es-MX'), label: 'Conceptos' },
              { value: proveedores, label: 'Proveedores' },
              { value: totalCantidad.toLocaleString('es-MX'), label: 'Cantidad' },
              { value: `$${totalImporte.toLocaleString('es-MX', { minimumFractionDigits: 2 })}`, label: 'Total MXN' },
            ].map(s => (
              <div className="stat" key={s.label}>
                <span className="stat-value">{s.value}</span>
                <span className="stat-label">{s.label}</span>
              </div>
            ))}
          </div>

          <div className="toolbar">
            <input
              className="filename-input"
              value={filename}
              onChange={e => setFilename(e.target.value)}
              placeholder="nombre-archivo.xlsx"
            />
            <button className="btn-export" onClick={() => exportToExcel(rows, filename)}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round"
                  d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
              </svg>
              Descargar Excel
            </button>
            <button className="btn-clear" onClick={() => setRows([])}>Limpiar</button>
          </div>

          <div className="sheet-wrap">
            <CfdiGrid rows={rows} onChange={setRows} />
          </div>

          <div className="how-to-bottom">
            <HowToCard compact />
          </div>
        </>
      )}
    </div>
      )}

      <footer className="footer">
        <div className="footer-inner">
          <span className="footer-brand">XML · CFDI Parser</span>
          <span className="footer-sep">·</span>
          <span className="footer-tag">Sin servidor · Sin cookies · Analítica anónima</span>
          <span className="footer-sep">·</span>
          <button className="footer-link" onClick={() => setView('privacy')}>
            Aviso de Privacidad
          </button>
        </div>
      </footer>
    </>
  )
}
