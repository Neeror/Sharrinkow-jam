import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    minify: false,
    sourcemap: true,
    rollupOptions: {
      output: {
        manualChunks: {
          three: ['three'],
        },
      },
    },
  },
});
