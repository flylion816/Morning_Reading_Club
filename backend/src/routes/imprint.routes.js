const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const router = express.Router();
const { authMiddleware, optionalAuthMiddleware } = require('../middleware/auth');
const { adminAuthMiddleware } = require('../middleware/adminAuth');
const { userTenantContext, adminTenantContext, optionalUserOrPublicTenantContext } = require('../middleware/tenantContext');
const { getCurrentTenantId } = require('../utils/tenantContext');
const { resolveTenantSlug } = require('../utils/tenantSlug');
const { success, errors } = require('../utils/response');
const controller = require('../controllers/imprint.controller');
const activityTypeController = require('../controllers/imprintActivityType.controller');
const Enrollment = require('../models/Enrollment');

async function requirePaidEnrollment(req, res, next) {
  try {
    const userId = req.user._id || req.user.userId || req.user.id;
    const tenantId = getCurrentTenantId();
    const enrollment = await Enrollment.findOne({
      userId,
      tenantId,
      paymentStatus: { $in: ['paid', 'free'] },
      status: { $in: ['active', 'completed'] },
      deleted: { $ne: true }
    }).lean();
    if (!enrollment) {
      return res.status(403).json({ code: 403, message: '完成支付后可使用在场功能' });
    }
    next();
  } catch (err) {
    next(err);
  }
}

const uploadRoot = path.join(__dirname, '../../uploads');
const tenantsRoot = path.join(uploadRoot, 'tenants');
if (!fs.existsSync(tenantsRoot)) fs.mkdirSync(tenantsRoot, { recursive: true });

function ensureTenantDir(slug) {
  const dir = path.join(tenantsRoot, slug);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
}

const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    try {
      // 关键：使用 req._resolvedTenantId（在中间件中显式设置），防止 ALS 在异步回调中丢失
      const tenantId = req._resolvedTenantId;
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
  const imageExts = /jpeg|jpg|png|webp/;
  const videoExts = /mp4|mov|m4v/;
  const ext = path.extname(file.originalname).toLowerCase().replace('.', '');
  if (imageExts.test(ext) || videoExts.test(ext)) return cb(null, true);
  cb(new Error('仅支持 jpeg/jpg/png/webp/mp4/mov 格式'));
};

const upload = multer({ storage, fileFilter, limits: { fileSize: 50 * 1024 * 1024 } });

// 在 userTenantContext 后显式设置 req._resolvedTenantId，防止 multer 异步回调中 ALS 丢失
function setResolvedTenantId(req, res, next) {
  req._resolvedTenantId = getCurrentTenantId();
  next();
}

// 管理后台专用路由（在 router.use(authMiddleware) 之前注册，使用独立的 adminAuthMiddleware）
router.get('/admin/list', adminAuthMiddleware, adminTenantContext, controller.adminList);
router.put('/admin/:id', adminAuthMiddleware, adminTenantContext, controller.adminUpdate);
router.delete('/admin/:id', adminAuthMiddleware, adminTenantContext, controller.adminRemove);

// 管理后台图片/视频上传
router.post('/admin/upload', adminAuthMiddleware, adminTenantContext, (req, res, next) => {
  req._resolvedTenantId = getCurrentTenantId();
  next();
}, upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json(errors.badRequest('未收到文件'));
  const baseUrl = process.env.BASE_URL || '';
  const relativePath = req.file.path.replace(path.join(__dirname, '../../'), '');
  const fileUrl = `${baseUrl}/${relativePath}`;
  const videoExts = /mp4|mov|m4v/;
  const ext = path.extname(req.file.originalname).toLowerCase().replace('.', '');
  const fileType = videoExts.test(ext) ? 'video' : 'image';
  res.json(success({ url: fileUrl, thumbUrl: fileUrl, type: fileType }));
});

// 活动类型标签管理（管理后台）
router.get('/admin/activity-types', adminAuthMiddleware, adminTenantContext, activityTypeController.adminList);
router.post('/admin/activity-types', adminAuthMiddleware, adminTenantContext, activityTypeController.create);
router.put('/admin/activity-types/reorder', adminAuthMiddleware, adminTenantContext, activityTypeController.reorder);
router.put('/admin/activity-types/:id', adminAuthMiddleware, adminTenantContext, activityTypeController.update);
router.delete('/admin/activity-types/:id', adminAuthMiddleware, adminTenantContext, activityTypeController.remove);

// 活动类型标签（小程序拉取，必须在 /:id 之前注册，否则 activity-types 会被当成 id）
router.get('/activity-types', authMiddleware, userTenantContext, activityTypeController.list);

// 印记详情：可选认证，未登录可查看
router.get('/:id', optionalAuthMiddleware, optionalUserOrPublicTenantContext, controller.detail);

router.use(authMiddleware, userTenantContext, requirePaidEnrollment);

// 图片上传（必须在 /:id 路由之前注册）
router.post('/upload', setResolvedTenantId, upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json(errors.badRequest('未收到文件'));
  const baseUrl = process.env.BASE_URL || '';
  const relativePath = req.file.path.replace(path.join(__dirname, '../../'), '');
  const fileUrl = `${baseUrl}/${relativePath}`;
  const videoExts = /mp4|mov|m4v/;
  const ext = path.extname(req.file.originalname).toLowerCase().replace('.', '');
  const fileType = videoExts.test(ext) ? 'video' : 'image';
  res.json(success({ url: fileUrl, thumbUrl: fileUrl, type: fileType }));
});

router.get('/', controller.list);
router.post('/', controller.create);
router.put('/:id', controller.update);
router.delete('/:id', controller.remove);
router.post('/:id/attend', controller.attend);
router.delete('/:id/attend', controller.cancelAttend);
router.post('/:id/reactions', controller.react);
router.delete('/:id/reactions', controller.cancelReaction);
router.get('/:id/comments', controller.listComments);
router.post('/:id/comments', controller.createComment);
router.delete('/:id/comments/:cid', controller.deleteComment);

module.exports = router;
