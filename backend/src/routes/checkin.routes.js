const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const router = express.Router();
const { authMiddleware, optionalAuthMiddleware } = require('../middleware/auth');
const { userTenantContext, optionalUserOrPublicTenantContext } = require('../middleware/tenantContext');
const { getCurrentTenantId } = require('../utils/tenantContext');
const { resolveTenantSlug } = require('../utils/tenantSlug');
const { errors } = require('../utils/response');
const {
  createCheckin,
  getUserCheckins,
  getUserCheckinSummary,
  getPeriodCheckins,
  searchCheckins,
  searchMyCheckins,
  uploadCheckinImage,
  getCheckinDetail,
  updateCheckin,
  deleteCheckin,
  getCheckins,
  likeCheckin,
  unlikeCheckin
} = require('../controllers/checkin.controller');

const uploadRoot = path.join(__dirname, '../../uploads');
const tenantsRoot = path.join(uploadRoot, 'tenants');
if (!fs.existsSync(tenantsRoot)) fs.mkdirSync(tenantsRoot, { recursive: true });

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
}

const imageStorage = multer.diskStorage({
  destination: async (req, file, cb) => {
    try {
      const tenantId = req._resolvedTenantId || req.user?.tenantId || getCurrentTenantId();
      if (!tenantId) return cb(new Error('缺少租户上下文'));
      const slug = await resolveTenantSlug(tenantId);
      req._resolvedTenantId = tenantId;
      req._checkinUploadTenantSlug = slug;
      cb(null, ensureDir(path.join(tenantsRoot, slug, 'checkins')));
    } catch (error) {
      cb(error);
    }
  },
  filename: (req, file, cb) => {
    const random = crypto.randomBytes(16).toString('hex');
    const ext = path.extname(file.originalname || '').toLowerCase() || '.jpg';
    cb(null, `${Date.now()}-${random}${ext}`);
  }
});

const allowedImageExts = new Set(['.jpg', '.jpeg', '.png', '.gif', '.webp']);
const allowedImageMimes = new Set(['image/jpeg', 'image/png', 'image/gif', 'image/webp']);
const uploadCheckinImageFile = multer({
  storage: imageStorage,
  limits: {
    fileSize: 10 * 1024 * 1024
  },
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname || '').toLowerCase();
    if (allowedImageExts.has(ext) && allowedImageMimes.has(file.mimetype)) {
      cb(null, true);
      return;
    }

    cb(new Error('仅支持 jpg、png、gif、webp 图片'));
  }
});

function handleCheckinImageUploadError(err, req, res, next) {
  if (!err) return next();
  if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
    return res.status(400).json(errors.badRequest('图片大小不能超过10MB'));
  }
  return res.status(400).json(errors.badRequest(err.message || '图片上传失败'));
}

// 其余 checkin 路由都需要登录 + 租户上下文
router.post('/', authMiddleware, userTenantContext, createCheckin);
router.get('/', authMiddleware, userTenantContext, getCheckins);
router.post(
  '/images',
  authMiddleware,
  userTenantContext,
  uploadCheckinImageFile.single('file'),
  handleCheckinImageUploadError,
  uploadCheckinImage
);
router.get('/user/summary', authMiddleware, userTenantContext, getUserCheckinSummary);
router.get('/user/:userId/summary', authMiddleware, userTenantContext, getUserCheckinSummary);
router.get('/user/:userId?', authMiddleware, userTenantContext, getUserCheckins);
router.get('/search', authMiddleware, userTenantContext, searchCheckins);
router.get('/my/search', authMiddleware, userTenantContext, searchMyCheckins);
router.get('/period/:periodId', authMiddleware, userTenantContext, getPeriodCheckins);
router.post('/:checkinId/like', authMiddleware, userTenantContext, likeCheckin);
router.delete('/:checkinId/like', authMiddleware, userTenantContext, unlikeCheckin);
router.put('/:checkinId', authMiddleware, userTenantContext, updateCheckin);
router.delete('/:checkinId', authMiddleware, userTenantContext, deleteCheckin);

// 打卡详情：可选认证，未登录只能看公开打卡（放最后避免拦截具名路由）
router.get('/:checkinId', optionalAuthMiddleware, optionalUserOrPublicTenantContext, getCheckinDetail);

module.exports = router;
