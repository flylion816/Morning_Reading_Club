const mongoose = require('mongoose');

const adminSessionSchema = new mongoose.Schema(
  {
    sessionId: { type: String, required: true, unique: true },
    adminId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Admin',
      required: true,
      index: true
    },
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tenant',
      default: null,
      index: true
    },
    sessionVersion: { type: Number, required: true },
    // Only a one-way digest of the current refresh-token jti is stored.
    refreshJtiHash: { type: String, required: true, select: false },
    expiresAt: { type: Date, required: true },
    revokedAt: { type: Date, default: null },
    lastUsedAt: { type: Date, default: Date.now }
  },
  { timestamps: true, versionKey: false, collection: 'admin_sessions' }
);

adminSessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
adminSessionSchema.index({ adminId: 1, revokedAt: 1, expiresAt: 1 });

module.exports = mongoose.model('AdminSession', adminSessionSchema);
