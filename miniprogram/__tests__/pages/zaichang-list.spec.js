jest.mock('../../services/imprint.service', () => ({
  list: jest.fn(),
  getActivityTypes: jest.fn()
}));

jest.mock('../../services/enrollment.service', () => ({
  getUserEnrollments: jest.fn()
}));

jest.mock('../../utils/period-access', () => ({
  hasPaidEnrollment: jest.fn(),
  redirectAfterCommunityDenied: jest.fn()
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

jest.mock('../../services/activity.service', () => ({
  track: jest.fn()
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

describe('zaichang list page', () => {
  beforeEach(() => {
    jest.resetModules();
    pageConfig = null;
    global.Page = jest.fn(config => {
      pageConfig = config;
      return config;
    });

    wx.redirectTo.mockClear();
    wx.navigateTo.mockClear();
    wx.showToast.mockClear();

    imprintService = require('../../services/imprint.service');
    enrollmentService = require('../../services/enrollment.service');
    periodAccess = require('../../utils/period-access');
    storage = require('../../utils/storage');
    activityService = require('../../services/activity.service');

    imprintService.list.mockReset();
    imprintService.getActivityTypes.mockReset();
    enrollmentService.getUserEnrollments.mockReset();
    periodAccess.hasPaidEnrollment.mockReset();
    periodAccess.redirectAfterCommunityDenied.mockReset();
    storage.tenantStorage.get.mockReset();
    activityService.track.mockReset();

    imprintService.list.mockResolvedValue({ list: [] });
    imprintService.getActivityTypes.mockResolvedValue({ list: [] });

    require('../../pages/zaichang/list/list');
    pageInstance = createPageInstance();
  });

  afterEach(() => {
    delete global.Page;
  });

  test('onLoad redirects to index when token is missing', async () => {
    storage.tenantStorage.get.mockReturnValue(null);

    await pageInstance.onLoad();

    expect(wx.redirectTo).toHaveBeenCalledWith({ url: '/pages/index/index' });
    expect(enrollmentService.getUserEnrollments).not.toHaveBeenCalled();
  });

  test('onLoad denies access when user has no paid enrollment', async () => {
    storage.tenantStorage.get.mockReturnValue('token_1');
    enrollmentService.getUserEnrollments.mockResolvedValue({ list: [] });
    periodAccess.hasPaidEnrollment.mockReturnValue(false);

    await pageInstance.onLoad();

    expect(periodAccess.redirectAfterCommunityDenied).toHaveBeenCalledWith(
      '/pages/index/index',
      '完成支付后可查看在场'
    );
    expect(imprintService.list).not.toHaveBeenCalled();
  });

  test('onLoad tracks and loads list when access is allowed', async () => {
    storage.tenantStorage.get.mockReturnValue('token_1');
    enrollmentService.getUserEnrollments.mockResolvedValue({
      list: [{ status: 'active', paymentStatus: 'paid' }]
    });
    periodAccess.hasPaidEnrollment.mockReturnValue(true);

    await pageInstance.onLoad();

    expect(activityService.track).toHaveBeenCalledWith('zaichang_list_view');
    expect(imprintService.getActivityTypes).toHaveBeenCalled();
    expect(imprintService.list).toHaveBeenCalledWith({ page: 1, pageSize: 10 });
  });

  test('onTapPublish blocks unpaid user', async () => {
    storage.tenantStorage.get.mockReturnValue('token_1');
    enrollmentService.getUserEnrollments.mockResolvedValue({ list: [] });
    periodAccess.hasPaidEnrollment.mockReturnValue(false);

    await pageInstance.onTapPublish();

    expect(wx.showToast).toHaveBeenCalledWith({
      title: '完成支付后可发布印记',
      icon: 'none'
    });
    expect(wx.navigateTo).not.toHaveBeenCalled();
  });
});
