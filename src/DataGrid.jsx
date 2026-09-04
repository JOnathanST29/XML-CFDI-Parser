import { forwardRef, useImperativeHandle, useMemo, useCallback, useRef } from 'react'
import { AgGridReact } from 'ag-grid-react'
import { ModuleRegistry, ValidationModule, themeQuartz } from 'ag-grid-community'
import { AllEnterpriseModule } from 'ag-grid-enterprise'
import { AG_GRID_LOCALE_ES } from '@ag-grid-community/locale'
import { DEFAULT_COL_DEF, flatColumns } from './columns'

// AG Grid Enterprise (licencia en src/agGridLicense.js). AllEnterpriseModule incluye todo Community.
// En dev sumamos ValidationModule para ver errores completos en consola (no va al bundle de prod).
const modules = [AllEnterpriseModule]
if (import.meta.env.DEV) modules.push(ValidationModule)
ModuleRegistry.registerModules(modules)

// Tema Quartz con los tokens de App.css (estilo Attio): bordes finos, grises neutros, Inter 13px
const theme = themeQuartz.withParams({
  accentColor: '#2f6fed',
  backgroundColor: '#ffffff',
  foregroundColor: '#1b1b1d',
  borderColor: '#e6e7ea',
  rowBorder: true,
  columnBorder: false,
  headerBackgroundColor: '#fafafa',
  headerTextColor: '#6b6f76',
  headerFontWeight: 500,
  headerColumnBorder: false,
  oddRowBackgroundColor: '#ffffff',
  rowHoverColor: '#f7f7f8',
  selectedRowBackgroundColor: '#eaf1ff',
  rangeSelectionBorderColor: '#2f6fed',
  rangeSelectionBackgroundColor: 'rgba(47,111,237,.08)',
  chromeBackgroundColor: '#fafafa',
  fontFamily: "'Inter Variable', Inter, system-ui, -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
  fontSize: 13,
  headerFontSize: 12.5,
  iconSize: 16,
  rowHeight: 36,
  headerHeight: 36,
  cellHorizontalPadding: 12,
  borderRadius: 6,
  wrapperBorderRadius: 0,
  wrapperBorder: false,
  menuBorder: true,
  menuShadow: '0 12px 32px rgba(16,24,40,.14), 0 2px 6px rgba(16,24,40,.06)',
})

// Estilos para el Excel exportado (se aplican por cellClass; ver columns.js)
const EXCEL_STYLES = [
  { id: 'xl-money', numberFormat: { format: '#,##0.00' } },
  { id: 'xl-date',  dataType: 'DateTime', numberFormat: { format: 'yyyy-mm-dd' } },
  { id: 'header',   font: { bold: true }, interior: { color: '#F5F6F7', pattern: 'Solid' } },
]

const SIDE_BAR = {
  toolPanels: [{
    id: 'columns',
    labelDefault: 'Columnas',
    labelKey: 'columns',
    iconKey: 'columns',
    toolPanel: 'agColumnsToolPanel',
    toolPanelParams: {
      suppressRowGroups: true, suppressValues: true, suppressPivots: true,
      suppressPivotMode: true, suppressColumnFilter: false, suppressColumnSelectAll: false,
    },
  }],
  // Cerrado por default; el botón "Columnas" queda a la derecha
}

/**
 * Grid AG Grid Enterprise reutilizable para las vistas de conceptos y facturas.
 *
 * Props:
 *  - columnDefs, rowData, getRowId
 *  - labelField: campo donde va el texto "Total (n filas)" en la fila fija de totales
 *  - onVisibleRows(rows[]): se llama con las filas que pasan el filtro cada vez que cambia el modelo
 *  - onChange(rows[]): al editar una celda, con todas las filas actualizadas
 *  - quickFilterText
 */
const DataGrid = forwardRef(function DataGrid(
  { columnDefs, rowData, getRowId, labelField, onVisibleRows, onChange, quickFilterText = '', domLayout, compact = false, compactColumns = [] },
  ref,
) {
  const gridRef = useRef(null)

  // Celular: solo las columnas esenciales (el Excel sigue llevando todas), sin panel lateral ni barra de grupos
  const onGridReady = useCallback((e) => {
    if (!compact || !compactColumns.length) return
    const keep = new Set(compactColumns)
    e.api.applyColumnState({
      state: flatColumns(columnDefs).map(c => ({ colId: c.field, hide: !keep.has(c.field) })),
    })
  }, [compact, compactColumns, columnDefs])
  useImperativeHandle(ref, () => ({ get api() { return gridRef.current?.api ?? null } }), [])

  const sumFields = useMemo(
    () => flatColumns(columnDefs).filter(c => c.context?.sum).map(c => c.field),
    [columnDefs],
  )

  // Fila fija de totales (solo sobre las filas visibles tras filtrar) + aviso a App con las filas visibles
  const recompute = useCallback((api) => {
    const sums = Object.fromEntries(sumFields.map(f => [f, 0]))
    const visible = []
    api.forEachNodeAfterFilter(node => {
      if (node.group || !node.data) return
      visible.push(node.data)
      for (const f of sumFields) sums[f] += Number(node.data[f]) || 0
    })
    for (const f of sumFields) sums[f] = Math.round(sums[f] * 100) / 100
    api.setGridOption('pinnedBottomRowData', [{
      __id: '__total__',
      [labelField]: `Total (${visible.length.toLocaleString('es-MX')} filas)`,
      ...sums,
    }])
    onVisibleRows?.(visible)
  }, [sumFields, labelField, onVisibleRows])

  const onModelUpdated = useCallback(e => recompute(e.api), [recompute])

  const onCellValueChanged = useCallback((e) => {
    if (!onChange) return
    const next = []
    e.api.forEachLeafNode(node => next.push(node.data))
    if (next.length === 0) return // nunca propagar vacío por un fallo del grid
    onChange(next)
    recompute(e.api)
  }, [onChange, recompute])

  const rowId = useCallback(p => (p.data.__id ? p.data.__id : getRowId(p.data)), [getRowId])

  const getRowStyle = useCallback(p =>
    p.node.rowPinned ? { fontWeight: 600, background: '#fafafa', borderTop: '1px solid #d3d5da' } : undefined
  , [])

  // Menú contextual: solo copiar y ajustar columnas (la exportación va por el botón de la app)
  const getContextMenuItems = useCallback(() => [
    'copy', 'copyWithHeaders', 'separator', 'autoSizeAll', 'resetColumns',
  ], [])

  return (
    <AgGridReact
      ref={gridRef}
      theme={theme}
      localeText={AG_GRID_LOCALE_ES}
      rowData={rowData}
      getRowId={rowId}
      columnDefs={columnDefs}
      defaultColDef={DEFAULT_COL_DEF}
      quickFilterText={quickFilterText}
      domLayout={domLayout}
      animateRows
      cellSelection
      undoRedoCellEditing
      undoRedoCellEditingLimit={50}
      stopEditingWhenCellsLoseFocus
      enterNavigatesVerticallyAfterEdit
      sideBar={compact ? false : SIDE_BAR}
      rowGroupPanelShow={compact ? 'never' : 'always'}
      groupDefaultExpanded={1}
      suppressAggFuncInHeader
      excelStyles={EXCEL_STYLES}
      getRowStyle={getRowStyle}
      getContextMenuItems={getContextMenuItems}
      tooltipShowDelay={400}
      onGridReady={onGridReady}
      onModelUpdated={onModelUpdated}
      onCellValueChanged={onCellValueChanged}
    />
  )
})

export default DataGrid
