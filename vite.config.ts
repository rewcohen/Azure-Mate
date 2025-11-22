import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  // Use relative paths for Electron compatibility
  base: './',
  server: {
    port: 3000,
    host: true,
  },
  build: {
    // Output to dist folder
    outDir: 'dist',
    // Generate sourcemaps for debugging
    sourcemap: false,
    // Optimize chunk size
    chunkSizeWarningLimit: 1000,
  },
});
