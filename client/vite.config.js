import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const API = process.env.API_URL || 'http://localhost:4000';

export default defineConfig({
  plugins: [react()],
  // three.js (~130 kB gzipped) is its own lazy chunk, loaded only by the logged-out landing page.
  build: { chunkSizeWarningLimit: 600 },
  server: {
    port: 5173,
    proxy: {
      '/api': API,
      '/uploads': API,
      '/socket.io': { target: API, ws: true },
    },
  },
});
