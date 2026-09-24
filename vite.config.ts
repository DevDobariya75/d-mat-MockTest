import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

const srcPath = fileURLToPath(new URL('./src', import.meta.url));

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { '@': srcPath },
  },
  build: {
    // The 600-question bank is ~700 kB of JSON on its own.
    chunkSizeWarningLimit: 900,
    rollupOptions: {
      output: {
        // Split the bank and the vendor code out of the app chunk so that a UI
        // change does not invalidate the (much larger, rarely changing) bank.
        manualChunks(id: string) {
          if (id.includes('data/generated/tests.json')) return 'question-bank';
          if (id.includes('node_modules')) return 'vendor';
          return undefined;
        },
      },
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./tests/setup.ts'],
    include: ['tests/**/*.test.{ts,tsx}'],
  },
});
