const mongoose = require('mongoose');

const uri = 'mongodb://admin:admin123@localhost:27017/morning_reading?authSource=admin';

mongoose.connect(uri).then(async () => {
  console.log('MongoDB 连接成功');
  
  const sectionSchema = new mongoose.Schema({}, { strict: false });
  const Section = mongoose.model('Section', sectionSchema, 'sections');
  
  try {
    // 定义更新数据
    const updates = [
      { id: '6915e741c4fbb40316417098', day: 0, title: '开营词' },
      { id: '6915e741c4fbb40316417099', day: 1, title: '第一天 品德成功论' },
      { id: '6915e741c4fbb4031641709a', day: 2, title: '第二天 思维方式的力量' },
      { id: '6915e741c4fbb4031641709b', day: 3, title: '第三天 以原则为中心的思维' },
      { id: '6915e741c4fbb4031641709c', day: 4, title: '第四天 成长与改变的原则' }
    ];
    
    console.log('开始更新...');
    for (const update of updates) {
      const result = await Section.findByIdAndUpdate(
        update.id,
        { title: update.title },
        { new: true }
      );
      console.log(`✓ day ${result.day}: ${result.title}`);
    }
    
    console.log('\n更新完成！');
    process.exit(0);
  } catch (error) {
    console.error('更新失败:', error);
    process.exit(1);
  }
}).catch(err => {
  console.error('MongoDB 连接失败:', err);
  process.exit(1);
});
