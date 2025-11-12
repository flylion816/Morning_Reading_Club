/**
 * 本地存储工具类
 * 封装微信小程序的本地存储API,支持过期时间
 */

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
      console.error('存储失败:', error);
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
        fail: (err) => reject(err)
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
      console.error('读取存储失败:', error);
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
        success: (res) => {
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
      console.error('删除存储失败:', error);
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
        fail: (err) => reject(err)
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
      console.error('清空存储失败:', error);
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
        fail: (err) => reject(err)
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
      console.error('获取键名失败:', error);
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
      console.error('获取存储信息失败:', error);
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
module.exports = new Storage();
