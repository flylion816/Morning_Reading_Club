const mongoose = require('mongoose');

const uri = 'mongodb://admin:admin123@localhost:27017/morning_reading?authSource=admin';

mongoose.connect(uri).then(async () => {
  console.log('MongoDB 连接成功');

  const checkinSchema = new mongoose.Schema({}, { strict: false });
  const Checkin = mongoose.model('Checkin', checkinSchema, 'checkins');
  const userSchema = new mongoose.Schema({}, { strict: false });
  const User = mongoose.model('User', userSchema, 'users');

  try {
    // 删除之前的Mock打卡记录
    await Checkin.deleteMany({
      note: {
        $in: [
          '今天学到了很多关于成长与改变原则的内容，感受深刻。',
          '反复阅读了第四天的内容，对人生成长有了新的认识。',
          '第三天以原则为中心的思维让我重新思考人生方向。'
        ]
      }
    });

    // 获取或创建用户
    const users = await User.find({}).limit(4);

    console.log('找到用户数:', users.length);
    if (users.length < 4) {
      console.log('用户数不足，需要创建更多用户');
      process.exit(1);
    }

    const periodId = '6915e741c4fbb40316417092'; // 勇敢的心

    const checkins = [
      {
        userId: new mongoose.Types.ObjectId(users[0]._id),
        periodId: new mongoose.Types.ObjectId(periodId),
        sectionId: new mongoose.Types.ObjectId('6915e741c4fbb4031641709c'),
        day: 4,
        checkinDate: new Date('2025-11-13'),
        readingTime: 25,
        completionRate: 88,
        note: '成长，从夹都不是一条笔直的上升线。它更像一条螺旋——看似兜回原点，实则海拔早已提升。很多人以为成长的关键在"快"，于是一路狂奔、焦虑、拉扯，以为只要不停，就会抵达。可现实告诉我们：真正的成长，从来不是速度的游戏，而是节奏的艺术。',
        mood: 'inspired',
        isPublic: true,
        createdAt: new Date('2025-11-13T15:30:00Z')
      },
      {
        userId: new mongoose.Types.ObjectId(users[1]._id),
        periodId: new mongoose.Types.ObjectId(periodId),
        sectionId: new mongoose.Types.ObjectId('6915e741c4fbb4031641709c'),
        day: 4,
        checkinDate: new Date('2025-11-12'),
        readingTime: 30,
        completionRate: 95,
        note: '反复阅读了第四天的内容，对人生成长有了新的认识。这些原则不仅改变了我对成长的理解，也给了我实践的方向。',
        mood: 'thoughtful',
        isPublic: true,
        createdAt: new Date('2025-11-12T14:20:00Z')
      },
      {
        userId: new mongoose.Types.ObjectId(users[2]._id),
        periodId: new mongoose.Types.ObjectId(periodId),
        sectionId: new mongoose.Types.ObjectId('6915e741c4fbb4031641709b'),
        day: 3,
        checkinDate: new Date('2025-11-11'),
        readingTime: 28,
        completionRate: 92,
        note: '第三天以原则为中心的思维让我重新思考人生方向。原则不是束缚，而是自由的基础。',
        mood: 'calm',
        isPublic: true,
        createdAt: new Date('2025-11-11T10:15:00Z')
      },
      {
        userId: new mongoose.Types.ObjectId(users[3]._id),
        periodId: new mongoose.Types.ObjectId(periodId),
        sectionId: new mongoose.Types.ObjectId('6915e741c4fbb4031641709c'),
        day: 4,
        checkinDate: new Date('2025-11-10'),
        readingTime: 22,
        completionRate: 85,
        note: '今天的课程内容很有启发，特别是关于成长与改变的那部分，让我明白了坚持的真正意义。',
        mood: 'happy',
        isPublic: true,
        createdAt: new Date('2025-11-10T16:45:00Z')
      }
    ];

    console.log('开始创建打卡记录...');
    for (const checkin of checkins) {
      const result = await Checkin.create(checkin);
      const user = await User.findById(result.userId);
      console.log(`✓ ${user.nickname} - Day ${result.day} (${new Date(result.createdAt).toLocaleDateString()}): 创建成功`);
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
