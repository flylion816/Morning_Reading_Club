const crypto = require('crypto');
const cron = require('node-cron');
const mongoose = require('mongoose');
const path = require('path');
const fs = require('fs');
const CompanionNote = require('../models/CompanionNote');
const logger = require('../utils/logger');
const { withSystemContext } = require('../utils/tenantContext');
const { resolveTenantSlug } = require('../utils/tenantSlug');

const fsp = fs.promises;
const uploadRoot = path.resolve(__dirname, '../../uploads');
const publicTenantsRoot = path.join(uploadRoot, 'tenants');
const privateTenantsRoot = path.join(uploadRoot, 'private', 'tenants');
const MAX_PDF_SIZE = 50 * 1024 * 1024;
const MAX_PAGE_SIZE = 1.5 * 1024 * 1024;
const MAX_PAGE_COUNT = 120;
const MAX_PAGES_SIZE = 60 * 1024 * 1024;
const ORPHAN_TTL_MS = 24 * 60 * 60 * 1000;

function isSafeFileToken(value) {
  return typeof value === 'string' && /^[a-f0-9]{32,96}$/i.test(value);
}

function assertWithin(root, candidate) {
  const relative = path.relative(root, candidate);
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error('无效的文件路径');
  }
  return candidate;
}

function randomFileName(extension) {
  return `${Date.now()}-${crypto.randomBytes(16).toString('hex')}${extension}`;
}

function validatePdfFile(file) {
  if (!file || !Buffer.isBuffer(file.buffer)) {
    throw Object.assign(new Error('缺少 PDF 文件'), { statusCode: 400 });
  }
  if (file.size > MAX_PDF_SIZE) {
    throw Object.assign(new Error('PDF 文件不能超过 50 MB'), { statusCode: 400 });
  }
  if (path.extname(file.originalname || '').toLowerCase() !== '.pdf') {
    throw Object.assign(new Error('只支持 PDF 文件'), { statusCode: 400 });
  }
  if (file.buffer.slice(0, 5).toString() !== '%PDF-') {
    throw Object.assign(new Error('文件不是有效的 PDF'), { statusCode: 400 });
  }
}

function validateCoverFile(file) {
  if (!file || !Buffer.isBuffer(file.buffer)) {
    throw Object.assign(new Error('缺少封面图片'), { statusCode: 400 });
  }
  if (file.size > MAX_PAGE_SIZE) {
    throw Object.assign(new Error('封面图片不能超过 1.5 MB'), { statusCode: 400 });
  }
  const header = file.buffer.slice(0, 3);
  if (header[0] !== 0xff || header[1] !== 0xd8 || header[2] !== 0xff) {
    throw Object.assign(new Error('封面必须是 JPEG 图片'), { statusCode: 400 });
  }
}

function validatePageFile(file) {
  if (!file || !Buffer.isBuffer(file.buffer)) {
    throw Object.assign(new Error('缺少页图'), { statusCode: 400 });
  }
  if (file.size > MAX_PAGE_SIZE) {
    throw Object.assign(new Error('页图不能超过 1.5 MB'), { statusCode: 400 });
  }
  const header = file.buffer.slice(0, 3);
  if (header[0] !== 0xff || header[1] !== 0xd8 || header[2] !== 0xff) {
    throw Object.assign(new Error('页图必须是 JPEG 图片'), { statusCode: 400 });
  }
}

async function tenantRoots(tenantId) {
  const slug = await resolveTenantSlug(tenantId);
  const privateRoot = assertWithin(privateTenantsRoot, path.join(privateTenantsRoot, slug));
  const publicRoot = assertWithin(publicTenantsRoot, path.join(publicTenantsRoot, slug));
  await fsp.mkdir(privateRoot, { recursive: true });
  await fsp.mkdir(publicRoot, { recursive: true });
  return { slug, privateRoot, publicRoot };
}

async function privateUploadDirectory(tenantId, fileToken, create = true) {
  if (!isSafeFileToken(fileToken)) {
    throw Object.assign(new Error('无效的文件令牌'), { statusCode: 400 });
  }
  const { slug, privateRoot } = await tenantRoots(tenantId);
  const noteRoot = assertWithin(privateRoot, path.join(privateRoot, 'companion-notes'));
  const directory = assertWithin(noteRoot, path.join(noteRoot, fileToken));
  if (create) await fsp.mkdir(directory, { recursive: true });
  return { slug, privateRoot, directory, relativeDir: `companion-notes/${fileToken}` };
}

