import { lookup, type LookupAddress, type LookupOptions } from 'node:dns';
import { Agent } from 'node:https';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// En développement (pnpm dev:web), /api est relayé vers l'application qui
// tourne dans Docker, derrière Caddy : https://<APP_NAME>.localhost
const apiTarget = process.env.API_URL ?? 'https://acta.localhost';

// Windows ne résout pas les sous-domaines de localhost : ils désignent la
// machine locale (RFC 6761), le relais s'y adresse directement.
const agent = new Agent({
  lookup: (hostname: string, options: LookupOptions, callback: (...args: never[]) => void) => {
    if (!hostname.endsWith('.localhost')) return lookup(hostname, options, callback as never);
    const address: LookupAddress = { address: '127.0.0.1', family: 4 };
    const reply = callback as (error: null, address: string | LookupAddress[], family?: number) => void;
    if (options.all) reply(null, [address]);
    else reply(null, address.address, address.family);
  },
});

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': { target: apiTarget, changeOrigin: true, secure: false, agent },
    },
  },
});
