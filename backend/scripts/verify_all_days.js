const mongoose = require('mongoose');

const mongoUrl = 'mongodb://admin:admin123@localhost:27017/morning_reading?authSource=admin';
const Section = require('/Users/pica_1/我的坚果云/flylion/AI项目开发/七个习惯晨读营/backend/src/models/Section');
const Period = require('/Users/pica_1/我的坚果云/flylion/AI项目开发/七个习惯晨读营/backend/src/models/Period');

async function verifyCourses() {
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
    console.log('========================================');
    console.log('Day 0-22 课程统计');
    console.log('========================================\n');

    let totalCharacters = 0;
    let totalParagraphs = 0;
    let successCount = 0;

    for (let day = 0; day <= 22; day++) {
      const section = await Section.findOne({
        periodId: period._id,
        day: day
      });

      if (!section) {
        console.log(`❌ Day ${day.toString().padStart(2)}: 未找到`);
      } else {
        const contentLen = section.content ? section.content.length : 0;
        const paragraphs = section.content
          ? (section.content.match(/<strong>\d+\.<\/strong>/g) || []).length
          : 0;

        const titleStr = section.title.substring(0, 20).padEnd(20);
        console.log(`✅ Day ${day.toString().padStart(2)}: ${titleStr} ${String(contentLen).padStart(5)}字 ${String(paragraphs).padStart(2)}段`);

        totalCharacters += contentLen;
        totalParagraphs += paragraphs;
        successCount++;
      }
    }

    console.log('\n========================================');
    console.log(`统计结果`);
    console.log('========================================');
    console.log(`成功导入: ${successCount}/21 天`);
    console.log(`总字数: ${totalCharacters.toLocaleString('en')} 字`);
    console.log(`总段落: ${totalParagraphs} 段`);
    console.log(`平均每天: ${(totalCharacters / 23).toFixed(0)} 字, ${(totalParagraphs / 23).toFixed(1)} 段\n`);

    if (successCount === 23) {
      console.log('🎉 所有23天课程已成功导入数据库！');
    }

    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    console.error('❌ 错误:', error.message);
    await mongoose.disconnect();
    process.exit(1);
  }
}

verifyCourses();
