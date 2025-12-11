import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  // Load env file based on `mode` in the current working directory.
  const env = loadEnv(mode, process.cwd(), '');

  return {
    plugins: [react()],
    define: {
      // Safely replace process.env.API_KEY in the code with the actual value from .env
      'process.env.API_KEY': JSON.stringify(env.API_KEY),
      // Prevent crashes if libraries try to access process.env properties
      'process.env': {}
    },
    server: {
      port: 5173,
      proxy: {
        // Proxy API requests to the backend
        '/webhook': 'http://localhost:3000',
        '/auth': 'http://localhost:3000',
        '/api': 'http://localhost:3000'
      }
    }
  };
});