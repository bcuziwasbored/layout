import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  base: '/layout/',
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      // 'prompt' (not 'autoUpdate') so the new SW parks in `waiting` and fires
      // onNeedRefresh instead of swapping itself in mid-session — src/components
      // /UpdateToast.jsx surfaces that as a tap-to-reload toast (issue #85).
      registerType: 'prompt',
      manifest: {
        name: 'Layout',
        short_name: 'Layout',
        description: 'Instagram carousel and collage editor',
        theme_color: '#000000',
        background_color: '#000000',
        display: 'standalone',
        orientation: 'portrait',
        // Relative paths (no leading slash) so they resolve against the
        // manifest URL under the /layout/ base, not the domain root.
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: 'icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
        // Android long-press menu (ignored by iOS). Relative URL for the same
        // base reason as the icons; App.jsx consumes ?action=new on boot.
        shortcuts: [
          {
            name: 'New project',
            short_name: 'New',
            description: 'Start a blank 4:5 project',
            url: './?action=new',
            icons: [{ src: 'icon-192.png', sizes: '192x192', type: 'image/png' }],
          },
        ],
      },
      workbox: {
        // Precache app shell plus onboarding sample photos and icons so they
        // render offline (the default glob omits jpg/jpeg/svg).
        globPatterns: ['**/*.{js,css,html,ico,png,svg,jpg,jpeg,webmanifest}'],
        runtimeCaching: [
          {
            // Google Fonts stylesheet — revalidate in the background when online.
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'google-fonts-stylesheets',
              expiration: { maxEntries: 20, maxAgeSeconds: 60 * 60 * 24 * 365 },
            },
          },
          {
            // Font files — cache-first so renders and exports match offline.
            urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-webfonts',
              cacheableResponse: { statuses: [0, 200] },
              expiration: { maxEntries: 60, maxAgeSeconds: 60 * 60 * 24 * 365 },
            },
          },
        ],
      },
    }),
  ],
})
