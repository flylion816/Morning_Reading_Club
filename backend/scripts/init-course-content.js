const mongoose = require('mongoose');
const Section = require('../src/models/Section');
const Period = require('../src/models/Period');

const mongoUrl = process.env.MONGODB_URL || 'mongodb://localhost:27017/morning-reading-club';

/**
 * 通用课程内容导入脚本
 * 用法: node init-course-content.js [periodName] [day] [data.json]
 *
 * 示例:
 *   node init-course-content.js "平衡之道" 0 day1-content.json
 *
 * 或在脚本中修改以下配置参数
 */

// ===== 配置参数（可通过命令行参数覆盖） =====
const CONFIG = {
  periodName: process.argv[2] || '平衡之道',      // 期次名称
  day: parseInt(process.argv[3]) || 0,            // 课程日期（0表示开场）
  dataFile: process.argv[4] || null,              // 外部JSON数据文件（可选）

  // 如果不使用外部文件，在这里定义课程内容
  courseContent: {
    title: '品德成功论',
    subtitle: '',
    icon: '⚖️',
    meditation: '开始学习之前，给自己1分钟的时间，深呼吸，静静心，然后开始学习。',
    question: '带着问题学习\n什么是品德成功论?',
    content: `<p><strong style="color: #d32f2f;">每天晨读内容</strong></p>
<p></p>
<p><strong>品德成功论 由内而外全面造就自己</strong></p>
<p></p>
<p><strong>1.</strong> 品德成功论提醒人们，高效能的生活是有基本原则的。只有当人们学会并遵循这些原则，把它们融入到自己的品格中去，才能享受真正的成功与恒久的幸福。</p>
<p></p>
<p><strong>2.</strong> 没有正确的生活，就没有真正卓越的人生。</p>
<p style="margin-left: 2em;">——戴维·斯塔·乔丹(David Starr Jordan)</p>
<p style="margin-left: 2em;">美国生物学家及教育家</p>
<p></p>
<p><strong>3.</strong> 在25年的工作经历中，我与商界、大学和婚姻家庭各个领域的人共事。和其中一些外表看来很成功的人深入接触后，我却发现他们常在与内心的渴望斗争，他们确实需要协调和高效，以及健康向上的人际关系。</p>
<p></p>
<p><strong>4.</strong> 我想从下面他们和我分享的这些例子中，你应该能找到共鸣：</p>
<p></p>
<p><strong>5.</strong> 我的事业十分成功，但却牺牲了个人生活和家庭生活。不但与妻儿形同陌路，甚至无法肯定自己是否真正了解自己，是否了解什么才是生命中最重要的。</p>
<p></p>
<p><strong>6.</strong> 我很忙，确实很忙，但有时候我自己也不清楚是否有价值。我希望生活得有意义，能对世界有所贡献。</p>
<p></p>
<p><strong>7.</strong> 我上过无数关于有效管理的课程，我对员工的期望值很高，也想尽办法善待他们，但就是感觉不到他们的忠心。我想如果我有一天生病在家，他们一定会无所事事，闲聊度日。为什么我无法把他们训练得独立而负责呢？为什么我总是找不到这样的员工呢？</p>
<p></p>
<p><strong>8.</strong> 要做的事太多了，我总是感到时间不够用，觉得压力沉重，终日忙忙碌碌，一周7天，天天如此。我参加过时间管理研讨班，也尝试过各种安排进度计划的工具。虽然也有点帮助，但我仍然觉得无法像我希望的那样，过上快乐、高效而平和的生活。</p>
<p></p>
<p><strong>9.</strong> 看到别人有所成就，或获得某种认可，表面上我会挤出微笑，热切地表示祝贺，可是，内心却难受得不得了。为什么我会有这种感觉？</p>
<p></p>
<p><strong>10.</strong> 我个性很强。凡乎在任何交往中，我都能控制结果。多数情况下，我甚至可以设法影响他人通过我想要的决议。我仔细考虑了每种情况，并且坚信我的建议通常都是对大家最好的。但是我仍感到不安，我很想知道，他人对我的为人和建议到底是何态度。</p>
<p></p>
<p><strong>11.</strong> 我的婚姻已变得平淡无趣。我们并没有恶言相向，更没有大打出手，只是不再有爱的感觉。我们请教过婚姻顾问，也试过许多办法，但看来就是无法重新燃起往日的爱情火花。</p>
<p></p>
<p><strong>12.</strong> 我那十来岁的儿子不听话，还打架。不管我怎么努力，他就是不听我的话，我该怎么办呢？</p>
<p></p>
<p><strong>13.</strong> 我想教育孩子懂得工作的价值。但每次要他们做点什么，都要时时刻刻在旁监督，还得忍受他们不时地抱怨，结果还不如自己动手来得简单。为什么孩子们就不能不要我提醒，快快乐乐地料理自己的事呢？</p>
<p></p>
<p><strong>14.</strong> 我又开始节食了——今年的第五次。我知道自己体重超标，也确实想有所改变。我阅读所有最新的资料，确定目标，并采取积极的态度激励自己，但我就是做不到，几周后就溃败了。看来我就是无法信守诺言。</p>
<p></p>
<p><strong>15.</strong> 这些都是我在任职咨询顾问和大学教师期间遇到的一些普遍而又深层次的问题，不是一两天就能解决的。</p>
<p></p>
<p><strong>16.</strong> 几年前，我和妻子桑德拉就为类似的问题大伤脑筋。我们的一个儿子学习成绩很差，甚至看不懂试卷上的问题。他与同学交往时也很不成熟，经常弄得周围的人很尴尬。他又瘦又小，动作也不协调。打棒球时，他往往在投手投球之前就挥动了球棒，招来他人的嘲笑。</p>
<p></p>
<p><strong>17.</strong> 我和桑德拉觉得，若要十全十美，首先要做完美的父母。于是我们尝试用积极的态度来激发他的自信心："加油，孩子，你能办得到！我们知道你行！手握高一点，看着球，等球快到面前再挥棒。"只要他稍有进步，我们就大为奖励一番以增强他的信心："干得好，孩子，继续。"</p>
<p></p>
<p><strong>18.</strong> 尽管如此，还是引来了嘲笑；我们对此大加乐贺："别笑，他还在学习呢。"而这时我们的儿子却总是哭着说："我永远也学不好，我根本就不喜欢棒球！"</p>
<p></p>
<p><strong>19.</strong> 所有的努力似乎都徒劳无功，那时我们真是心急如焚，看得出来这一切反而伤害了他的自尊心。开始我们总能对他加以肯定、鼓励和帮助，可是一再失败后，还是放弃了，只能试着从另一个角度来看待。</p>
<p></p>
<p><strong>20.</strong> 后来，在讲授有关沟通与认知的课程中，我对思维方式的形成、思维方式如何影响观点、观点又如何左右行为等问题深感兴趣，并进一步研究了期望理论(Expectancy Theory)、自我实现预言(Self-fulfilling Prophecy)和皮格马利翁效应(Pygmalion Effect)。从中我意识到，每个人的思维方式都是那么根深蒂固，仅仅研究世界是不够的，还要研究我们看世界时所戴的"透镜"，因为这透镜(即思维方式)往往左右着我们对世界的看法。</p>
<p></p>
<p><strong>21.</strong> 我跟桑德拉谈到这些想法，并借此分析我们的困境，终于认识到我们对儿子往往言不由衷。自省后我们承认，内心深处的确觉得儿子在某些方面"不如常人"。所以不论我们多么注意自己的态度与行为，其效果都是有限的，因为表面的言行终究掩饰不住其背后的信息，那就是："你不行，你需要父母的保护。"</p>
<p></p>
<p><strong>22.</strong> 此时我们才开始觉悟：要改变现状，首先要改变自己；要改变自己，先要改变我们对问题的看法。</p>`,
    reflection: '上文中，哪一句话特别触动我？引起了我哪些感触?',
    action: '把自己的感触记录在下面的打卡日记上（觉察日记），在早上的晨读营里分享。',
    learn: '阅读《高效能人士的七个习惯》原本第一章 由内而外全面造就自己《品德与个人魅力执重》《光有技巧还不够》',
    extract: '从上文中，摘抄出一句金句，分享到晨读营的微信群中。',
    say: '把今天的心得收获和书友、亲友说一说。你会惊讶地发现，人们以往对你的消极看法和贴在你身上的标签会慢慢消失不见。',
    duration: 23,
    isPublished: true,
    sortOrder: 0
  }
};

