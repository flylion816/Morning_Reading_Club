#!/usr/bin/env node

const mongoose = require('mongoose');
const Section = require('../src/models/Section');
const Period = require('../src/models/Period');

const mongoUrl = process.env.MONGODB_URI || process.env.MONGODB_URL || 'mongodb://admin:admin123@localhost:27017/morning_reading?authSource=admin';

async function cleanupDatabase() {
  try {
    console.log('\n========================================');
    console.log('   清理数据库中的重复和错误记录');
    console.log('========================================\n');

    await mongoose.connect(mongoUrl, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    console.log('✅ 数据库连接成功\n');

    const period = await Period.findOne({ name: '平衡之道' });
    if (!period) {
      console.error('❌ 找不到期次');
      process.exit(1);
    }

    // 清除 Day 1-3 的重复
    console.log('Step 1: 清除 Day 1-3 的重复记录\n');
    for (let day = 1; day <= 3; day++) {
      const count = await Section.countDocuments({
        periodId: period._id,
        day: day
      });

      if (count > 1) {
        console.log(`  Day ${day}: 找到 ${count} 条记录，删除多余 ${count - 1} 条`);
        const records = await Section.find({
          periodId: period._id,
          day: day
        }).sort({ updatedAt: -1 }).sort({ _id: -1 });  // 保留最新的

        // 保留第一条（最新的），删除其他
        for (let i = 1; i < records.length; i++) {
          await Section.deleteOne({ _id: records[i]._id });
        }
      } else {
        console.log(`  Day ${day}: ${count === 0 ? '无记录' : '1条记录（正常）'}`);
      }
    }

    // 注意：Day 4-21 已正确导入，无需删除
    console.log('\nStep 2: 检查 Day 4-21 的状态\n');
    for (let day = 4; day <= 21; day++) {
      const count = await Section.countDocuments({
        periodId: period._id,
        day: day
      });
      console.log(`  Day ${day}: ${count === 1 ? '✅' : '⚠️'} ${count} 条记录`);
    }

    await mongoose.connection.close();
    console.log('\n✅ 数据库清理完成！\n');
    process.exit(0);

  } catch (error) {
    console.error('❌ 错误:', error.message);
    await mongoose.connection.close();
    process.exit(1);
  }
}

cleanupDatabase();
