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
                Aparecerá una tabla con todos los productos extraídos. Puedes ordenar, filtrar como en Excel
                (clic en el ícono del encabezado y marca los valores que quieras) o editar celdas con doble clic.
                Lo que edites es lo que se exporta.
              </p>
            </div>
          </li>
          <li>
            <span className="step-num">4</span>
            <div>
              <strong>Descarga el Excel</strong>
              <p>
                Escribe el nombre que quieras para tu archivo y haz clic en{' '}
                <strong>Descargar Excel</strong>. Si no le pones <code>.xlsx</code> al final,
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
              Por ahora solo soporta <strong>CFDI 4.0</strong> (la versión obligatoria desde 2023).
              Si tienes facturas más viejas en 3.3, puede que no las lea correctamente.
            </p>
          </details>
          <details>
            <summary>¿Puedo cargar facturas de notas de crédito o pagos?</summary>
            <p>
              Sí, cualquier CFDI 4.0 funciona (Ingreso, Egreso, Pago, Traslado, Nómina).
              Solo ten en cuenta que las columnas <code>CANTIDAD</code> y <code>TOTAL</code>{' '}
              pueden no tener sentido en algunos tipos (ej. en una nómina, "CANTIDAD" sería 1).
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
            <summary>¿Por qué a veces hay varias filas con el mismo folio?</summary>
            <p>
              Porque cada fila representa <strong>un producto</strong> de la factura.
              Si una factura trae 5 productos diferentes, aparecerán 5 filas con el mismo folio
              pero distinto producto. Así puedes filtrar y sumar por producto fácilmente.
            </p>
          </details>
        </div>
      </div>
    </div>
  )
}
