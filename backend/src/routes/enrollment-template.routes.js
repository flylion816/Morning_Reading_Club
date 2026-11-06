const express = require('express');
const { adminAuthMiddleware } = require('../middleware/adminAuth');
const { adminTenantContext } = require('../middleware/tenantContext');
const controller = require('../controllers/enrollment-template.controller');

const router = express.Router();
router.use(adminAuthMiddleware, adminTenantContext, (req, res, next) => {
  if (!req.resolvedTenantId) return res.status(403).json({ code: 403, message: '请先选择具体租户' });
  next();
});

router.get('/', controller.listEnrollmentTemplates);
router.post('/', controller.createEnrollmentTemplate);
router.get('/:id/preview', controller.previewEnrollmentTemplate);
router.post('/:id/copy', controller.copyEnrollmentTemplate);
router.put('/:id', controller.updateEnrollmentTemplate);
router.get('/:id', controller.getEnrollmentTemplate);

module.exports = router;
