const mongoose = require('mongoose');
const Section = require('../src/models/Section');
const Period = require('../src/models/Period');

const mongoUrl = process.env.MONGODB_URL || 'mongodb://localhost:27017/morning-reading-club';

async function cleanupDuplicates() {
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

    // 查找 Day 1 的所有课程
    const day1Courses = await Section.find({
      periodId: period._id,
      day: 1
    }).sort({ createdAt: 1 });

    console.log(`找到 ${day1Courses.length} 个 Day 1 课程:\n`);
    day1Courses.forEach((course, idx) => {
      console.log(`${idx + 1}. ID: ${course._id}`);
      console.log(`   标题: ${course.title}`);
      console.log(`   创建时间: ${course.createdAt}`);
      console.log(`   内容长度: ${course.content.length} 字\n`);
    });

    if (day1Courses.length > 1) {
      console.log('⚠️ 检测到重复的 Day 1 课程\n');
      console.log('保留策略: 保留最新的2条记录(品德成功论 + 思维方式的力量)');
      console.log('删除策略: 删除中间的重复品德成功论记录\n');

      // 找出重复的品德成功论记录（保留最后一条）
      const deleteCourses = day1Courses
        .filter(course => course.title === '品德成功论')
        .slice(0, -1);  // 除了最后一条，其他都删除

      if (deleteCourses.length > 0) {
        console.log(`正在删除 ${deleteCourses.length} 条重复记录...\n`);
        for (const course of deleteCourses) {
          await Section.deleteOne({ _id: course._id });
          console.log(`✓ 已删除: ${course.title} (ID: ${course._id})`);
        }
      }

      console.log('\n清理完成后的 Day 1 课程:');
      const remainingCourses = await Section.find({
        periodId: period._id,
        day: 1
      }).sort({ createdAt: 1 });

      remainingCourses.forEach((course, idx) => {
        console.log(`${idx + 1}. ${course.title} (${course.content.length} 字)`);
      });
    } else {
      console.log('✅ 没有重复记录，数据清洁\n');
    }

    await mongoose.connection.close();
    console.log('\n✅ 数据库连接已关闭');
    console.log('🎉 清理完成！');
    process.exit(0);

  } catch (error) {
    console.error('❌ 错误:', error.message);
    await mongoose.connection.close();
    process.exit(1);
  }
}

cleanupDuplicates();
