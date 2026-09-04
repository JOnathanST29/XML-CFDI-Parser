import { useState, useMemo, useCallback, useRef, useEffect } from 'react'
import { useGridFilter } from 'ag-grid-react'

/**
 * Filtro estilo Excel para AG Grid Community.
 *
 * Muestra la lista de valores únicos de la columna con checkboxes,
 * búsqueda, "Seleccionar todo", orden A-Z / Z-A y botones Aceptar / Cancelar.
 * Para fechas arma un árbol Año → Mes → Día, igual que Excel.
 *
 * Se configura vía filterParams:
 *   kind:   'text' | 'number' | 'date'
 *   format: (valor) => string   — cómo mostrar el valor en la lista (opcional)
 *
 * Modelo del filtro: { values: string[] } (claves seleccionadas) o null (sin filtro).
 */

const MESES = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre']
const EMPTY_LABEL = '(Vacías)'
// Mismos textos que usa Excel en español según el tipo de columna
const SORT_LABELS = {
  text:   ['Ordenar de A a Z', 'Ordenar de Z a A'],
  number: ['Ordenar de menor a mayor', 'Ordenar de mayor a menor'],
  date:   ['Ordenar de más antiguos a más recientes', 'Ordenar de más recientes a más antiguos'],
}

const toDate = (v) => {
  if (!v) return null
  const d = v instanceof Date ? v : new Date(v)
  return isNaN(d) ? null : d
}
const pad = (n) => String(n).padStart(2, '0')

function keyOf(value, kind) {
  if (kind === 'date') {
    const d = toDate(value)
    return d ? `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` : ''
  }
  if (kind === 'number') return value == null || value === '' ? '' : String(Number(value))
  return value == null ? '' : String(value).trim()
}

// Construye los items de la lista (plano) o del árbol (fechas) a partir de un mapa clave → conteo
function buildItems(counts, kind, format) {
  const keys = [...counts.keys()]

  if (kind === 'date') {
    const years = new Map()
    for (const k of keys) {
      if (!k) continue
      const [y, m, d] = k.split('-')
      if (!years.has(y)) years.set(y, new Map())
      const months = years.get(y)
      if (!months.has(m)) months.set(m, [])
      months.get(m).push({ key: k, label: String(Number(d)), count: counts.get(k) })
    }
    const tree = [...years.keys()].sort((a, b) => b.localeCompare(a)).map(y => ({
      key: `y:${y}`, label: y,
      children: [...years.get(y).keys()].sort().map(m => ({
        key: `m:${y}-${m}`, label: MESES[Number(m) - 1],
        children: years.get(y).get(m).sort((a, b) => a.key.localeCompare(b.key)),
      })),
    }))
    if (counts.has('')) tree.push({ key: '', label: EMPTY_LABEL, count: counts.get('') })
    return tree
  }

  const sorted = kind === 'number'
    ? keys.sort((a, b) => (a === '' ? 1 : b === '' ? -1 : Number(a) - Number(b)))
    : keys.sort((a, b) => (a === '' ? 1 : b === '' ? -1 : a.localeCompare(b, 'es', { sensitivity: 'base' })))

  return sorted.map(k => ({
    key: k,
    label: k === '' ? EMPTY_LABEL : (format ? format(kind === 'number' ? Number(k) : k) : k),
    count: counts.get(k),
  }))
}

const leavesOf = (item) => item.children ? item.children.flatMap(leavesOf) : [item]

function Checkbox({ state, onChange, children, className }) {
  const ref = useRef(null)
  useEffect(() => { if (ref.current) ref.current.indeterminate = state === 'some' }, [state])
  return (
    <label className={`sf-item ${className || ''}`}>
      <input ref={ref} type="checkbox" checked={state === 'all'} onChange={onChange} />
      <span className="sf-item-label">{children}</span>
    </label>
  )
}

