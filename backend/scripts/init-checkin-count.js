const mongoose = require('mongoose');

const uri = 'mongodb://admin:admin123@localhost:27017/morning_reading?authSource=admin';

mongoose.connect(uri).then(async () => {
  console.log('MongoDB 连接成功');
  
  const periodSchema = new mongoose.Schema({}, { strict: false });
  const Period = mongoose.model('Period', periodSchema, 'periods');
  
  try {
    // 期次ID列表
    const periods = [
      '6916c27f2a43d9be12944348',  // 智慧之光
      '6915e741c4fbb40316417092',  // 勇敢的心
      '6915e741c4fbb40316417093',  // 能量之泉
      '6915e741c4fbb40316417094'   // 心流之境
    ];
    
    console.log('开始初始化打卡人数...');
    for (const periodId of periods) {
      // 生成随机打卡人数（10-20之间）
      const checkinCount = Math.floor(Math.random() * 11) + 10; // 10-20
      
      const result = await Period.findByIdAndUpdate(
        periodId,
        { checkinCount: checkinCount, totalCheckins: checkinCount * 5 }, // 假设每人平均打卡5次
        { new: true }
      );
      
      console.log(`✓ ${result.name}: ${checkinCount}人已打卡`);
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
