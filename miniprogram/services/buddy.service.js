const request = require('../utils/request');

class BuddyService {
  getState(periodId) {
    return request.get(`/buddies/period/${periodId}`, {}, { suppressError: true });
  }

  join(periodId) {
    return request.post(`/buddies/period/${periodId}/join`);
  }

  cancel(periodId) {
    return request.post(`/buddies/period/${periodId}/cancel`);
  }

  nudge(periodId) {
    return request.post(`/buddies/period/${periodId}/nudge`);
  }

  leave(periodId) {
    return request.post(`/buddies/period/${periodId}/leave`);
  }
}

module.exports = new BuddyService();
