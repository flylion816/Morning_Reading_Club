/**
 * 新书友线索：落地页、留言、接待组跟进
 */
const request = require('../utils/request');

class NewcomerLeadService {
  // 访客也能调用；已登录时额外返回自己的线索和是否已在营里
  // view: 1 表示这是第一次打开（计一次访问）；src 是来源，用来统计
  getLanding(inviterId, { view = false, src = '' } = {}) {
    return request.get('/newcomer-leads/landing', {
      ...(inviterId ? { inviterId } : {}),
      ...(src ? { src } : {}),
      ...(view ? { view: 1 } : {})
    });
  }

  getMine() {
    return request.get('/newcomer-leads/mine');
  }

  submit(payload) {
    return request.post('/newcomer-leads', payload);
  }

  // 分享人专属小程序码，返回 { imageBase64, contentType }
  // 把当前是开发版、体验版还是正式版带上：页面还没发布正式版时，体验版也能生成专属码
  createInviteQrcode(source) {
    let envVersion = 'release';
    try {
      const info = typeof wx.getAccountInfoSync === 'function' ? wx.getAccountInfoSync() : null;
      envVersion = (info && info.miniProgram && info.miniProgram.envVersion) || 'release';
    } catch (error) {
      envVersion = 'release';
    }
    return request.post('/newcomer-leads/qrcode', { source, envVersion });
  }

  // 接待组：落地页访问、留言和转化
  getStats(days = 30) {
    return request.get('/mobile-admin/newcomer-leads/stats', { days });
  }

  // ---- 接待组 ----
  listLeads(params = {}) {
    return request.get('/mobile-admin/newcomer-leads', params);
  }

  getLeadDetail(leadId) {
    return request.get(`/mobile-admin/newcomer-leads/${leadId}`);
  }

  claimLead(leadId) {
    return request.post(`/mobile-admin/newcomer-leads/${leadId}/claim`);
  }

  updateLeadStatus(leadId, status, note = '') {
    return request.patch(`/mobile-admin/newcomer-leads/${leadId}`, { status, note });
  }

  // 当前登录人是否在接待组（后台用户管理里配置），用来决定是否显示入口
  getAccess() {
    return request.get('/mobile-admin/newcomer-leads/access');
  }
}

module.exports = new NewcomerLeadService();
