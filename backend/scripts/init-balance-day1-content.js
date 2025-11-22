const mongoose = require('mongoose');
const Section = require('../src/models/Section');
const Period = require('../src/models/Period');

const mongoUrl = process.env.MONGODB_URL || 'mongodb://localhost:27017/morning-reading-club';

// 第一天课程内容
const day1Content = {
  day: 0,
  title: '品德成功论',
  subtitle: '',
  icon: '⚖️',
  meditation: '开始学习之前，给自己1分钟的时间，深呼吸，静静心，然后开始学习。',
  question: '带着问题学习\n什么是品德成功论?',
  content: '每天晨读内容\n\n品德成功论 由内而外全面造就自己\n\n1. 品德成功论提醒人们，高效能的生活是有基本原则的。只有当人们学会并遵循这些原则，把它们融入到自己的品格中去，才能享受真正的成功与恒久的幸福。\n\n2. 没有正确的生活，就没有真正卓越的人生。\n——戴维·斯塔·乔丹(David Starr Jordan)\n|美国生物学家及教育家\n\n3. 在25年的工作经历中，我与商界、大学和婚姻家庭各个领域的人共事。和其中一些外表看来很成功的人深入接触后，我却发现他们常在与内心的渴望斗争，他们确实需要协调和高效，以及健康向上的人际关系。',
  reflection: '',
  action: '',
  learn: '',
  extract: '',
  say: '',
  duration: 23,
  isPublished: true,
  sortOrder: 0
};

async function initBalanceDay1() {
  try {
    console.log('正在连接数据库...');
    await mongoose.connect(mongoUrl, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    console.log('✅ 数据库连接成功\n');

    // 找到"平衡之道"期次
    const period = await Period.findOne({ name: '平衡之道' });
    if (!period) {
      console.error('❌ 找不到"平衡之道"期次');
      process.exit(1);
    }
    console.log(`✅ 找到期次: ${period.name}\n`);

    // 检查是否已存在day 0的课程
    const existingSection = await Section.findOne({
      periodId: period._id,
      day: 0
    });

    if (existingSection) {
      console.log(`ℹ️ day 0课程已存在，正在删除旧记录...`);
      await Section.deleteOne({ _id: existingSection._id });
      console.log(`✅ 旧记录已删除\n`);
    }

    // 创建新的课程
    console.log('📝 正在创建课程...');
    const newSection = await Section.create({
      periodId: period._id,
      day: day1Content.day,
      title: day1Content.title,
      subtitle: day1Content.subtitle,
      icon: day1Content.icon,
      meditation: day1Content.meditation,
      question: day1Content.question,
      content: day1Content.content,
      reflection: day1Content.reflection,
      action: day1Content.action,
      learn: day1Content.learn,
      extract: day1Content.extract,
      say: day1Content.say,
      duration: day1Content.duration,
      isPublished: day1Content.isPublished,
      sortOrder: day1Content.sortOrder
    });

    console.log('\n✅ 课程创建成功!');
    console.log(`   ID: ${newSection._id}`);
    console.log(`   标题: ${newSection.title}`);
    console.log(`   期次: ${period.name}`);
    console.log(`   已发布: ${newSection.isPublished}`);
    console.log(`\n   内容字段状态:`);
    console.log(`     ✓ meditation: ${newSection.meditation.length} 字`);
    console.log(`     ✓ question: ${newSection.question.length} 字`);
    console.log(`     ✓ content: ${newSection.content.length} 字`);
    console.log(`     ○ reflection: ${newSection.reflection ? newSection.reflection.length + ' 字' : '空'}`);
    console.log(`     ○ action: ${newSection.action ? newSection.action.length + ' 字' : '空'}`);
    console.log(`     ○ learn: ${newSection.learn ? newSection.learn.length + ' 字' : '空'}`);
    console.log(`     ○ extract: ${newSection.extract ? newSection.extract.length + ' 字' : '空'}`);
    console.log(`     ○ say: ${newSection.say ? newSection.say.length + ' 字' : '空'}`);

    await mongoose.connection.close();
    console.log('\n✅ 数据库连接已关闭');
    process.exit(0);

  } catch (error) {
    console.error('❌ 错误:', error.message);
    if (error.stack) {
      console.error(error.stack);
    }
    await mongoose.connection.close();
    process.exit(1);
  }
}

initBalanceDay1();
