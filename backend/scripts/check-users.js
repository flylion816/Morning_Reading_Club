const mongoose = require('mongoose');
mongoose.connect('mongodb://admin:admin123@localhost:27017/morning_reading?authSource=admin')
  .then(async () => {
    const User = mongoose.model('User', new mongoose.Schema({}, { strict: false }));
    const users = await User.find({}).limit(5);
    console.log('前5个用户的openid:');
    users.forEach(u => console.log(`- ${u.nickname}: ${u.openid}`));
    process.exit(0);
  });
