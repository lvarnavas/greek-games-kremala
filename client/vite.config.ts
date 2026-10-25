import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { manifest } from './pwa.manifest';

const serverUrl = process.env.VITE_DEV_SERVER_PROXY ?? 'http://localhost:3001';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: false,
      includeAssets: ['favicon.svg', 'icons/apple-touch-icon.png'],
      manifest,
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2,json,webmanifest}'],
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/socket\.io/, /^\/health/],
        cleanupOutdatedCaches: true,
      },
      devOptions: { enabled: false },
    }),
  ],
  server: {
    port: 5173,
    host: true,
    proxy: { '/socket.io': { target: serverUrl, ws: true, changeOrigin: true } },
  },
  build: { target: 'es2020', sourcemap: false },
});
