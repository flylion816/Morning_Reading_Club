const mongoose = require('mongoose');
const Section = require('../src/models/Section');
const Period = require('../src/models/Period');

const mongoUrl = process.env.MONGODB_URL || 'mongodb://localhost:27017/morning-reading-club';

async function deleteWrongDay2() {
  try {
    console.log('正在连接数据库...');
    await mongoose.connect(mongoUrl, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    console.log('✅ 数据库连接成功\n');

    const period = await Period.findOne({ name: '平衡之道' });
    if (!period) {
      console.error('❌ 找不到期次: "平衡之道"');
      process.exit(1);
    }

    // 查找 Day 1 的"思维方式的力量"记录
    const wrongRecord = await Section.findOne({
      periodId: period._id,
      day: 1,
      title: '思维方式的力量'
    });

    if (wrongRecord) {
      console.log('找到错误的记录:');
      console.log(`  标题: ${wrongRecord.title}`);
      console.log(`  Day: ${wrongRecord.day}`);
      console.log(`  ID: ${wrongRecord._id}`);
      console.log(`  创建时间: ${wrongRecord.createdAt}\n`);

      await Section.deleteOne({ _id: wrongRecord._id });
      console.log('✅ 已删除错误的Day 1记录\n');
    } else {
      console.log('✅ 未找到错误的记录,数据已正确\n');
    }

    await mongoose.connection.close();
    console.log('✅ 数据库连接已关闭');
    process.exit(0);

  } catch (error) {
    console.error('❌ 错误:', error.message);
    await mongoose.connection.close();
    process.exit(1);
  }
}

deleteWrongDay2();
