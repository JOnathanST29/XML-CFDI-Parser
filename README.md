# XML · CFDI Parser

Convierte facturas electrónicas mexicanas (CFDI 4.0 del SAT) a Excel directamente desde el navegador.

> **Privacidad por diseño:** todo el procesamiento ocurre localmente. Tus XMLs nunca se envían a ningún servidor.

🌐 **Sitio en vivo:** [excelcfdi.com](https://excelcfdi.com)

---

## ¿Qué problema resuelve?

Cada vez que llega una factura del SAT (compra a un proveedor, gasto, etc.), te llegan **dos archivos**:

- Un **PDF** legible para humanos
- Un **XML** con la información estructurada (es lo que vale legalmente)

Cuando tienes 30, 60, 200 facturas al mes y necesitas **resumir las compras en un Excel**
(¿qué compré?, ¿cuánto?, ¿a quién?, ¿cuándo?), abrirlas una por una es un infierno.

Las herramientas existentes hacen una de dos cosas:

1. **Te piden subir los XMLs a su servidor** — riesgo de privacidad (los CFDIs traen RFC,
   montos, productos, sellos digitales), y muchas son de pago.
2. **Te piden instalar software de escritorio** — Windows-only, drivers, contraseñas, etc.

Esta herramienta:

- Corre 100% en el navegador (cualquier OS, sin instalar nada)
- No envía los XMLs a ningún lado (literalmente — no hay backend)
- Es gratis y sin login
- Genera el Excel listo para descargar

## ¿Cómo se usa? (flujo del usuario)

1. Abres la app (es una sola página)
2. Aparece un dialog de bienvenida explicando que todo es local — solo la primera vez
3. Arrastras XMLs (o varios a la vez) al dropzone
4. Aparece una tabla (AG Grid) con los conceptos extraídos
5. Puedes **filtrar, ordenar y editar** con filtros estilo Excel (lista de valores con checkboxes; las fechas en árbol Año → Mes → Día). Lo que edites en la tabla es lo que se exporta
6. Escribes el nombre del archivo y das clic en **Descargar Excel**
7. El archivo se descarga a tu computadora — fin

Comportamientos útiles:
- **Cargas múltiples se acumulan** (puedes ir agregando lotes)
- **Duplicados se omiten automáticamente** por UUID del CFDI
- **El botón "Limpiar"** vacía todo si quieres empezar de cero
- Si no pones `.xlsx` al nombre, se agrega solo

## ¿Cómo funciona por dentro?

```
┌─────────────────┐     ┌──────────────┐     ┌──────────────┐     ┌─────────────┐
│ XML del SAT     │ →   │ DOMParser    │ →   │ AG Grid      │ →   │ AG Grid     │
│ (drag & drop)   │     │ (cfdiParser) │     │ (2 vistas)   │     │ Excel export│
└─────────────────┘     └──────────────┘     └──────────────┘     └─────────────┘
        ↑                                                                ↓
   Tu navegador  ─────────────────────────────────────────────────  Tu computadora
                  (nada sale a Internet en ningún momento)
```

### Archivos principales

| Archivo | Qué hace |
|---|---|
| [`src/cfdiParser.js`](src/cfdiParser.js) | Lee CFDI 3.3 y 4.0 con `DOMParser`: cabecera completa, impuestos por tasa (traslados, retenciones, locales), nómina, complemento de pago. Devuelve conceptos, facturas, columnas de impuestos y un resumen de la carga (leídas, omitidas con motivo, repetidas) |
| [`src/DataGrid.jsx`](src/DataGrid.jsx) | Grid AG Grid Enterprise reutilizable: fila de totales sobre lo filtrado, selección de rangos y copiar, panel de columnas, agrupar arrastrando, undo |
| [`src/columns.js`](src/columns.js) | Definiciones de columnas de las vistas Conceptos y Facturas; las columnas de impuestos se generan según lo que traigan los XML |
| [`src/catalogos.js`](src/catalogos.js) | Catálogos del SAT (tipo de comprobante, formas y métodos de pago, impuestos, uso CFDI, regímenes) para mostrar nombres legibles |
| [`src/agGridLicense.js`](src/agGridLicense.js) | Registra la licencia Enterprise desde `AG_GRID_ENTERPRISE_KEY` (ver `.env.example`) |
| [`src/SetFilter.jsx`](src/SetFilter.jsx) | Filtro estilo Excel (lista de valores con checkboxes, árbol de fechas, orden A-Z, buscar) para AG Grid Community |
| [`src/exporter.js`](src/exporter.js) | Exporta con AG Grid Enterprise: 2 hojas (Conceptos y Facturas), respeta filtro y orden, incluye todas las columnas, fechas y montos con formato real. En celular ofrece "Compartir" |
| [`src/App.jsx`](src/App.jsx) | UI principal: dropzone, recibo de carga, KPIs que siguen al filtro, pestañas Conceptos/Facturas, descarga con confirmación, Limpiar con confirmación, aviso de privacidad como capa (la tabla conserva filtros) |
| [`src/Privacy.jsx`](src/Privacy.jsx) | Página completa con el aviso de privacidad (LFPDPPP) |
| [`src/WelcomeDialog.jsx`](src/WelcomeDialog.jsx) | Modal de bienvenida (primera visita, persistido en localStorage) |
| [`src/App.css`](src/App.css) | Sistema visual inspirado en Attio: tokens en `:root` (superficies, bordes, texto, acento, estados), Inter empaquetada localmente, botón primario negro |

### Decisiones clave (y por qué)

- **Vite + React (JSX, sin TypeScript):** rápido para iterar, no necesitamos tipos para una app tan acotada.
- **Sin react-router:** un solo flag `view` en `useState` basta para alternar entre home y privacy. Ahorra ~10 KB.
- **AG Grid Enterprise en lugar de Univer:** antes usábamos Univer (hoja estilo Excel con fórmulas). Pesaba ~1.7 MB gzip
  y nada de lo que el usuario editaba o filtraba llegaba al Excel exportado. AG Grid es DOM (funciona Ctrl+F, selección
  de texto, touch), y con Enterprise tenemos exportación a Excel nativa (respeta filtros, formatos reales, varias hojas),
  selección de rangos con copiar, panel de columnas y agrupación arrastrando encabezados. Bundle: ~750 KB gzip.
- **Licencia Enterprise por variable de entorno:** `AG_GRID_ENTERPRISE_KEY` en `.env.local` (ignorado por git; el repo es
  público) y como secret del mismo nombre en GitHub Actions. Sin clave todo funciona pero con marca de agua.
- **Filtro estilo Excel propio (`SetFilter.jsx`):** lo construimos cuando estábamos en Community y a los usuarios les gustó
  ("Excel calcado"), así que lo conservamos: lista de valores con conteo, árbol Año → Mes → Día en fechas, y la lista solo
  muestra los valores que sobreviven a los filtros de las demás columnas, igual que Excel.
- **Dos vistas, un solo estado:** Conceptos (una fila por renglón) y Facturas (una fila por UUID) se montan las dos y se
  alternan con `hidden`, para que el Excel salga con ambas hojas y para no perder filtros al cambiar de pestaña.
- **Totales con criterio fiscal:** ingresos suman, egresos (notas de crédito) restan, nómina/pago/traslado se excluyen.
  Monedas distintas de MXN se convierten con el `TipoCambio` del XML. Los KPIs se calculan sobre lo filtrado.
- **Fechas en hora local:** el CFDI trae `2026-01-15T19:30:00` sin zona; se interpreta y formatea con hora local, nunca
  con `toISOString()` (que convertía a UTC y corría un día las facturas timbradas después de las 18:00).
- **Columnas de impuestos dinámicas:** se crea una columna por cada combinación impuesto + tasa presente en los XML
  (`IVA 16%`, `IVA 8%`, `IVA exento`, `IEPS 26.5%`, `Ret. ISR`, `Ret. IVA`, `ISH 3% (local)`...). Así no asumimos 16% ni
  mezclamos IEPS con IVA.
- **localStorage para el welcome:** clave `cfdi-parser:welcome-seen`. Borra esa clave para volver a verlo.
- **Sin analytics ni cookies:** la promesa de privacidad es vinculante; cualquier script de tracking la rompería.

### Columnas extraídas

**Por factura** (pestaña Facturas y hoja "Facturas"): `TIPO`, `FACTURA` (serie+folio), `FECHA`, `FECHA_TIMBRADO`, `EMISOR`,
`RFC_EMISOR`, `REGIMEN_EMISOR`, `RECEPTOR`, `RFC_RECEPTOR`, `USO_CFDI`, `MONEDA`, `TIPO_CAMBIO`, `METODO_PAGO`, `FORMA_PAGO`,
`LUGAR_EXPEDICION`, `SUBTOTAL`, `DESCUENTO`, una columna por impuesto y tasa (`TRAS_IVA_16`, `TRAS_IEPS_26_5`, `RET_ISR`,
`RET_IVA`, `TRAS_LOCAL_ISH`...), `IMPUESTOS_TRASLADADOS`, `IMPUESTOS_RETENIDOS`, `TOTAL`, `TOTAL_MXN`, `NUM_CONCEPTOS`,
`UUID`, `VERSION`, `ARCHIVO`. En nómina: `NOMINA_PERCEPCIONES`, `NOMINA_DEDUCCIONES`, `NOMINA_ISR_RETENIDO`. En pagos:
`PAGO_MONTO`, `PAGO_NUM_DOCTOS`, `PAGO_DOCUMENTOS`.

**Por concepto** (pestaña Conceptos y hoja "Conceptos"): la cabecera de la factura repetida en cada fila, más
`NUM_CONCEPTO`, `CLAVE_PROD_SERV`, `CODIGO_PRODUCTO` (NoIdentificacion), `PRODUCTO`, `CANTIDAD`, `CLAVE_UNIDAD`, `UNIDAD`,
`VALOR_UNITARIO`, `IMPORTE` (sin impuestos), `DESCUENTO_CONCEPTO`, los impuestos del renglón por tasa, e
`IMPORTE_CON_IMPUESTOS` (importe − descuento + trasladados − retenidos).

> Una fila **por concepto** en la vista Conceptos: si una factura tiene 5 productos, son 5 filas con la misma cabecera.
> Para una fila por comprobante usa la pestaña Facturas. El Excel siempre trae las dos hojas.

## Identidad

Marca "CFDI a Excel". Archivos en `public/`:

| Archivo | Uso |
|---|---|
| `logo-mark.svg` | Marca sola (cuadro negro con tabla y celda verde). Es también `favicon.svg` y el ícono del header |
| `logo.svg` / `logo-white.svg` | Lockup con wordmark para fondo claro / oscuro |
| `apple-touch-icon.png` | 180×180 para iOS |
| `og-image.png` | 1200×630 para previews en redes y WhatsApp |

Los PNG se generaron en el navegador con canvas a partir del SVG (no hay conversor en el repo); si cambias la marca, vuelve a generarlos.

## Stack

- [Vite](https://vite.dev/) — build tool / dev server
- [React](https://react.dev/) — UI
- [AG Grid Enterprise](https://www.ag-grid.com/) — tabla con filtros, edición, rangos, agrupación y exportación a Excel
  - `ag-grid-enterprise` + `ag-grid-react` + `@ag-grid-community/locale` (español)
  - Tema Quartz con los mismos tokens que la app
- Estilo inspirado en [Attio](https://attio.com): fondo `#fafafa`, superficies blancas con borde `#e6e7ea`, texto `#1b1b1d`, acento `#2f6fed` solo para foco y selección, [Inter](https://rsms.me/inter/) vía `@fontsource-variable/inter` (sin llamadas a Google Fonts)

## Desarrollo

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # output en dist/
npm run preview  # sirve dist/ localmente
```

### Probar el welcome dialog otra vez

```js
// En la consola del navegador:
localStorage.removeItem('cfdi-parser:welcome-seen')
location.reload()
```

### Agregar más campos del CFDI

El parser está en [`src/cfdiParser.js`](src/cfdiParser.js). Solo hay que:

1. Leerlo en `parseCFDI` de [`src/cfdiParser.js`](src/cfdiParser.js): en `cabecera` si es de la factura, o en el
   bucle de conceptos si es del renglón (`attr(c, 'XXX')`)
2. Agregar la columna en `conceptoColumns` o `facturaColumns` de [`src/columns.js`](src/columns.js) usando los helpers
   `text`, `money` o `date` (`hide: true` si no debe verse por default; el Excel la incluye de todos modos)

Complementos que todavía no se leen y podrían agregarse: carta porte, comercio exterior, donatarias, INE.

## Privacidad

Los CFDIs contienen información fiscal sensible (RFCs, montos, productos, sellos digitales).
Por eso esta herramienta fue diseñada para que **nada salga de tu computadora**:

- No hay servidor que reciba archivos
- El parseo se hace con `DOMParser` del navegador
- El Excel se genera y descarga 100% local
- No se usan cookies ni servicios de analítica que rastreen usuarios

Aviso completo disponible dentro de la app (footer → "Aviso de Privacidad").

## Roadmap / ideas pendientes

- [ ] Deploy a Vercel/Netlify
- [ ] Analytics privacy-friendly (Umami o Plausible) opcional
- [x] Resumen por proveedor: arrastra el encabezado Emisor a la barra de grupos

## Licencia

Proyecto personal de uso libre.
