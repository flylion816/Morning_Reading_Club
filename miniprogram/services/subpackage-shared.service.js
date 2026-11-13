const commentService = require('./comment.service');
const seenCardService = require('./seen-card.service');
const highlightService = require('./highlight.service');
const { normalizeDanmakuContent } = require('../utils/danmaku');
const { requireLogin } = require('../utils/require-login');
const { SEEN_PHRASES, getSeenPhraseText } = require('../utils/seen-phrases');
const { createContainedShareCover } = require('../utils/share-cover');
const { hashText } = require('../utils/text-hash');

module.exports = {
  commentService,
  seenCardService,
  highlightService,
  normalizeDanmakuContent,
  requireLogin,
  SEEN_PHRASES,
  getSeenPhraseText,
  createContainedShareCover,
  hashText
};
