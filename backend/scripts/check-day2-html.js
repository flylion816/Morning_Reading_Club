const mongoose = require('mongoose');
const Section = require('../src/models/Section');
const Period = require('../src/models/Period');

const mongoUrl = process.env.MONGODB_URL || 'mongodb://localhost:27017/morning-reading-club';

async function checkDay2Html() {
  try {
    console.log('正在连接数据库...');
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

    const course = await Section.findOne({
      periodId: period._id,
      day: 2,
      title: '思维方式的力量'
    });

    if (!course) {
      console.error('❌ 找不到Day 2课程');
      process.exit(1);
    }

    console.log('📖 Day 2 课程HTML内容分析\n');
    console.log('═'.repeat(80));

    // 显示前500个字符
    console.log('\n前500个字符:\n');
    console.log(course.content.substring(0, 500));

    console.log('\n\n═'.repeat(80));
    console.log('\n分析空行分布:\n');

    // 找出所有的点
    const points = [];
    const pointRegex = /<strong>(\d+)\.<\/strong>/g;
    let match;

    while ((match = pointRegex.exec(course.content)) !== null) {
      const pointNum = match[1];
      const startIdx = match.index;

      // 找到这个点后面的内容，直到下一个点或结尾
      const nextPointIdx = course.content.indexOf('<strong>' + (parseInt(pointNum) + 1) + '.</strong>', startIdx);
      const endIdx = nextPointIdx === -1 ? course.content.length : nextPointIdx;

      const pointContent = course.content.substring(startIdx, endIdx);

      // 统计这段内容中有多少个<p></p>
      const emptyLineCount = (pointContent.match(/<p><\/p>/g) || []).length;

      // 显示点的开头和空行数
      const contentPreview = pointContent.substring(0, 80).replace(/\n/g, '\\n');
      console.log(`点 ${pointNum}: ${emptyLineCount} 个<p></p> | ${contentPreview}...`);

      points.push({
        num: pointNum,
        emptyLines: emptyLineCount,
        contentStart: pointContent.substring(0, 200)
      });
    }

    console.log('\n═'.repeat(80));
    console.log('\n详细分析:\n');

    // 显示第1个和第2个点之间的内容
    const point1Start = course.content.indexOf('<strong>1.</strong>');
    const point2Start = course.content.indexOf('<strong>2.</strong>');
    const betweenContent = course.content.substring(point1Start, point2Start + 100);

    console.log('点1和点2之间的内容(显示转义):\n');
    console.log(JSON.stringify(betweenContent));

    console.log('\n\n点1和点2之间的实际格式:\n');
    console.log(betweenContent.replace(/</g, '\n<'));

    // 统计总体情况
    const totalPoints = points.length;
    const totalEmptyLines = (course.content.match(/<p><\/p>/g) || []).length;

    console.log('\n═'.repeat(80));
    console.log('\n总体统计:\n');
    console.log(`总点数: ${totalPoints}`);
    console.log(`总空行数: ${totalEmptyLines}`);
    console.log(`平均每个点之间的空行: ${(totalEmptyLines / (totalPoints + 1)).toFixed(2)}`);

    console.log('\n期望格式: 每个点之间应该有 1 个 <p></p>');
    console.log(`实际情况: 有 ${totalEmptyLines} 个 <p></p> 用于 ${totalPoints} 个点`);

    if (totalEmptyLines === totalPoints + 1) {
      console.log('\n✅ 格式正确!\n');
    } else {
      console.log('\n⚠️ 格式可能不完全正确，需要检查\n');
      console.log('建议: 应该是 (点数 + 1) 个空行');
      console.log(`即: ${totalPoints} + 1 = ${totalPoints + 1} 个<p></p>\n`);
    }

    await mongoose.connection.close();
    process.exit(0);

  } catch (error) {
    console.error('❌ 错误:', error.message);
    await mongoose.connection.close();
    process.exit(1);
  }
}

checkDay2Html();
