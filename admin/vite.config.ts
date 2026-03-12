import { fileURLToPath, URL } from 'node:url';

import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import vueJsx from '@vitejs/plugin-vue-jsx';
import vueDevTools from 'vite-plugin-vue-devtools';

// https://vite.dev/config/
export default defineConfig({
  // 部署路径配置
  // 开发环境：base = '/'（本地 http://localhost:5173）
  // 生产环境：base = '/admin/'（线上 https://wx.shubai01.com/admin/）
  base: process.env.NODE_ENV === 'production' ? '/admin/' : '/',

  plugins: [vue(), vueJsx(), vueDevTools()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      '@tests': fileURLToPath(new URL('./src/tests', import.meta.url))
    }
  },

  // 开发服务器配置
  server: {
    proxy: {
      // API 请求代理
      // 开发环境：http://localhost:5173/api/v1 → http://localhost:3000/api/v1
      // 可通过 VITE_API_PROXY_TARGET 环境变量配置目标服务器
      // 例：VITE_API_PROXY_TARGET=http://192.168.102.60:3000
      '/api/v1': {
        target: process.env.VITE_API_PROXY_TARGET || 'http://localhost:3000',
        changeOrigin: true,
        rewrite: (path) => path
      }
    }
  }
});
