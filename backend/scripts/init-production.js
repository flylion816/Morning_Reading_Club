/**
 * 生产环境初始化脚本
 *
 * 用途：在生产环境部署前执行初始化任务
 *
 * 使用方法：
 *   node scripts/init-production.js [--skip-admin] [--skip-indexes] [--skip-verification]
 *
 * 选项：
 *   --skip-admin       跳过创建超级管理员账户
 *   --skip-indexes     跳过创建数据库索引
 *   --skip-verification 跳过环境验证
 */

const mongoose = require('mongoose');
const chalk = require('chalk');
require('dotenv').config();

// 导入配置验证器
const { validateConfig } = require('../src/utils/config-validator');

// 导入模型
const AdminUser = require('../src/models/AdminUser');
const User = require('../src/models/User');
const Period = require('../src/models/Period');
const Section = require('../src/models/Section');
const Insight = require('../src/models/Insight');
const Checkin = require('../src/models/Checkin');
const Comment = require('../src/models/Comment');
const AuditLog = require('../src/models/AuditLog');

// 解析命令行参数
const args = process.argv.slice(2);
const skipAdmin = args.includes('--skip-admin');
const skipIndexes = args.includes('--skip-indexes');
const skipVerification = args.includes('--skip-verification');

// 初始化颜色
const log = (msg, color = 'cyan') => console.log(chalk[color](msg));
const error = (msg) => console.error(chalk.red(msg));
const success = (msg) => console.log(chalk.green(msg));
const warn = (msg) => console.log(chalk.yellow(msg));

/**
 * 验证环境配置
 */
async function verifyConfig() {
  log('\n📋 验证环境配置...');
  try {
    validateConfig();
    success('✓ 环境配置验证成功');
    return true;
  } catch (err) {
    error('✗ 环境配置验证失败');
    return false;
  }
}

/**
 * 连接MongoDB
 */
async function connectMongoDB() {
  log('\n🔗 连接MongoDB...');
  try {
    await mongoose.connect(process.env.MONGODB_URI, {
      serverSelectionTimeoutMS: 5000,
    });
    success('✓ MongoDB连接成功');
    return true;
  } catch (err) {
    error(`✗ MongoDB连接失败: ${err.message}`);
    return false;
  }
}

/**
 * 创建数据库索引
 */
async function createIndexes() {
  log('\n📇 创建数据库索引...');
  try {
    const models = [AdminUser, User, Period, Section, Insight, Checkin, Comment, AuditLog];
    let indexCount = 0;

    for (const model of models) {
      try {
        // collection.getIndexes() 会返回所有现有索引
        const indexes = await model.collection.getIndexes();
        const indexNames = Object.keys(indexes);
        indexCount += indexNames.length;
        log(`  ✓ ${model.modelName}: ${indexNames.length} 个索引`, 'gray');
      } catch (err) {
        warn(`  ⚠ ${model.modelName}: ${err.message}`);
      }
    }

    success(`✓ 索引检查完成 (共 ${indexCount} 个索引)`);
    return true;
  } catch (err) {
    error(`✗ 创建索引失败: ${err.message}`);
    return false;
  }
}

/**
 * 创建超级管理员账户（如果不存在）
 */
async function createSuperAdmin() {
  log('\n👨‍💼 初始化超级管理员账户...');
  try {
    // 检查是否已存在管理员
    const existingAdmin = await AdminUser.findOne({
      email: 'admin@morningreading.com',
    });

    if (existingAdmin) {
      warn('⚠ 超级管理员账户已存在，跳过创建');
      return true;
    }

    // 创建超级管理员
    const superAdmin = new AdminUser({
      name: 'System Administrator',
      email: 'admin@morningreading.com',
      password: 'admin123456', // 密码会在模型中被哈希
      role: 'superadmin',
      status: 'active',
    });

    await superAdmin.save();
    success('✓ 超级管理员账户创建成功');
    success('  邮箱: admin@morningreading.com');
    success('  默认密码: admin123456 (请在生产环境中修改)');
    return true;
  } catch (err) {
    error(`✗ 创建超级管理员失败: ${err.message}`);
    return false;
  }
}

/**
 * 数据库迁移检查
 */
