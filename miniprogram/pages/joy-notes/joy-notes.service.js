const request = require('../../utils/request');

const quiet = { suppressError: true };

module.exports = {
  getPeriods() {
    return request.get('/joy-notes/periods', {}, quiet);
  },
  getSections(periodId) {
    return request.get(`/joy-notes/periods/${encodeURIComponent(periodId)}/sections`, {}, quiet);
  },
  getMine(params) {
    return request.get('/joy-notes', params, quiet);
  },
  create(data) {
    return request.post('/joy-notes', data, quiet);
  },
  update(id, data) {
    return request.put(`/joy-notes/${encodeURIComponent(id)}`, data, quiet);
  },
  remove(id) {
    return request.delete(`/joy-notes/${encodeURIComponent(id)}`, {}, quiet);
  }
};
