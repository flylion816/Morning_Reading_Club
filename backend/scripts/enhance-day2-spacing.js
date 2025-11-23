const mongoose = require('mongoose');
const Section = require('../src/models/Section');
const Period = require('../src/models/Period');

const mongoUrl = process.env.MONGODB_URL || 'mongodb://localhost:27017/morning-reading-club';

async function enhanceDay2Spacing() {
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

    console.log('📖 分析当前HTML结构...\n');

    // 计算原始空行数
    const originalEmptyLines = (course.content.match(/<p><\/p>/g) || []).length;
    console.log(`原始空行数: ${originalEmptyLines} 个\n`);

    // 替换单个<p></p>为双个<p></p> - 加强视觉分隔
    let enhancedContent = course.content;

    // 在每个点之间添加额外的空行
    // 模式: </p>\n<p></p>\n<p><strong> → </p>\n<p></p>\n<p></p>\n<p><strong>
    enhancedContent = enhancedContent.replace(
      /<\/p>\n<p><\/p>\n<p><strong>/g,
      '</p>\n<p></p>\n<p></p>\n<p><strong>'
    );

    // 计算新的空行数
    const newEmptyLines = (enhancedContent.match(/<p><\/p>/g) || []).length;

    console.log('✅ 已增强空行间距\n');
    console.log(`原始空行数: ${originalEmptyLines} 个`);
    console.log(`新的空行数: ${newEmptyLines} 个`);
    console.log(`增加了: ${newEmptyLines - originalEmptyLines} 个空行\n`);

    // 显示前后对比
    console.log('═'.repeat(80));
    console.log('\n前后对比示例:\n');

    // 找出第1和第2个点之间的部分
    const point1Idx = course.content.indexOf('<strong>1.</strong>');
    const point2Idx = course.content.indexOf('<strong>2.</strong>');
    const originalBetween = course.content.substring(point1Idx, point2Idx + 100);

    const enhancedPoint1Idx = enhancedContent.indexOf('<strong>1.</strong>');
    const enhancedPoint2Idx = enhancedContent.indexOf('<strong>2.</strong>');
    const enhancedBetween = enhancedContent.substring(enhancedPoint1Idx, enhancedPoint2Idx + 100);

    console.log('【原始格式】:');
    console.log(originalBetween.replace(/</g, '\n<'));

    console.log('\n\n【增强后格式】:');
    console.log(enhancedBetween.replace(/</g, '\n<'));

    console.log('\n\n═'.repeat(80));

    // 保存到数据库
    course.content = enhancedContent;
    await course.save();

    console.log('\n✅ 已更新数据库\n');

    // 验证
    const finalCourse = await Section.findById(course._id);
    const finalEmptyLines = (finalCourse.content.match(/<p><\/p>/g) || []).length;
    const finalPointCount = (finalCourse.content.match(/<strong>\d+\./g) || []).length;

    console.log('最终验证:');
    console.log(`  点数: ${finalPointCount} 个`);
    console.log(`  空行: ${finalEmptyLines} 个`);
    console.log(`  每点之间的平均空行: ${(finalEmptyLines / (finalPointCount + 1)).toFixed(2)} 个\n`);

    if (finalEmptyLines > originalEmptyLines) {
      console.log('✅ 空行增强成功！现在应该能看到更明显的间距\n');
    }

    await mongoose.connection.close();
    process.exit(0);

  } catch (error) {
    console.error('❌ 错误:', error.message);
    await mongoose.connection.close();
    process.exit(1);
  }
}

enhanceDay2Spacing();
