/**
 * Logger 工具单元测试
 * 测试日志工具在开发/生产环境的行为
 * 共 16 个测试用例
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import logger from '../logger';

describe('Logger - 统一日志工具', () => {
  let consoleLogSpy: any;
  let consoleWarnSpy: any;
  let consoleErrorSpy: any;
  let consoleTimeSpy: any;
  let consoleTimeEndSpy: any;
  let consoleTableSpy: any;
  let consoleGroupSpy: any;
  let consoleGroupEndSpy: any;
  let consoleClearSpy: any;

  beforeEach(() => {
    // Mock 所有 console 方法
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    consoleTimeSpy = vi.spyOn(console, 'time').mockImplementation(() => {});
    consoleTimeEndSpy = vi.spyOn(console, 'timeEnd').mockImplementation(() => {});
    consoleTableSpy = vi.spyOn(console, 'table').mockImplementation(() => {});
    consoleGroupSpy = vi.spyOn(console, 'group').mockImplementation(() => {});
    consoleGroupEndSpy = vi.spyOn(console, 'groupEnd').mockImplementation(() => {});
    consoleClearSpy = vi.spyOn(console, 'clear').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ============ 基础日志方法 (5 个) ============
  describe('基础日志方法', () => {
    it('[Log-1] log() 应该调用 console.log', () => {
      logger.log('测试消息', { data: 'test' });
      expect(consoleLogSpy).toHaveBeenCalled();
    });

    it('[Log-2] info() 应该调用 console.log 并使用 [INFO] 前缀', () => {
      logger.info('信息消息', { key: 'value' });
      expect(consoleLogSpy).toHaveBeenCalled();
    });

    it('[Log-3] warn() 应该调用 console.warn 并使用 [WARN] 前缀', () => {
      logger.warn('警告消息', { issue: 'something' });
      expect(consoleWarnSpy).toHaveBeenCalled();
    });

    it('[Log-4] error() 应该总是调用 console.error（即使在生产环境）', () => {
      const error = new Error('测试错误');
      logger.error('错误消息', error);
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('[ERROR]'),
        expect.stringContaining('color'),
        '错误消息',
        error
      );
    });

    it('[Log-5] debug() 应该调用 console.log 并使用 [DEBUG] 前缀', () => {
      logger.debug('调试消息', { debug: true });
      expect(consoleLogSpy).toHaveBeenCalled();
    });
  });

  // ============ 性能测量 (2 个) ============
  describe('性能测量', () => {
    it('[Perf-1] time() 应该调用 console.time', () => {
      logger.time('operation-1');
      expect(consoleTimeSpy).toHaveBeenCalledWith('operation-1');
    });

    it('[Perf-2] timeEnd() 应该调用 console.timeEnd', () => {
      logger.timeEnd('operation-1');
      expect(consoleTimeEndSpy).toHaveBeenCalledWith('operation-1');
    });
  });

  // ============ 表格和分组 (3 个) ============
  describe('表格和分组输出', () => {
    it('[Output-1] table() 应该调用 console.table', () => {
      const data = [
        { name: '用户1', score: 95 },
        { name: '用户2', score: 87 }
      ];
      logger.table(data);
      expect(consoleTableSpy).toHaveBeenCalledWith(data);
    });

    it('[Output-2] group() 应该调用 console.group', () => {
      logger.group('分组标题');
      expect(consoleGroupSpy).toHaveBeenCalledWith('分组标题');
    });

    it('[Output-3] groupEnd() 应该调用 console.groupEnd', () => {
      logger.groupEnd();
      expect(consoleGroupEndSpy).toHaveBeenCalled();
    });
  });

  // ============ 控制台操作 (1 个) ============
  describe('控制台操作', () => {
    it('[Control-1] clear() 应该调用 console.clear', () => {
      logger.clear();
      expect(consoleClearSpy).toHaveBeenCalled();
    });
  });

  // ============ 自定义选项 (3 个) ============
  describe('自定义选项', () => {
    it('[Options-1] 应该支持自定义 prefix', () => {
      logger.log('消息', { data: 'test' }, { prefix: '[CUSTOM]' });
      expect(consoleLogSpy).toHaveBeenCalledWith(
        '%c[CUSTOM]',
        expect.any(String),
        '消息',
        expect.any(Object)
      );
    });

    it('[Options-2] 应该支持自定义 color', () => {
      logger.info('消息', {}, { color: 'color: #ff0000' });
      expect(consoleLogSpy).toHaveBeenCalledWith(
        '%c[INFO]',
        'color: #ff0000',
        '消息',
        expect.any(Object)
      );
    });

    it('[Options-3] 应该组合使用 prefix 和 color', () => {
      logger.warn('警告', {}, { prefix: '[CUSTOM]', color: 'color: #123456' });
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        '%c[CUSTOM]',
        'color: #123456',
        '警告',
        expect.any(Object)
      );
    });
  });

  // ============ 状态查询 (2 个) ============
  describe('日志状态', () => {
    it('[Status-1] getStatus() 应该返回日志状态对象', () => {
      const status = logger.getStatus();
      expect(status).toHaveProperty('enabled');
      expect(status).toHaveProperty('isDev');
      expect(status).toHaveProperty('environment');
    });

    it('[Status-2] getStatus() 返回的 environment 应该是 development 或 production', () => {
      const status = logger.getStatus();
      expect(['development', 'production']).toContain(status.environment);
    });
  });
});
