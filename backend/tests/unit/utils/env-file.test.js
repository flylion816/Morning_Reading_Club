const { expect } = require('chai');
const dotenv = require('dotenv');
const { line, composeLine } = require('../../../../scripts/env-file');

describe('generated dotenv and Compose env lines', () => {
  it('round trips spaces, dollar signs, hashes and double quotes as dotenv data', () => {
    const original = 'my " quoted $password # literal';
    expect(dotenv.parse(line('MYSQL_PASSWORD', original)).MYSQL_PASSWORD).to.equal(original);
  });

  it('rejects characters that the dotenv parser cannot represent exactly', () => {
    expect(() => line('MYSQL_PASSWORD', "single'quote-secret")).to.throw(/MYSQL_PASSWORD/);
    expect(() => line('JWT_SECRET', 'back\\slash-secret')).to.throw(/JWT_SECRET/);
    expect(() => line('REDIS_PASSWORD', 'line\nbreak')).to.throw(/REDIS_PASSWORD/);
  });

  it('rejects Compose-interpolated dollar values instead of writing a mismatched credential', () => {
    expect(() => composeLine('MONGO_PASSWORD', 'literal-$-password-2026')).to.throw(/MONGO_PASSWORD/);
    expect(composeLine('MONGO_PASSWORD', 'url-safe-strong-password-2026')).to.equal("MONGO_PASSWORD='url-safe-strong-password-2026'");
  });
});
