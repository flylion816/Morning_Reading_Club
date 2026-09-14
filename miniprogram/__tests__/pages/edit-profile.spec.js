jest.mock('../../services/user.service', () => ({
  updateUserProfile: jest.fn(),
  uploadAvatar: jest.fn()
}));
jest.mock('../../services/activity.service', () => ({
  track: jest.fn()
}));
jest.mock('../../utils/avatar', () => ({
  decorateUserAvatar: jest.fn(user => user),
  getUserAvatarDisplay: jest.fn(() => ({ avatarText: '用', avatarColor: '#168c91' }))
}));

describe('edit-profile page', () => {
  let pageConfig;
  let pageInstance;
  let userService;

  beforeEach(() => {
    jest.resetModules();
    pageConfig = null;
    global.Page = jest.fn(config => { pageConfig = config; return config; });
    global.getApp = jest.fn(() => ({ globalData: { userInfo: { _id: 'user-1', nickname: '旧昵称' } } }));
    userService = require('../../services/user.service');
    wx.showToast.mockClear();
    wx.navigateBack.mockClear();
    require('../../pages/edit-profile/edit-profile');
    pageInstance = {
      ...pageConfig,
      data: { ...pageConfig.data, originalNickname: '旧昵称', nickname: '重复昵称', avatar: '🦁', avatarUrl: '', signature: '', saving: false },
      setData(update) { this.data = { ...this.data, ...update }; }
    };
  });

  test('saving the unchanged nickname shows no-change feedback without calling the API', async () => {
    pageInstance.onLoad();
    pageInstance.data.nickname = '旧昵称';

    await pageInstance.handleSave();

    expect(userService.updateUserProfile).not.toHaveBeenCalled();
    expect(wx.showToast).toHaveBeenCalledWith(expect.objectContaining({
      title: '个人信息未修改，无需保存',
      icon: 'none'
    }));
  });

  test('duplicate nickname keeps editor open and asks user to change it', async () => {
    userService.updateUserProfile.mockRejectedValue({ code: 409, message: '该昵称已被使用，请修改后再保存' });

    await pageInstance.handleSave();

    expect(pageInstance.data.nicknameError).toBe('该昵称已被使用，请修改后再保存');
    expect(pageInstance.data.saving).toBe(false);
    expect(wx.navigateBack).not.toHaveBeenCalled();
  });
  test.each(['signature', 'avatarUrl'])('原昵称不变仍可保存 %s', async field => {
    jest.useFakeTimers();
    pageInstance.onLoad();
    pageInstance.data[field] = field === 'avatarUrl' ? 'https://example.com/new.png' : '新签名';
    userService.updateUserProfile.mockResolvedValue({ _id: 'user-1', nickname: '旧昵称' });
    await pageInstance.handleSave();
    expect(userService.updateUserProfile).toHaveBeenCalled();
    jest.clearAllTimers();
    jest.useRealTimers();
  });

});
