import { LicenseManager } from 'ag-grid-enterprise'

/**
 * Registra la licencia de AG Grid Enterprise.
 * La clave viene de la variable AG_GRID_ENTERPRISE_KEY (expuesta por envPrefix en vite.config.js):
 *  - local: .env.local (ignorado por git; ver .env.example)
 *  - CI / GitHub Pages: secret AG_GRID_ENTERPRISE_KEY en deploy.yml
 * Sin clave, AG Grid funciona igual pero muestra marca de agua y un aviso en consola.
 */
const key = import.meta.env.AG_GRID_ENTERPRISE_KEY
if (key) {
  LicenseManager.setLicenseKey(key)
} else if (import.meta.env.DEV) {
  console.warn('[AG Grid] Sin AG_GRID_ENTERPRISE_KEY: Enterprise corre en modo de prueba (marca de agua).')
}
