const request = require('../utils/request');

class PresenceService {
  // 上报“我正在读这一课”，失败静默，不影响阅读
  async reportReading(sectionId) {
    try {
      return await request.post('/presence/reading', { sectionId }, { suppressError: true, suppressAuthError: true });
    } catch (e) {
      return null;
    }
  }

  getToday(periodId) {
    return request.get('/presence/today', { periodId }, { suppressError: true });
  }

  getMyRank(sectionId, type) {
    return request.get('/presence/my-rank', { sectionId, type }, { suppressError: true });
  }

  getPeriodOrigins(periodId) {
    return request.get(`/presence/period/${periodId}/origins`, {}, { suppressError: true });
  }
}

module.exports = new PresenceService();
