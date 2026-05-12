const mongoose = require('mongoose');
const Checkin = require('./backend/src/models/Checkin');

async function test() {
  await mongoose.connect('mongodb://localhost:27017/morning_reading', {
    useNewUrlParser: true,
    useUnifiedTopology: true
  });
  const checkin = await Checkin.findOne({ likes: { $exists: true, $not: {$size: 0} } }).populate('likes.userId', 'nickname avatar avatarUrl');
  console.log(JSON.stringify(checkin.likes, null, 2));
  process.exit(0);
}
test();
