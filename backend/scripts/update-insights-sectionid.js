const mongoose = require('mongoose');

const uri = 'mongodb://admin:admin123@localhost:27017/morning_reading?authSource=admin';

mongoose.connect(uri).then(async () => {
  console.log('MongoDB 连接成功');
  
  const insightSchema = new mongoose.Schema({}, { strict: false });
  const Insight = mongoose.model('Insight', insightSchema, 'insights');
  
  try {
    // 定义更新数据
    const updates = [
      { 
        id: '6916ba315aee1a38709a11d4', 
        day: 4, 
        sectionId: '6915e741c4fbb4031641709c'  // day 4的section
      },
      { 
        id: '6916ba315aee1a38709a11d2', 
        day: 3, 
        sectionId: '6915e741c4fbb4031641709b'  // day 3的section
      }
    ];
    
    console.log('开始更新Insight的sectionId...');
    for (const update of updates) {
      const result = await Insight.findByIdAndUpdate(
        update.id,
        { sectionId: update.sectionId },
        { new: true }
      );
      console.log(`✓ Insight day ${result.day}: sectionId 已更新为 ${update.sectionId}`);
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
