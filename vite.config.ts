import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api/oura': {
        target: 'https://api.ouraring.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/oura/, ''),
        secure: true,
      },
    },
  },
  optimizeDeps: {
    exclude: ['lucide-react'],
  },
});
