import type { ManifestOptions } from 'vite-plugin-pwa';

export const manifest: Partial<ManifestOptions> = {
  name: 'Κρεμάλα — Παιχνίδι λέξεων',
  short_name: 'Κρεμάλα',
  description: 'Η κλασική Κρεμάλα στα ελληνικά: solo, μονομαχία, συνεργατική, με bots ή online με φίλους.',
  lang: 'el',
  dir: 'ltr',
  start_url: '/',
  scope: '/',
  display: 'standalone',
  orientation: 'portrait',
  background_color: '#fbf7f0',
  theme_color: '#4338ca',
  categories: ['games', 'education', 'entertainment'],
  icons: [
    { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
    { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
    { src: '/icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
  ],
};
