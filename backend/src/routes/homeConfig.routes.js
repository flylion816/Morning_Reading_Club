const express = require('express');
const router = express.Router();
const { adminAuthMiddleware } = require('../middleware/adminAuth');
const { publicTenantContext, adminTenantContext } = require('../middleware/tenantContext');
const {
  getPublicHomeConfig,
  getAdminHomeConfig,
  updateAdminHomeConfig
} = require('../controllers/homeConfig.controller');

router.get('/', publicTenantContext, getPublicHomeConfig);
router.get('/admin', adminAuthMiddleware, adminTenantContext, getAdminHomeConfig);
router.put('/admin', adminAuthMiddleware, adminTenantContext, updateAdminHomeConfig);

module.exports = router;
