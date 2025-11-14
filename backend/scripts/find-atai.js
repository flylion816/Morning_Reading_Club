const mongoose = require('mongoose');
mongoose.connect('mongodb://admin:admin123@localhost:27017/morning_reading?authSource=admin')
  .then(async () => {
    const User = mongoose.model('User', new mongoose.Schema({}, { strict: false }));
    const users = await User.find({ openid: /atai/ });
    console.log(`找到 ${users.length} 个包含 atai 的用户:`);
    users.forEach(u => console.log(`- ${u.nickname} (${u._id}): ${u.openid}`));
    process.exit(0);
  });
