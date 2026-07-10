import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'prompt',
      includeAssets: [
        'favicon.ico',
        'offline.html',
        'childkeeper-clock-hearts-icon-180.png',
        'childkeeper-clock-hearts-icon-192.png',
        'childkeeper-clock-hearts-icon-512.png'
      ],
      manifest: {
        name: "The Childkeeper's Log",
        short_name: 'Childkeeper Log',
        description: 'Track childcare hours, earnings, and reports across families.',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        background_color: '#1E1E1E',
        theme_color: '#beff8b',
        categories: ['productivity', 'business', 'finance'],
        icons: [
          {
            src: '/childkeeper-clock-hearts-icon-192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: '/childkeeper-clock-hearts-icon-512.png',
            sizes: '512x512',
            type: 'image/png'
          },
          {
            src: '/childkeeper-clock-hearts-icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable'
          }
        ]
      },
      workbox: {
        maximumFileSizeToCacheInBytes: 3 * 1024 * 1024,
        navigateFallback: '/offline.html',
        globPatterns: ['**/*.{js,css,html,ico,png,svg,json}'],
        runtimeCaching: [
          {
            urlPattern: ({ request }) => request.destination === 'document',
            handler: 'NetworkFirst',
            options: {
              cacheName: 'pages-cache',
              networkTimeoutSeconds: 3,
              expiration: {
                maxEntries: 20,
                maxAgeSeconds: 7 * 24 * 60 * 60
              }
            }
          },
          {
            urlPattern: ({ request }) => ['style', 'script', 'worker'].includes(request.destination),
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'asset-cache',
              expiration: {
                maxEntries: 80,
                maxAgeSeconds: 30 * 24 * 60 * 60
              }
            }
          },
          {
            urlPattern: ({ request }) => request.destination === 'image',
            handler: 'CacheFirst',
            options: {
              cacheName: 'image-cache',
              expiration: {
                maxEntries: 80,
                maxAgeSeconds: 30 * 24 * 60 * 60
              }
            }
          }
        ]
      }
    })
  ],
  server: {
    port: 3000,
    open: true
  }
})
