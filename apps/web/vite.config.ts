import path from 'path';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';

import runtimeErrorOverlay from '@replit/vite-plugin-runtime-error-modal';

// PORT and BASE_PATH are optional for local dev — fall back to sensible defaults
const port = Number(process.env.PORT ?? 5173);
const basePath = process.env.BASE_PATH ?? '/';

export default defineConfig({
  base: basePath,
  plugins: [
    react(),
    tailwindcss(),
    runtimeErrorOverlay(),
    ...(process.env.NODE_ENV !== 'production' &&
    process.env.REPL_ID !== undefined
      ? [
          await import('@replit/vite-plugin-cartographer').then((m) =>
            m.cartographer({
              root: path.resolve(import.meta.dirname, '..'),
            }),
          ),
          await import('@replit/vite-plugin-dev-banner').then((m) =>
            m.devBanner(),
          ),
        ]
      : []),
  ],
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, 'src'),
      '@assets': path.resolve(
        import.meta.dirname,
        '..',
        '..',
        'attached_assets',
      ),
    },
    dedupe: ['react', 'react-dom'],
  },
  root: path.resolve(import.meta.dirname),
  build: {
    outDir: path.resolve(import.meta.dirname, 'dist/public'),
    emptyOutDir: true,
    // Emit source maps only for debugging — disable in prod if not using an error tracker
    sourcemap: process.env.NODE_ENV !== 'production',
    // Warn on chunks > 500 kB (Vite default is 500 kB, we keep it explicit)
    chunkSizeWarningLimit: 500,
    rollupOptions: {
      output: {
        // Split vendor libraries for better long-term caching
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('react') || id.includes('react-dom') || id.includes('wouter')) {
              return 'vendor-react';
            }
            if (id.includes('@tanstack')) {
              return 'vendor-query';
            }
            if (id.includes('@radix-ui') || id.includes('lucide-react') || id.includes('class-variance-authority') || id.includes('tailwind-merge')) {
              return 'vendor-ui';
            }
            if (id.includes('recharts') || id.includes('d3')) {
              return 'vendor-charts';
            }
            return 'vendor';
          }
        },
      },
    },
  },
  server: {
    port,
    strictPort: true,
    host: '0.0.0.0',
    allowedHosts: true,
    proxy: {
      '/api': {
        target: 'http://localhost:5001',
        changeOrigin: true,
        configure: (proxy) => {
          proxy.on('error', (err) => { console.error('[proxy error]', err.message); });
          proxy.on('proxyReq', (_, req) => { console.log('[proxy]', req.method, req.url); });
        },
      },
    },
    fs: {
      strict: true,
    },
  },
  preview: {
    port,
    host: '0.0.0.0',
    allowedHosts: true,
  },
});
