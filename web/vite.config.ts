import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// En développement (pnpm dev:web), /api est relayé vers l'application qui
// tourne dans Docker, derrière Caddy : https://<APP_NAME>.localhost
const apiTarget = process.env.API_URL ?? 'https://acta.localhost';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': { target: apiTarget, changeOrigin: true, secure: false },
    },
  },
});
