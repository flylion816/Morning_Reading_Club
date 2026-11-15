const request = require('../utils/request');

class BuddyService {
  getState(periodId) {
    return request.get(`/buddies/period/${periodId}`, {}, { suppressError: true });
  }

  getOverview(periodId) {
    return request.get(`/buddies/period/${periodId}/overview`, {}, { suppressError: true });
  }

  join(periodId) {
    return request.post(`/buddies/period/${periodId}/join`);
  }

  cancel(periodId) {
    return request.post(`/buddies/period/${periodId}/cancel`);
  }

  nudge(periodId, messageKey = 'together') {
    return request.post(`/buddies/period/${periodId}/nudge`, { messageKey });
  }

  leave(periodId) {
    return request.post(`/buddies/period/${periodId}/leave`);
  }

  // 两人今天都读完后击掌，每人每天一次
  highFive(periodId) {
    return request.post(`/buddies/period/${periodId}/highfive`);
  }

  // 送一句：只能选预设短句的 key
  gift(periodId, messageKey) {
    return request.post(`/buddies/period/${periodId}/gift`, { messageKey });
  }

  // 邀请：从本期学员里挑一位读伴
  getCandidates(periodId, q = '', page = 1) {
    return request.get(`/buddies/period/${periodId}/candidates`, { ...(q ? { q } : {}), page });
  }

  // 是否出现在别人的读伴邀请名单里（默认出现）
  setDiscoverable(discoverable) {
    return request.post('/buddies/settings', { discoverable: !!discoverable });
  }

  invite(periodId, targetUserId) {
    return request.post(`/buddies/period/${periodId}/invite`, { targetUserId });
  }

  respondInvite(periodId, inviteId, accept) {
    return request.post(`/buddies/period/${periodId}/invites/${inviteId}/respond`, { accept: !!accept });
  }

  cancelInvite(periodId, inviteId) {
    return request.post(`/buddies/period/${periodId}/invites/${inviteId}/cancel`);
  }

  // 读伴回应：对读伴的一篇打卡回一句预设短句
  react(periodId, checkinId, messageKey) {
    return request.post(`/buddies/period/${periodId}/react`, { checkinId, messageKey });
  }

  // 结营纪念：天数、击掌、对方送的第一句、续伴意愿
  getSouvenir(periodId) {
    return request.get(`/buddies/period/${periodId}/souvenir`, {}, { suppressError: true });
  }

  // 下一期还做读伴：双方都点了才生效
  rematch(periodId) {
    return request.post(`/buddies/period/${periodId}/rematch`);
  }
}

module.exports = new BuddyService();
