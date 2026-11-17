const { expect } = require('chai');
const mongoose = require('mongoose');

const service = require('../../../src/services/companion-note-files.service');

describe('companion-note-files.service', () => {
  const noteId = new mongoose.Types.ObjectId().toString();
  const userId = new mongoose.Types.ObjectId().toString();
  const tenantId = new mongoose.Types.ObjectId().toString();

  beforeEach(() => {
    process.env.COMPANION_FILE_SECRET = 'test_companion_file_signing_secret_32_characters_only';
  });

  it('签发并校验绑定用户、租户和用途的十分钟令牌', () => {
    const token = service.encodeTicket({
      noteId,
      userId,
      tenantId,
      exp: Math.floor(Date.now() / 1000) + 600
    });
    const payload = service.decodeTicket(token);

    expect(payload).to.include({ noteId, userId, tenantId, kind: 'pdf' });
  });

  it('拒绝伪造、篡改和过期令牌', () => {
    const token = service.encodeTicket({
      noteId,
      userId,
      tenantId,
      exp: Math.floor(Date.now() / 1000) - 1
    });
    expect(service.decodeTicket(token)).to.equal(null);
    expect(service.decodeTicket(`${token}x`)).to.equal(null);

    const valid = service.encodeTicket({
      noteId,
      userId,
      tenantId,
      exp: Math.floor(Date.now() / 1000) + 600
    });
    const [body] = valid.split('.');
    const forged = `${Buffer.from(JSON.stringify({ noteId, userId: new mongoose.Types.ObjectId().toString(), tenantId, kind: 'pdf', exp: Math.floor(Date.now() / 1000) + 600 })).toString('base64url')}.${valid.split('.')[1]}`;
    expect(service.decodeTicket(forged)).to.equal(null);
    expect(service.decodeTicket(`${body}.${'a'.repeat(43)}`)).to.equal(null);
  });

  it('校验 PDF、封面和页图格式与大小', () => {
    const pdf = { originalname: 'note.pdf', size: 5, buffer: Buffer.from('%PDF-1.7') };
    const jpeg = { originalname: 'page.jpg', size: 5, buffer: Buffer.from([0xff, 0xd8, 0xff, 0x00]) };

    expect(() => service.validatePdfFile(pdf)).not.to.throw();
    expect(() => service.validateCoverFile(jpeg)).not.to.throw();
    expect(() => service.validatePageFile(jpeg)).not.to.throw();
    expect(() => service.validatePdfFile({ ...pdf, originalname: 'note.txt' })).to.throw('只支持 PDF 文件');
    expect(() => service.validatePdfFile({ ...pdf, buffer: Buffer.from('nope') })).to.throw('有效的 PDF');
    expect(() => service.validatePageFile({ ...jpeg, buffer: Buffer.from('png') })).to.throw('JPEG');
  });
});
