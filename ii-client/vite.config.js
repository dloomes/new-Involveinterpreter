import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // In development, proxy /api calls to the .NET backend so the React
    // dev server and API can run on different ports without CORS issues.
    proxy: {
      '/api': {
        target: 'https://localhost:7046',
        changeOrigin: true,
        secure: false, // allow the self-signed dev cert
      },
    },
  },
  build: {
    // Output directly into the API's static files folder so dotnet publish picks it up
    outDir: '../API/wwwroot',
    emptyOutDir: true,
  },
})
