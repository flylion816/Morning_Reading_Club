import { fileURLToPath } from 'node:url';
import { mergeConfig, defineConfig, configDefaults } from 'vitest/config';
import viteConfig from './vite.config';

export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      // 测试环境
      environment: 'happy-dom',

      // 排除目录
      exclude: [...configDefaults.exclude, 'e2e/**'],

      // 全局测试文件
      setupFiles: ['./src/tests/setup.ts'],

      // 覆盖率配置
      coverage: {
        provider: 'c8',
        reporter: ['text', 'json', 'html', 'lcov'],
        exclude: [
          'node_modules/',
          'src/tests/',
          '**/*.d.ts',
          '**/*.config.*',
          '**/mockData',
          'dist/',
          '.nuxt/'
        ],
        // 覆盖率阈值
        lines: 60,
        functions: 65,
        branches: 55,
        statements: 60
      },

      // 根目录
      root: fileURLToPath(new URL('./', import.meta.url)),

      // 全局标志
      globals: true,

      // 并发测试
      isolate: true,
      threads: true,

      // 超时配置
      testTimeout: 10000,
      hookTimeout: 10000
    }
  })
);
