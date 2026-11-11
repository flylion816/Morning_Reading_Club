const express = require('express');

const router = express.Router();
const { authMiddleware } = require('../middleware/auth');
const { userTenantContext } = require('../middleware/tenantContext');
const {
  getPeriodLetter,
  saveDraft,
  sealLetter,
  openLetter,
  replyLetter,
  getMyLetters
} = require('../controllers/letter.controller');

router.use(authMiddleware, userTenantContext);

router.get('/mine', getMyLetters);
router.get('/period/:periodId', getPeriodLetter);
router.put('/period/:periodId/draft', saveDraft);
router.post('/period/:periodId/seal', sealLetter);
router.post('/:id/open', openLetter);
router.post('/:id/reply', replyLetter);

module.exports = router;
