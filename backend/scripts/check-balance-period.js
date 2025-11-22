const mongoose = require('mongoose');
const Period = require('/Users/pica_1/我的坚果云/flylion/AI项目开发/七个习惯晨读营/backend/src/models/Period');
const Section = require('/Users/pica_1/我的坚果云/flylion/AI项目开发/七个习惯晨读营/backend/src/models/Section');

const mongoUrl = process.env.MONGODB_URL || 'mongodb://localhost:27017/morning-reading-club';

async function checkBalancePeriod() {
  try {
    console.log('正在连接数据库...');
    await mongoose.connect(mongoUrl, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    console.log('✅ 数据库连接成功\n');

    const period = await Period.findOne({ name: '平衡之道' });
    if (!period) {
      console.log('❌ 找不到"平衡之道"期次');
      process.exit(1);
    }

    console.log('✅ 找到期次:');
    console.log(`   名称: ${period.name}`);
    console.log(`   标题: ${period.title}`);
    console.log(`   ID: ${period._id}\n`);

    const sections = await Section.find({ periodId: period._id }).sort({ day: 1 });
    console.log(`找到 ${sections.length} 个课程:\n`);

    sections.forEach((section, idx) => {
      console.log(`${idx + 1}. 第 ${section.day} 天 - ${section.title}`);
      console.log(`   已发布: ${section.isPublished}`);
      console.log(`   内容字段状态:`);
      console.log(`     - meditation: ${section.meditation ? '✅ 有内容' : '❌ 空'}`);
      console.log(`     - question: ${section.question ? '✅ 有内容' : '❌ 空'}`);
      console.log(`     - content: ${section.content ? '✅ 有内容 (' + section.content.length + '字)' : '❌ 空'}`);
      console.log(`     - reflection: ${section.reflection ? '✅ 有内容' : '❌ 空'}`);
      console.log(`     - action: ${section.action ? '✅ 有内容' : '❌ 空'}`);
      console.log(`     - learn: ${section.learn ? '✅ 有内容' : '❌ 空'}`);
      console.log(`     - extract: ${section.extract ? '✅ 有内容' : '❌ 空'}`);
      console.log(`     - say: ${section.say ? '✅ 有内容' : '❌ 空'}\n`);
    });

    await mongoose.connection.close();
    console.log('✅ 数据库连接已关闭');

  } catch (error) {
    console.error('❌ 错误:', error.message);
    process.exit(1);
  }
}

checkBalancePeriod();
