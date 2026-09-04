export default function HowToCard({ compact = false }) {
  return (
    <div className={`how-to-card${compact ? ' how-to-card--compact' : ''}`}>
      <div className="how-to-header">¿Cómo se usa?</div>
      <div className="how-to-body">
        <ol className="how-to-steps">
          <li>
            <span className="step-num">1</span>
            <div>
              <strong>Consigue tus archivos XML</strong>
              <p>
                Cada factura del SAT trae un PDF y un XML. Aquí necesitas el <strong>XML</strong>
                {' '}(el archivo que termina en <code>.xml</code>). El PDF no sirve para esto.
              </p>
              <p className="step-hint">
                💡 Si solo tienes el PDF, búscalo en tu correo: el proveedor te envió ambos archivos juntos.
                También puedes descargarlos del portal del SAT.
              </p>
            </div>
          </li>
          <li>
            <span className="step-num">2</span>
            <div>
              <strong>Arrástralos al recuadro de arriba</strong>
              <p>
                Selecciona uno o varios archivos XML desde tu Finder/Explorador y arrástralos
                al recuadro punteado. También puedes hacer clic ahí y seleccionarlos manualmente.
              </p>
              <p className="step-hint">
                💡 Puedes cargar varios lotes — los archivos se acumulan. Si arrastras el mismo XML
                dos veces, no se duplica.
              </p>
            </div>
          </li>
          <li>
            <span className="step-num">3</span>
            <div>
              <strong>Revisa y edita en la tabla</strong>
              <p>
                Verás dos pestañas: <strong>Conceptos</strong> (una fila por producto o servicio) y{' '}
                <strong>Facturas</strong> (una fila por comprobante con subtotal, impuestos y total).
                Puedes ordenar, filtrar como en Excel (clic en el ícono del encabezado y marca los valores),
                buscar, agrupar por proveedor arrastrando un encabezado a la barra de arriba, o editar celdas con
                doble clic. Las columnas que no ves están en el panel <strong>Columnas</strong> a la derecha.
              </p>
              <p className="step-hint">
                💡 Los cuadros de resumen y la fila de totales siguen al filtro. Las notas de crédito restan;
                nómina y complementos de pago no entran al total.
              </p>
            </div>
          </li>
          <li>
            <span className="step-num">4</span>
            <div>
              <strong>Descarga el Excel</strong>
              <p>
                Escribe el nombre que quieras para tu archivo y haz clic en{' '}
                <strong>Descargar Excel</strong>. Se exporta lo que ves (con filtros y orden) en dos hojas,
                Conceptos y Facturas, con todas las columnas. Si no le pones <code>.xlsx</code> al final,
                se agrega solo. El archivo se guarda en tu carpeta de Descargas.
              </p>
            </div>
          </li>
        </ol>

        <div className="how-to-faq">
          <strong>Preguntas frecuentes</strong>
          <details>
            <summary>¿Mis facturas se guardan en algún servidor?</summary>
            <p>
              No. Todo ocurre dentro de tu navegador. Los archivos nunca se envían a Internet.
              Si cierras la pestaña, todo se borra de la memoria.
            </p>
          </details>
          <details>
            <summary>¿Funciona con CFDI 3.3 (versión vieja)?</summary>
            <p>
              Sí. Lee <strong>CFDI 4.0</strong> (obligatorio desde 2023) y <strong>CFDI 3.3</strong>.
              Las versiones anteriores (3.2 y más viejas) no se leen; al cargarlas aparecen en el recibo como omitidas
              con el motivo.
            </p>
          </details>
          <details>
            <summary>¿Puedo cargar notas de crédito, nómina o complementos de pago?</summary>
            <p>
              Sí. La columna <strong>Tipo</strong> dice qué es cada comprobante (Ingreso, Egreso, Nómina, Pago,
              Traslado). En los totales, los ingresos suman, los egresos (notas de crédito) restan, y nómina,
              pagos y traslados no se cuentan. Si quieres ver solo un tipo, filtra la columna Tipo.
            </p>
          </details>
          <details>
            <summary>¿El Total es con IVA o sin IVA?</summary>
            <p>
              Hay varias columnas para que no haya duda: en Conceptos, <strong>Importe (sin impuestos)</strong> es
              cantidad por precio, y <strong>Importe con impuestos</strong> ya suma IVA e IEPS y resta retenciones
              de ese renglón. En Facturas ves <strong>Subtotal</strong>, cada impuesto por tasa (IVA 16%, IVA 8%,
              IEPS, retenciones de ISR e IVA, impuestos locales) y el <strong>Total</strong> del comprobante.
              Las facturas en dólares u otra moneda se convierten a pesos con el tipo de cambio del XML.
            </p>
          </details>
          <details>
            <summary>¿Hay límite de archivos?</summary>
            <p>
              No hay límite impuesto, pero entre más archivos cargues, más memoria usará tu
              navegador. Hemos probado con 200+ XMLs sin problema.
            </p>
          </details>
          <details>
            <summary>¿Por qué en Conceptos hay varias filas con el mismo folio?</summary>
            <p>
              Porque cada fila representa <strong>un producto</strong> de la factura.
              Si una factura trae 5 productos diferentes, aparecerán 5 filas con el mismo folio
              pero distinto producto. Así puedes filtrar y sumar por producto. Si quieres una fila
              por factura, usa la pestaña <strong>Facturas</strong>.
            </p>
          </details>
          <details>
            <summary>¿Qué es el "Folio fiscal (UUID)"?</summary>
            <p>
              Es el identificador único que el SAT asigna a cada comprobante al timbrarlo (32 caracteres).
              Sirve para no cargar dos veces la misma factura y para localizarla en el portal del SAT.
            </p>
          </details>
        </div>
      </div>
    </div>
  )
}
