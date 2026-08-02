import { defineConfig } from 'vite';
import { builtinModules } from 'node:module';
import { fileURLToPath } from 'node:url';

const dir = fileURLToPath(new URL('.', import.meta.url));

const external = ['electron', ...builtinModules, ...builtinModules.map((m) => `node:${m}`)];

export default defineConfig({
  build: {
    outDir: '.vite/build',
    emptyOutDir: false,
    lib: {
      entry: `${dir}src/preload.ts`,
      formats: ['cjs'],
      fileName: () => 'preload.js',
    },
    rollupOptions: { external },
  },
});
