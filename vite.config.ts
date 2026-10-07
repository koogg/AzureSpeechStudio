import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import path from 'path'
import { localStorePlugin } from './vite-plugin-local-store'
import pkg from './package.json'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [vue(), localStorePlugin()],
  define: {
    __APP_VERSION__: JSON.stringify(`v${pkg.version}`)
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src')
    }
  },
  server: {
    port: 5173,
    open: false,
    watch: {
      ignored: [
        '**/release/**',
        '**/portable-dist/**',
        '**/dist-electron/**',
        '**/data/**',
        '**/*.zip',
        '**/*.exe',
        '**/*.7z',
        '**/*.tar.gz'
      ]
    }
  }
})