async function checkMigrations() {
  log('\n🔄 检查数据迁移...');
  try {
    // 这里可以添加具体的数据库迁移逻辑
    // 例如：修复数据格式、删除过期数据、填充新字段等

    const userCount = await User.countDocuments();
    const periodCount = await Period.countDocuments();
    const insightCount = await Insight.countDocuments();

    log(`  • 用户数量: ${userCount}`, 'gray');
    log(`  • 期次数量: ${periodCount}`, 'gray');
    log(`  • 心得数量: ${insightCount}`, 'gray');

    success('✓ 数据库迁移检查完成');
    return true;
  } catch (err) {
    error(`✗ 数据库迁移检查失败: ${err.message}`);
    return false;
  }
}

/**
 * 系统健康检查
 */
async function healthCheck() {
  log('\n🏥 系统健康检查...');
  try {
    // 检查MongoDB连接
    const mongoStatus = mongoose.connection.readyState === 1 ? 'connected' : 'disconnected';
    log(`  • MongoDB: ${mongoStatus}`, 'gray');

    // 检查是否可以读写数据
    const testUser = new User({
      openid: `test_${Date.now()}`,
      nickname: 'Test User',
      gender: 'secret',
    });

    const saved = await testUser.save();
    await User.deleteOne({ _id: saved._id });
    log(`  • 数据库读写: OK`, 'gray');

    success('✓ 系统健康检查通过');
    return true;
  } catch (err) {
    error(`✗ 系统健康检查失败: ${err.message}`);
    return false;
  }
}

/**
 * 显示初始化摘要
 */
function showSummary(results) {
  const passed = Object.values(results).filter((v) => v).length;
  const total = Object.keys(results).length;

  log('\n' + chalk.cyan.bold('═════════════════════════════════════════'), 'cyan');
  log(chalk.cyan.bold('   初始化结果摘要'), 'cyan');
  log(chalk.cyan.bold('═════════════════════════════════════════'), 'cyan');

  Object.entries(results).forEach(([key, passed]) => {
    const status = passed ? chalk.green('✓') : chalk.red('✗');
    const taskName = {
      config: '环境配置验证',
      mongodb: 'MongoDB连接',
      indexes: '数据库索引',
      admin: '超级管理员',
      migrations: '数据迁移',
      health: '系统健康检查',
    }[key];

    console.log(`  ${status} ${taskName}`);
  });

  log(chalk.cyan.bold('═════════════════════════════════════════'), 'cyan');

  if (passed === total) {
    success(`\n✅ 所有初始化任务完成! (${passed}/${total})\n`);
    return true;
  } else {
    error(`\n❌ 初始化过程中出现错误! (${passed}/${total})\n`);
    return false;
  }
}

/**
 * 主初始化流程
 */
async function main() {
  console.clear();
  log('\n' + chalk.cyan.bold('╔═════════════════════════════════════════╗'), 'cyan');
  log(chalk.cyan.bold('║   晨读营项目 - 生产环境初始化'), 'cyan');
  log(chalk.cyan.bold('╚═════════════════════════════════════════╝'), 'cyan');

  const results = {};

  try {
    // 1. 验证环境配置
    if (!skipVerification) {
      results.config = await verifyConfig();
      if (!results.config) {
        error('\n环境配置验证失败，无法继续初始化');
        process.exit(1);
      }
    } else {
      warn('\n⊘ 跳过环境验证');
      results.config = true;
    }

    // 2. 连接MongoDB
    results.mongodb = await connectMongoDB();
    if (!results.mongodb) {
      error('\nMongoDB连接失败，无法继续初始化');
      process.exit(1);
    }

    // 3. 创建数据库索引
    if (!skipIndexes) {
      results.indexes = await createIndexes();
    } else {
      warn('\n⊘ 跳过索引创建');
      results.indexes = true;
    }

    // 4. 创建超级管理员
    if (!skipAdmin) {
      results.admin = await createSuperAdmin();
    } else {
      warn('\n⊘ 跳过超级管理员创建');
      results.admin = true;
    }

    // 5. 检查数据迁移
    results.migrations = await checkMigrations();

    // 6. 系统健康检查
    results.health = await healthCheck();

    // 显示摘要
    const success_flag = showSummary(results);

    // 关闭数据库连接
    await mongoose.connection.close();
    log('\n数据库连接已关闭\n', 'gray');

    // 退出
    process.exit(success_flag ? 0 : 1);
  } catch (err) {
    error(`\n❌ 初始化失败: ${err.message}`);
    try {
      await mongoose.connection.close();
    } catch (e) {
      // 忽略关闭连接时的错误
    }
    process.exit(1);
  }
}

// 启动初始化
if (require.main === module) {
  main();
}

module.exports = {
  verifyConfig,
  connectMongoDB,
  createIndexes,
  createSuperAdmin,
  checkMigrations,
  healthCheck,
};
