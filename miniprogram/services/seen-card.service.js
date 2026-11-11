/**
 * 看见卡服务
 * 对一篇打卡送一句预设短句；一人对同一篇打卡只有一张。
 */

const request = require('../utils/request');

function sendSeen(checkinId, phrase) {
  return request.put(`/seen-cards/checkin/${checkinId}`, { phrase });
}

function withdrawSeen(checkinId) {
  return request.delete(`/seen-cards/checkin/${checkinId}`);
}

function getCheckinSeen(checkinId) {
  return request.get(`/seen-cards/checkin/${checkinId}`, {}, { suppressError: true });
}

function getSummary(checkinIds = []) {
  return request.post('/seen-cards/checkins/summary', { checkinIds }, { suppressError: true });
}

function getReceived(params = {}) {
  return request.get('/seen-cards/received', params);
}

module.exports = { sendSeen, withdrawSeen, getCheckinSeen, getSummary, getReceived };
