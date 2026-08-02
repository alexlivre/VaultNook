import { defineConfig } from 'vite';
import tailwindcss from '@tailwindcss/vite';
import { fileURLToPath } from 'node:url';

const dir = fileURLToPath(new URL('.', import.meta.url));

export default defineConfig({
  plugins: [
    tailwindcss(),
    {
      name: 'relax-csp-for-hmr',
      apply: 'serve',
      transformIndexHtml: (html) =>
        html.replace("connect-src 'none'", "connect-src 'self' ws:"),
    },
  ],
  resolve: {
    conditions: ['development', 'browser'],
    alias: { '@': `${dir}src` },
  },
  esbuild: {
    loader: 'tsx',
    include: /\.tsx?$/,
  },
  base: './',
  build: {
    outDir: '.vite/renderer/main_window',
    emptyOutDir: true,
  },
  server: {
    port: 5173,
    strictPort: true,
  },
});
