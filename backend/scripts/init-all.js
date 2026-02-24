#!/usr/bin/env node

/**
 * 统一初始化脚本（开发环境）
 * 按顺序执行以下初始化任务：
 * 1. init-mongodb.js - 初始化 MongoDB 数据库和基本数据
 * 2. init-mysql.js - 创建 MySQL 备份表结构
 * 3. init-indexes.js - 创建数据库索引
 * 4. init-superadmin.js - 创建管理员账户
 * 5. init-23-days.js - 导入23天课程内容
 */

require('dotenv').config();
const { spawn } = require('child_process');
const path = require('path');

const scripts = [
  {
    name: 'MongoDB 初始化',
    script: 'init-mongodb.js',
    description: '创建基本的 MongoDB 数据库结构和测试数据'
  },
  {
    name: 'MySQL 表结构初始化',
    script: 'init-mysql.js',
    description: '创建 MySQL 备份表结构（用于 MongoDB ↔ MySQL 数据同步）'
  },
  {
    name: '数据库索引创建',
    script: 'init-indexes.js',
    description: '创建数据库索引以提升查询性能'
  },
  {
    name: '超级管理员初始化',
    script: 'init-superadmin.js',
    description: '创建超级管理员账户'
  },
  {
    name: '课程内容导入',
    script: 'init-23-days.js',
    description: '导入23天的课程详细内容'
  }
];

let currentIndex = 0;

function runScript(scriptName) {
  return new Promise((resolve, reject) => {
    const scriptPath = path.join(__dirname, scriptName);
    const child = spawn('node', [scriptPath], {
      stdio: 'inherit',
      cwd: __dirname,
      env: process.env
    });

    child.on('close', code => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`脚本 ${scriptName} 失败，exit code: ${code}`));
      }
    });

    child.on('error', error => {
      reject(error);
    });
  });
}

async function initAll() {
  console.log('\n' + '='.repeat(60));
  console.log('    📚 晨读营数据库完整初始化');
  console.log('='.repeat(60) + '\n');

  for (let i = 0; i < scripts.length; i++) {
    const script = scripts[i];
    const stepNumber = i + 1;
    const totalSteps = scripts.length;

    console.log(`\n${'─'.repeat(60)}`);
    console.log(`📍 步骤 ${stepNumber}/${totalSteps}: ${script.name}`);
    console.log(`${script.description}`);
    console.log(`${'─'.repeat(60)}\n`);

    try {
      await runScript(script.script);
      console.log(`\n✅ 步骤 ${stepNumber} 完成：${script.name}\n`);
    } catch (error) {
      console.error(`\n❌ 步骤 ${stepNumber} 失败：${script.name}`);
      console.error(`   原因：${error.message}\n`);

      const continueOnError = process.argv.includes('--continue-on-error');
      if (!continueOnError) {
        console.error('💡 提示：使用 --continue-on-error 参数可继续执行后续步骤\n');
        process.exit(1);
      } else {
        console.log('⚠️  继续执行下一步...\n');
      }
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log('    🎉 初始化完成！');
  console.log('='.repeat(60) + '\n');
  console.log('📊 已完成以下初始化：');
  scripts.forEach((script, index) => {
    console.log(`   ${index + 1}. ✅ ${script.name}`);
  });
  console.log('\n💡 后续步骤：');
  console.log('   1. 启动后端服务：npm run dev');
  console.log('   2. 访问 http://localhost:3000 测试 API');
  console.log('   3. 在微信开发者工具中测试小程序\n');

  process.exit(0);
}

// 运行初始化
initAll().catch(error => {
  console.error('❌ 初始化过程出错:', error.message);
  process.exit(1);
});
