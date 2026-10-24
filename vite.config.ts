/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // Relative base so the static build works on Vercel, Netlify, and GitHub Pages sub-paths.
  base: './',
  resolve: {
    alias: {
      '@': decodeURIComponent(new URL('./src', import.meta.url).pathname),
    },
  },
  build: {
    target: 'es2022',
    chunkSizeWarningLimit: 1600,
  },
  test: {
    include: ['src/**/*.test.ts'],
    environment: 'node',
  },
});
