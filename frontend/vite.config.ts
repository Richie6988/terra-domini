import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig(({ mode }) => ({
  plugins: [react()],

  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },

  // Dev only — proxy vers Django runserver
  server: {
    port: 5173,
    host: '0.0.0.0',
    proxy: {
      '/api': { target: 'http://localhost:8000', changeOrigin: true },
      '/ws':  { target: 'ws://localhost:8000',   ws: true, changeOrigin: true },
    },
  },

  build: {
    // Build directement dans le dossier que Django sert
    outDir: path.resolve(__dirname, 'dist'),  // Django collectstatic picks this up via STATICFILES_DIRS
    emptyOutDir: true,
    sourcemap: true,  // temp: debug TDZ

    rollupOptions: {
      output: {
        // Chunks nommés pour cache-busting optimal
        entryFileNames:   'assets/[name]-[hash].js',
        chunkFileNames:   'assets/[name]-[hash].js',
        assetFileNames:   'assets/[name]-[hash][extname]',
        manualChunks: {
          vendor:  ['react', 'react-dom'],
          map:     ['leaflet', 'react-leaflet'],
          h3:      ['h3-js'],
          query:   ['@tanstack/react-query'],
          store:   ['zustand'],
          motion:  ['framer-motion'],
          charts:  ['recharts'],
        },
      },
    },
  },

  optimizeDeps: {
    include: ['react', 'react-dom', 'leaflet', 'h3-js'],
  },
}))
