import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Get IP address from environment variable, default to localhost
const bindIP = process.env.BIND_IP || 'localhost';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    host: bindIP,
    proxy: {
      '/api': {
        target: `http://${bindIP}:3001`,
        changeOrigin: true
      },
      '/ws': {
        target: `ws://${bindIP}:3002`,
        ws: true
      }
    }
  },
  build: {
    outDir: 'dist',
    sourcemap: true
  }
});