import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Static Vite build. No environment variables required. Deploys to Vercel as-is.
export default defineConfig({
  plugins: [react()],
  build: {
    target: 'es2020',
    cssCodeSplit: true,
    chunkSizeWarningLimit: 1900,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (
              id.includes('three') ||
              id.includes('@react-three') ||
              id.includes('postprocessing') ||
              id.includes('drei')
            ) {
              return '3d'
            }
            if (id.includes('gsap')) return 'gsap'
          }
          return undefined
        },
      },
    },
  },
})
