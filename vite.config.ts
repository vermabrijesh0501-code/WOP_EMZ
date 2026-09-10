import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss()],
    build: {
      // Split heavy vendor libs into cached chunks (smaller initial download)
      rollupOptions: {
        output: {
          manualChunks: {
            'react-vendor': ['react', 'react-dom', 'react-router-dom'],
            'supabase': ['@supabase/supabase-js'],
            'icons': ['lucide-react'],
            'charts': ['recharts'],
            'pdf': ['jspdf'],
          },
        },
      },
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // Allow preview/sandbox proxy hosts to reach the dev server.
      allowedHosts: true as const,
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {
        // CRITICAL: the sync server persists its store to .data/sync-store.json on
        // EVERY mutation - without ignoring it, Vite forces a full page reload in all
        // connected browsers on every scan/sync event, breaking realtime sync.
        ignored: ['**/.data/**'],
      },
    },
  };
});