async function storeUpload({ tenantId, pdf, cover }) {
  validatePdfFile(pdf);
  validateCoverFile(cover);

  const fileToken = crypto.randomBytes(24).toString('hex');
  const { slug, privateRoot, publicRoot } = await tenantRoots(tenantId);
  const noteRoot = assertWithin(privateRoot, path.join(privateRoot, 'companion-notes'));
  const directory = assertWithin(noteRoot, path.join(noteRoot, fileToken));
  await fsp.mkdir(directory, { recursive: true });
  let coverPath;
  try {
    await fsp.writeFile(path.join(directory, 'source.pdf'), pdf.buffer, { flag: 'wx' });
    await fsp.writeFile(
      path.join(directory, 'metadata.json'),
      JSON.stringify({ originalName: path.basename(pdf.originalname || 'companion-note.pdf').slice(0, 255) })
    );
    const coverName = randomFileName('.jpg');
    coverPath = assertWithin(publicRoot, path.join(publicRoot, coverName));
    await fsp.writeFile(coverPath, cover.buffer, { flag: 'wx' });

    return {
      fileToken,
      file: {
        dir: `companion-notes/${fileToken}`,
        originalName: path.basename(pdf.originalname || 'companion-note.pdf').slice(0, 255),
        size: pdf.size,
        pageCount: null,
        pagesReady: false,
        uploadedAt: new Date()
      },
      coverUrl: `/uploads/tenants/${slug}/${coverPath.split(path.sep).pop()}`
    };
  } catch (error) {
    await fsp.rm(directory, { recursive: true, force: true }).catch(() => {});
    if (coverPath) await fsp.unlink(coverPath).catch(() => {});
    throw error;
  }
}

async function listPageNos(directory) {
  let names = [];
  try {
    names = await fsp.readdir(path.join(directory, 'pages'));
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
    return [];
  }
  return names
    .filter(name => /^\d+\.jpg$/i.test(name))
    .map(name => Number(name.slice(0, -4)))
    .filter(number => number >= 1 && number <= MAX_PAGE_COUNT)
    .sort((left, right) => left - right);
}

async function storePage({ tenantId, fileToken, pageNo, page }) {
  validatePageFile(page);
  const parsedPageNo = Number(pageNo);
  if (!Number.isInteger(parsedPageNo) || parsedPageNo < 1 || parsedPageNo > MAX_PAGE_COUNT) {
    throw Object.assign(new Error('页码必须是 1–120 的整数'), { statusCode: 400 });
  }

  const { directory } = await privateUploadDirectory(tenantId, fileToken, false);
  const sourcePath = assertWithin(directory, path.join(directory, 'source.pdf'));
  try {
    await fsp.access(sourcePath, fs.constants.F_OK);
  } catch (_) {
    throw Object.assign(new Error('文件令牌不存在或已过期'), { statusCode: 404 });
  }

  const pagesDirectory = assertWithin(directory, path.join(directory, 'pages'));
  await fsp.mkdir(pagesDirectory, { recursive: true });
  const pagePath = assertWithin(pagesDirectory, path.join(pagesDirectory, `${parsedPageNo}.jpg`));

  let existingSize = 0;
  try {
    existingSize = (await fsp.stat(pagePath)).size;
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }

  let totalSize = 0;
  for (const existingPageNo of await listPageNos(directory)) {
    const existingPagePath = path.join(pagesDirectory, `${existingPageNo}.jpg`);
    try {
      totalSize += (await fsp.stat(existingPagePath)).size;
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }
  }
  totalSize = totalSize - existingSize + page.size;
  if (totalSize > MAX_PAGES_SIZE) {
    throw Object.assign(new Error('页图合计不能超过 60 MB'), { statusCode: 400 });
  }

  await fsp.writeFile(pagePath, page.buffer);
  return {
    pageNo: parsedPageNo,
    receivedPageNos: await listPageNos(directory),
    totalSize
  };
}

async function inspectUpload(tenantId, fileToken) {
  const { directory, relativeDir } = await privateUploadDirectory(tenantId, fileToken, false);
  const sourcePath = assertWithin(directory, path.join(directory, 'source.pdf'));
  const stat = await fsp.stat(sourcePath).catch(error => {
    if (error.code === 'ENOENT') {
      const notFound = new Error('文件令牌不存在或已过期');
      notFound.statusCode = 404;
      throw notFound;
    }
    throw error;
  });
  let originalName = 'companion-note.pdf';
  try {
    const metadata = JSON.parse(await fsp.readFile(path.join(directory, 'metadata.json'), 'utf8'));
    if (metadata.originalName) originalName = String(metadata.originalName).slice(0, 255);
  } catch (_) {
    // Older temporary uploads may not have metadata; keep a safe default.
  }
  const pageNos = await listPageNos(directory);
  return {
    directory,
    relativeDir,
    sourcePath,
    originalName,
    size: stat.size,
    pageNos,
    pagesReady: false
  };
}

async function removeUploadDirectory(tenantId, relativeDir) {
  if (!relativeDir || typeof relativeDir !== 'string') return;
  const { privateRoot } = await tenantRoots(tenantId);
  const candidate = assertWithin(privateRoot, path.resolve(privateRoot, relativeDir));
  if (!candidate.startsWith(`${privateRoot}${path.sep}`)) throw new Error('无效的文件路径');
  await fsp.rm(candidate, { recursive: true, force: true });
}

