/**
 * 摘抄本服务
 */

const request = require('../utils/request');

class HighlightService {
  /** 摘下一段原文，重复摘同一段会返回已有那条 */
  addHighlight(sectionId, text, note = '') {
    return request.post('/highlights', { sectionId, text, note });
  }

  /** 只能改自己的感想 */
  updateNote(id, note) {
    return request.put(`/highlights/${id}`, { note });
  }

  removeHighlight(id) {
    return request.delete(`/highlights/${id}`);
  }

  /** 我的摘抄：{ list, total, periods } */
  getMine(params = {}) {
    return request.get('/highlights/mine', params);
  }

  /** 某课里被多位书友摘过的段落：{ popular: [{ textHash, count }], mine: [textHash] } */
  getSectionPopular(sectionId) {
    return request.get(`/highlights/section/${sectionId}/popular`, {}, { suppressError: true });
  }
}

module.exports = new HighlightService();
