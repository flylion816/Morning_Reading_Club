#!/usr/bin/env node

const mongoose = require('mongoose');
const Section = require('../src/models/Section');
const Period = require('../src/models/Period');

const mongoUrl = 'mongodb://admin:admin123@localhost:27017/morning_reading?authSource=admin';

async function deleteContent() {
  try {
    console.log('========================================');
    console.log('   删除平衡之道课程内容');
    console.log('========================================\n');

    console.log('正在连接数据库...');
    await mongoose.connect(mongoUrl, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    console.log('✅ 数据库连接成功\n');

    // 查找期次
    console.log('🔍 查找期次: "平衡之道"');
    const period = await Period.findOne({ name: '平衡之道' });
    if (!period) {
      console.error('❌ 找不到期次');
      await mongoose.disconnect();
      process.exit(1);
    }
    console.log(`✅ 找到期次: ${period.name} (ID: ${period._id})\n`);

    // 删除现有内容
    console.log('🗑️  删除现有的平衡之道课程内容...');
    const deleteResult = await Section.deleteMany({ periodId: period._id });
    console.log(`✅ 已删除 ${deleteResult.deletedCount} 条记录\n`);

    console.log('========================================');
    console.log('✅ 删除完成！');
    console.log('========================================\n');

    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    console.error('❌ 操作失败:', error.message);
    await mongoose.disconnect();
    process.exit(1);
  }
}

deleteContent();
