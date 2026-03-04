/**
 * Storage Utility Tests
 * Tests for the local storage wrapper that supports expiration
 *
 * Test Coverage:
 * - Set and get operations
 * - Data expiration
 * - JSON serialization
 * - Storage clearing
 * - Edge cases (null, undefined, empty values)
 */

const storage = require('../../utils/storage');
const constants = require('../../config/constants');

describe('Storage Utility', () => {
  beforeEach(() => {
    // Clear storage before each test
    global.wx.__storage = {};
    global.wx.setStorageSync = jest.fn((key, data) => {
      if (!global.wx.__storage) {
        global.wx.__storage = {};
      }
      global.wx.__storage[key] = data;
    });
    global.wx.getStorageSync = jest.fn((key) => {
      return global.wx.__storage?.[key] || null;
    });
    global.wx.removeStorageSync = jest.fn((key) => {
      if (global.wx.__storage) {
        delete global.wx.__storage[key];
      }
    });
    global.wx.clearStorageSync = jest.fn(() => {
      global.wx.__storage = {};
    });
    jest.clearAllMocks();
  });

  describe('[STOR-1] 保存数据应成功存储到本地', () => {
    test('should store string value', () => {
      const result = storage.set('test_key', 'test_value');
      expect(result).toBe(true);
      expect(global.wx.__storage['test_key']).toBeDefined();
    });

    test('should store number value', () => {
      storage.set('count', 42);
      const stored = global.wx.__storage['count'];
      expect(stored).toBeDefined();
      const parsed = JSON.parse(stored);
      expect(parsed.value).toBe(42);
    });

    test('should store boolean value', () => {
      storage.set('flag', true);
      const stored = global.wx.__storage['flag'];
      expect(stored).toBeDefined();
      const parsed = JSON.parse(stored);
      expect(parsed.value).toBe(true);
    });

    test('should store object value', () => {
      const user = { id: '123', name: 'Test User' };
      storage.set('user', user);
      const stored = global.wx.__storage['user'];
      expect(stored).toBeDefined();
      const parsed = JSON.parse(stored);
      expect(parsed.value).toEqual(user);
    });

    test('should store array value', () => {
      const items = [1, 2, 3, 4, 5];
      storage.set('items', items);
      const stored = global.wx.__storage['items'];
      expect(stored).toBeDefined();
      const parsed = JSON.parse(stored);
      expect(parsed.value).toEqual(items);
    });

    test('should include timestamp in stored data', () => {
      const beforeTime = Date.now();
      storage.set('test', 'value');
      const afterTime = Date.now();

      const stored = global.wx.__storage['test'];
      const parsed = JSON.parse(stored);
      expect(parsed.timestamp).toBeGreaterThanOrEqual(beforeTime);
      expect(parsed.timestamp).toBeLessThanOrEqual(afterTime);
    });
  });

  describe('[STOR-2] 读取数据应返回已保存的值', () => {
    test('should retrieve stored string value', () => {
      storage.set('key', 'stored_value');
      const value = storage.get('key');
      expect(value).toBe('stored_value');
    });

    test('should retrieve stored object value', () => {
      const user = { id: '456', name: 'User Name' };
      storage.set('user', user);
      const retrieved = storage.get('user');
      expect(retrieved).toEqual(user);
    });

    test('should retrieve stored array value', () => {
      const list = ['a', 'b', 'c'];
      storage.set('list', list);
      const retrieved = storage.get('list');
      expect(retrieved).toEqual(list);
    });

    test('should retrieve stored number value', () => {
      storage.set('number', 123);
      const value = storage.get('number');
      expect(value).toBe(123);
    });

    test('should retrieve stored boolean value', () => {
      storage.set('boolean', false);
      const value = storage.get('boolean');
      expect(value).toBe(false);
    });

    test('should handle nested object retrieval', () => {
      const nested = {
        user: { id: '1', name: 'Test' },
        settings: { theme: 'dark', lang: 'zh' }
      };
      storage.set('nested', nested);
      const retrieved = storage.get('nested');
      expect(retrieved).toEqual(nested);
      expect(retrieved.user.name).toBe('Test');
    });
  });

  describe('[STOR-3] 删除数据应清除本地存储', () => {
    test('should remove stored value', () => {
      storage.set('to_delete', 'value');
      expect(global.wx.__storage['to_delete']).toBeDefined();

      const result = storage.remove('to_delete');
      expect(result).toBe(true);
      expect(global.wx.__storage['to_delete']).toBeUndefined();
    });

    test('should not error when removing non-existent key', () => {
      const result = storage.remove('nonexistent');
      expect(result).toBe(true);
    });

    test('should return false on error (if storage error occurs)', () => {
      // This tests error handling for wx API failures
      global.wx.removeStorageSync = jest.fn(() => {
        throw new Error('Storage error');
      });

      const result = storage.remove('key');
      expect(result).toBe(false);
    });

    test('should only remove specified key', () => {
      storage.set('key1', 'value1');
      storage.set('key2', 'value2');
      storage.set('key3', 'value3');

      storage.remove('key2');

      expect(global.wx.__storage['key1']).toBeDefined();
      expect(global.wx.__storage['key2']).toBeUndefined();
      expect(global.wx.__storage['key3']).toBeDefined();
    });
  });

  describe('[STOR-4] 清空所有数据应删除所有键值', () => {
    test('should clear all stored data', () => {
      storage.set('key1', 'value1');
      storage.set('key2', 'value2');
      storage.set('key3', 'value3');

      const result = storage.clear();
      expect(result).toBe(true);
      expect(Object.keys(global.wx.__storage).length).toBe(0);
    });

    test('should be safe to call when storage is empty', () => {
      const result = storage.clear();
      expect(result).toBe(true);
      expect(global.wx.__storage).toEqual({});
    });

    test('should clear complex data structures', () => {
      storage.set('user', { id: '1', name: 'User' });
      storage.set('items', [1, 2, 3]);
      storage.set('settings', { theme: 'dark' });

      storage.clear();

      expect(storage.get('user')).toBeNull();
      expect(storage.get('items')).toBeNull();
      expect(storage.get('settings')).toBeNull();
    });
  });

  describe('[STOR-5] 读取不存在的键应返回 null', () => {
    test('should return null for non-existent key', () => {
      const value = storage.get('nonexistent');
      expect(value).toBeNull();
    });

    test('should return null after key is removed', () => {
      storage.set('temp', 'value');
      storage.remove('temp');
      const value = storage.get('temp');
      expect(value).toBeNull();
    });

    test('should return null for expired key', () => {
      const now = Date.now();
      // Set an item with 100ms expiration, already expired
      const expiredData = {
        value: 'test',
        timestamp: now - 200,
        expire: 100
      };
      global.wx.__storage['expired'] = JSON.stringify(expiredData);

      const value = storage.get('expired');
      expect(value).toBeNull();
    });

    test('should clear expired key from storage', () => {
      const now = Date.now();
      const expiredData = {
        value: 'test',
        timestamp: now - 200,
        expire: 100
      };
      global.wx.__storage['expired'] = JSON.stringify(expiredData);

      storage.get('expired');

      // Expired key should be removed
      expect(global.wx.__storage['expired']).toBeUndefined();
    });

    test('should return null when storage returns empty', () => {
      global.wx.getStorageSync = jest.fn(() => null);
      const value = storage.get('key');
      expect(value).toBeNull();
    });
  });

  describe('[STOR-6] 应支持 JSON 对象序列化和反序列化', () => {
    beforeEach(() => {
      // Reset storage before each test in this suite
      global.wx.__storage = {};
      jest.clearAllMocks();
    });

    test('should serialize complex objects', () => {
      const complex = {
        user: {
          id: '123',
          profile: { age: 25, city: 'Beijing' }
        },
        items: [1, 2, 3],
        settings: { theme: 'dark', notifications: true }
      };

      storage.set('complex', complex);
      const retrieved = storage.get('complex');

      expect(retrieved).toEqual(complex);
      expect(retrieved.user.profile.city).toBe('Beijing');
      expect(retrieved.items).toEqual([1, 2, 3]);
    });

    test('should handle null values in objects', () => {
      const obj = {
        id: '123',
        name: 'Test',
        description: null,
        tags: []
      };

      storage.set('obj', obj);
      const retrieved = storage.get('obj');

      expect(retrieved.id).toBe('123');
      expect(retrieved.description).toBeNull();
      expect(retrieved.tags).toEqual([]);
    });

    test('should handle arrays of objects', () => {
      const array = [
        { id: 1, name: 'Item 1' },
        { id: 2, name: 'Item 2' },
        { id: 3, name: 'Item 3' }
      ];

      storage.set('items', array);
      const retrieved = storage.get('items');

      expect(Array.isArray(retrieved)).toBe(true);
      expect(retrieved.length).toBe(3);
      expect(retrieved[0].name).toBe('Item 1');
    });

    test('should handle special characters in strings', () => {
      const text = '特殊字符 "quotes" and \'single\' \n newlines \t tabs';
      storage.set('text', text);
      const retrieved = storage.get('text');

      expect(retrieved).toBe(text);
    });

    test('should handle Date objects (converted to strings)', () => {
      const date = new Date('2025-03-04').toISOString();
      storage.set('date', date);
      const retrieved = storage.get('date');

      expect(retrieved).toBe(date);
    });

    test('should handle boolean values correctly', () => {
      global.wx.__storage = {}; // Reset before test
      storage.set('true_val', true);
      storage.set('false_val', false);

      expect(storage.get('true_val')).toBe(true);
      expect(storage.get('false_val')).toBe(false);
    });

    test('should handle zero and empty string', () => {
      global.wx.__storage = {}; // Reset before test
      storage.set('zero', 0);
      storage.set('empty', '');

      expect(storage.get('zero')).toBe(0);
      expect(storage.get('empty')).toBe('');
    });

    test('should return null on JSON parse error', () => {
      // Corrupt the data
      global.wx.__storage['corrupt'] = 'invalid json {]';

      const value = storage.get('corrupt');
      expect(value).toBeNull();
    });
  });

  describe('Additional Storage Features', () => {
    beforeEach(() => {
      // Reset storage before each test in this suite
      global.wx.__storage = {};
      jest.clearAllMocks();
    });

    test('should support data expiration', () => {
      const now = Date.now();
      storage.set('temp', 'value', 1000); // 1 second expiration

      // Create data that looks expired
      const expiredData = {
        value: 'old',
        timestamp: now - 2000,
        expire: 1000
      };
      global.wx.__storage['old'] = JSON.stringify(expiredData);

      expect(storage.get('old')).toBeNull();
    });

    test('should support data that never expires', () => {
      global.wx.__storage = {}; // Reset storage
      storage.set('permanent', 'value', null);
      const retrieved = storage.get('permanent');
      expect(retrieved).toBe('value');
    });

    test('has() should return true for existing keys', () => {
      global.wx.__storage = {}; // Reset storage
      storage.set('exists', 'value');
      expect(storage.has('exists')).toBe(true);
    });

    test('has() should return false for non-existent keys', () => {
      expect(storage.has('nonexistent')).toBe(false);
    });

    test('getAllKeys() should return all stored keys', () => {
      storage.clear();
      storage.set('key1', 'value1');
      storage.set('key2', 'value2');

      global.wx.getStorageInfoSync = jest.fn(() => ({
        keys: ['key1', 'key2']
      }));

      const keys = storage.getAllKeys();
      expect(Array.isArray(keys)).toBe(true);
    });

    test('getInfo() should return storage information', () => {
      global.wx.getStorageInfoSync = jest.fn(() => ({
        keys: ['key1', 'key2'],
        currentSize: 1024,
        limitSize: 10240
      }));

      const info = storage.getInfo();
      expect(info.keys).toBeDefined();
      expect(info.currentSize).toBeDefined();
      expect(info.limitSize).toBeDefined();
    });
  });
});
