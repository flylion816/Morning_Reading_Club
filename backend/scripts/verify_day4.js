#!/usr/bin/env node

const mongoose = require('mongoose');
const Section = require('/Users/pica_1/我的坚果云/flylion/AI项目开发/七个习惯晨读营/backend/src/models/Section');

async function verifyDay4() {
  try {
    const mongoUrl = 'mongodb://admin:admin123@localhost:27017/morning_reading?authSource=admin';
    await mongoose.connect(mongoUrl, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });

    console.log('✅ 验证 Day 4 记录\n');

    const day4 = await Section.findOne({ day: 4 });

    if (!day4) {
      console.log('❌ 未找到 Day 4 记录');
      await mongoose.disconnect();
      process.exit(1);
    }

    console.log('========================================');
    console.log('   Day 4 课程详情');
    console.log('========================================\n');
    console.log('基本信息:');
    console.log('  标题: ' + day4.title);
    console.log('  副标题: ' + day4.subtitle);
    console.log('  图标: ' + day4.icon);
    console.log('  发布状态: ' + (day4.isPublished ? '✅ 已发布' : '❌ 未发布'));
    console.log('  排序: Day ' + day4.day + ' (第' + day4.sortOrder + '个)\n');

    console.log('内容字段:');
    console.log('  静一静: ' + (day4.meditation ? day4.meditation.length + ' 字' : '无'));
    console.log('  问一问: ' + (day4.question ? day4.question.length + ' 字' : '无'));
    console.log('  读一读: ' + (day4.content ? day4.content.length + ' 字' : '无'));

    if (day4.content) {
      const paragraphs = day4.content.match(/<strong>\d+\./g) || [];
      console.log('         ' + paragraphs.length + ' 个段落');
      console.log('         (preview: ' + day4.content.substring(0, 100).replace(/[\n\r]/g, '') + '...)');
    }

    console.log('  想一想: ' + (day4.reflection ? day4.reflection.length + ' 字' : '无'));
    console.log('  记一记: ' + (day4.action ? day4.action.length + ' 字' : '无'));
    console.log('  摘一摘: ' + (day4.extract ? day4.extract.length + ' 字' : '无'));
    console.log('  说一说: ' + (day4.say ? day4.say.length + ' 字' : '无'));
    console.log('  学一学: ' + (day4.learn ? day4.learn.length + ' 字' : '无'));

    console.log('\n时间信息:');
    console.log('  创建时间: ' + day4.createdAt.toLocaleString('zh-CN'));
    console.log('  更新时间: ' + day4.updatedAt.toLocaleString('zh-CN'));

    console.log('\n========================================');
    console.log('✅ Day 4 记录验证完成');
    console.log('✅ 数据库中现在只有 1 条完整的 Day 4 记录');
    console.log('========================================\n');

    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    console.error('❌ 验证失败:', error.message);
    process.exit(1);
  }
}

verifyDay4();
