const express = require('express');

const router = express.Router();
const { authMiddleware } = require('../middleware/auth');
const { adminAuthMiddleware } = require('../middleware/adminAuth');
const { userTenantContext, adminTenantContext } = require('../middleware/tenantContext');
const {
  adminListLetters,
  adminDeleteLetter,
  getPeriodLetter,
  saveDraft,
  sealLetter,
  openLetter,
  replyLetter,
  getMyLetters
} = require('../controllers/letter.controller');

// 管理后台：在书友登录校验之前注册，用独立的管理员校验
router.get('/admin/list', adminAuthMiddleware, adminTenantContext, adminListLetters);
router.delete('/admin/:id', adminAuthMiddleware, adminTenantContext, adminDeleteLetter);

router.use(authMiddleware, userTenantContext);

router.get('/mine', getMyLetters);
router.get('/period/:periodId', getPeriodLetter);
router.put('/period/:periodId/draft', saveDraft);
router.post('/period/:periodId/seal', sealLetter);
router.post('/:id/open', openLetter);
router.post('/:id/reply', replyLetter);

module.exports = router;
