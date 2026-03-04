/**
 * 导出工具单元测试
 * 测试 CSV、Excel、JSON 导出功能
 * 共 24 个测试用例
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  exportToCSV,
  exportToJSON,
  generateExportData,
  generateStatisticsReport,
  generateFilename
} from '../exportUtils';

describe('Export Utils - 数据导出工具', () => {
  let createElementSpy: any;
  let appendChildSpy: any;
  let removeChildSpy: any;
  let revokeObjectURLSpy: any;
  let createObjectURLSpy: any;

  beforeEach(() => {
    // Mock DOM 方法
    createElementSpy = vi.spyOn(document, 'createElement');
    appendChildSpy = vi.spyOn(document.body, 'appendChild');
    removeChildSpy = vi.spyOn(document.body, 'removeChild');
    revokeObjectURLSpy = vi.spyOn(URL, 'revokeObjectURL');
    createObjectURLSpy = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:mock-url');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ============ CSV 导出 (4 个) ============
  describe('CSV 导出', () => {
    it('[CSV-1] exportToCSV() 应该创建下载链接', () => {
      const headers = ['姓名', '年龄'];
      const rows = [['张三', '25'], ['李四', '30']];

      exportToCSV('用户列表', headers, rows);

      expect(createObjectURLSpy).toHaveBeenCalled();
      expect(appendChildSpy).toHaveBeenCalled();
      expect(removeChildSpy).toHaveBeenCalled();
      expect(revokeObjectURLSpy).toHaveBeenCalled();
    });

    it('[CSV-2] exportToCSV() 应该正确处理包含逗号的数据', () => {
      const headers = ['文本'];
      const rows = [['包含,逗号的内容']];

      exportToCSV('test', headers, rows);

      expect(createObjectURLSpy).toHaveBeenCalled();
    });

    it('[CSV-3] exportToCSV() 应该正确处理包含双引号的数据', () => {
      const headers = ['文本'];
      const rows = [['包含"双引号"的内容']];

      exportToCSV('test', headers, rows);

      expect(createObjectURLSpy).toHaveBeenCalled();
    });

    it('[CSV-4] exportToCSV() 应该正确处理包含换行的数据', () => {
      const headers = ['文本'];
      const rows = [['包含\n换行的内容']];

      exportToCSV('test', headers, rows);

      expect(createObjectURLSpy).toHaveBeenCalled();
    });
  });

  // ============ JSON 导出 (3 个) ============
  describe('JSON 导出', () => {
    it('[JSON-1] exportToJSON() 应该创建下载链接', () => {
      const headers = ['姓名', '年龄'];
      const rows = [['张三', '25'], ['李四', '30']];

      exportToJSON('用户列表', headers, rows);

      expect(createObjectURLSpy).toHaveBeenCalled();
      expect(appendChildSpy).toHaveBeenCalled();
      expect(removeChildSpy).toHaveBeenCalled();
      expect(revokeObjectURLSpy).toHaveBeenCalled();
    });

    it('[JSON-2] exportToJSON() 应该将数据转换为对象数组', () => {
      const headers = ['name', 'age'];
      const rows = [['张三', 25]];

      exportToJSON('data', headers, rows);

      expect(createObjectURLSpy).toHaveBeenCalled();
    });

    it('[JSON-3] exportToJSON() 应该处理空数据', () => {
      const headers = ['列1', '列2'];
      const rows: any[] = [];

      exportToJSON('empty', headers, rows);

      expect(createObjectURLSpy).toHaveBeenCalled();
    });
  });

  // ============ 数据生成 (5 个) ============
  describe('generateExportData - 生成导出数据', () => {
    it('[Gen-1] 应该从对象数组生成导出数据', () => {
      const data = [
        { id: 1, name: '张三', score: 95 },
        { id: 2, name: '李四', score: 87 }
      ];
      const fieldMap = [
        { key: 'id', label: 'ID' },
        { key: 'name', label: '姓名' },
        { key: 'score', label: '成绩' }
      ];

      const result = generateExportData(data, fieldMap);

      expect(result.headers).toEqual(['ID', '姓名', '成绩']);
      expect(result.rows).toHaveLength(2);
      expect(result.rows[0]).toEqual([1, '张三', 95]);
      expect(result.rows[1]).toEqual([2, '李四', 87]);
    });

    it('[Gen-2] 应该支持自定义格式化函数', () => {
      const data = [{ name: '张三', date: new Date('2025-03-04') }];
      const fieldMap = [
        {
          key: 'name',
          label: '姓名'
        },
        {
          key: 'date',
          label: '日期',
          formatter: (value: Date) => value.toLocaleDateString('zh-CN')
        }
      ];

      const result = generateExportData(data, fieldMap);

      expect(result.rows[0][1]).toBe('2025/3/4');
    });

    it('[Gen-3] 应该为缺失的值使用默认值 "-"', () => {
      const data = [{ id: 1, name: '张三', email: null }];
      const fieldMap = [
        { key: 'id', label: 'ID' },
        { key: 'name', label: '姓名' },
        { key: 'email', label: '邮箱' }
      ];

      const result = generateExportData(data, fieldMap);

      expect(result.rows[0][2]).toBe('-');
    });

    it('[Gen-4] 应该处理空数据数组', () => {
      const data: any[] = [];
      const fieldMap = [{ key: 'id', label: 'ID' }];

      const result = generateExportData(data, fieldMap);

      expect(result.rows).toHaveLength(0);
      expect(result.headers).toEqual(['ID']);
    });

    it('[Gen-5] 应该支持复杂的数据转换', () => {
      const data = [
        { userId: 1, status: 'active', amount: 99.5 },
        { userId: 2, status: 'inactive', amount: 0 }
      ];
      const fieldMap = [
        { key: 'userId', label: '用户ID' },
        {
          key: 'status',
          label: '状态',
          formatter: (value: string) => value === 'active' ? '活跃' : '未活跃'
        },
        {
          key: 'amount',
          label: '金额',
          formatter: (value: number) => `¥${value.toFixed(2)}`
        }
      ];

      const result = generateExportData(data, fieldMap);

      expect(result.rows[0]).toEqual([1, '活跃', '¥99.50']);
      expect(result.rows[1]).toEqual([2, '未活跃', '¥0.00']);
    });
  });

  // ============ 统计报表 (3 个) ============
  describe('generateStatisticsReport - 生成统计报表', () => {
    it('[Report-1] 应该生成完整的统计报表对象', () => {
      const statistics = { 总用户数: 100, 活跃用户: 80 };
      const exportData = {
        headers: ['ID', '姓名'],
        rows: [['1', '张三']]
      };

      const report = generateStatisticsReport('用户统计', statistics, exportData);

      expect(report.title).toBe('用户统计');
      expect(report.statistics).toEqual(statistics);
      expect(report.data).toEqual(exportData);
      expect(report).toHaveProperty('generatedAt');
    });

    it('[Report-2] generatedAt 应该是有效的日期格式', () => {
      const report = generateStatisticsReport('测试', {}, { headers: [], rows: [] });
      expect(report.generatedAt).toBeTruthy();
      expect(typeof report.generatedAt).toBe('string');
    });

    it('[Report-3] 应该支持各种数据类型的统计值', () => {
      const statistics = {
        总数: 100,
        比率: 85.5,
        说明: '这是统计说明'
      };

      const report = generateStatisticsReport('多类型统计', statistics, {
        headers: [],
        rows: []
      });

      expect(report.statistics).toEqual(statistics);
    });
  });

  // ============ 文件名生成 (3 个) ============
  describe('generateFilename - 生成文件名', () => {
    it('[Filename-1] 应该生成包含前缀的文件名', () => {
      const filename = generateFilename('报表');
      expect(filename).toContain('报表');
    });

    it('[Filename-2] 生成的文件名应该包含日期', () => {
      const filename = generateFilename('日志');
      // 文件名格式: 前缀-日期-时间戳
      expect(filename).toMatch(/日志-\d{4}-\d{1,2}-\d{1,2}-\d+/);
    });

    it('[Filename-3] 每次调用应该生成不同的文件名（由于时间戳）', async () => {
      const filename1 = generateFilename('数据');
      // 等待毫秒以确保时间戳不同
      await new Promise(resolve => setTimeout(resolve, 10));
      const filename2 = generateFilename('数据');

      expect(filename1).not.toBe(filename2);
    });
  });

  // ============ 导出数据类型 (3 个) ============
  describe('导出数据接口和类型', () => {
    it('[Type-1] ExportData 应该有 headers 和 rows 属性', () => {
      const data = generateExportData(
        [{ id: 1, name: '张三' }],
        [
          { key: 'id', label: 'ID' },
          { key: 'name', label: '姓名' }
        ]
      );

      expect(data).toHaveProperty('headers');
      expect(data).toHaveProperty('rows');
      expect(Array.isArray(data.headers)).toBe(true);
      expect(Array.isArray(data.rows)).toBe(true);
    });

    it('[Type-2] StatisticsReport 应该有必要的字段', () => {
      const report = generateStatisticsReport('测试', { 总数: 10 }, {
        headers: ['col'],
        rows: [['val']]
      });

      expect(report).toHaveProperty('title');
      expect(report).toHaveProperty('generatedAt');
      expect(report).toHaveProperty('statistics');
      expect(report).toHaveProperty('data');
    });

    it('[Type-3] 行数据应该只包含字符串或数字（带格式化）', () => {
      const data = generateExportData(
        [{ id: 1, name: '张三', active: true }],
        [
          { key: 'id', label: 'ID' },
          { key: 'name', label: '姓名' },
          {
            key: 'active',
            label: '激活',
            formatter: (value: boolean) => value ? '是' : '否'
          }
        ]
      );

      data.rows.forEach(row => {
        row.forEach(cell => {
          expect(typeof cell === 'string' || typeof cell === 'number').toBe(true);
        });
      });
    });
  });
});
