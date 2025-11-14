const mongoose = require('mongoose');
mongoose.connect('mongodb://admin:admin123@localhost:27017/morning_reading?authSource=admin')
  .then(async () => {
    const Checkin = mongoose.model('Checkin', new mongoose.Schema({}, { strict: false }));
    const User = mongoose.model('User', new mongoose.Schema({}, { strict: false }));

    const users = await User.find({}).limit(3);
    console.log('前3个用户:');
    users.forEach(u => console.log(`- ${u.nickname} (${u._id})`));

    const checkins = await Checkin.find({});
    console.log(`\n打卡记录总数: ${checkins.length}`);
    checkins.slice(0, 5).forEach(c => {
      console.log(`- UserID: ${c.userId}, Day ${c.day}, Date: ${c.checkinDate.toISOString().split('T')[0]}`);
    });

    process.exit(0);
  });
