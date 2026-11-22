import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';
import type { Plugin } from 'vite';

/**
 * onnxruntime-web references its wasm/mjs via `new URL(..., import.meta.url)`, so Vite emits
 * ~24 MB of assets. @imgly/background-removal never uses them: it sets `ort.env.wasm.wasmPaths`
 * to its own versioned CDN resources (cached offline by the service worker). Drop the dead copies.
 */
function dropUnusedOrtAssets(): Plugin {
  return {
    name: 'dolabi:drop-unused-ort-assets',
    apply: 'build',
    generateBundle(_options, bundle) {
      for (const [file, chunk] of Object.entries(bundle)) {
        if (chunk.type === 'asset' && /ort[^/]*\.(wasm|mjs)$/.test(file)) delete bundle[file];
      }
    },
  };
}

// https://vite.dev/config/
// Deploy base: "/" for a root domain, "/Dolabi/" for GitHub Pages (set by the deploy workflow).
const base = process.env.BASE_PATH ?? '/';

export default defineConfig({
  base,
  plugins: [
    react(),
    tailwindcss(),
    dropUnusedOrtAssets(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: false, // registered manually in src/main.tsx via virtual:pwa-register
      includeAssets: ['favicon.ico', 'favicon.svg', 'apple-touch-icon.png'],
      manifest: {
        id: base,
        name: 'دولابي - منسّق ملابسك الذكي',
        short_name: 'دولابي',
        description: 'صوّر هدومك، والتطبيق يفرّغها وينسّق لك أطقم لايقة — حتى من غير نت.',
        lang: 'ar',
        dir: 'rtl',
        display: 'standalone',
        orientation: 'portrait',
        theme_color: '#FFFFFF',
        background_color: '#F8F8FA',
        start_url: base,
        scope: base,
        categories: ['lifestyle', 'shopping', 'utilities'],
        icons: [
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: 'maskable-icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // App shell: everything Vite emits (JS, CSS, HTML, icons, fonts) is precached.
        globPatterns: ['**/*.{js,css,html,ico,png,svg,webp,woff,woff2,webmanifest}'],
        // ONNX/WASM runtimes are huge; they are fetched lazily and runtime-cached instead.
        globIgnores: ['**/*.wasm', '**/ort*.mjs'],
        maximumFileSizeToCacheInBytes: 6 * 1024 * 1024,
        navigateFallback: `${base}index.html`,
        cleanupOutdatedCaches: true,
        clientsClaim: true,
        skipWaiting: true,
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.origin === 'https://fonts.googleapis.com',
            handler: 'StaleWhileRevalidate',
            options: { cacheName: 'google-fonts-css' },
          },
          {
            urlPattern: ({ url }) => url.origin === 'https://fonts.gstatic.com',
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-files',
              expiration: { maxEntries: 30, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            // @imgly/background-removal model chunks + onnx wasm (first use online, then fully offline)
            urlPattern: ({ url }) => url.hostname.endsWith('staticimgly.com'),
            handler: 'CacheFirst',
            options: {
              cacheName: 'imgly-bg-removal-model',
              expiration: { maxEntries: 300, maxAgeSeconds: 60 * 60 * 24 * 120 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            // optional self-hosted model (VITE_IMGLY_PUBLIC_PATH=/imgly/)
            urlPattern: ({ url, sameOrigin }) => sameOrigin && url.pathname.startsWith(`${base}imgly/`),
            handler: 'CacheFirst',
            options: {
              cacheName: 'imgly-self-hosted',
              expiration: { maxEntries: 100, maxAgeSeconds: 60 * 60 * 24 * 120 },
            },
          },
          {
            urlPattern: ({ url }) => url.pathname.endsWith('.wasm'),
            handler: 'CacheFirst',
            options: {
              cacheName: 'wasm-runtime',
              expiration: { maxEntries: 20, maxAgeSeconds: 60 * 60 * 24 * 120 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
      devOptions: { enabled: false },
    }),
  ],
  optimizeDeps: {
    exclude: ['@imgly/background-removal', 'onnxruntime-web'],
  },
  worker: { format: 'es' },
  build: {
    target: 'es2022',
    chunkSizeWarningLimit: 1500,
  },
});
