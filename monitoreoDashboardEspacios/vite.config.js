import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// En producción, el Ingress de k8s enruta /api/<servicio>/** hacia Kong
// (que a su vez le quita el /<servicio> antes de reenviar). En desarrollo
// local replicamos el mismo contrato pegándole directo a cada servicio,
// para no depender de tener Kong/Ingress corriendo mientras se itera con
// `npm run dev`.
const stripPrefix = (prefix) => (path) => path.replace(prefix, '');

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      '/api/zones': {
        target: 'http://localhost:8080',
        changeOrigin: true,
        rewrite: stripPrefix(/^\/api\/zones/),
      },
      '/api/tickets': {
        target: 'http://localhost:3001',
        changeOrigin: true,
        rewrite: stripPrefix(/^\/api\/tickets/),
      },
      '/api/users': {
        target: 'http://localhost:8000',
        changeOrigin: true,
        rewrite: stripPrefix(/^\/api\/users/),
      },
      '/api/vehicles': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        rewrite: stripPrefix(/^\/api\/vehicles/),
      },
      '/api/assignments': {
        target: 'http://localhost:8001',
        changeOrigin: true,
        rewrite: stripPrefix(/^\/api\/assignments/),
      },
      '/api/audit': {
        target: 'http://localhost:3002',
        changeOrigin: true,
        rewrite: stripPrefix(/^\/api\/audit/),
      },
    },
  },
});
