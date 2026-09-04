import { useMemo, useCallback, useRef, useState } from 'react'
import { AgGridReact } from 'ag-grid-react'
import {
  ModuleRegistry,
  ClientSideRowModelModule,
  ClientSideRowModelApiModule,
  RowApiModule,
  ColumnApiModule,
  LocaleModule,
  RowStyleModule,
  CustomFilterModule,
  TextEditorModule,
  NumberEditorModule,
  ColumnAutoSizeModule,
  PinnedRowModule,
  QuickFilterModule,
  CellStyleModule,
  UndoRedoEditModule,
  ValidationModule,
  themeQuartz,
} from 'ag-grid-community'
import { AG_GRID_LOCALE_ES } from '@ag-grid-community/locale'
import SetFilter from './SetFilter'

// Registro modular: solo lo que usamos. Evita cargar AllCommunityModule (~300 KB gzip).
// En dev sumamos ValidationModule para ver errores completos en consola (no va al bundle de prod).
const modules = [
  ClientSideRowModelModule,
  ClientSideRowModelApiModule,
  RowApiModule,
  ColumnApiModule,
  LocaleModule,
  RowStyleModule,
  CustomFilterModule,
  TextEditorModule,
  NumberEditorModule,
  ColumnAutoSizeModule,
  PinnedRowModule,
  QuickFilterModule,
  CellStyleModule,
  UndoRedoEditModule,
]
if (import.meta.env.DEV) modules.push(ValidationModule) // tree-shaken en prod
ModuleRegistry.registerModules(modules)

// Tema Quartz con la paleta Fiori de App.css
const theme = themeQuartz.withParams({
  accentColor: '#0070f2',
  backgroundColor: '#ffffff',
  foregroundColor: '#32363a',
  borderColor: '#d9d9d9',
  headerBackgroundColor: '#f5f6f7',
  headerTextColor: '#6a6d70',
  headerFontWeight: 700,
  oddRowBackgroundColor: '#ffffff',
  rowHoverColor: '#eaf4ff',
  selectedRowBackgroundColor: '#d9ecff',
  fontFamily: "'72', 'SAP-icons', Arial, Helvetica, sans-serif",
  fontSize: 13,
  headerFontSize: 12,
  rowHeight: 30,
  headerHeight: 34,
  borderRadius: 0,
  wrapperBorderRadius: 0,
  wrapperBorder: false,
})

