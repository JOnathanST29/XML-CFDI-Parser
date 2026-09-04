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
│ XML del SAT     │ →   │ DOMParser    │ →   │ AG Grid      │ →   │ SheetJS     │
│ (drag & drop)   │     │ (cfdiParser) │     │ (UI editable)│     │ (.xlsx)     │
└─────────────────┘     └──────────────┘     └──────────────┘     └─────────────┘
        ↑                                                                ↓
   Tu navegador  ─────────────────────────────────────────────────  Tu computadora
                  (nada sale a Internet en ningún momento)
```

### Archivos principales

| Archivo | Qué hace |
|---|---|
| [`src/cfdiParser.js`](src/cfdiParser.js) | Lee el XML del CFDI con `DOMParser` y devuelve un array de filas (una por concepto del comprobante) |
| [`src/CfdiGrid.jsx`](src/CfdiGrid.jsx) | Tabla AG Grid Community: columnas tipadas, edición conectada al estado, fila de totales y buscador global |
| [`src/SetFilter.jsx`](src/SetFilter.jsx) | Filtro estilo Excel (lista de valores con checkboxes, árbol de fechas, orden A-Z, buscar) para AG Grid Community |
| [`src/exporter.js`](src/exporter.js) | Toma las filas y genera un `.xlsx` con SheetJS, agregando la extensión si falta |
| [`src/App.jsx`](src/App.jsx) | UI principal: dropzone, KPIs, toolbar, routing simple home/privacy |
| [`src/Privacy.jsx`](src/Privacy.jsx) | Página completa con el aviso de privacidad (LFPDPPP) |
| [`src/WelcomeDialog.jsx`](src/WelcomeDialog.jsx) | Modal de bienvenida (primera visita, persistido en localStorage) |
| [`src/App.css`](src/App.css) | Estilos inspirados en SAP Fiori (paleta, tipografía 72, layout shell) |

### Decisiones clave (y por qué)

- **Vite + React (JSX, sin TypeScript):** rápido para iterar, no necesitamos tipos para una app tan acotada.
- **Sin react-router:** un solo flag `view` en `useState` basta para alternar entre home y privacy. Ahorra ~10 KB.
- **AG Grid Community en lugar de Univer:** antes usábamos Univer (hoja estilo Excel con fórmulas). Pesaba ~1.7 MB gzip
  y nada de lo que el usuario editaba o filtraba llegaba al Excel exportado (el export salía del estado de React).
  AG Grid es DOM (funciona Ctrl+F, selección de texto, touch), pesa ~4 veces menos y las ediciones sí se exportan.
- **Registro modular de AG Grid:** solo se registran los módulos que usamos en `CfdiGrid.jsx`. Si usas una API nueva
  del grid y sale `AG Grid: error #200`, falta registrar el módulo que indica el link. En dev se carga `ValidationModule`
  para que el mensaje sea explícito.
- **Filtro estilo Excel propio (`SetFilter.jsx`):** el Set Filter con checkboxes de AG Grid es Enterprise (de pago),
  así que lo implementamos como custom filter component. Igual que Excel, la lista solo muestra los valores que sobreviven
  a los filtros de las demás columnas.
- **localStorage para el welcome:** clave `cfdi-parser:welcome-seen`. Borra esa clave para volver a verlo.
- **Sin analytics ni cookies:** la promesa de privacidad es vinculante; cualquier script de tracking la rompería.

### Columnas extraídas

| Columna del Excel | De dónde sale en el XML |
|---|---|
| `EMISOR` | `cfdi:Emisor/@Nombre` |
| `RFC_EMISOR` | `cfdi:Emisor/@Rfc` |
| `FECHA` | `cfdi:Comprobante/@Fecha` |
| `FACTURA` | `@Serie` + `@Folio` |
| `RECEPTOR` | `cfdi:Receptor/@Nombre` |
| `RFC_RECEPTOR` | `cfdi:Receptor/@Rfc` |
| `CODIGO_PRODUCTO` | `cfdi:Concepto/@NoIdentificacion` |
| `PRODUCTO` | `cfdi:Concepto/@Descripcion` |
| `BOTELLAS` | `cfdi:Concepto/@Cantidad` |
| `TOTAL` | `cfdi:Concepto/@Importe` |
| `DOCUMENTO` | `tfd:TimbreFiscalDigital/@UUID` |

> Una fila **por concepto**: si una factura tiene 5 productos diferentes, genera 5 filas (todos los datos
> de cabecera se repiten en cada fila — eso permite filtrar por proveedor, fecha, etc. directamente).

> **Notas sobre nombres:**
> - `BOTELLAS` mantiene la convención del Excel original con el que cruzamos datos. Realmente es la
>   cantidad del concepto (puede ser piezas, kg, lo que sea). No lo renombré para mantener compatibilidad.
> - `CODIGO_PRODUCTO` es lo que el emisor pone como SKU/código interno. No es la `ClaveProdServ`
>   del SAT (que es genérica, ej. `50202200` = bebidas alcohólicas).

## Stack

- [Vite](https://vite.dev/) — build tool / dev server
- [React](https://react.dev/) — UI
- [AG Grid Community](https://www.ag-grid.com/) (MIT) — tabla con sorting, edición y filtros
  - `ag-grid-community` + `ag-grid-react` + `@ag-grid-community/locale` (español)
  - Tema Quartz con la paleta Fiori
- [SheetJS](https://sheetjs.com/) (`xlsx`) — generación del `.xlsx` descargable
- Estilo inspirado en [SAP Fiori](https://experience.sap.com/fiori-design-web/) (paleta azul `#0070f2`, tipografía 72, shell header)

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

1. Leer el atributo nuevo en el bucle de conceptos (`c.getAttribute('XXX')`)
2. Agregar la columna al objeto que se hace `push`
3. Agregar la columna en `COLUMN_DEFS` de [`src/CfdiGrid.jsx`](src/CfdiGrid.jsx) (con `filterParams.kind` = `text`, `number` o `date`) y en `COLUMNS` de [`src/exporter.js`](src/exporter.js)

Campos del CFDI que no estamos usando hoy y podrían ser útiles:
- `cfdi:Comprobante/@SubTotal`, `@Total`, `@Moneda`, `@TipoDeComprobante`, `@FormaPago`, `@MetodoPago`
- `cfdi:Concepto/@ClaveProdServ` (catálogo SAT) y `@ClaveUnidad`
- Impuestos por concepto (IVA, IEPS) — están en `cfdi:Traslados`

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
- [ ] Soporte para CFDI 3.3 (legacy) además de 4.0
- [ ] Detectar tipo de comprobante (Ingreso/Egreso/Pago) y filtrar
- [ ] Modo "Resumen por proveedor" — agrupa conceptos por EMISOR

## Licencia

Proyecto personal de uso libre.
