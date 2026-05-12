require('dotenv').config({ path: __dirname + '/.env' });
const mongoose = require('mongoose');
const Checkin = require('./src/models/Checkin');

mongoose.connect(process.env.MONGODB_URI)
  .then(async () => {
    const checkin = await Checkin.findOne({ "likes.0": { $exists: true } })
      .populate('likes.userId', 'nickname avatar avatarUrl')
      .lean();
    if (checkin) console.log(JSON.stringify(checkin.likes, null, 2));
    else console.log("No likes found");
    process.exit(0);
  });
