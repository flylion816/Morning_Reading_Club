const request = require('../utils/request');

class ImprintService {
  list(params) {
    return request.get('/imprints', params);
  }

  create(data) {
    return request.post('/imprints', data);
  }

  detail(id) {
    return request.get(`/imprints/${id}`);
  }

  update(id, data) {
    return request.put(`/imprints/${id}`, data);
  }

  remove(id) {
    return request.delete(`/imprints/${id}`);
  }

  attend(id) {
    return request.post(`/imprints/${id}/attend`);
  }

  cancelAttend(id) {
    return request.delete(`/imprints/${id}/attend`);
  }

  react(id, type) {
    return request.post(`/imprints/${id}/reactions`, { type });
  }

  cancelReaction(id) {
    return request.delete(`/imprints/${id}/reactions`);
  }

  listComments(id, params) {
    return request.get(`/imprints/${id}/comments`, params);
  }

  createComment(id, data) {
    return request.post(`/imprints/${id}/comments`, data);
  }

  getActivityTypes() {
    return request.get('/imprints/activity-types');
  }

  deleteComment(id, cid) {
    return request.delete(`/imprints/${id}/comments/${cid}`);
  }
}

module.exports = new ImprintService();
