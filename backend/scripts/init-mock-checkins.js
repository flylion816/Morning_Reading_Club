const mongoose = require('mongoose');

const uri = 'mongodb://admin:admin123@localhost:27017/morning_reading?authSource=admin';

mongoose.connect(uri).then(async () => {
  console.log('MongoDB 连接成功');

  const checkinSchema = new mongoose.Schema({}, { strict: false });
  const Checkin = mongoose.model('Checkin', checkinSchema, 'checkins');
  const userSchema = new mongoose.Schema({}, { strict: false });
  const User = mongoose.model('User', userSchema, 'users');

  try {
    const userId = '6915e741c4fbb40316417089'; // 阿泰
    const periodId = '6915e741c4fbb40316417092'; // 勇敢的心

    // 第4天 section: 6915e741c4fbb4031641709c
    // 第3天 section: 6915e741c4fbb4031641709b

    const checkins = [
      {
        userId: new mongoose.Types.ObjectId(userId),
        periodId: new mongoose.Types.ObjectId(periodId),
        sectionId: new mongoose.Types.ObjectId('6915e741c4fbb4031641709c'),
        day: 4,
        checkinDate: new Date('2025-11-13'),
        readingTime: 25,
        completionRate: 88,
        note: '今天学到了很多关于成长与改变原则的内容，感受深刻。',
        mood: 'inspired',
        isPublic: true,
        createdAt: new Date('2025-11-13T15:30:00Z')
      },
      {
        userId: new mongoose.Types.ObjectId(userId),
        periodId: new mongoose.Types.ObjectId(periodId),
        sectionId: new mongoose.Types.ObjectId('6915e741c4fbb4031641709c'),
        day: 4,
        checkinDate: new Date('2025-11-12'),
        readingTime: 30,
        completionRate: 95,
        note: '反复阅读了第四天的内容，对人生成长有了新的认识。',
        mood: 'thoughtful',
        isPublic: true,
        createdAt: new Date('2025-11-12T14:20:00Z')
      },
      {
        userId: new mongoose.Types.ObjectId(userId),
        periodId: new mongoose.Types.ObjectId(periodId),
        sectionId: new mongoose.Types.ObjectId('6915e741c4fbb4031641709b'),
        day: 3,
        checkinDate: new Date('2025-11-11'),
        readingTime: 28,
        completionRate: 92,
        note: '第三天以原则为中心的思维让我重新思考人生方向。',
        mood: 'calm',
        isPublic: true,
        createdAt: new Date('2025-11-11T10:15:00Z')
      }
    ];

    console.log('开始创建打卡记录...');
    for (const checkin of checkins) {
      const result = await Checkin.create(checkin);
      console.log(`✓ Day ${result.day} (${new Date(result.createdAt).toLocaleDateString()}): 创建成功`);
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
