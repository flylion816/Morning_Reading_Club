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
    pageInstance.data.nickname = '旧昵称';

    await pageInstance.handleSave();

    expect(userService.updateUserProfile).not.toHaveBeenCalled();
    expect(wx.showToast).toHaveBeenCalledWith(expect.objectContaining({
      title: '当前昵称未发生变化',
      icon: 'none'
    }));
  });

  test('duplicate nickname keeps editor open and asks user to change it', async () => {
    userService.updateUserProfile.mockRejectedValue({ code: 409, message: '该昵称已被使用，请修改后再保存' });

    await pageInstance.handleSave();

    expect(wx.showToast).toHaveBeenCalledWith({ title: '该昵称已被使用，请修改后再保存', icon: 'none' });
    expect(pageInstance.data.saving).toBe(false);
    expect(wx.navigateBack).not.toHaveBeenCalled();
  });
});