const fmtMoney = (v) =>
  v == null || v === '' ? '' : `$${Number(v).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const fmtNumber = (v) =>
  v == null || v === '' ? '' : Number(v).toLocaleString('es-MX', { maximumFractionDigits: 3 })
const fmtDate = (v) => {
  if (!v) return ''
  const d = v instanceof Date ? v : new Date(v)
  return isNaN(d) ? String(v) : d.toISOString().slice(0, 10)
}

const COLUMN_DEFS = [
  { field: 'EMISOR',          headerName: 'Emisor',        minWidth: 200, flex: 2 },
  { field: 'RFC_EMISOR',      headerName: 'RFC Emisor',    width: 140 },
  {
    field: 'FECHA', headerName: 'Fecha', width: 120,
    filterParams: { kind: 'date' },
    valueFormatter: p => fmtDate(p.value),
    editable: false,
  },
  { field: 'FACTURA',         headerName: 'Factura',       width: 130 },
  { field: 'RECEPTOR',        headerName: 'Receptor',      minWidth: 180, flex: 2 },
  { field: 'RFC_RECEPTOR',    headerName: 'RFC Receptor',  width: 140 },
  { field: 'CODIGO_PRODUCTO', headerName: 'Código',        width: 120 },
  { field: 'PRODUCTO',        headerName: 'Producto',      minWidth: 240, flex: 3 },
  {
    field: 'BOTELLAS', headerName: 'Botellas', width: 110, type: 'numericColumn',
    filterParams: { kind: 'number', format: fmtNumber },
    cellEditor: 'agNumberCellEditor',
    valueFormatter: p => fmtNumber(p.value),
  },
  {
    field: 'TOTAL', headerName: 'Total', width: 130, type: 'numericColumn',
    filterParams: { kind: 'number', format: fmtMoney },
    cellEditor: 'agNumberCellEditor',
    cellEditorParams: { precision: 2 },
    valueFormatter: p => fmtMoney(p.value),
  },
  { field: 'DOCUMENTO',       headerName: 'UUID',          width: 300, editable: false,
    cellStyle: { fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: 11 } },
]

const DEFAULT_COL_DEF = {
  sortable: true,
  resizable: true,
  editable: true,
  // Filtro estilo Excel (lista de valores con checkboxes) en todas las columnas.
  // Sin fila de filtros flotantes: como en Excel, solo el botón en el encabezado.
  filter: SetFilter,
  filterParams: { kind: 'text' },
  floatingFilter: false,
  suppressHeaderMenuButton: true,
}

/**
 * Tabla AG Grid Community para los conceptos del CFDI.
 *
 * Props:
 *  - rows:      array de filas (una por concepto) que viene de cfdiParser
 *  - onChange:  (rowsActualizados) => void — se dispara cuando el usuario edita una celda.
 *               Así lo editado en pantalla sí llega al Excel exportado.
 */
export default function CfdiGrid({ rows, onChange }) {
  const gridRef = useRef(null)
  const [quick, setQuick] = useState('')
  const [visible, setVisible] = useState(rows.length)

  // Fila fija de totales (sobre las filas visibles tras filtrar)
  const computeTotals = useCallback((api) => {
    let botellas = 0, total = 0, n = 0
    api.forEachNodeAfterFilter(node => {
      botellas += Number(node.data?.BOTELLAS) || 0
      total    += Number(node.data?.TOTAL)    || 0
      n++
    })
    setVisible(n)
    api.setGridOption('pinnedBottomRowData', [{
      __id: '__total__',
      EMISOR: `Total (${n.toLocaleString('es-MX')} conceptos)`,
      BOTELLAS: botellas,
      TOTAL: total,
    }])
  }, [])

  const onGridReady    = useCallback(e => computeTotals(e.api), [computeTotals])
  const onModelUpdated = useCallback(e => computeTotals(e.api), [computeTotals])

  const onCellValueChanged = useCallback((e) => {
    if (!onChange) return
    // Reconstruimos el array desde lo que tiene el grid, preservando orden original
    const next = []
    // Quitamos el __id interno para que no se cuele como columna en el Excel
    e.api.forEachNode(node => { const data = { ...node.data }; delete data.__id; next.push(data) })
    // Nunca propagamos una lista vacía por un fallo del grid: eso borraría los datos del usuario
    if (next.length === 0) return
    onChange(next)
  }, [onChange])

  const pinnedRowStyle = useCallback(p =>
    p.node.rowPinned ? { fontWeight: 700, background: '#f5f6f7', borderTop: '2px solid #d9d9d9' } : undefined
  , [])

  const getRowId = useMemo(() => (p) => p.data.__id, [])

  // Cada fila necesita un id estable para que AG Grid haga updates delta en lugar de re-render total.
  const rowData = useMemo(
    () => rows.map((r, i) => (r.__id ? r : { ...r, __id: `${r.DOCUMENTO || 'x'}#${i}` })),
    [rows]
  )

  return (
    <div className="grid-container">
      <div className="grid-toolbar">
        <input
          className="grid-quick-filter"
          type="search"
          placeholder="Buscar en todas las columnas…"
          value={quick}
          onChange={e => setQuick(e.target.value)}
        />
        <span className="grid-count">
          {visible.toLocaleString('es-MX')} de {rows.length.toLocaleString('es-MX')} conceptos
        </span>
        <button
          className="grid-reset"
          type="button"
          onClick={() => { setQuick(''); gridRef.current?.api?.setFilterModel(null) }}
        >
          Quitar filtros
        </button>
      </div>
      <div className="grid-body">
        <AgGridReact
          ref={gridRef}
          theme={theme}
          localeText={AG_GRID_LOCALE_ES}
          rowData={rowData}
          getRowId={getRowId}
          columnDefs={COLUMN_DEFS}
          defaultColDef={DEFAULT_COL_DEF}
          quickFilterText={quick}
          animateRows={false}
          undoRedoCellEditing
          stopEditingWhenCellsLoseFocus
          enableCellTextSelection
          ensureDomOrder
          getRowStyle={pinnedRowStyle}
          onGridReady={onGridReady}
          onModelUpdated={onModelUpdated}
          onCellValueChanged={onCellValueChanged}
        />
      </div>
    </div>
  )
}
