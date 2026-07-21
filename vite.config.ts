import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tsconfigPaths from "vite-tsconfig-paths";

// https://vite.dev/config/
export default defineConfig({
  build: {
    sourcemap: 'hidden',
    emptyOutDir: true,
    rollupOptions: {
      output: {
        // 导出分享包时需要把应用整体内联到单个 HTML，关闭代码分割。
        inlineDynamicImports: true,
        manualChunks: undefined,
      },
    },
  },
  plugins: [
    react(),
    tsconfigPaths()
  ],
})
