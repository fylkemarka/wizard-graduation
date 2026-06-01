import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // PLAYWRIGHT env is set by the e2e webServer so test runs don't pop a
  // browser tab on every dev-server start.
  server: { port: 5173, open: !process.env.PLAYWRIGHT },
});
