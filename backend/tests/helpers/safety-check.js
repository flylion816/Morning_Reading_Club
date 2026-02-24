/**
 * 🔒 测试环境安全检查
 * 防止单元测试和集成测试连接到真实的生产数据库
 * 这是一个关键的安全防护，防止数据丧失
 */

module.exports = {
  /**
   * 检查测试环境是否安全
   * @throws {Error} 如果环境不安全
   */
  checkTestEnvironment() {
    const NODE_ENV = process.env.NODE_ENV;
    const MONGODB_URI = process.env.MONGODB_URI;

    // ❌ 禁止在生产环境运行测试
    if (NODE_ENV === 'production') {
      throw new Error(
        '🚫 [CRITICAL] 单元测试禁止在生产环境运行！\n' +
        '原因：测试会删除数据库中的所有数据。\n' +
        '解决方案：\n' +
        '  1. 设置 NODE_ENV=test\n' +
        '  2. 加载 .env.test 文件\n' +
        '  3. 使用内存数据库（MongoMemoryServer）\n' +
        '当前 NODE_ENV: ' + NODE_ENV
      );
    }

    // ⚠️ 警告：检查是否试图连接到真实数据库
    if (NODE_ENV === 'development' && MONGODB_URI && MONGODB_URI.includes('morning_reading_db')) {
      console.warn(
        '⚠️  [WARNING] 单元测试在开发环境运行，正在连接到真实数据库！\n' +
        '检查：当前 MONGODB_URI = ' + MONGODB_URI + '\n' +
        '建议：如果不是有意，请设置 NODE_ENV=test'
      );
    }

    // ℹ️ 信息：测试环境正确配置
    if (NODE_ENV === 'test') {
      if (!MONGODB_URI || MONGODB_URI === '') {
        console.log('✅ [SAFE] 测试环境配置正确：使用内存数据库（MongoMemoryServer）');
      } else {
        console.log('ℹ️  [INFO] 测试环境运行中。MONGODB_URI: ' + MONGODB_URI);
      }
    }
  },

  /**
   * 防护：禁止在测试中执行 deleteMany({}) 连接到真实数据库
   * @param {string} context - 调用上下文（模型名称）
   */
  warnDeleteMany(context) {
    const NODE_ENV = process.env.NODE_ENV;
    if (NODE_ENV !== 'test' && NODE_ENV !== 'development') {
      throw new Error(
        `❌ [CRITICAL] 尝试在 ${NODE_ENV} 环境中执行 deleteMany！\n` +
        `上下文: ${context}\n` +
        `这会导致数据丧失！停止执行。`
      );
    }
  }
};
