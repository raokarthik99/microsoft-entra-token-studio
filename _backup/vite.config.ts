import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    proxy: {
      '/token': 'http://localhost:5173',
      '/auth': 'http://localhost:5173',
      '/health': 'http://localhost:5173'
    }
  },
  build: {
    outDir: 'dist/client',
    emptyOutDir: true
  }
});
