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
      '@': fileURLToPath(new URL('./src', import.meta.url))
    }
  }
});
