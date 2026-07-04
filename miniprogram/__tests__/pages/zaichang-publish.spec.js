jest.mock('../../services/imprint.service', () => ({
  create: jest.fn(),
  update: jest.fn(),
  detail: jest.fn(),
  getActivityTypes: jest.fn()
}));

jest.mock('../../utils/request', () => ({
  get: jest.fn()
}));

jest.mock('../../config/env', () => ({
  apiBaseUrl: 'https://api.example.com/api/v1',
  wxAppId: 'wx_test'
}));

jest.mock('../../services/activity.service', () => ({
  track: jest.fn()
}));

jest.mock('../../utils/storage', () => ({
  tenantStorage: {
    get: jest.fn()
  }
}));

jest.mock('../../config/constants', () => ({
  STORAGE_KEYS: {
    TOKEN: 'token'
  }
}));

jest.mock('../../services/enrollment.service', () => ({
  getUserEnrollments: jest.fn()
}));

jest.mock('../../utils/period-access', () => ({
  hasPaidEnrollment: jest.fn(),
  redirectAfterCommunityDenied: jest.fn()
}));

let pageConfig;
let pageInstance;
let imprintService;
let enrollmentService;
let periodAccess;
let storage;
let activityService;

function createPageInstance() {
  return {
    ...pageConfig,
    data: JSON.parse(JSON.stringify(pageConfig.data)),
    setData(update, callback) {
      this.data = { ...this.data, ...update };
      if (typeof callback === 'function') callback();
    }
  };
}

