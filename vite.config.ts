/// <reference types="vitest/config" />
import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// MealHelp is a static site on GitHub Pages, where the repository name becomes
// the first path segment, so every asset and route lives under it.
const BASE = '/MealHelp/'

// Dev and preview share a port so the installed PWA's cached scope keeps
// matching between the two.
const PORT = 3140

export default defineConfig({
  base: BASE,
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: { port: PORT, strictPort: true },
  preview: { port: PORT, strictPort: true },
  plugins: [
    react(),
    VitePWA({
      // A cooking session must never be interrupted by a surprise reload, so
      // the new worker waits and the app asks before refreshing.
      registerType: 'prompt',
      includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'MealHelp',
        short_name: 'MealHelp',
        description:
          'Plan the week, generate one grocery list, and cook from recipes that all look the same.',
        theme_color: '#b4541f',
        background_color: '#fdf8f3',
        display: 'standalone',
        scope: BASE,
        start_url: BASE,
        categories: ['food', 'lifestyle', 'productivity'],
        shortcuts: [
          {
            name: "This week's plan",
            short_name: 'Plan',
            url: `${BASE}#/plan`,
            icons: [{ src: 'icon-192.png', sizes: '192x192' }],
          },
          {
            name: 'Grocery list',
            short_name: 'Grocery',
            url: `${BASE}#/grocery`,
            icons: [{ src: 'icon-192.png', sizes: '192x192' }],
          },
        ],
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          {
            src: 'icon-512-maskable.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        // Recipes, plans and the grocery list all live in IndexedDB, so
        // precaching the shell is enough to make the whole app work offline.
        // The starter photographs are deliberately *not* in here: nearly a
        // megabyte of pictures for recipes many people delete does not belong
        // in an install. They are cached the first time they are seen instead.
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        cleanupOutdatedCaches: true,
        navigateFallback: `${BASE}index.html`,
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.pathname.includes('/starters/'),
            handler: 'CacheFirst',
            options: {
              cacheName: 'mealhelp-starter-photos',
              // Twelve files today; the cap is only a backstop against a
              // cache that grows quietly for ever.
              expiration: { maxEntries: 40, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
    }),
  ],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.ts'],
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
  },
})
