const express = require('express');
const multer = require('multer');
const { adminAuthMiddleware } = require('../middleware/adminAuth');
const { adminTenantContext } = require('../middleware/tenantContext');
const { adminUploadRateLimit } = require('../middleware/ratelimit');
const { getCurrentTenantId } = require('../utils/tenantContext');
const controller = require('../controllers/companion-note.controller');

const router = express.Router();
// defParamCharset: 'utf8'：Safari 发中文文件名时不带 RFC 5987 编码，
// busboy 默认按 latin1 解码会把「小程序的故事」变成乱码。
const memoryUpload = multer({
  storage: multer.memoryStorage(),
  defParamCharset: 'utf8',
  limits: {
    fileSize: 50 * 1024 * 1024,
    files: 2
  }
});
const pageUpload = multer({
  storage: multer.memoryStorage(),
  defParamCharset: 'utf8',
  limits: {
    fileSize: 1.5 * 1024 * 1024,
    files: 1
  }
});

function handleUpload(uploadMiddleware) {
  return (req, res, next) => uploadMiddleware(req, res, error => {
    if (!error) return next();
    if (error instanceof multer.MulterError && error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ code: 400, message: '文件超过大小限制' });
    }
    return next(error);
  });
}

function requireActiveTenantForUpload(req, res, next) {
  if (!req.resolvedTenantId && !getCurrentTenantId()) {
    return res.status(403).json({
      code: 403,
      message: '上传前必须选择具体租户（platform_superadmin 需设置 X-Active-Tenant）'
    });
  }
  return next();
}

router.use(adminAuthMiddleware, adminTenantContext);

router.post(
  '/files',
  requireActiveTenantForUpload,
  adminUploadRateLimit,
  handleUpload(memoryUpload.fields([
    { name: 'file', maxCount: 1 },
    { name: 'cover', maxCount: 1 }
  ])),
  controller.uploadFiles
);
router.post(
  '/files/:fileToken/pages',
  requireActiveTenantForUpload,
  adminUploadRateLimit,
  handleUpload(pageUpload.single('page')),
  controller.uploadPage
);

router.get('/', controller.listAdmin);
router.put('/sort', controller.sortAdminNotes);
router.post('/', controller.saveAdminNote);
router.patch('/comments/:commentId/replies/:replyId', controller.moderateReply);
router.patch('/comments/:commentId', controller.moderateComment);
router.delete('/comments/:commentId/replies/:replyId', controller.deleteAdminReply);
router.delete('/comments/:commentId', controller.deleteAdminComment);

router.get('/:id/preview', controller.previewAdminNote);
router.get('/:id/comments', controller.listAdminComments);
router.post('/:id/publish', controller.publishAdminNote);
router.post('/:id/unpublish', controller.unpublishAdminNote);
router.get('/:id', controller.getAdminDetail);
router.put('/:id', controller.saveAdminNote);
router.delete('/:id', controller.deleteAdminNote);

module.exports = router;
