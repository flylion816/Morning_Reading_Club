jest.mock('../../utils/request', () => ({ get: jest.fn(), post: jest.fn() }));

describe('newcomer-lead.service', () => {
  let service;
  let request;

  beforeEach(() => {
    jest.resetModules();
    request = require('../../utils/request');
    request.get.mockReset();
    request.post.mockReset();
    service = require('../../services/newcomer-lead.service');
  });

  test('落地页：只有 view 为 true 才带 view=1；带上来源和分享人', () => {
    service.getLanding('i1', { view: true, src: 'daily_card' });
    expect(request.get).toHaveBeenLastCalledWith('/newcomer-leads/landing', { inviterId: 'i1', src: 'daily_card', view: 1 });
    service.getLanding('i1');
    expect(request.get).toHaveBeenLastCalledWith('/newcomer-leads/landing', { inviterId: 'i1' });
    service.getLanding('', { view: false, src: '' });
    expect(request.get).toHaveBeenLastCalledWith('/newcomer-leads/landing', {});
  });

  test('专属小程序码：带上当前是开发版、体验版还是正式版，取不到时按正式版', () => {
    wx.getAccountInfoSync = jest.fn(() => ({ miniProgram: { envVersion: 'trial' } }));
    service.createInviteQrcode('daily_card');
    expect(request.post).toHaveBeenLastCalledWith('/newcomer-leads/qrcode', { source: 'daily_card', envVersion: 'trial' });
    wx.getAccountInfoSync = jest.fn(() => { throw new Error('x'); });
    service.createInviteQrcode('daily_card');
    expect(request.post).toHaveBeenLastCalledWith('/newcomer-leads/qrcode', { source: 'daily_card', envVersion: 'release' });
    delete wx.getAccountInfoSync;
  });

  test('接待组统计走统计接口', () => {
    service.getStats(7);
    expect(request.get).toHaveBeenLastCalledWith('/mobile-admin/newcomer-leads/stats', { days: 7 });
  });
});
