const mongoose = require('mongoose');
const Section = require('../src/models/Section');

const MONGODB_URI = 'mongodb://admin:admin123@localhost:27017/morning_reading?authSource=admin';

async function updateSection() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('MongoDB连接成功');
    
    // 查找标题为"品德成功论"的课节
    const section = await Section.findOne({ title: '品德成功论' });
    
    if (section) {
      console.log('找到课节:');
      console.log('- ID:', section._id);
      console.log('- 当前标题:', section.title);
      console.log('- 当前副标题:', section.subtitle);
      
      // 更新标题和副标题
      section.title = '第四天 成长与改变的原则';
      section.subtitle = '勇敢的心 - 七个习惯晨读营至';
      await section.save();
      
      console.log('\n更新成功！');
      console.log('- 新标题:', section.title);
      console.log('- 新副标题:', section.subtitle);
    } else {
      console.log('未找到标题为"品德成功论"的课节');
      
      // 列出所有课节
      const allSections = await Section.find({}).sort({ day: 1 });
      console.log('\n所有课节:');
      allSections.forEach(s => {
        console.log(`- Day ${s.day}: ${s.title} (${s.subtitle})`);
      });
    }
    
    await mongoose.connection.close();
    console.log('\nMongoDB连接已关闭');
  } catch (error) {
    console.error('错误:', error);
    process.exit(1);
  }
}

updateSection();
