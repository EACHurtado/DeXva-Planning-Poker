import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  // Rutas relativas: el sitio se sirve desde una subcarpeta en GitHub Pages.
  base: './',
  plugins: [react()],
})
