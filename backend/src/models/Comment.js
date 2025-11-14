const mongoose = require('mongoose');

const ReplySchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  content: {
    type: String,
    required: true,
    maxlength: 500
  },
  replyToUserId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
}, {
  _id: true,
  versionKey: false
});

const CommentSchema = new mongoose.Schema({
  checkinId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Checkin',
    required: true
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  content: {
    type: String,
    required: true,
    maxlength: 1000
  },
  replyCount: {
    type: Number,
    default: 0,
    min: 0
  },
  replies: {
    type: [ReplySchema],
    default: []
  }
}, {
  timestamps: true,
  versionKey: false
});

// 索引
CommentSchema.index({ checkinId: 1, createdAt: -1 });
CommentSchema.index({ userId: 1 });

module.exports = mongoose.model('Comment', CommentSchema);