async function resolvePdfPath(tenantId, relativeDir) {
  const { privateRoot } = await tenantRoots(tenantId);
  const directory = assertWithin(privateRoot, path.resolve(privateRoot, relativeDir));
  if (!directory.startsWith(`${privateRoot}${path.sep}`)) throw new Error('无效的文件路径');
  const pdfPath = assertWithin(directory, path.join(directory, 'source.pdf'));
  await fsp.access(pdfPath, fs.constants.R_OK);
  return pdfPath;
}

function getFileSecret() {
  const secret = process.env.COMPANION_FILE_SECRET;
  if (!secret || secret.length < 32) {
    const error = new Error('COMPANION_FILE_SECRET 未配置');
    error.statusCode = 503;
    throw error;
  }
  return secret;
}

function encodeTicket({ noteId, userId, tenantId, exp }) {
  const payload = Buffer.from(JSON.stringify({ noteId, userId, tenantId, kind: 'pdf', exp })).toString('base64url');
  const signature = crypto.createHmac('sha256', getFileSecret()).update(payload).digest('base64url');
  return `${payload}.${signature}`;
}

function decodeTicket(token) {
  if (typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [payloadPart, signaturePart] = parts;
  if (!payloadPart || !signaturePart || signaturePart.length !== 43) return null;
  let expected;
  try {
    expected = crypto.createHmac('sha256', getFileSecret()).update(payloadPart).digest('base64url');
  } catch (_) {
    return null;
  }
  const providedBuffer = Buffer.from(signaturePart);
  const expectedBuffer = Buffer.from(expected);
  if (providedBuffer.length !== expectedBuffer.length || !crypto.timingSafeEqual(providedBuffer, expectedBuffer)) {
    return null;
  }

  try {
    const payload = JSON.parse(Buffer.from(payloadPart, 'base64url').toString('utf8'));
    if (
      payload.kind !== 'pdf' ||
      !mongoose.Types.ObjectId.isValid(payload.noteId) ||
      !payload.noteId ||
      !mongoose.Types.ObjectId.isValid(payload.userId) ||
      !mongoose.Types.ObjectId.isValid(payload.tenantId) ||
      !Number.isFinite(Number(payload.exp)) ||
      Number(payload.exp) <= Math.floor(Date.now() / 1000)
    ) {
      return null;
    }
    return payload;
  } catch (_) {
    return null;
  }
}

async function cleanupOrphanUploads({ now = Date.now(), maxAgeMs = ORPHAN_TTL_MS } = {}) {
  const referencedDirs = await withSystemContext(null, async () => {
    const notes = await CompanionNote.find({}).select('file.dir').lean();
    return new Set(notes.map(note => note.file?.dir).filter(Boolean));
  });
  const removed = [];
  let tenantSlugs = [];
  try {
    tenantSlugs = await fsp.readdir(privateTenantsRoot);
  } catch (error) {
    if (error.code === 'ENOENT') return removed;
    throw error;
  }

  for (const slug of tenantSlugs) {
    const noteRoot = path.join(privateTenantsRoot, slug, 'companion-notes');
    let tokens = [];
    try {
      tokens = await fsp.readdir(noteRoot);
    } catch (error) {
      if (error.code === 'ENOENT') continue;
      throw error;
    }
    for (const token of tokens) {
      if (!isSafeFileToken(token)) continue;
      const relativeDir = `companion-notes/${token}`;
      if (referencedDirs.has(relativeDir)) continue;
      const candidate = assertWithin(noteRoot, path.join(noteRoot, token));
      const stat = await fsp.stat(candidate).catch(() => null);
      if (!stat || now - stat.mtimeMs < maxAgeMs) continue;
      await fsp.rm(candidate, { recursive: true, force: true });
      removed.push(`${slug}/${token}`);
    }
  }
  return removed;
}

let cleanupScheduleStarted = false;
function startCompanionNoteCleanup() {
  if (cleanupScheduleStarted) return;
  const instanceId = process.env.NODE_APP_INSTANCE;
  if (instanceId && instanceId !== '0') return;
  cleanupScheduleStarted = true;
  cron.schedule('30 3 * * *', async () => {
    try {
      const removed = await cleanupOrphanUploads();
      if (removed.length) logger.info('陪伴手札临时目录清理完成', { count: removed.length });
    } catch (error) {
      logger.error('陪伴手札临时目录清理失败', { message: error.message });
    }
  }, { timezone: 'Asia/Shanghai' });
}

module.exports = {
  MAX_PDF_SIZE,
  MAX_PAGE_SIZE,
  MAX_PAGE_COUNT,
  MAX_PAGES_SIZE,
  ORPHAN_TTL_MS,
  isSafeFileToken,
  validatePdfFile,
  validateCoverFile,
  validatePageFile,
  storeUpload,
  storePage,
  inspectUpload,
  listPageNos,
  removeUploadDirectory,
  resolvePdfPath,
  encodeTicket,
  decodeTicket,
  cleanupOrphanUploads,
  startCompanionNoteCleanup,
  privateTenantsRoot,
  publicTenantsRoot
};
