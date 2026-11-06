#!/usr/bin/env node

// One-time operator tool. This script was not executed while preparing local fixes.
const crypto = require('crypto');
const mongoose = require('mongoose');
const path = require('path');
const dotenv = require('dotenv');

const envPath = path.resolve(__dirname, '../.env.production');
dotenv.config({ path: envPath });

async function main() {
  const [tenantSlug, keyId, rawScopes, confirmation] = process.argv.slice(2);
  const allowedScopes = new Set(['roster:read', 'insight:write', 'podcast:write']);
  const scopes = String(rawScopes || '').split(',').filter(Boolean);
  if (confirmation !== '--write-one-key' || !tenantSlug || !/^[A-Za-z0-9_-]{3,80}$/.test(keyId || '') ||
      !scopes.length || scopes.some(scope => !allowedScopes.has(scope))) {
    throw new Error('Usage: NODE_ENV=production node backend/scripts/provision-external-integration-key.js <tenant-slug> <key-id> <roster:read,insight:write,podcast:write> --write-one-key');
  }
  if (!process.env.MONGODB_URI || !process.env.EXTERNAL_API_KEY_ENCRYPTION_KEY) {
    throw new Error('MONGODB_URI and EXTERNAL_API_KEY_ENCRYPTION_KEY must come from the approved secret store');
  }

  const { encryptIntegrationSecret } = require('../src/services/external-integration-credentials.service');
  const Tenant = require('../src/models/Tenant');
  const ExternalIntegrationKey = require('../src/models/ExternalIntegrationKey');
  await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 10000 });
  try {
    const tenant = await Tenant.findOne({ slug: tenantSlug, status: 'active' }).select('_id').lean().exec();
    if (!tenant) throw new Error('Active tenant not found');
    const secret = crypto.randomBytes(32).toString('base64url');
    await ExternalIntegrationKey.create({
      tenantId: tenant._id,
      keyId,
      encryptedSecret: encryptIntegrationSecret(secret),
      scopes,
      status: 'active'
    });
    // Intentionally emit the credential once. Do not redirect this output to a log.
    process.stdout.write(JSON.stringify({ keyId, tenantSlug, scopes, secret }) + '\n');
  } finally {
    await mongoose.disconnect();
  }
}

main().catch(error => {
  process.stderr.write(`External integration key provisioning failed: ${error.message}\n`);
  process.exitCode = 1;
});
