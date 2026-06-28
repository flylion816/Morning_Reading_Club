const request = require('../utils/request');

class HomeConfigService {
  getConfig() {
    return request.get('/home-config', {}, {
      showLoading: false,
      suppressAuthError: true,
      suppressError: true
    });
  }
}

module.exports = new HomeConfigService();
