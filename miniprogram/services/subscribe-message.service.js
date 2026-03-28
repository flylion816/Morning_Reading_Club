const request = require('../utils/request');

class SubscribeMessageService {
  getSettings() {
    return request.get('/notifications/subscriptions');
  }

  saveGrants(grants = []) {
    return request.post('/notifications/subscriptions/grants', { grants });
  }
}

module.exports = new SubscribeMessageService();
