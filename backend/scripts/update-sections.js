const mongoose = require('mongoose');

// 连接数据库
mongoose.connect('mongodb://localhost:27017/morning-reading', {
  useNewUrlParser: true,
  useUnifiedTopology: true
});

const sectionSchema = new mongoose.Schema({}, { strict: false });
const Section = mongoose.model('Section', sectionSchema, 'sections');

async function updateSections() {
  try {
    // 查询所有sections
    const sections = await Section.find({ periodId: '6915e741c4fbb40316417092' }).sort({ day: 1 });
    
    console.log('找到的sections:');
    sections.forEach(s => {
      console.log(`  day ${s.day}: ${s.title} (id: ${s._id})`);
    });

    // 定义更新数据
    const updates = [
      { day: 0, title: '开营词' },
      { day: 1, title: '第一天 品德成功论' },
      { day: 2, title: '第二天 思维方式的力量' },
      { day: 3, title: '第三天 以原则为中心的思维' },
      { day: 4, title: '第四天 成长与改变的原则' }
    ];

    console.log('\n开始更新...');
    for (const update of updates) {
      const section = sections.find(s => s.day === update.day);
      if (section) {
        await Section.findByIdAndUpdate(section._id, { title: update.title });
        console.log(`✓ day ${update.day} 已更新为: ${update.title}`);
      }
    }

    console.log('\n更新完成！');
    
    // 验证更新结果
    const updatedSections = await Section.find({ periodId: '6915e741c4fbb40316417092' }).sort({ day: 1 });
    console.log('\n更新后的sections:');
    updatedSections.forEach(s => {
      console.log(`  day ${s.day}: ${s.title}`);
    });

    process.exit(0);
  } catch (error) {
    console.error('更新失败:', error);
    process.exit(1);
  }
}

updateSections();
