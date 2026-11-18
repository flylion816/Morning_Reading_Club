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

  it('storeUpload 同时返回私有目录和公开封面根，封面写入 publicRoot 而不是 undefined', async function () {
    // CI 的 Mongo Memory Server 启动/建租户偶发超时，给足余量
    this.timeout(30000);
    const fs = require('fs');
    const os = require('os');
    const path = require('path');
    const TenantModel = require('../../../src/models/Tenant');

    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'companion-upload-'));
    const originalJoin = path.join;
    // 把服务的上传根重定向到临时目录：拦截 resolve 即可覆盖 uploadRoot 派生路径
    const servicePath = require.resolve('../../../src/services/companion-note-files.service');
    delete require.cache[servicePath];
    const { withSystemContext } = require('../../../src/utils/tenantContext');
    const tenantContext = require('../../../src/utils/tenantContext');
    const originalWithSystemContext = tenantContext.withSystemContext;
    tenantContext.withSystemContext = (_ctx, fn) => fn();

    const slug = `upload-test-${Date.now()}`;
    await TenantModel.create({ name: slug, slug, code: slug, status: 'active' });
    try {
      const svc = require('../../../src/services/companion-note-files.service');
      // 通过环境定位上传根：直接改模块内常量不可行，用 chdir 也不合适；
      // 这里用进程级 monkey patch 不优雅，改为验证相对结构而非绝对路径。
      const result = await svc.storeUpload({
        tenantId: (await TenantModel.findOne({ slug }))._id.toString(),
        pdf: { originalname: 'note.pdf', size: 8, buffer: Buffer.from('%PDF-1.7') },
        cover: { originalname: 'cover.jpg', size: 4, buffer: Buffer.from([0xff, 0xd8, 0xff, 0x00]) }
      });
      expect(result.fileToken).to.match(/^[0-9a-f]{48}$/);
      expect(result.file.dir).to.equal(`companion-notes/${result.fileToken}`);
      expect(result.coverUrl).to.match(new RegExp(`^/uploads/tenants/${slug}/[0-9a-zA-Z_-]+\\.jpg$`));
      expect(fs.existsSync(path.join('uploads', 'private', 'tenants', slug, result.file.dir, 'source.pdf'))).to.equal(true);
      expect(fs.existsSync(path.join('uploads', 'tenants', slug, path.basename(result.coverUrl)))).to.equal(true);
    } finally {
      tenantContext.withSystemContext = originalWithSystemContext;
      delete require.cache[servicePath];
      fs.rmSync(tmp, { recursive: true, force: true });
      fs.rmSync(path.join('uploads', 'private', 'tenants', slug), { recursive: true, force: true });
      fs.rmSync(path.join('uploads', 'tenants', slug), { recursive: true, force: true });
    }
  });
});
