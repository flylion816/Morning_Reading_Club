const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const router = express.Router();
const { authMiddleware } = require('../middleware/auth');
const { adminAuthMiddleware } = require('../middleware/adminAuth');
const { userTenantContext, adminTenantContext } = require('../middleware/tenantContext');
const { getCurrentTenantId } = require('../utils/tenantContext');
const { resolveTenantSlug } = require('../utils/tenantSlug');
const { success, errors } = require('../utils/response');
const {
  getCurrentUser,
  updateProfile,
  getUserById,
  getUserStats,
  getUserList,
  updateUser,
  deleteUser,
  bindPhone,
  getPhoneInfo
} = require('../controllers/user.controller');

const uploadRoot = path.join(__dirname, '../../uploads');
const tenantsRoot = path.join(uploadRoot, 'tenants');
if (!fs.existsSync(tenantsRoot)) fs.mkdirSync(tenantsRoot, { recursive: true });

function ensureTenantDir(slug) {
  const dir = path.join(tenantsRoot, slug);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
}

const avatarStorage = multer.diskStorage({
  destination: async (req, file, cb) => {
    try {
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
    const ext = path.extname(file.originalname).toLowerCase() || '.jpg';
    cb(null, `avatar-${Date.now()}-${random}${ext}`);
  }
});

const avatarFileFilter = (req, file, cb) => {
  if (/jpeg|jpg|png|webp/i.test(path.extname(file.originalname).toLowerCase().replace('.', ''))) {
    return cb(null, true);
  }
  cb(new Error('仅支持 jpeg/jpg/png/webp 格式'));
};

const avatarUpload = multer({ storage: avatarStorage, fileFilter: avatarFileFilter, limits: { fileSize: 5 * 1024 * 1024 } });

function setResolvedTenantId(req, res, next) {
  req._resolvedTenantId = getCurrentTenantId();
  next();
}

// 小程序用户路由：需要用户登录 + 用户租户上下文
router.get('/me', authMiddleware, userTenantContext, getCurrentUser);
router.put('/profile', authMiddleware, userTenantContext, updateProfile);

// 头像上传（用户可访问）
router.post('/avatar', authMiddleware, userTenantContext, setResolvedTenantId, avatarUpload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json(errors.badRequest('未收到文件'));
  const baseUrl = process.env.BASE_URL || '';
  const relativePath = req.file.path.replace(path.join(__dirname, '../../'), '');
  const avatarUrl = `${baseUrl}/${relativePath}`;
  res.json(success({ avatarUrl, url: avatarUrl }, '头像上传成功'));
});
router.post('/bindPhone', authMiddleware, userTenantContext, bindPhone);
router.get('/phone', authMiddleware, userTenantContext, getPhoneInfo);

// 在场人搜索：普通用户可用，只返回 nickname/avatar（必须在 /:userId 之前注册）
router.get('/search', authMiddleware, userTenantContext, async (req, res) => {
  const User = require('../models/User');
  const { success, errors } = require('../utils/response');
  try {
    const q = (req.query.search || req.query.keyword || '').trim();
    if (!q) return res.json(success({ list: [] }));
    const re = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    const users = await User.find({ nickname: re })
      .select('_id nickname avatarUrl')
      .limit(20)
      .lean();
    res.json(success({ list: users }));
  } catch (err) {
    res.status(500).json(errors.serverError());
  }
});

router.get('/:userId', authMiddleware, userTenantContext, getUserById);
router.get('/:userId/stats', authMiddleware, userTenantContext, getUserStats);

// 管理员用户搜索：按昵称或用户ID搜索，返回头像+昵称+ID（必须在 / 之前注册）
router.get('/admin/search', adminAuthMiddleware, adminTenantContext, async (req, res) => {
  const User = require('../models/User');
  const mongoose = require('mongoose');
  try {
    const q = (req.query.q || '').trim();
    if (!q) return res.json(success({ list: [] }));

    const conditions = [
      { nickname: new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i') }
    ];
    if (mongoose.Types.ObjectId.isValid(q)) {
      conditions.push({ _id: new mongoose.Types.ObjectId(q) });
    }

    const users = await User.find({ $or: conditions, status: { $ne: 'deleted' } })
      .select('_id nickname avatarUrl')
      .limit(20)
      .lean();
    res.json(success({ list: users }));
  } catch (err) {
    res.status(500).json(errors.serverError());
  }
});

/**
 * @route   GET /api/v1/users
 * @desc    获取用户列表（管理员）
 * @access  Admin
 */
router.get('/', adminAuthMiddleware, adminTenantContext, getUserList);

/**
 * @route   PUT /api/v1/users/:userId
 * @desc    更新用户信息（管理员）
 * @access  Admin
 */
router.put('/:userId', adminAuthMiddleware, adminTenantContext, updateUser);

/**
 * @route   DELETE /api/v1/users/:userId
 * @desc    删除用户（管理员）
 * @access  Admin
 */
router.delete('/:userId', adminAuthMiddleware, adminTenantContext, deleteUser);

module.exports = router;
