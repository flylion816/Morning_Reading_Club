const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const uploadController = require('../controllers/upload.controller');
const { adminAuthMiddleware } = require('../middleware/adminAuth');
const { adminTenantContext } = require('../middleware/tenantContext');
const { getCurrentTenantId } = require('../utils/tenantContext');
const { resolveTenantSlug } = require('../utils/tenantSlug');
const { errors } = require('../utils/response');

const router = express.Router();

const uploadRoot = path.join(__dirname, '../../uploads');
const tenantsRoot = path.join(uploadRoot, 'tenants');
if (!fs.existsSync(tenantsRoot)) fs.mkdirSync(tenantsRoot, { recursive: true });

function ensureTenantDir(slug) {
  const dir = path.join(tenantsRoot, slug);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
}

// multer 动态 destination：从 req 直接读租户 ID（避免 ALS 在异步文件写入时丢失上下文）
const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    try {
      const tenantId = req._resolvedTenantId || getCurrentTenantId();
      if (!tenantId) return cb(new Error('缺少租户上下文'));
      const slug = await resolveTenantSlug(tenantId);
      cb(null, ensureTenantDir(slug));
    } catch (err) {
      cb(err);
    }
  },
  filename: (req, file, cb) => {
    const random = crypto.randomBytes(16).toString('hex');
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `${Date.now()}-${random}${ext}`);
  }
});

const fileFilter = (req, file, cb) => {
  const allowedExts = /jpeg|jpg|png|gif|webp|pdf|doc|docx|xls|xlsx|mp4|webm|m4a|mp3|aac/;
  const extname = allowedExts.test(path.extname(file.originalname).toLowerCase());
  if (extname) return cb(null, true);
  cb(new Error('不支持的文件类型'));
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 200 * 1024 * 1024 }
});

function requireActiveTenantForUpload(req, res, next) {
  if (!getCurrentTenantId()) {
    return res.status(403).json(errors.forbidden('上传前必须选择具体租户（platform_superadmin 需设置 X-Active-Tenant）'));
  }
  next();
}

router.post(
  '/',
  adminAuthMiddleware,
  adminTenantContext,
  requireActiveTenantForUpload,
  upload.single('file'),
  uploadController.uploadFile
);

router.post(
  '/multiple',
  adminAuthMiddleware,
  adminTenantContext,
  requireActiveTenantForUpload,
  upload.array('files', 10),
  uploadController.uploadMultiple
);

router.delete(
  '/:filename',
  adminAuthMiddleware,
  adminTenantContext,
  requireActiveTenantForUpload,
  uploadController.deleteFile
);

module.exports = router;
