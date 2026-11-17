const mongoose = require('mongoose');
const tenantPlugin = require('./plugins/tenantPlugin');

const ReplySchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    content: { type: String, required: true, minlength: 1, maxlength: 500 },
    replyToUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    likes: {
      type: [{
        userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        createdAt: { type: Date, default: Date.now }
      }],
      default: []
    },
    likeCount: { type: Number, default: 0, min: 0 },
    hidden: { type: Boolean, default: false },
    createdAt: { type: Date, default: Date.now }
  },
  { _id: true, versionKey: false }
);

const CompanionNoteCommentSchema = new mongoose.Schema(
  {
    noteId: { type: mongoose.Schema.Types.ObjectId, ref: 'CompanionNote', required: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    content: { type: String, required: true, minlength: 1, maxlength: 500 },
    likes: {
      type: [{
        userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        createdAt: { type: Date, default: Date.now }
      }],
      default: []
    },
    likeCount: { type: Number, default: 0, min: 0 },
    replies: { type: [ReplySchema], default: [] },
    replyCount: { type: Number, default: 0, min: 0 },
    isPinned: { type: Boolean, default: false },
    pinnedAt: { type: Date, default: null },
    hidden: { type: Boolean, default: false },
    pageNo: { type: Number, default: null, min: 1, max: 120 },
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', default: null, index: true }
  },
  { timestamps: true, versionKey: false }
);

CompanionNoteCommentSchema.index({ noteId: 1, isPinned: -1, createdAt: -1 });
CompanionNoteCommentSchema.index({ userId: 1 });
CompanionNoteCommentSchema.index({ tenantId: 1, createdAt: -1 });

CompanionNoteCommentSchema.plugin(tenantPlugin);

module.exports = mongoose.model('CompanionNoteComment', CompanionNoteCommentSchema);
