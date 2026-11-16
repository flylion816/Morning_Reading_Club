const express = require('express');
const { authMiddleware } = require('../middleware/auth');
const { userTenantContext } = require('../middleware/tenantContext');
const controller = require('../controllers/joyNoteShare.controller');

const router = express.Router();
router.use((req, res, next) => {
  res.set('Cache-Control', 'private, no-store');
  next();
});
// 读分享也必须登录：没登录一律 401，小程序回到首页
router.use(authMiddleware, userTenantContext);
router.post('/', controller.createShare);
// 固定路径要放在 /:code 之前
router.get('/note/:noteId', controller.getShareStatus);
router.delete('/note/:noteId', controller.revokeShare);
router.post('/:code/qrcode', controller.createQrcode);
router.get('/:code', controller.resolveShare);

module.exports = router;
