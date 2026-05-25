const express = require('express');

const router = express.Router();
const {
  authMiddleware,
  optionalAuthMiddleware,
  adminMiddleware
} = require('../middleware/auth');
const { adminAuthMiddleware, optionalAdminAuthMiddleware } = require('../middleware/adminAuth');
const {
  userTenantContext,
  adminTenantContext,
  publicTenantContext,
  optionalUserOrPublicTenantContext,
  optionalAdminOrPublicTenantContext
} = require('../middleware/tenantContext');
const {
  getSectionsByPeriod,
  getSectionDetail,
  searchSections,
  markReadingCompletion,
  createSection,
  updateSection,
  deleteSection,
  getTodayTask,
  uploadPodcast,
  syncPodcast
} = require('../controllers/section.controller');

const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const multer = require('multer');
const { getCurrentTenantId } = require('../utils/tenantContext');
const { resolveTenantSlug } = require('../utils/tenantSlug');

const uploadRoot = path.join(__dirname, '../../uploads');
const tenantsRoot = path.join(uploadRoot, 'tenants');

function ensureTenantDir(slug) {
  const dir = path.join(tenantsRoot, slug);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
}

const podcastStorage = multer.diskStorage({
  destination: async (req, file, cb) => {
    try {
      const tenantId = getCurrentTenantId();
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

const podcastFileFilter = (req, file, cb) => {
  const allowedTypes = /m4a|mp3|aac|mp4|webm/;
  const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
  if (extname) return cb(null, true);
  cb(new Error('仅支持音频文件（m4a/mp3/aac）'));
};

const podcastUpload = multer({
  storage: podcastStorage,
  fileFilter: podcastFileFilter,
  limits: { fileSize: 200 * 1024 * 1024 }
});

/**
 * @route   GET /api/v1/sections/today/task
 * @desc    获取今日任务（根据当前日期动态计算）
 * @access  Protected
 */
router.get('/today/task', authMiddleware, userTenantContext, getTodayTask);

/**
 * @route   POST /api/v1/sections/external/upload-podcast
 * @desc    外部接口：上传播客音频文件
 * @access  Public (外部系统调用)
 */
router.post('/external/upload-podcast', publicTenantContext, podcastUpload.single('file'), uploadPodcast);

/**
 * @route   POST /api/v1/sections/external/sync-podcast
 * @desc    外部接口：同步播客信息到课节
 * @access  Public (外部系统调用)
 */
router.post('/external/sync-podcast', publicTenantContext, syncPodcast);

/**
 * @route   GET /api/v1/sections/period/:periodId
 * @desc    获取期次的课程列表
 * @access  Public / Optional Auth
 */
router.get('/period/:periodId', optionalAuthMiddleware, optionalAdminAuthMiddleware, optionalAdminOrPublicTenantContext, getSectionsByPeriod);

/**
 * @route   GET /api/v1/sections/search
 * @desc    搜索课节正文内容（读一读）
 * @access  Auth
 */
router.get('/search', authMiddleware, userTenantContext, searchSections);

/**
 * @route   POST /api/v1/sections/:sectionId/reading-completion
 * @desc    标记当前用户完成课节沉浸阅读
 * @access  Protected
 */
router.post('/:sectionId/reading-completion', authMiddleware, userTenantContext, markReadingCompletion);

/**
 * @route   GET /api/v1/sections/:sectionId
 * @desc    获取课程详情
 * @access  Public / Optional Auth
 */
router.get('/:sectionId', optionalAuthMiddleware, optionalAdminAuthMiddleware, optionalAdminOrPublicTenantContext, getSectionDetail);

/**
 * @route   POST /api/v1/sections
 * @desc    创建课程（管理员）
 * @access  Admin
 */
router.post('/', adminAuthMiddleware, adminTenantContext, createSection);

/**
 * @route   PUT /api/v1/sections/:sectionId
 * @desc    更新课程（管理员）
 * @access  Admin
 */
router.put('/:sectionId', adminAuthMiddleware, adminTenantContext, updateSection);

/**
 * @route   DELETE /api/v1/sections/:sectionId
 * @desc    删除课程（管理员）
 * @access  Admin
 */
router.delete('/:sectionId', adminAuthMiddleware, adminTenantContext, deleteSection);

module.exports = router;
