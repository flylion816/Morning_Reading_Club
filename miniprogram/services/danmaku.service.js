const request = require('../utils/request');

const danmakuService = {
  getDanmaku(insightId) {
    return request.get(`/insights/${insightId}/danmaku`);
  },

  postDanmaku(insightId, { content, type = 'comment', scrollPercent = 0, color = '#4a90e2' }) {
    return request.post(`/insights/${insightId}/danmaku`, {
      content,
      type,
      scrollPercent,
      color
    });
  }
};

module.exports = danmakuService;
