const mongoose = require('mongoose');
const tenantPlugin = require('./plugins/tenantPlugin');

const UserReadingCompletionSchema = new mongoose.Schema(
  {
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tenant',
      required: true,
      index: true
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    periodId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Period',
      required: true
    },
    sectionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Section',
      required: true
    },
    durationMs: {
      type: Number,
      default: 0,
      min: 0
    },
    completedAt: {
      type: Date,
      default: Date.now
    }
  },
  {
    timestamps: true,
    versionKey: false
  }
);

UserReadingCompletionSchema.index(
  { tenantId: 1, userId: 1, sectionId: 1 },
  { unique: true }
);
UserReadingCompletionSchema.index({ userId: 1, periodId: 1 });
UserReadingCompletionSchema.index({ sectionId: 1 });
UserReadingCompletionSchema.plugin(tenantPlugin);

module.exports = mongoose.model(
  'UserReadingCompletion',
  UserReadingCompletionSchema
);
