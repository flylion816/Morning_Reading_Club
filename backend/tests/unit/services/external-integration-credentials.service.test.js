const { expect } = require('chai');
const credentials = require('../../../src/services/external-integration-credentials.service');

describe('External integration credential encryption', () => {
  const originalKey = process.env.EXTERNAL_API_KEY_ENCRYPTION_KEY;
  before(() => { process.env.EXTERNAL_API_KEY_ENCRYPTION_KEY = Buffer.alloc(32, 3).toString('base64'); });
  after(() => {
    if (originalKey === undefined) delete process.env.EXTERNAL_API_KEY_ENCRYPTION_KEY;
    else process.env.EXTERNAL_API_KEY_ENCRYPTION_KEY = originalKey;
  });

  it('round-trips an integration secret using authenticated encryption', () => {
    const encrypted = credentials.encryptIntegrationSecret('test-key-do-not-use-outside-tests');
    expect(encrypted).to.match(/^v1\./);
    expect(encrypted).not.to.include('test-key-do-not-use-outside-tests');
    expect(credentials.decryptIntegrationSecret(encrypted)).to.equal('test-key-do-not-use-outside-tests');
  });

  it('rejects a modified authentication tag', () => {
    const encrypted = credentials.encryptIntegrationSecret('another-test-key');
    const parts = encrypted.split('.');
    parts[2] = Buffer.from('invalid-tag').toString('base64url');
    expect(() => credentials.decryptIntegrationSecret(parts.join('.'))).to.throw();
  });

  it('rejects an absent or incorrectly sized wrapping key', () => {
    process.env.EXTERNAL_API_KEY_ENCRYPTION_KEY = Buffer.alloc(8, 1).toString('base64');
    expect(() => credentials.encryptIntegrationSecret('x')).to.throw(/32 bytes/);
    process.env.EXTERNAL_API_KEY_ENCRYPTION_KEY = Buffer.alloc(32, 3).toString('base64');
  });
});