export default function SetFilter(props) {
  const { model, onModelChange, getValue, api, column, colDef, doesRowPassOtherFilter, kind = 'text', format } = props

  const [items, setItems]       = useState([])
  const [allKeys, setAllKeys]   = useState([])
  const [selected, setSelected] = useState(() => new Set())
  const [search, setSearch]     = useState('')
  const [expanded, setExpanded] = useState(() => new Set())

  // ── Lógica del filtro (lo que AG Grid evalúa por fila) ──
  const modelSet = useMemo(() => (model?.values ? new Set(model.values) : null), [model])

  const doesFilterPass = useCallback(({ node }) => {
    if (!modelSet) return true
    return modelSet.has(keyOf(getValue(node), kind))
  }, [modelSet, getValue, kind])

  // Al abrir el popup: recalcular valores disponibles (respetando los filtros de OTRAS columnas, como Excel)
  const afterGuiAttached = useCallback(() => {
    const counts = new Map()
    api.forEachLeafNode(node => {
      if (!doesRowPassOtherFilter(node)) return
      const k = keyOf(getValue(node), kind)
      counts.set(k, (counts.get(k) || 0) + 1)
    })
    const built = buildItems(counts, kind, format)
    const keys  = built.flatMap(leavesOf).map(l => l.key)
    setItems(built)
    setAllKeys(keys)
    setSelected(new Set(modelSet ? keys.filter(k => modelSet.has(k)) : keys))
    setSearch('')
    // Años expandidos por default, meses colapsados (como Excel)
    setExpanded(new Set(built.filter(i => i.children).map(i => i.key)))
  }, [api, getValue, doesRowPassOtherFilter, kind, format, modelSet])

  useGridFilter({ doesFilterPass, afterGuiAttached })

  // ── Búsqueda ──
  const q = search.trim().toLowerCase()
  const matches = useCallback((item, parents = []) => {
    if (!q) return true
    const hay = [...parents, item.label].join(' ').toLowerCase()
    return hay.includes(q)
  }, [q])

  const visibleItems = useMemo(() => {
    if (!q) return items
    const prune = (list, parents) => list.flatMap(it => {
      if (it.children) {
        const kids = prune(it.children, [...parents, it.label])
        return kids.length ? [{ ...it, children: kids }] : []
      }
      return matches(it, parents) ? [it] : []
    })
    return prune(items, [])
  }, [items, q, matches])

  const visibleLeafKeys = useMemo(() => visibleItems.flatMap(leavesOf).map(l => l.key), [visibleItems])

  // ── Selección ──
  const stateOf = (keys) => {
    const n = keys.filter(k => selected.has(k)).length
    return n === 0 ? 'none' : n === keys.length ? 'all' : 'some'
  }
  const toggleKeys = (keys, on) => {
    setSelected(prev => {
      const next = new Set(prev)
      keys.forEach(k => on ? next.add(k) : next.delete(k))
      return next
    })
  }
  const toggleExpand = (key) => setExpanded(prev => {
    const next = new Set(prev)
    next.has(key) ? next.delete(key) : next.add(key)
    return next
  })

  // ── Acciones ──
  const apply = () => {
    const all = allKeys.every(k => selected.has(k))
    onModelChange(all ? null : { values: [...selected] })
    api.hidePopupMenu?.()
  }
  const cancel = () => api.hidePopupMenu?.()
  const clear  = () => { onModelChange(null); api.hidePopupMenu?.() }
  const sort   = (dir) => {
    api.applyColumnState({ state: [{ colId: column.getColId(), sort: dir }], defaultState: { sort: null } })
    api.hidePopupMenu?.()
  }

  const renderItems = (list, depth = 0) => list.map(it => {
    if (it.children) {
      const keys = leavesOf(it).map(l => l.key)
      const open = expanded.has(it.key) || !!q
      return (
        <div key={it.key} className="sf-group" style={{ '--depth': depth }}>
          <div className="sf-group-row">
            <button type="button" className="sf-caret" onClick={() => toggleExpand(it.key)} aria-label={open ? 'Contraer' : 'Expandir'}>
              {open ? '▾' : '▸'}
            </button>
            <Checkbox state={stateOf(keys)} onChange={e => toggleKeys(keys, e.target.checked)}>{it.label}</Checkbox>
          </div>
          {open && renderItems(it.children, depth + 1)}
        </div>
      )
    }
    return (
      <div key={it.key} className="sf-leaf" style={{ '--depth': depth }}>
        <Checkbox state={selected.has(it.key) ? 'all' : 'none'} onChange={e => toggleKeys([it.key], e.target.checked)}>
          {it.label}<span className="sf-count">{it.count}</span>
        </Checkbox>
      </div>
    )
  })

  const allState = stateOf(visibleLeafKeys)

  return (
    <div className="sf">
      <button type="button" className="sf-menu" onClick={() => sort('asc')}>{SORT_LABELS[kind][0]}</button>
      <button type="button" className="sf-menu" onClick={() => sort('desc')}>{SORT_LABELS[kind][1]}</button>
      <div className="sf-sep" />
      <button type="button" className="sf-menu" onClick={clear} disabled={!model}>
        Borrar filtro de «{colDef.headerName}»
      </button>
      <div className="sf-sep" />
      <input
        className="sf-search"
        type="search"
        placeholder="Buscar"
        value={search}
        onChange={e => setSearch(e.target.value)}
      />
      <div className="sf-list">
        {visibleLeafKeys.length === 0 ? (
          <div className="sf-empty">Sin coincidencias</div>
        ) : (
          <>
            <Checkbox
              className="sf-all"
              state={allState}
              onChange={e => toggleKeys(visibleLeafKeys, e.target.checked)}
            >
              {q ? '(Seleccionar todos los resultados de la búsqueda)' : '(Seleccionar todo)'}
            </Checkbox>
            {renderItems(visibleItems)}
          </>
        )}
      </div>
      <div className="sf-actions">
        <button type="button" className="sf-ok" onClick={apply} disabled={selected.size === 0}>Aceptar</button>
        <button type="button" className="sf-cancel" onClick={cancel}>Cancelar</button>
      </div>
    </div>
  )
}
