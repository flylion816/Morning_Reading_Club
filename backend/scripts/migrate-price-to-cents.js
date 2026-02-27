/**
 * 迁移脚本：将期次价格从元转换为分
 * 用法: node backend/scripts/migrate-price-to-cents.js
 */

const mongoose = require('mongoose');
const path = require('path');

// 获取MongoDB连接URI
const { config } = require(path.join(__dirname, '../../.env.config.js'));
const mongodbUri = config.backend.mongodbUri;

// 连接MongoDB
async function connectDB() {
  try {
    await mongoose.connect(mongodbUri, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    console.log('✅ MongoDB connected successfully');
  } catch (error) {
    console.error('❌ MongoDB connection error:', error.message);
    process.exit(1);
  }
}

// 执行迁移
async function migratePrice() {
  try {
    const Period = require('../src/models/Period');

    // 获取所有期次
    const periods = await Period.find();
    console.log(`📊 找到 ${periods.length} 个期次`);

    if (periods.length === 0) {
      console.log('⚠️  没有找到任何期次记录');
      return;
    }

    // 显示迁移前的数据
    console.log('\n📋 迁移前的价格：');
    periods.forEach(period => {
      console.log(`  ${period.name}: price=${period.price}, originalPrice=${period.originalPrice}`);
    });

    // 批量更新
    let updatedCount = 0;
    for (const period of periods) {
      if (period.price > 0 || period.originalPrice > 0) {
        const newPrice = Math.round(period.price * 100);
        const newOriginalPrice = Math.round(period.originalPrice * 100);

        await Period.updateOne(
          { _id: period._id },
          {
            price: newPrice,
            originalPrice: newOriginalPrice
          }
        );
        updatedCount++;
        console.log(`✅ 已更新 ${period.name}: price=${newPrice} 分, originalPrice=${newOriginalPrice} 分`);
      }
    }

    console.log(`\n✨ 迁移完成！共更新 ${updatedCount} 个期次`);

    // 显示迁移后的数据
    console.log('\n📋 迁移后的价格：');
    const updatedPeriods = await Period.find();
    updatedPeriods.forEach(period => {
      console.log(`  ${period.name}: price=${period.price}, originalPrice=${period.originalPrice}`);
    });
  } catch (error) {
    console.error('❌ 迁移失败:', error);
    process.exit(1);
  } finally {
    await mongoose.connection.close();
  }
}

// 执行
async function main() {
  await connectDB();
  await migratePrice();
}

main();
