/**
 * 慢递邮局服务：写给结营那天的自己的信
 */

const request = require('../utils/request');

module.exports = {
  getPeriodLetter(periodId) {
    return request.get(`/letters/period/${periodId}`, {}, { suppressError: true });
  },

  saveDraft(periodId, { content, stamp }) {
    return request.put(`/letters/period/${periodId}/draft`, { content, stamp });
  },

  seal(periodId) {
    return request.post(`/letters/period/${periodId}/seal`);
  },

  open(letterId) {
    return request.post(`/letters/${letterId}/open`);
  },

  reply(letterId, reply) {
    return request.post(`/letters/${letterId}/reply`, { reply });
  },

  getMine() {
    return request.get('/letters/mine');
  }
};
