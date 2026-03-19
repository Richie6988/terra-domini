import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5173,
    host: '0.0.0.0',
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
      '/ws': {
        target: 'ws://localhost:8000',
        ws: true,
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
    rollupOptions: {
      output: {
        manualChunks: {
          vendor:   ['react', 'react-dom'],
          map:      ['leaflet', 'react-leaflet'],
          h3:       ['h3-js'],
          query:    ['@tanstack/react-query'],
          store:    ['zustand'],
          motion:   ['framer-motion'],
          charts:   ['recharts'],
        },
      },
    },
  },
  optimizeDeps: {
    include: ['react', 'react-dom', 'leaflet', 'h3-js'],
  },
})
