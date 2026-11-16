/**
 * 觉察日记（原随喜记）接口：随喜速记、觉察记录、后来、回访卡片。
 * 放在主包：首页和阅读页的速记条（components/quick-note）都要用，分包可以引用主包，反过来不行。
 */
const request = require('../utils/request');

const quiet = { suppressError: true };

module.exports = {
  getPeriods() {
    return request.get('/joy-notes/periods', {}, quiet);
  },
  getSections(periodId) {
    return request.get(`/joy-notes/periods/${encodeURIComponent(periodId)}/sections`, {}, quiet);
  },
  // params: page, limit, periodId, q, kind（joy / awareness / 空为全部）
  getMine(params) {
    return request.get('/joy-notes', params, quiet);
  },
  getOne(id) {
    return request.get(`/joy-notes/${encodeURIComponent(id)}`, {}, quiet);
  },
  create(data) {
    return request.post('/joy-notes', data, quiet);
  },
  update(id, data) {
    return request.put(`/joy-notes/${encodeURIComponent(id)}`, data, quiet);
  },
  remove(id) {
    return request.delete(`/joy-notes/${encodeURIComponent(id)}`, {}, quiet);
  },
  // 觉察：追加一句「后来」
  addFollowUp(id, content) {
    return request.post(`/joy-notes/${encodeURIComponent(id)}/follow-ups`, { content }, quiet);
  },
  // 来信里点「先不写」：这条觉察不再回访
  skipRevisit(id) {
    return request.post(`/joy-notes/${encodeURIComponent(id)}/revisit/skip`, {}, quiet);
  },
  // 来信页一次读取最多 10 张回访卡片（只含「择」和状态）
  getRevisitCards(ids) {
    return request.get('/joy-notes/revisits', { ids: (ids || []).join(',') }, quiet);
  }
};
