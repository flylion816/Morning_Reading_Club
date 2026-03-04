/**
 * 测试数据工厂函数统一导出
 * 用于所有单元测试中导入使用
 */

export * from './user-fixtures';
export * from './period-fixtures';
export * from './enrollment-fixtures';
export * from './insight-fixtures';

// 导出 Section 相关的接口和工厂函数
export type { MockSection } from './period-fixtures';
export { createMockSection, createMockSections } from './period-fixtures';
