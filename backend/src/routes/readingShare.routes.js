const express = require('express');
const { authMiddleware, optionalAuthMiddleware } = require('../middleware/auth');
const { userTenantContext, optionalUserOrPublicTenantContext } = require('../middleware/tenantContext');
const controller = require('../controllers/readingShare.controller');

const router = express.Router();

// 扫码的人可能还没登录：解析短码是公开的；生成小程序码要登录
router.get('/:code', optionalAuthMiddleware, optionalUserOrPublicTenantContext, controller.resolveReadingShare);
router.post('/', authMiddleware, userTenantContext, controller.createReadingShare);

module.exports = router;
