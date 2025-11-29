import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    proxy: {
      '/token': 'http://localhost:3000',
      '/auth': 'http://localhost:3000',
      '/health': 'http://localhost:3000'
    }
  },
  build: {
    outDir: 'dist/client',
    emptyOutDir: true
  }
});
