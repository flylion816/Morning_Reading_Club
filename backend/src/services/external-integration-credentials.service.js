const crypto = require('crypto');

function getEncryptionKey() {
  const value = process.env.EXTERNAL_API_KEY_ENCRYPTION_KEY;
  if (!value) throw new Error('EXTERNAL_API_KEY_ENCRYPTION_KEY is not configured');
  const key = Buffer.from(value, 'base64');
  if (key.length !== 32) throw new Error('EXTERNAL_API_KEY_ENCRYPTION_KEY must decode to 32 bytes');
  return key;
}

function encryptIntegrationSecret(secret) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', getEncryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(secret, 'utf8'), cipher.final()]);
  return `v1.${  iv.toString('base64url')  }.${  cipher.getAuthTag().toString('base64url')  }.${  encrypted.toString('base64url')}`;
}

function decryptIntegrationSecret(value) {
  const parts = String(value || '').split('.');
  if (parts.length !== 4 || parts[0] !== 'v1') throw new Error('Unsupported integration secret format');
  const decipher = crypto.createDecipheriv('aes-256-gcm', getEncryptionKey(), Buffer.from(parts[1], 'base64url'));
  decipher.setAuthTag(Buffer.from(parts[2], 'base64url'));
  return Buffer.concat([decipher.update(Buffer.from(parts[3], 'base64url')), decipher.final()]).toString('utf8');
}

module.exports = { encryptIntegrationSecret, decryptIntegrationSecret };