/**
 * 加载外部数据文件（可选）
 */
function loadExternalData() {
  if (!CONFIG.dataFile) {
    return CONFIG.courseContent;
  }

  try {
    const fs = require('fs');
    const path = require('path');
    const dataPath = path.isAbsolute(CONFIG.dataFile)
      ? CONFIG.dataFile
      : path.join(__dirname, CONFIG.dataFile);

    console.log(`📂 加载外部数据文件: ${dataPath}`);
    const data = JSON.parse(fs.readFileSync(dataPath, 'utf-8'));
    console.log('✅ 外部数据加载成功\n');
    return data;
  } catch (error) {
    console.warn(`⚠️ 无法加载外部文件，使用默认配置: ${error.message}\n`);
    return CONFIG.courseContent;
  }
}

/**
 * 主导入函数
 */
async function initCourseContent() {
  try {
    console.log('========================================');
    console.log('   通用课程内容导入工具');
    console.log('========================================\n');

    console.log('正在连接数据库...');
    await mongoose.connect(mongoUrl, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    console.log('✅ 数据库连接成功\n');

    // 查找期次
    console.log(`🔍 查找期次: "${CONFIG.periodName}"`);
    const period = await Period.findOne({ name: CONFIG.periodName });
    if (!period) {
      console.error(`❌ 找不到期次: "${CONFIG.periodName}"`);
      console.log('\n📌 可用期次列表:');
      const allPeriods = await Period.find().select('name');
      allPeriods.forEach(p => console.log(`   - ${p.name}`));
      process.exit(1);
    }
    console.log(`✅ 找到期次: ${period.name} (ID: ${period._id})\n`);

    // 加载课程内容（支持外部文件）
    const courseContent = loadExternalData();
    const finalData = {
      periodId: period._id,
      day: CONFIG.day,
      ...courseContent
    };

    // 创建课程（INSERT模式，不删除旧记录）
    console.log('📝 创建新课程...');
    const newSection = await Section.create(finalData);

    // 输出成功信息
    console.log('\n✅ 课程创建成功!');
    console.log('━'.repeat(40));
    console.log(`📌 课程ID: ${newSection._id}`);
    console.log(`📚 期次: ${period.name}`);
    console.log(`📅 日期: 第 ${newSection.day} 天`);
    console.log(`📖 标题: ${newSection.title}`);
    console.log(`✓ 发布状态: ${newSection.isPublished ? '已发布' : '草稿'}`);
    console.log('━'.repeat(40));
    console.log('\n   内容字段详情:');
    console.log(`   ✓ meditation (静一静): ${newSection.meditation.length} 字`);
    console.log(`   ✓ question (问一问): ${newSection.question.length} 字`);
    console.log(`   ✓ content (读一读): ${newSection.content.length} 字`);
    console.log(`   ${newSection.reflection ? '✓' : '○'} reflection (想一想): ${newSection.reflection ? newSection.reflection.length + ' 字' : '空'}`);
    console.log(`   ${newSection.action ? '✓' : '○'} action (记一记): ${newSection.action ? newSection.action.length + ' 字' : '空'}`);
    console.log(`   ${newSection.extract ? '✓' : '○'} extract (摘一摘): ${newSection.extract ? newSection.extract.length + ' 字' : '空'}`);
    console.log(`   ${newSection.say ? '✓' : '○'} say (说一说): ${newSection.say ? newSection.say.length + ' 字' : '空'}`);
    console.log(`   ${newSection.learn ? '✓' : '○'} learn (学一学): ${newSection.learn ? newSection.learn.length + ' 字' : '空'}`);

    // 验证22个点
    const pointMatches = newSection.content.match(/<strong>\d+\./g);
    const pointCount = pointMatches ? pointMatches.length : 0;
    console.log(`\n   📌 内容点数: ${pointCount} 个点`);

    // 验证空行
    const emptyParagraphs = (newSection.content.match(/<p><\/p>/g) || []).length;
    console.log(`   📌 空行数: ${emptyParagraphs} 个 <p></p>\n`);

    await mongoose.connection.close();
    console.log('✅ 数据库连接已关闭\n');
    console.log('🎉 导入完成！');

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

// 显示使用说明
console.log('\n📖 使用说明:');
console.log('━'.repeat(40));
console.log('1. 基础用法（使用默认配置）:');
console.log('   node init-course-content.js\n');
console.log('2. 指定期次和日期:');
console.log('   node init-course-content.js "平衡之道" 1\n');
console.log('3. 使用外部JSON文件:');
console.log('   node init-course-content.js "平衡之道" 2 day2-data.json\n');
console.log('━'.repeat(40));
console.log(`\n当前配置: 期次="${CONFIG.periodName}", 日期=${CONFIG.day}\n`);

initCourseContent();
