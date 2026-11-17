const express = require('express');
const {
  authMiddleware
} = require('../middleware/auth');
const { userTenantContext } = require('../middleware/tenantContext');
const { companionNoteCommentRateLimit } = require('../middleware/ratelimit');
const controller = require('../controllers/companion-note.controller');

const router = express.Router();

// PDF downloads are authorized by the user-bound ticket rather than an Authorization header.
router.get('/:id/file', controller.downloadFile);
router.use(authMiddleware, userTenantContext);

router.get('/', controller.getList);
router.get('/section/:sectionId', controller.getSectionNotes);
router.get('/period/:periodId/overview', controller.getPeriodOverview);
router.post('/:id/file-ticket', controller.issueFileTicket);
router.post('/:id/read', controller.markRead);
router.post('/:id/like', controller.likeNote);
router.delete('/:id/like', controller.unlikeNote);
router.get('/:id/comments', controller.listComments);
router.post('/:id/comments', companionNoteCommentRateLimit, controller.createComment);

router.post('/comments/:commentId/replies', companionNoteCommentRateLimit, controller.replyToComment);
router.delete('/comments/:commentId/replies/:replyId', controller.deleteReply);
router.delete('/comments/:commentId', controller.deleteComment);
router.post('/comments/:commentId/like', controller.likeComment);
router.delete('/comments/:commentId/like', controller.unlikeComment);
router.post('/comments/:commentId/replies/:replyId/like', controller.likeReply);
router.delete('/comments/:commentId/replies/:replyId/like', controller.unlikeReply);

router.get('/:id', controller.getDetail);

module.exports = router;
