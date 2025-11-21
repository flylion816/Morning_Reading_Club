/**
 * 更新打卡记录的日期到最近的时间范围内
 * 这样可以测试 ranking API 的时间范围过滤功能
 */

const mongoose = require('mongoose');
require('dotenv').config();

const Checkin = require('../src/models/Checkin');

async function updateCheckinDates() {
  try {
    // 连接数据库
    await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });

    console.log('✅ 数据库连接成功');

    // 获取所有打卡记录
    const checkins = await Checkin.find().sort({ createdAt: -1 });
    console.log(`找到 ${checkins.length} 条打卡记录\n`);

    if (checkins.length === 0) {
      console.log('⚠️  没有找到打卡记录');
      process.exit(0);
    }

    const now = new Date();
    const bulkOps = [];

    // 将打卡记录的日期分布到最近 21 天内
    checkins.forEach((checkin, index) => {
      // 计算相对于现在的天数差（从 0 到 20）
      const daysAgo = Math.floor((index / checkins.length) * 21);

      // 创建新的日期
      const newDate = new Date(now);
      newDate.setDate(newDate.getDate() - daysAgo);
      newDate.setHours(Math.floor(Math.random() * 24), Math.floor(Math.random() * 60), 0, 0);

      bulkOps.push({
        updateOne: {
          filter: { _id: checkin._id },
          update: {
            $set: {
              checkinDate: newDate,
              createdAt: newDate
            }
          }
        }
      });
    });

    // 执行批量更新
    if (bulkOps.length > 0) {
      const result = await Checkin.bulkWrite(bulkOps);
      console.log(`✅ 成功更新 ${result.modifiedCount} 条打卡记录的日期\n`);

      // 显示更新后的日期范围
      const stats = await Checkin.aggregate([
        {
          $group: {
            _id: null,
            minDate: { $min: '$checkinDate' },
            maxDate: { $max: '$checkinDate' },
            count: { $sum: 1 }
          }
        }
      ]);

      if (stats.length > 0) {
        const stat = stats[0];
        console.log('📊 打卡日期统计:');
        console.log(`  总打卡数: ${stat.count}`);
        console.log(`  最早日期: ${new Date(stat.minDate).toISOString()}`);
        console.log(`  最新日期: ${new Date(stat.maxDate).toISOString()}`);
      }
    }

    console.log('\n✅ 打卡日期更新完成');
    process.exit(0);
  } catch (error) {
    console.error('❌ 更新失败:', error.message);
    process.exit(1);
  }
}

// 执行
updateCheckinDates();
