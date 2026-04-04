import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

/**
 * Base path for assets and router. Wrong base + wrong URL (e.g. opening `/` while
 * base is `/merchant/`) makes the browser request JS and get `index.html` → MIME error.
 *
 * - Dev default: `/` so `npm run dev` works at http://localhost:5173/
 * - Prod default: `/merchant/` for subpath deploys
 * - Override any time: set `VITE_BASE_URL` (e.g. `/` or `/merchant/`)
 */
function normalizeBase(raw) {
  if (raw == null || String(raw).trim() === '') return null
  let b = String(raw).trim()
  if (!b.startsWith('/')) b = `/${b}`
  if (!b.endsWith('/')) b = `${b}/`
  return b
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const base =
    normalizeBase(env.VITE_BASE_URL) ??
    (mode === 'development' ? '/' : '/merchant/')

  return {
    plugins: [react(), tailwindcss()],
    base,
  }
})
