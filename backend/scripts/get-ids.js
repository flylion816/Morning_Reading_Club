const mongoose = require('mongoose');

const uri = 'mongodb://admin:admin123@localhost:27017/morning_reading?authSource=admin';

mongoose.connect(uri).then(async () => {
  const userSchema = new mongoose.Schema({}, { strict: false });
  const User = mongoose.model('User', userSchema, 'users');
  const sectionSchema = new mongoose.Schema({}, { strict: false });
  const Section = mongoose.model('Section', sectionSchema, 'sections');
  const periodSchema = new mongoose.Schema({}, { strict: false });
  const Period = mongoose.model('Period', periodSchema, 'periods');

  const users = await User.find({}).limit(1);
  const sections = await Section.find({ day: { $in: [3, 4] } });
  const period = await Period.findOne({ name: '勇敢的心' });

  if (users.length > 0) {
    console.log('用户ID:', users[0]._id.toString());
    console.log('用户昵称:', users[0].nickname);
  }

  if (period) {
    console.log('期次ID:', period._id.toString());
  }

  sections.forEach(s => {
    console.log(`Day ${s.day}: ${s._id.toString()} - ${s.title}`);
  });

  process.exit(0);
}).catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
