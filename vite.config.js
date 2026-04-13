import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { visualizer } from 'rollup-plugin-visualizer'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    visualizer({
      filename: 'dist/stats.html',
      // Set to true locally if you want the browser to open after build.
      open: false,
      gzipSize: true,
      brotliSize: true,
    }),
  ],
  base: '/merchant/',
  build: {
    /** Avoid competing with LCP: Firebase is loaded after first paint via AuthContext dynamic import. */
    modulePreload: {
      resolveDependencies(_filename, deps) {
        return deps.filter((dep) => !String(dep).includes('firebase-'));
      },
    },
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined
          // Firebase v9+ modular SDK uses scoped @firebase/* packages + entry firebase/*
          if (/[\\/]node_modules[\\/](@firebase|firebase)[\\/]/.test(id)) return 'firebase'
          if (/[\\/]node_modules[\\/]@react-google-maps[\\/]/.test(id)) return 'maps'
          // html2pdf/html2canvas/jspdf — only reachable via dynamic import() in invoicePdf (user action).
          if (/[\\/]node_modules[\\/](html2pdf\.js|html2canvas|jspdf)/.test(id)) return 'pdf-canvas'
          if (/[\\/]node_modules[\\/](react|react-dom|scheduler)[\\/]/.test(id)) return 'react-vendor'
          if (/[\\/]node_modules[\\/]react-router/.test(id)) return 'react-vendor'
          if (/[\\/]node_modules[\\/]lucide-react[\\/]/.test(id)) return 'icons'
          return 'vendor'
        },
      },
    },
    // pdf-canvas (~1MB) is loaded only on invoice PDF download, not on first paint.
    chunkSizeWarningLimit: 1100,
  },
})
