const mongoose = require('mongoose');
const Insight = require('../src/models/Insight');
const User = require('../src/models/User');
const Period = require('../src/models/Period');

const mongoUrl = 'mongodb://admin:admin123@localhost:27017/morning_reading?authSource=admin';

async function checkContent() {
  try {
    await mongoose.connect(mongoUrl, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });

    console.log('\n========== 小凡看见内容检查 ==========\n');

    // 查找所有发布的insights
    const insights = await Insight.find({ isPublished: true })
      .populate('userId', 'nickname')
      .populate('targetUserId', 'nickname')
      .populate('periodId', 'name')
      .limit(3)
      .lean();

    if (insights.length === 0) {
      console.log('❌ 没有发布的小凡看见');
      await mongoose.disconnect();
      return;
    }

    console.log(`📋 找到 ${insights.length} 条已发布的小凡看见\n`);

    insights.forEach((insight, i) => {
      console.log(`\n[${i+1}] 小凡看见详情:`);
      console.log('─'.repeat(80));
      console.log(`ID: ${insight._id}`);
      console.log(`创建者: ${insight.userId?.nickname || '未知'}`);
      console.log(`被看见人: ${insight.targetUserId?.nickname || '未指定'}`);
      console.log(`期次: ${insight.periodId?.name || '未知'}`);
      console.log(`媒体类型: ${insight.mediaType}`);
      console.log(`发布状态: ${insight.isPublished ? '已发布' : '草稿'}`);
      console.log(`\n内容格式分析:`);

      const content = insight.content;
      const isHtml = /<[^>]+>/.test(content);

      if (isHtml) {
        console.log('  ✓ 检测到HTML标签');
        console.log(`  - 内容开头: ${content.substring(0, 100)}...`);

        // 尝试提取纯文本
        const plainText = content.replace(/<[^>]+>/g, '').substring(0, 100);
        console.log(`  - 纯文本: ${plainText}...`);
      } else {
        console.log('  ✓ 纯文本格式');
        console.log(`  - 内容: ${content.substring(0, 100)}...`);
      }
    });

    console.log('\n' + '─'.repeat(80));
    console.log('\n分析结论:');
    console.log('如果看到HTML标签，说明：');
    console.log('  1. 后台存储的是HTML格式的内容');
    console.log('  2. 前端显示时应该解析HTML而不是显示原文');
    console.log('  3. 需要在前端使用 v-html 或 innerHTML 来渲染\n');

    await mongoose.disconnect();
  } catch (error) {
    console.error('❌ 检查失败:', error.message);
    await mongoose.disconnect();
  }
}

checkContent();
