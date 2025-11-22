const mongoose = require('mongoose');
const Section = require('../src/models/Section');
const Period = require('../src/models/Period');

const mongoUrl = process.env.MONGODB_URL || 'mongodb://localhost:27017/morning-reading-club';

async function fixDay2Content() {
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

    // 查找所有Day 2的"思维方式的力量"记录
    const day2Courses = await Section.find({
      periodId: period._id,
      day: 2,
      title: '思维方式的力量'
    }).sort({ createdAt: 1 });

    console.log(`找到 ${day2Courses.length} 个Day 2课程\n`);

    if (day2Courses.length > 1) {
      console.log('⚠️ 检测到重复的Day 2课程，删除重复的...\n');
      // 保留最后一条，删除其他的
      for (let i = 0; i < day2Courses.length - 1; i++) {
        await Section.deleteOne({ _id: day2Courses[i]._id });
        console.log(`✓ 已删除: ID ${day2Courses[i]._id}`);
      }
    }

    // 获取保留下来的那一条
    const course = await Section.findOne({
      periodId: period._id,
      day: 2,
      title: '思维方式的力量'
    });

    if (!course) {
      console.error('❌ 无法找到Day 2课程');
      process.exit(1);
    }

    console.log('\n检查Day 2课程HTML格式...\n');

    // 检查现有的空行数和点数
    const pointMatches = course.content.match(/<strong>\d+\./g);
    const pointCount = pointMatches ? pointMatches.length : 0;
    const emptyLines = (course.content.match(/<p><\/p>/g) || []).length;

    console.log(`当前点数: ${pointCount} 个`);
    console.log(`当前空行数: ${emptyLines} 个`);
    console.log(`期望空行数: ${pointCount + 1} 个\n`);

    if (emptyLines === pointCount + 1) {
      console.log('✅ 空行格式已正确，无需修改\n');
    } else {
      console.log('⚠️ 空行格式不正确，需要修复...\n');

      // 解析内容，找出所有的点
      const contentParts = course.content.split('<strong>');
      let fixedContent = contentParts[0]; // 保留第一部分（标题）

      for (let i = 1; i < contentParts.length; i++) {
        const part = contentParts[i];

        // 找到点号的结尾
        const pointEndIdx = part.indexOf('</strong>');
        if (pointEndIdx === -1) continue;

        const pointNumber = part.substring(0, pointEndIdx);
        const pointContent = part.substring(pointEndIdx + 9); // 跳过</strong>

        // 清理点内容中多余的</p>和<p></p>
        let cleanedContent = pointContent;

        // 移除开头的多余空白和段落标签
        cleanedContent = cleanedContent.replace(/^\s*<\/p>\s*/, '</p>');

        // 添加点号和内容
        fixedContent += `<strong>${pointNumber}</strong>${cleanedContent}`;

        // 在每个点后面确保有<p></p>分隔符（如果后面还有内容）
        if (i < contentParts.length - 1) {
          // 检查是否已经有<p></p>
          if (!fixedContent.endsWith('<p></p>\n')) {
            if (fixedContent.endsWith('</p>')) {
              fixedContent += '\n<p></p>\n';
            }
          }
        }
      }

      // 更新数据库
      course.content = fixedContent;
      await course.save();

      const newEmptyLines = (fixedContent.match(/<p><\/p>/g) || []).length;
      console.log(`✅ 已修复HTML格式`);
      console.log(`   新的空行数: ${newEmptyLines} 个\n`);
    }

    // 最终验证
    const finalCourse = await Section.findById(course._id);
    const finalPointCount = (finalCourse.content.match(/<strong>\d+\./g) || []).length;
    const finalEmptyLines = (finalCourse.content.match(/<p><\/p>/g) || []).length;

    console.log('最终验证:');
    console.log(`  点数: ${finalPointCount} 个`);
    console.log(`  空行: ${finalEmptyLines} 个`);
    console.log(`  状态: ${finalEmptyLines === finalPointCount + 1 ? '✅ 正确' : '⚠️ 需要手动调整'}\n`);

    await mongoose.connection.close();
    console.log('✅ 数据库连接已关闭');
    console.log('🎉 修复完成！');
    process.exit(0);

  } catch (error) {
    console.error('❌ 错误:', error.message);
    if (error.stack) {
      console.error('\n错误详情:');
      console.error(error.stack);
    }
    await mongoose.connection.close();
    process.exit(1);
  }
}

fixDay2Content();
