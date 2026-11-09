jest.mock('../../utils/storage', () => ({
  tenantStorage: {
    get: jest.fn()
  }
}));

const { tenantStorage } = require('../../utils/storage');
const {
  hasVerifiedSocialAccess,
  guardSocialPage
} = require('../../utils/social-access');

describe('social page access guard', () => {
  beforeEach(() => {
    jest.resetModules();
    global.wx = {
      switchTab: jest.fn(),
      reLaunch: jest.fn()
    };
    global.getApp = jest.fn(() => ({
      globalData: { canUsePaidFeatures: false }
    }));
    tenantStorage.get.mockReturnValue('token_1');
  });

  afterEach(() => {
    delete global.wx;
    delete global.getApp;
  });

  test('requires both a token and verified paid-feature access', () => {
    tenantStorage.get.mockReturnValue('token_1');
    expect(hasVerifiedSocialAccess()).toBe(false);

    global.getApp.mockReturnValue({
      globalData: { canUsePaidFeatures: true }
    });
    expect(hasVerifiedSocialAccess()).toBe(true);

    tenantStorage.get.mockReturnValue(null);
    expect(hasVerifiedSocialAccess()).toBe(false);
  });

  test('redirects an unverified visitor immediately to the home tab', () => {
    const page = { data: {}, setData: jest.fn() };

    expect(guardSocialPage(page)).toBe(false);
    expect(wx.switchTab).toHaveBeenCalledWith(
      expect.objectContaining({ url: '/pages/index/index' })
    );
    expect(wx.reLaunch).not.toHaveBeenCalled();
    expect(page.setData).not.toHaveBeenCalled();
  });

  test('unlocks the social page shell only after verification', () => {
    global.getApp.mockReturnValue({
      globalData: { canUsePaidFeatures: true }
    });
    const page = { data: {}, setData: jest.fn() };

    expect(guardSocialPage(page)).toBe(true);
    expect(page.setData).toHaveBeenCalledWith({ socialAccessGranted: true });
    expect(wx.switchTab).not.toHaveBeenCalled();
  });
});
