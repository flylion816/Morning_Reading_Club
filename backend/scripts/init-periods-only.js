#!/usr/bin/env node
/**
 * 仅初始化期次和课程内容，不影响用户/打卡/报名等数据
 * 幂等：期次按 name+tenantId 查找，不存在才创建；课程按 periodId+day upsert
 *
 * 用法：node backend/scripts/init-periods-only.js
 */

const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');

// 加载环境配置
try {
  const envConfig = require(path.resolve(__dirname, '../../.env.config.js'));
  process.env.MONGODB_URI = process.env.MONGODB_URI || envConfig.config.backend.mongodbUri;
} catch (e) {
  // fallback
}
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const mongoUrl = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/morning_reading_db';

const Period = require('../src/models/Period');
const Section = require('../src/models/Section');
const { runWithSystemContext } = require('../src/utils/tenantContext');

const TENANT_ID = process.env.FANREN_TENANT_ID || '6a093a4acd3626e58585c1ca';

const PERIODS = [
  {
    name: '平衡之道',
    subtitle: '七个习惯晨读营',
    title: '平衡之道 - 七个习惯晨读营',
    description: '21天养成阅读习惯，培养品德成功论思维',
    icon: '⛰️',
    coverColor: 'linear-gradient(135deg, #4a90e2 0%, #357abd 100%)',
    coverEmoji: '⛰️',
    startDate: new Date('2025-11-28'),
    endDate: new Date('2025-12-20'),
    totalDays: 23,
    price: 99,
    originalPrice: 199,
    maxEnrollment: 100,
    currentEnrollment: 0,
    status: 'completed',
    isPublished: true,
    sortOrder: 1
  },
  {
    name: '勇敢的心',
    subtitle: '七个习惯晨读营',
    title: '勇敢的心 - 七个习惯晨读营',
    description: '21天养成阅读习惯，培养品德成功论思维',
    icon: '💪',
    coverColor: 'linear-gradient(135deg, #ff6b6b 0%, #e63946 100%)',
    coverEmoji: '💪',
    startDate: new Date('2025-10-11'),
    endDate: new Date('2025-11-13'),
    totalDays: 23,
    price: 99,
    originalPrice: 199,
    maxEnrollment: 100,
    currentEnrollment: 0,
    status: 'completed',
    isPublished: true,
    sortOrder: 2
  },
  {
    name: '能量之泉',
    subtitle: '七个习惯晨读营',
    title: '能量之泉 - 七个习惯晨读营',
    description: '探索内在能量，提升自我效能',
    icon: '🌊',
    coverColor: 'linear-gradient(135deg, #7ed321 0%, #63b520 100%)',
    coverEmoji: '🌊',
    startDate: new Date('2025-08-09'),
    endDate: new Date('2025-09-12'),
    totalDays: 23,
    price: 99,
    originalPrice: 199,
    maxEnrollment: 100,
    currentEnrollment: 0,
    status: 'completed',
    isPublished: true,
    sortOrder: 3
  },
  {
    name: '静心之镜',
    subtitle: '七个习惯晨读营',
    title: '静心之镜 - 七个习惯晨读营',
    description: '深层心灵成长之旅',
    icon: '🪞',
    coverColor: 'linear-gradient(135deg, #a78bfa 0%, #8b5cf6 100%)',
    coverEmoji: '🪞',
    startDate: new Date('2025-06-01'),
    endDate: new Date('2025-07-04'),
    totalDays: 23,
    price: 99,
    originalPrice: 199,
    maxEnrollment: 100,
    currentEnrollment: 0,
    status: 'completed',
    isPublished: true,
    sortOrder: 4
  }
];

async function main() {
  console.log('========================================');
  console.log('   初始化期次和课程内容');
  console.log('========================================\n');

  await mongoose.connect(mongoUrl);
  console.log('✅ 数据库连接成功');
  console.log(`🏷️  租户 ID：${TENANT_ID}\n`);

  await runWithSystemContext(async () => {
    // 创建期次（幂等：按 name+tenantId 查找）
    const createdPeriods = [];
    for (const periodData of PERIODS) {
      let period = await Period.findOne({ name: periodData.name, tenantId: TENANT_ID });
      if (period) {
        console.log(`⏭️  期次 "${periodData.name}" 已存在，跳过`);
      } else {
        period = await Period.create({ ...periodData, tenantId: TENANT_ID });
        console.log(`✅ 创建期次 "${period.name}" (${period._id})`);
      }
      createdPeriods.push(period);
    }

    // 为"平衡之道"导入 day0-22 课程内容
    const mainPeriod = createdPeriods.find(p => p.name === '平衡之道');
    if (!mainPeriod) {
      console.error('❌ 找不到"平衡之道"期次');
      return;
    }

    console.log(`\n📖 为期次 "${mainPeriod.name}" 导入课程内容...\n`);
    let successCount = 0;
    let skipCount = 0;

    for (let day = 0; day <= 22; day++) {
      const filepath = path.join(__dirname, `day${day}-content.json`);
      if (!fs.existsSync(filepath)) {
        console.log(`⚠️  day${day}-content.json 不存在，跳过`);
        continue;
      }

      const content = JSON.parse(fs.readFileSync(filepath, 'utf8'));
      const result = await Section.findOneAndUpdate(
        { periodId: mainPeriod._id, day },
        {
          $set: {
            periodId: mainPeriod._id,
            tenantId: TENANT_ID,
            day,
            title: content.title || `第 ${day} 天`,
            subtitle: content.subtitle || `Day ${day}`,
            icon: content.icon || '📖',
            description: content.description || '',
            content: content.content || '',
            audioUrl: content.audioUrl || null,
            isPublished: true,
            sortOrder: day
          }
        },
        { upsert: true, new: true }
      );
      console.log(`  ✅ Day ${day}: ${result.title}`);
      successCount++;
    }

    // 为其他期次创建占位课程（day 0-22，内容待导入）
    for (const period of createdPeriods) {
      if (period.name === '平衡之道') continue;
      const existing = await Section.countDocuments({ periodId: period._id });
      if (existing > 0) {
        console.log(`\n⏭️  期次 "${period.name}" 已有 ${existing} 个课程，跳过`);
        continue;
      }
      console.log(`\n📖 为期次 "${period.name}" 创建占位课程...`);
      const sections = [];
      for (let day = 0; day <= 22; day++) {
        sections.push({
          periodId: period._id,
          tenantId: TENANT_ID,
          day,
          title: `第 ${day} 天`,
          subtitle: `Day ${day}`,
          icon: '📖',
          description: '',
          content: '<p>课程内容待导入</p>',
          isPublished: true,
          sortOrder: day
        });
      }
      await Section.insertMany(sections);
      console.log(`  ✅ 创建 23 个占位课程`);
    }

    console.log('\n========================================');
    console.log(`✨ 完成：导入 ${successCount} 个课程内容`);
    console.log('========================================');
  });

  await mongoose.disconnect();
}

main().catch(e => {
  console.error('❌ 错误：', e.message);
  process.exit(1);
});
