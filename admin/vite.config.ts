import { fileURLToPath, URL } from 'node:url';

import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import vueJsx from '@vitejs/plugin-vue-jsx';

// https://vite.dev/config/
export default defineConfig({
  // 部署路径配置
  // 开发环境：base = '/'（本地 http://localhost:5173）
  // 生产环境：base = '/admin/'（线上 https://wx.shubai01.com/admin/）
  base: process.env.NODE_ENV === 'production' ? '/admin/' : '/',

  build: {
    rollupOptions: {
      output: {
        // 管理后台部署在 /admin/ 子路径下；线上出现浏览器模块图缓存时，
        // 拆分路由 chunk 会让单个懒加载模块失败导致整页白屏。
        inlineDynamicImports: true
      }
    }
  },

  plugins: [vue(), vueJsx()],
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
      '/uploads': { target: process.env.VITE_API_PROXY_TARGET || 'http://localhost:3000', changeOrigin: true },
      '/api/v1': {
        target: process.env.VITE_API_PROXY_TARGET || 'http://localhost:3000',
        changeOrigin: true,
        rewrite: (path) => path
      }
    }
  }
});