describe('zaichang publish page', () => {
  beforeEach(() => {
    jest.resetModules();
    pageConfig = null;
    global.Page = jest.fn(config => {
      pageConfig = config;
      return config;
    });

    wx.redirectTo.mockClear();
    wx.showToast.mockClear();
    wx.showActionSheet.mockClear();
    wx.chooseMedia = jest.fn();
    wx.uploadFile = jest.fn();
    wx.setNavigationBarTitle.mockClear();

    imprintService = require('../../services/imprint.service');
    enrollmentService = require('../../services/enrollment.service');
    periodAccess = require('../../utils/period-access');
    storage = require('../../utils/storage');
    activityService = require('../../services/activity.service');

    imprintService.create.mockReset();
    imprintService.update.mockReset();
    imprintService.detail.mockReset();
    imprintService.getActivityTypes.mockReset();
    enrollmentService.getUserEnrollments.mockReset();
    periodAccess.hasPaidEnrollment.mockReset();
    periodAccess.redirectAfterCommunityDenied.mockReset();
    storage.tenantStorage.get.mockReset();
    activityService.track.mockReset();

    imprintService.getActivityTypes.mockResolvedValue({ list: [] });

    require('../../pages/zaichang/publish/publish');
    pageInstance = createPageInstance();
  });

  afterEach(() => {
    delete global.Page;
  });

  test('onLoad redirects to index when token is missing', async () => {
    storage.tenantStorage.get.mockReturnValue(null);

    await pageInstance.onLoad({});

    expect(wx.redirectTo).toHaveBeenCalledWith({ url: '/pages/index/index' });
    expect(enrollmentService.getUserEnrollments).not.toHaveBeenCalled();
  });

  test('onLoad denies access when user has no paid enrollment', async () => {
    storage.tenantStorage.get.mockReturnValue('token_1');
    enrollmentService.getUserEnrollments.mockResolvedValue({ list: [] });
    periodAccess.hasPaidEnrollment.mockReturnValue(false);

    await pageInstance.onLoad({});

    expect(periodAccess.redirectAfterCommunityDenied).toHaveBeenCalledWith(
      '/pages/index/index',
      '完成支付后可使用此功能'
    );
    expect(imprintService.getActivityTypes).not.toHaveBeenCalled();
  });

  test('onLoad tracks publish view for new imprint when access is allowed', async () => {
    storage.tenantStorage.get.mockReturnValue('token_1');
    enrollmentService.getUserEnrollments.mockResolvedValue({
      list: [{ status: 'active', paymentStatus: 'paid' }]
    });
    periodAccess.hasPaidEnrollment.mockReturnValue(true);

    await pageInstance.onLoad({});

    expect(pageInstance.data.checking).toBe(false);
    expect(activityService.track).toHaveBeenCalledWith('zaichang_publish_view');
    expect(imprintService.getActivityTypes).toHaveBeenCalled();
  });

  test('onChooseMedia does nothing when a video already exists', async () => {
    pageInstance.setData({
      mediaList: [{ type: 'video', url: 'https://example.com/a.mp4' }]
    });

    await pageInstance.onChooseMedia();

    expect(wx.showActionSheet).not.toHaveBeenCalled();
    expect(wx.chooseMedia).not.toHaveBeenCalled();
  });

  test('onSubmit validates media, title and activity type before create', async () => {
    await pageInstance.onSubmit();
    expect(wx.showToast).toHaveBeenLastCalledWith({ title: '请至少选一张图片', icon: 'none' });

    pageInstance.setData({
      mediaList: [{ type: 'image', url: 'https://example.com/a.jpg' }]
    });
    await pageInstance.onSubmit();
    expect(wx.showToast).toHaveBeenLastCalledWith({ title: '请填写标题', icon: 'none' });

    pageInstance.setData({ title: '下午茶' });
    await pageInstance.onSubmit();
    expect(wx.showToast).toHaveBeenLastCalledWith({ title: '请选择活动类型', icon: 'none' });
    expect(imprintService.create).not.toHaveBeenCalled();
  });

  test('onSelectType toggles multiple activity types', () => {
    pageInstance.onSelectType({ currentTarget: { dataset: { key: 'cooking' } } });
    pageInstance.onSelectType({ currentTarget: { dataset: { key: 'tea' } } });

    expect(pageInstance.data.selectedActivityTypes).toEqual(['cooking', 'tea']);
    expect(pageInstance.data.activityType).toBe('cooking');
    expect(pageInstance.data.activityTypes.find(item => item.key === 'cooking').selected).toBe(true);
    expect(pageInstance.data.activityTypes.find(item => item.key === 'tea').selected).toBe(true);

    pageInstance.onSelectType({ currentTarget: { dataset: { key: 'cooking' } } });

    expect(pageInstance.data.selectedActivityTypes).toEqual(['tea']);
    expect(pageInstance.data.activityType).toBe('tea');
  });

  test('onSubmit sends activityTypes and legacy activityType', async () => {
    jest.useFakeTimers();
    imprintService.create.mockResolvedValue({});
    pageInstance.setData({
      mediaList: [{ type: 'image', url: 'https://example.com/a.jpg' }],
      title: '做饭喝茶',
      description: '一起做饭',
      location: '厨房',
      selectedActivityTypes: ['cooking', 'tea'],
      activityType: 'cooking'
    });

    await pageInstance.onSubmit();

    expect(imprintService.create).toHaveBeenCalledWith(expect.objectContaining({
      title: '做饭喝茶',
      activityType: 'cooking',
      activityTypes: ['cooking', 'tea'],
      description: '一起做饭',
      location: '厨房'
    }));
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  test('onLoad maps historical single activityType to selectedActivityTypes while editing', async () => {
    storage.tenantStorage.get.mockReturnValue('token_1');
    enrollmentService.getUserEnrollments.mockResolvedValue({
      list: [{ status: 'active', paymentStatus: 'paid' }]
    });
    periodAccess.hasPaidEnrollment.mockReturnValue(true);
    imprintService.detail.mockResolvedValue({
      imprint: {
        title: '下午茶',
        activityType: 'tea',
        mediaList: [{ type: 'image', url: 'https://example.com/a.jpg' }],
        attendees: []
      }
    });

    await pageInstance.onLoad({ id: 'imprint_1' });

    expect(pageInstance.data.activityType).toBe('tea');
    expect(pageInstance.data.selectedActivityTypes).toEqual(['tea']);
    expect(pageInstance.data.activityTypes.find(item => item.key === 'tea').selected).toBe(true);
  });
});
