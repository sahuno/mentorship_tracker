import path from 'path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { receiptApiProxy } from './vite.plugins/receiptApiProxy';

export default defineConfig(() => {
  return {
    server: {
      port: 3000,
      host: '0.0.0.0',
    },
    plugins: [react(), receiptApiProxy()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
  };
});
