/**
 * 更新 Checkin 数据
 * 为现有打卡记录添加 likeCount 和 isFeatured 字段
 */

const mongoose = require('mongoose');
require('dotenv').config();

const Checkin = require('../src/models/Checkin');

async function updateCheckins() {
  try {
    // 连接数据库
    await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });

    console.log('✅ 数据库连接成功');

    // 获取所有打卡记录
    const checkins = await Checkin.find();
    console.log(`找到 ${checkins.length} 条打卡记录`);

    if (checkins.length === 0) {
      console.log('⚠️  没有找到打卡记录');
      process.exit(0);
    }

    // 批量更新：添加 likeCount 和 isFeatured
    let updatedCount = 0;
    const bulkOps = [];

    checkins.forEach((checkin, index) => {
      // 随机设置获赞数（0-10）
      const likeCount = Math.floor(Math.random() * 11);

      // 30% 的概率被精选
      const isFeatured = Math.random() < 0.3;

      bulkOps.push({
        updateOne: {
          filter: { _id: checkin._id },
          update: {
            $set: {
              likeCount,
              isFeatured
            }
          }
        }
      });
    });

    // 执行批量更新
    if (bulkOps.length > 0) {
      const result = await Checkin.bulkWrite(bulkOps);
      updatedCount = result.modifiedCount;
      console.log(`✅ 成功更新 ${updatedCount} 条打卡记录`);
    }

    // 统计信息
    const stats = await Checkin.aggregate([
      {
        $group: {
          _id: null,
          totalCheckins: { $sum: 1 },
          totalLikes: { $sum: '$likeCount' },
          featuredCount: {
            $sum: { $cond: ['$isFeatured', 1, 0] }
          },
          avgLikes: { $avg: '$likeCount' }
        }
      }
    ]);

    if (stats.length > 0) {
      const stat = stats[0];
      console.log('\n📊 打卡数据统计:');
      console.log(`  总打卡数: ${stat.totalCheckins}`);
      console.log(`  总获赞数: ${stat.totalLikes}`);
      console.log(`  精选数: ${stat.featuredCount}`);
      console.log(`  平均获赞: ${stat.avgLikes.toFixed(2)}`);
    }

    console.log('\n✅ Checkin 更新完成');
    process.exit(0);
  } catch (error) {
    console.error('❌ 更新失败:', error.message);
    process.exit(1);
  }
}

// 执行
updateCheckins();
