const fs = require('fs');
const path = require('path');

/**
 * 配置同步校验器
 *
 * 验证前端和后端的环境配置是否一致：
 * - 前端：.env.config.js 中的 currentEnv
 * - 后端：process.env.NODE_ENV
 *
 * 这是一个可选的安全检查，可以在启动时发现配置不同步的问题。
 */
class ConfigSyncValidator {
  /**
   * 执行配置同步检查
   * 启动时调用此函数，将检查结果输出到控制台
   */
  static validateConfigSync() {
    try {
      // 读取前端配置文件
      const envConfigPath = path.join(process.cwd(), '.env.config.js');

      if (!fs.existsSync(envConfigPath)) {
        console.warn('⚠️  警告: 未找到 .env.config.js 文件，配置同步检查跳过');
        return;
      }

      const envConfigContent = fs.readFileSync(envConfigPath, 'utf-8');

      // 提取 currentEnv 变量
      // 匹配: const currentEnv = 'dev' 或 const currentEnv = "prod"
      const match = envConfigContent.match(/currentEnv\s*=\s*['"](\w+)['"]/);
      if (!match) {
        console.warn('⚠️  警告: 无法从 .env.config.js 提取 currentEnv，配置同步检查跳过');
        return;
      }

      const currentEnv = match[1]; // 'dev' 或 'prod'
      const expectedNodeEnv = ConfigSyncValidator.mapEnvToNodeEnv(currentEnv);
      const actualNodeEnv = process.env.NODE_ENV || 'development'; // 默认值

      // 执行检查
      if (actualNodeEnv === expectedNodeEnv) {
        // ✅ 配置一致
        console.log(
          `✅ 配置一致性检查通过: currentEnv='${currentEnv}' → NODE_ENV='${actualNodeEnv}'`
        );
      } else {
        // ❌ 配置不一致，输出警告
        console.warn(`
⚠️  配置不一致警告！
   前端 .env.config.js: currentEnv='${currentEnv}'
   后端 NODE_ENV: '${actualNodeEnv}'
   期望 NODE_ENV: '${expectedNodeEnv}'

   请确保：
   1. .env.config.js 中的 currentEnv 与启动时的 NODE_ENV 相匹配
   2. 部署前同步修改两个配置

   示例：
   - 开发环境: currentEnv='dev' 且 NODE_ENV='development'
   - 生产环境: currentEnv='prod' 且 NODE_ENV='production'
        `);
      }
    } catch (error) {
      // 配置校验本身出错时，仅输出警告，不影响服务启动
      console.warn('⚠️  配置同步检查失败:', error.message);
    }
  }

  /**
   * 将前端的 currentEnv 映射到后端的 NODE_ENV
   * @private
   * @param {string} currentEnv 前端配置的环境值
   * @returns {string} 对应的 NODE_ENV 值
   */
  // eslint-disable-next-line class-methods-use-this, no-underscore-dangle
  static mapEnvToNodeEnv(currentEnv) {
    const mapping = {
      dev: 'development',
      prod: 'production',
      development: 'development',
      production: 'production',
      test: 'test'
    };

    return mapping[currentEnv] || 'development';
  }

  /**
   * 获取当前环境的详细信息（用于日志）
   * @returns {Object} 环境信息对象
   */
  static getEnvironmentInfo() {
    return {
      nodeEnv: process.env.NODE_ENV || 'development',
      isDevelopment: process.env.NODE_ENV === 'development',
      isProduction: process.env.NODE_ENV === 'production',
      isTest: process.env.NODE_ENV === 'test'
    };
  }

  /**
   * 检查是否为生产环境
   * 用于条件判断：if (ConfigSyncValidator.isProduction()) { ... }
   * @returns {boolean}
   */
  static isProduction() {
    return process.env.NODE_ENV === 'production';
  }

  /**
   * 检查是否为开发环境
   * @returns {boolean}
   */
  static isDevelopment() {
    return process.env.NODE_ENV === 'development' || !process.env.NODE_ENV;
  }

  /**
   * 检查是否为测试环境
   * @returns {boolean}
   */
  static isTest() {
    return process.env.NODE_ENV === 'test';
  }
}

module.exports = ConfigSyncValidator;
