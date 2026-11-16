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
// 固定路径要放在 /:id 之前
router.get('/revisits', controller.getRevisitCards);
router.get('/:id', controller.getOne);
router.put('/:id', controller.update);
router.delete('/:id', controller.remove);
router.post('/:id/follow-ups', controller.addFollowUp);
router.post('/:id/revisit/skip', controller.skipRevisit);

module.exports = router;
