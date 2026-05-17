#!/usr/bin/env node

/**
 * 批量导入 Day 0-22 课程内容到 MongoDB
 * 使用 upsert 模式，按 periodId + day 索引确保不重复
 */

const mongoose = require('mongoose');
const fs = require('fs');
const pathModule = require('path');

const envFile =
  process.env.NODE_ENV === 'production'
    ? pathModule.join(__dirname, '../.env.production')
    : pathModule.join(__dirname, '../.env');
require('dotenv').config({ path: envFile });

const mongoUrl = process.env.MONGODB_URI || 'mongodb://localhost:27017/morning_reading_db';
const Section = require('../src/models/Section');
const Period = require('../src/models/Period');

const SCRIPTS_DIR = __dirname;

async function importAllDays() {
  try {
    console.log('========================================');
    console.log('   批量导入 Day 0-22 课程内容');
    console.log('========================================\n');

    console.log('正在连接数据库...');
    await mongoose.connect(mongoUrl, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      authSource: 'admin',
      retryWrites: false
    });
    console.log('✅ 数据库连接成功\n');

    // 查找期次
    console.log('🔍 查找期次: "秩序之锚"');
    const period = await Period.findOne({ name: '秩序之锚' });
    if (!period) {
      console.error('❌ 找不到期次');
      process.exit(1);
    }
    console.log(`✅ 找到期次: ${period.name} (ID: ${period._id})\n`);

    console.log('========================================');
    console.log('   导入进度');
    console.log('========================================\n');

    let successCount = 0;
    let failCount = 0;

    // 导入 Day 0-22
    for (let day = 0; day <= 22; day++) {
      const filename = `day${day}-content.json`;
      const filepath = pathModule.join(SCRIPTS_DIR, filename);

      // 检查文件是否存在
      if (!fs.existsSync(filepath)) {
        console.log(`⚠️  Day ${day.toString().padStart(2)}: 文件不存在`);
        failCount++;
        continue;
      }

      try {
        // 加载 JSON
        const courseData = JSON.parse(fs.readFileSync(filepath, 'utf-8'));

        // 使用 upsert 确保不重复
        // 按 periodId + day 作为 upsert 条件
        const updated = await Section.findOneAndUpdate(
          {
            periodId: period._id,
            day: day
          },
          {
            periodId: period._id,
            day: day,
            ...courseData
          },
          {
            upsert: true,
            new: true,
            runValidators: false
          }
        );

        // 统计内容长度
        const contentLen = updated.content ? updated.content.length : 0;
        const paragraphs = updated.content
          ? (updated.content.match(/<strong>\\d+\\.<\/strong>/g) || []).length
          : 0;

        const titleStr = courseData.title.substring(0, 20).padEnd(20);
        console.log(
          `✅ Day ${day.toString().padStart(2)}: ${titleStr} ${String(contentLen).padStart(5)}字 ${String(paragraphs).padStart(2)}段`
        );
        successCount++;
      } catch (error) {
        console.log(`❌ Day ${day.toString().padStart(2)}: 导入失败 - ${error.message}`);
        failCount++;
      }
    }

    console.log('\n========================================');
    console.log(`✅ 成功: ${successCount}/21`);
    console.log(`❌ 失败: ${failCount}/21`);
    console.log('========================================\n');

    if (successCount === 23) {
      console.log('🎉 所有课程导入成功！');
    }

    await mongoose.disconnect();
    process.exit(successCount === 23 ? 0 : 1);
  } catch (error) {
    console.error('❌ 导入失败:', error.message);
    await mongoose.disconnect();
    process.exit(1);
  }
}

importAllDays();
