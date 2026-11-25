import path from 'node:path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import wasm from 'vite-plugin-wasm';
import { nodePolyfills } from 'vite-plugin-node-polyfills';

// Wiring follows the official Midnight UI template (midnightntwrk/midnight-examples,
// packages/mnkit/templates/ui): the ledger/onchain-runtime packages ship WASM
// loaded with top-level await, and parts of the SDK expect Node globals.
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    wasm(),
    nodePolyfills({ include: ['buffer', 'process', 'util', 'crypto', 'stream'], globals: { Buffer: true, process: true } }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@contract': path.resolve(__dirname, '../contract'),
    },
  },
  optimizeDeps: {
    exclude: ['@midnightntwrk/ledger-v9', '@midnightntwrk/onchain-runtime-v4', '@midnight-ntwrk/midnight-js-protocol'],
  },
  server: { fs: { allow: [path.resolve(__dirname, '..')] } },
  build: { target: 'esnext', chunkSizeWarningLimit: 4000 },
});
