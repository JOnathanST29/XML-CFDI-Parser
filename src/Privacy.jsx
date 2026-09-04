export default function Privacy({ onBack }) {
  return (
    <div className="app">
      <button className="btn-clear" onClick={onBack} style={{ marginBottom: 16 }}>
        ← Volver
      </button>

      <div className="page-header">
        <h1>Aviso de Privacidad</h1>
        <p>Última actualización: mayo 2026</p>
      </div>

      <div className="privacy-doc">
        <section>
          <h2>1. Responsable</h2>
          <p>
            Esta herramienta (CFDI a Excel, excelcfdi.com) es un proyecto personal de uso libre y gratuito,
            sin fines de lucro. No pertenece a ninguna empresa ni recolecta datos comerciales
            de sus usuarios.
          </p>
        </section>

        <section>
          <h2>2. Procesamiento 100% local</h2>
          <p>
            Todos los archivos XML que cargas se procesan <strong>directamente en tu navegador</strong>
            usando JavaScript local. <strong>Ningún archivo, dato o fragmento se transmite a
            servidores externos</strong>. La aplicación no cuenta con backend ni base de datos.
          </p>
          <p>
            Esto significa que la información fiscal de tus comprobantes (RFC, conceptos,
            montos, UUIDs, etc.) <strong>nunca sale de tu computadora</strong>.
          </p>
        </section>

        <section>
          <h2>3. Datos que NO se recolectan</h2>
          <ul>
            <li>No se almacenan los archivos XML cargados</li>
            <li>No se guardan los Excel descargados</li>
            <li>No se registran identificadores de dispositivo o sesión</li>
            <li>No se utilizan cookies (ni de tracking ni de publicidad)</li>
            <li>No hay registro de cuentas, login ni perfiles de usuario</li>
            <li>No se comparte información personal con terceros</li>
          </ul>
          <p>
            <em>Para métricas agregadas de uso del sitio, consulta la sección "Analítica".</em>
          </p>
        </section>

        <section>
          <h2>4. Cookies y almacenamiento local</h2>
          <p>
            La aplicación no utiliza cookies. Puede usar almacenamiento temporal en memoria
            (RAM del navegador) durante la sesión, que se borra al cerrar la pestaña o al
            hacer clic en "Limpiar".
          </p>
        </section>

        <section>
          <h2>5. Analítica</h2>
          <p>
            Esta aplicación utiliza <strong>Umami</strong>, un servicio de analítica web
            que respeta la privacidad. Umami:
          </p>
          <ul>
            <li>No utiliza cookies</li>
            <li>No rastrea usuarios individuales</li>
            <li>No recolecta direcciones IP completas (las hashea)</li>
            <li>No comparte datos con terceros</li>
            <li>Cumple con GDPR, CCPA y PECR sin necesidad de banner de consentimiento</li>
          </ul>
          <p>
            Lo único que se mide son métricas agregadas: número de visitas, país aproximado,
            tipo de navegador y páginas vistas. Esto nos ayuda a saber si la herramienta es
            útil. Puedes consultar la política de privacidad de Umami en{' '}
            <a href="https://umami.is/privacy" target="_blank" rel="noopener noreferrer">
              umami.is/privacy
            </a>.
          </p>
          <p>
            <strong>Importante:</strong> el contenido de tus archivos XML (RFCs, montos,
            productos, etc.) <strong>NO</strong> se envía a Umami ni a ningún otro servicio.
            La analítica solo registra que visitaste el sitio, no qué hiciste con tus archivos.
          </p>
        </section>

        <section>
          <h2>6. Seguridad de tus CFDIs</h2>
          <p>
            Los Comprobantes Fiscales Digitales por Internet (CFDI) contienen información
            sensible: RFCs, domicilios, sellos digitales, listas de productos, montos y
            patrones comerciales. <strong>Solo el emisor, el receptor y las autoridades
            fiscales autorizadas deben tener acceso a ellos.</strong>
          </p>
          <p>
            Esta herramienta está diseñada precisamente para que puedas trabajar con tus
            CFDIs sin exponerlos a terceros: el procesamiento ocurre exclusivamente en tu
            navegador.
          </p>
        </section>

        <section>
          <h2>7. Marco legal aplicable</h2>
          <p>
            Esta herramienta se ofrece sin recopilación de datos personales. En caso de
            que se incorporen funciones que recopilen datos en el futuro, se actualizará
            este aviso conforme a la <strong>Ley Federal de Protección de Datos Personales
            en Posesión de los Particulares (LFPDPPP)</strong> y los lineamientos del INAI.
          </p>
        </section>

        <section>
          <h2>8. Sin garantías</h2>
          <p>
            Esta herramienta se proporciona "tal cual", sin garantías de ningún tipo. El
            usuario es responsable de verificar la exactitud de los datos extraídos antes
            de utilizarlos para fines fiscales, contables o comerciales.
          </p>
        </section>

      </div>
    </div>
  )
}
