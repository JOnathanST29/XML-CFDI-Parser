import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  base: '/',
  plugins: [react()],
  // Expone AG_GRID_ENTERPRISE_KEY (de .env.local o del CI) como import.meta.env.AG_GRID_ENTERPRISE_KEY.
  // Solo las variables con estos prefijos llegan al bundle; no pongas secretos con prefijo AG_GRID_.
  envPrefix: ['VITE_', 'AG_GRID_'],
})
