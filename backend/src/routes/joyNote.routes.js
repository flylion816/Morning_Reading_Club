const express = require('express');
const { authMiddleware } = require('../middleware/auth');
const { userTenantContext } = require('../middleware/tenantContext');
const controller = require('../controllers/joyNote.controller');

const router = express.Router();
router.use((req, res, next) => {
  res.set('Cache-Control', 'private, no-store');
  next();
});
router.use(authMiddleware, userTenantContext);
router.get('/periods', controller.getPeriods);
router.get('/periods/:periodId/sections', controller.getSections);
router.get('/', controller.getMine);
router.post('/', controller.create);
router.put('/:id', controller.update);
router.delete('/:id', controller.remove);

module.exports = router;
