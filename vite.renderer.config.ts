import { defineConfig } from 'vite';
import tailwindcss from '@tailwindcss/vite';

// https://vitejs.dev/config
export default defineConfig({
  plugins: [tailwindcss()],
  resolve: {
    conditions: ['development', 'browser'],
  },
  esbuild: {
    loader: 'tsx',
    include: /\.tsx?$/,
  },
});
