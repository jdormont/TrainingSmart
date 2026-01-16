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
        configure: (proxy, _options) => {
          proxy.on('proxyReq', (proxyReq, _req, _res) => {
            // Strip cookies to prevent Oura WAF errors
            proxyReq.removeHeader('cookie');
            proxyReq.removeHeader('origin');
          });
        },
      },
    },
  },
  optimizeDeps: {
    exclude: ['lucide-react'],
  },
});
