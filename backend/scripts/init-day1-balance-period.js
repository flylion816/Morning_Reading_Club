const mongoose = require('mongoose');
const Section = require('../src/models/Section');
const Period = require('../src/models/Period');

// 数据库连接
const mongoUrl = process.env.MONGODB_URL || 'mongodb://localhost:27017/morning-reading-club';

// 平衡之道第一课的内容数据
// 这些内容需要从9张图片中提取
const day1CourseData = {
  periodName: '平衡之道',  // 需要找到对应的period
  day: 0,  // 第一课（从0开始）
  title: '品德成功论',  // 需要从图片中确认标题
  subtitle: '',
  icon: '⚖️',
  meditation: '', // 需要从图片提取
  question: '', // 需要从图片提取
  content: '', // 需要从图片提取
  reflection: '', // 需要从图片提取
  action: '', // 需要从图片提取
  learn: '', // 需要从图片提取
  extract: '', // 需要从图片提取
  say: '', // 需要从图片提取
  duration: 23,
  isPublished: true,
  sortOrder: 0
};

async function initializeDay1() {
  try {
    console.log('正在连接数据库...');
    await mongoose.connect(mongoUrl, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    console.log('✅ 数据库连接成功');

    // 找到"平衡之道"期次
    const period = await Period.findOne({ name: '平衡之道' });
    if (!period) {
      console.error('❌ 找不到"平衡之道"期次');
      process.exit(1);
    }
    console.log(`✅ 找到期次: ${period.name}`);

    // 检查是否已存在day 0的课程
    const existingSection = await Section.findOne({
      periodId: period._id,
      day: 0
    });
    if (existingSection) {
      console.log(`ℹ️ day 0已存在，删除旧记录...`);
      await Section.deleteOne({ _id: existingSection._id });
    }

    // 创建新的Section
    const newSection = await Section.create({
      periodId: period._id,
      day: day1CourseData.day,
      title: day1CourseData.title,
      subtitle: day1CourseData.subtitle,
      icon: day1CourseData.icon,
      meditation: day1CourseData.meditation,
      question: day1CourseData.question,
      content: day1CourseData.content,
      reflection: day1CourseData.reflection,
      action: day1CourseData.action,
      learn: day1CourseData.learn,
      extract: day1CourseData.extract,
      say: day1CourseData.say,
      duration: day1CourseData.duration,
      isPublished: day1CourseData.isPublished,
      sortOrder: day1CourseData.sortOrder
    });

    console.log(`✅ 课程创建成功!`);
    console.log(`   ID: ${newSection._id}`);
    console.log(`   标题: ${newSection.title}`);
    console.log(`   期次: ${period.name}`);

    await mongoose.connection.close();
    console.log('✅ 数据库连接已关闭');
    process.exit(0);

  } catch (error) {
    console.error('❌ 错误:', error.message);
    await mongoose.connection.close();
    process.exit(1);
  }
}

initializeDay1();
