const express = require('express');

const router = express.Router();
const { authMiddleware } = require('../middleware/auth');
const { userTenantContext } = require('../middleware/tenantContext');
const {
  createHighlight,
  updateHighlightNote,
  deleteHighlight,
  getMyHighlights,
  getSectionPopular
} = require('../controllers/highlight.controller');

router.post('/', authMiddleware, userTenantContext, createHighlight);
router.get('/mine', authMiddleware, userTenantContext, getMyHighlights);
router.get('/section/:sectionId/popular', authMiddleware, userTenantContext, getSectionPopular);
router.put('/:id', authMiddleware, userTenantContext, updateHighlightNote);
router.delete('/:id', authMiddleware, userTenantContext, deleteHighlight);

module.exports = router;
