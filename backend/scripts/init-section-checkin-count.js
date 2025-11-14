const mongoose = require('mongoose');

const uri = 'mongodb://admin:admin123@localhost:27017/morning_reading?authSource=admin';

mongoose.connect(uri).then(async () => {
  console.log('MongoDB 连接成功');

  const sectionSchema = new mongoose.Schema({}, { strict: false });
  const Section = mongoose.model('Section', sectionSchema, 'sections');

  try {
    // 为每个课节初始化打卡人数（5-15之间的随机数）
    const sections = await Section.find({});

    console.log('开始初始化课节打卡人数...');
    for (const section of sections) {
      // 生成随机打卡人数（5-15之间）
      const checkinCount = Math.floor(Math.random() * 11) + 5; // 5-15

      const result = await Section.findByIdAndUpdate(
        section._id,
        { checkinCount: checkinCount },
        { new: true }
      );

      console.log(`✓ Day ${result.day} (${result.title}): ${checkinCount}人已打卡`);
    }

    console.log('\n初始化完成！');
    process.exit(0);
  } catch (error) {
    console.error('初始化失败:', error);
    process.exit(1);
  }
}).catch(err => {
  console.error('MongoDB 连接失败:', err);
  process.exit(1);
});
