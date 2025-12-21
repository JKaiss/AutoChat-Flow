
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  // Load env file based on `mode` in the current working directory.
  const env = loadEnv(mode, (process as any).cwd(), '');

  return {
    plugins: [react()],
    define: {
      // Prioritize system process.env (GCP) over local .env files
      'process.env.API_KEY': JSON.stringify(process.env.API_KEY || env.API_KEY),
      // Prevent crashes if libraries try to access process.env properties
      'process.env': {}
    },
    server: {
      port: 5173,
      proxy: {
        '/webhook': 'http://localhost:3000',
        '/auth': 'http://localhost:3000',
        '/api': 'http://localhost:3000'
      }
    }
  };
});