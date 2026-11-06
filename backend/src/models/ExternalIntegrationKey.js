const mongoose = require('mongoose');

const externalIntegrationKeySchema = new mongoose.Schema({
  tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true },
  keyId: { type: String, required: true, trim: true },
  encryptedSecret: { type: String, required: true, select: false },
  scopes: { type: [String], required: true },
  status: { type: String, enum: ['active', 'revoked'], default: 'active', index: true },
  expiresAt: { type: Date, default: null },
  lastUsedAt: { type: Date, default: null },
  createdAt: { type: Date, default: Date.now },
  revokedAt: { type: Date, default: null }
}, { versionKey: false, collection: 'external_integration_keys' });

externalIntegrationKeySchema.index({ tenantId: 1, keyId: 1 }, { unique: true });
externalIntegrationKeySchema.index({ tenantId: 1, status: 1, scopes: 1 });

module.exports = mongoose.model('ExternalIntegrationKey', externalIntegrationKeySchema);
