import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  base: process.env.VITE_BASE ?? '/',
  plugins: [
    react(),
    VitePWA({
      registerType: 'prompt',
      injectRegister: null,
      includeAssets: ['icons/*'],
      manifest: {
        name: 'Мой авто',
        short_name: 'Мой авто',
        description: 'История машин: ТО, запчасти, заправки, расходы, напоминания',
        lang: 'ru',
        start_url: './',
        scope: './',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#F2F3F5',
        theme_color: '#F2F3F5',
        icons: [{ src: 'icons/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' }],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2,webmanifest}'],
        navigateFallback: 'index.html',
        navigateFallbackDenylist: [/oauth\.html/],
        maximumFileSizeToCacheInBytes: 6 * 1024 * 1024,
      },
    }),
  ],
  server: { port: 5173, strictPort: true },
  build: { target: 'es2022' },
})
