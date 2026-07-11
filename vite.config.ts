import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { receiptApiProxy } from './vite.plugins/receiptApiProxy';

export default defineConfig(({ command, mode }) => {
  // Dev-only: the receipt API proxy (vite.plugins/receiptApiProxy.ts) runs the
  // server-side handlers in api/ during `npm run dev`. Those handlers read
  // secrets from process.env (Gemini key, Supabase service role key, URL, anon
  // key). Vite does NOT load .env.local into process.env, so without this the
  // dev handlers see undefined and receipt uploads 500.
  //
  // We inject only the SERVER-side vars into process.env, and ONLY for the dev
  // server (command === 'serve'). These values are never placed in `define`
  // and are never referenced via import.meta.env, so they cannot reach the
  // client bundle. Vite continues to expose the public VITE_* vars to the
  // client automatically via import.meta.env, unchanged.
  if (command === 'serve') {
    const env = loadEnv(mode, process.cwd(), '');

    const serverEnvKeys = [
      'GEMINI_API_KEY',
      'SUPABASE_URL',
      'SUPABASE_ANON_KEY',
      'SUPABASE_SERVICE_ROLE_KEY',
      'SUPABASE_SERVICE_KEY',
      'VITE_SUPABASE_URL',
      'VITE_SUPABASE_ANON_KEY',
      'NEXT_PUBLIC_SUPABASE_URL',
      'NEXT_PUBLIC_SUPABASE_ANON_KEY',
    ];

    for (const key of serverEnvKeys) {
      if (process.env[key] === undefined && env[key] !== undefined) {
        process.env[key] = env[key];
      }
    }
  }

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
