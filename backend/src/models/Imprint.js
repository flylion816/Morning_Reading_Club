const mongoose = require('mongoose');
const tenantPlugin = require('./plugins/tenantPlugin');

const AttendeeSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  name: { type: String, required: true },
  isRegistered: { type: Boolean, default: false },
  addedBy: { type: String, enum: ['author', 'self'], default: 'author' }
}, { _id: true, versionKey: false });

const MediaSchema = new mongoose.Schema({
  type: { type: String, enum: ['image', 'video'], default: 'image' },
  url: { type: String, required: true },
  thumbUrl: { type: String }
}, { _id: false, versionKey: false });

const ImprintSchema = new mongoose.Schema({
  tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', default: null, index: true },
  authorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  title: { type: String, required: true, maxlength: 30 },
  description: { type: String, maxlength: 200, default: '' },
  activityType: { type: String, required: true },
  location: { type: String, maxlength: 20, default: '' },
  mediaList: { type: [MediaSchema], default: [] },
  attendees: { type: [AttendeeSchema], default: [] },
  periodId: { type: mongoose.Schema.Types.ObjectId, ref: 'Period', default: null },
  happenedAt: { type: Date, default: Date.now },
  reactionCounts: {
    gonming: { type: Number, default: 0, min: 0 },
    ran: { type: Number, default: 0, min: 0 },
    xiangqu: { type: Number, default: 0, min: 0 }
  },
  commentCount: { type: Number, default: 0, min: 0 }
}, { timestamps: true, versionKey: false });

ImprintSchema.index({ tenantId: 1, happenedAt: -1 });
ImprintSchema.index({ tenantId: 1, activityType: 1, happenedAt: -1 });
ImprintSchema.index({ tenantId: 1, periodId: 1, happenedAt: -1 });
ImprintSchema.index({ authorId: 1 });

ImprintSchema.plugin(tenantPlugin);
module.exports = mongoose.model('Imprint', ImprintSchema);
