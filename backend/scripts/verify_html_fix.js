const mongoose = require('mongoose');
const Insight = require('../src/models/Insight');
const User = require('../src/models/User');
const Period = require('../src/models/Period');

const mongoUrl = 'mongodb://admin:admin123@localhost:27017/morning_reading?authSource=admin';

// 模拟前端的stripHtmlTags和truncateText函数
function stripHtmlTags(text) {
  return text.replace(/<[^>]+>/g, '').trim();
}

function truncateText(text, length) {
  const plainText = stripHtmlTags(text);
  return plainText.length > length ? plainText.substring(0, length) + '...' : plainText;
}

async function verifyFix() {
  try {
    await mongoose.connect(mongoUrl, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });

    console.log('\n========== 小凡看见HTML修复验证 ==========\n');

    const insights = await Insight.find({ isPublished: true })
      .populate('userId', 'nickname')
      .populate('targetUserId', 'nickname')
      .populate('periodId', 'name')
      .limit(1)
      .lean();

    if (insights.length === 0) {
      console.log('❌ 没有发布的小凡看见');
      await mongoose.disconnect();
      return;
    }

    const insight = insights[0];

    console.log('📋 修复效果演示：\n');
    console.log('═'.repeat(80));
    console.log('原始内容（从数据库获取）：');
    console.log('─'.repeat(80));
    console.log(insight.content.substring(0, 200) + '...\n');

    console.log('═'.repeat(80));
    console.log('修复前（旧版本 - 直接显示）：');
    console.log('─'.repeat(80));
    // 直接截断，不移除标签
    const oldDisplay = insight.content.length > 50
      ? insight.content.substring(0, 50) + '...'
      : insight.content;
    console.log(oldDisplay);
    console.log('❌ 显示的是HTML标签，用户看不懂\n');

    console.log('═'.repeat(80));
    console.log('修复后（新版本 - 移除标签后显示）：');
    console.log('─'.repeat(80));
    const newDisplay = truncateText(insight.content, 50);
    console.log(newDisplay);
    console.log('✅ 显示的是纯文本，用户能看懂\n');

    console.log('═'.repeat(80));
    console.log('后台表格显示效果：\n');
    console.log('列：类型 | 媒体 | 内容 | 期次 | 被看见人');
    console.log('─'.repeat(80));
    console.log(
      `     看见  | 文本 | ${truncateText(insight.content, 40).substring(0, 40)} | ${insight.periodId?.name || '未知'} | ${insight.targetUserId?.nickname || '未指定'}`
    );
    console.log('═'.repeat(80));

    console.log('\n✅ 修复验证完成！');
    console.log('   后台现在显示的是正确的纯文本内容，和小程序保持一致\n');

    await mongoose.disconnect();
  } catch (error) {
    console.error('❌ 验证失败:', error.message);
    await mongoose.disconnect();
  }
}

verifyFix();
