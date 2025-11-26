const mongoose = require('mongoose');

const mongoUrl = 'mongodb://admin:admin123@localhost:27017/morning_reading?authSource=admin';
const Section = require('/Users/pica_1/我的坚果云/flylion/AI项目开发/七个习惯晨读营/backend/src/models/Section');
const Period = require('/Users/pica_1/我的坚果云/flylion/AI项目开发/七个习惯晨读营/backend/src/models/Period');

async function deleteDay123() {
  try {
    console.log('连接数据库...');
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

    console.log(`期次: ${period.name} (ID: ${period._id})`);
    console.log('========================================\n');

    // 要删除的课程（Day 1-3）
    const daysToDelete = [1, 2, 3];

    console.log('删除旧的课程...');
    for (const day of daysToDelete) {
      const result = await Section.deleteMany({
        periodId: period._id,
        day: day
      });
      console.log(`✅ Day ${day}: 删除 ${result.deletedCount} 条记录`);
    }

    console.log('\n========================================\n');
    console.log('✅ Day 1-3 已删除！');

    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    console.error('❌ 错误:', error.message);
    await mongoose.disconnect();
    process.exit(1);
  }
}

deleteDay123();
