/**
 * 本地存储工具类
 * 封装微信小程序的本地存储API,支持过期时间
 */

const logger = require('./logger');

class Storage {
  /**
   * 设置存储
   * @param {string} key 键名
   * @param {any} value 值
   * @param {number} expire 过期时间(毫秒),null表示永久有效
   */
  set(key, value, expire = null) {
    try {
      const data = {
        value,
        timestamp: Date.now(),
        expire
      };
      wx.setStorageSync(key, JSON.stringify(data));
      return true;
    } catch (error) {
      logger.error('存储失败:', error);
      return false;
    }
  }

  /**
   * 异步设置存储
   */
  setAsync(key, value, expire = null) {
    return new Promise((resolve, reject) => {
      const data = {
        value,
        timestamp: Date.now(),
        expire
      };
      wx.setStorage({
        key,
        data: JSON.stringify(data),
        success: () => resolve(true),
        fail: err => reject(err)
      });
    });
  }

  /**
   * 获取存储
   * @param {string} key 键名
   * @returns {any} 返回存储的值,如果不存在或已过期则返回null
   */
  get(key) {
    try {
      const dataStr = wx.getStorageSync(key);

      if (!dataStr) {
        return null;
      }

      const data = JSON.parse(dataStr);

      // 检查是否过期
      if (data.expire) {
        const now = Date.now();
        if (now - data.timestamp > data.expire) {
          // 已过期,删除并返回null
          this.remove(key);
          return null;
        }
      }

      return data.value;
    } catch (error) {
      logger.error('读取存储失败:', error);
      return null;
    }
  }

  /**
   * 异步获取存储
   */
  getAsync(key) {
    return new Promise((resolve, reject) => {
      wx.getStorage({
        key,
        success: res => {
          try {
            const data = JSON.parse(res.data);

            // 检查是否过期
            if (data.expire) {
              const now = Date.now();
              if (now - data.timestamp > data.expire) {
                this.remove(key);
                resolve(null);
                return;
              }
            }

            resolve(data.value);
          } catch (error) {
            reject(error);
          }
        },
        fail: () => resolve(null)
      });
    });
  }

  /**
   * 删除存储
   * @param {string} key 键名
   */
  remove(key) {
    try {
      wx.removeStorageSync(key);
      return true;
    } catch (error) {
      logger.error('删除存储失败:', error);
      return false;
    }
  }

  /**
   * 异步删除存储
   */
  removeAsync(key) {
    return new Promise((resolve, reject) => {
      wx.removeStorage({
        key,
        success: () => resolve(true),
        fail: err => reject(err)
      });
    });
  }

  /**
   * 清空所有存储
   */
  clear() {
    try {
      wx.clearStorageSync();
      return true;
    } catch (error) {
      logger.error('清空存储失败:', error);
      return false;
    }
  }

  /**
   * 异步清空所有存储
   */
  clearAsync() {
    return new Promise((resolve, reject) => {
      wx.clearStorage({
        success: () => resolve(true),
        fail: err => reject(err)
      });
    });
  }

  /**
   * 获取所有键名
   * @returns {Array} 键名数组
   */
  getAllKeys() {
    try {
      const info = wx.getStorageInfoSync();
      return info.keys || [];
    } catch (error) {
      logger.error('获取键名失败:', error);
      return [];
    }
  }

  /**
   * 获取存储信息
   * @returns {Object} 存储信息对象
   */
  getInfo() {
    try {
      return wx.getStorageInfoSync();
    } catch (error) {
      logger.error('获取存储信息失败:', error);
      return {
        keys: [],
        currentSize: 0,
        limitSize: 0
      };
    }
  }

  /**
   * 检查键是否存在
   * @param {string} key 键名
   * @returns {boolean}
   */
  has(key) {
    const value = this.get(key);
    return value !== null;
  }
}

// 导出单例
const storageInstance = new Storage();

// 多租户隔离存储：所有 key 带 wxAppId 前缀
const envConfig = require('../config/env');

function _prefixKey(key) {
  const appId = envConfig.wxAppId || 'default';
  return `${appId}:${key}`;
}

function _logValueForKey(key, value) {
  if (/token/i.test(key)) return '[REDACTED]';
  if (typeof value === 'object') return JSON.stringify(value).slice(0, 80);
  return value;
}

const tenantStorage = {
  set(key, value) {
    const prefixedKey = _prefixKey(key);
    console.log('[TENANT-STORAGE] set', prefixedKey, _logValueForKey(key, value));
    wx.setStorageSync(prefixedKey, value);
  },
  get(key) {
    // 迁移兼容：先读带前缀的 key，回退到旧 key（首次升级时迁移旧数据）
    const prefixedKey = _prefixKey(key);
    const val = wx.getStorageSync(prefixedKey);
    if (val !== '' && val !== null && val !== undefined) {
      console.log('[TENANT-STORAGE] get (hit)', prefixedKey);
      return val;
    }
    const legacy = wx.getStorageSync(key);
    if (legacy !== '' && legacy !== null && legacy !== undefined) {
      console.log('[TENANT-STORAGE] get (migrate legacy)', key, '->', prefixedKey);
      tenantStorage.set(key, legacy);
      wx.removeStorageSync(key);
      return legacy;
    }
    console.log('[TENANT-STORAGE] get (miss)', prefixedKey);
    return null;
  },
  remove(key) {
    const prefixedKey = _prefixKey(key);
    console.log('[TENANT-STORAGE] remove', prefixedKey);
    wx.removeStorageSync(prefixedKey);
    wx.removeStorageSync(key);
  }
};

module.exports = storageInstance;
module.exports.tenantStorage = tenantStorage;
