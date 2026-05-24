const request = require('../utils/request');

const communityActivityService = {
  getList(params = {}) {
    return request.get('/community-activities', params);
  },

  getPopup() {
    return request.get('/community-activities/popup');
  },

  getDetail(activityId) {
    return request.get(`/community-activities/${activityId}`);
  },

  register(activityId, data = {}) {
    return request.post(`/community-activities/${activityId}/register`, data);
  },

  cancelRegister(activityId) {
    return request.request({
      url: `/community-activities/${activityId}/register`,
      method: 'DELETE'
    });
  },

  getMyActivities(params = {}) {
    return request.get('/community-activities/my', params);
  }
};

module.exports = communityActivityService;
