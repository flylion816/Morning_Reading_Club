describe('community activity detail page', () => {
  let pageConfig;
  let pageInstance;
  let communityActivityService;
  let activityService;

  function buildPageInstance() {
    return {
      ...pageConfig,
      data: JSON.parse(JSON.stringify(pageConfig.data)),
      setData(update) {
        this.data = {
          ...this.data,
          ...update
        };
      }
    };
  }

  beforeEach(() => {
    jest.resetModules();
    pageConfig = null;

    global.Page = jest.fn(config => {
      pageConfig = config;
      return config;
    });
    global.getApp = jest.fn(() => ({
      globalData: {
        isLogin: true
      }
    }));

    jest.doMock('../../config/current-tenant', () => ({
      wxAppId: 'wx_test_tenant',
      subscribeTemplates: {
        activity_reminder: 'TENANT_ACTIVITY_REMINDER_TEMPLATE'
      }
    }));
    jest.doMock('../../services/communityActivity.service', () => ({
      getDetail: jest.fn(),
      register: jest.fn()
    }));
    jest.doMock('../../services/activity.service', () => ({
      track: jest.fn()
    }));

    wx.requestSubscribeMessage.mockClear();
    wx.showToast.mockClear();

    communityActivityService = require('../../services/communityActivity.service');
    activityService = require('../../services/activity.service');
    communityActivityService.register.mockResolvedValue({
      registrationId: 'reg_1'
    });

    require('../../pages/community-activity-detail/community-activity-detail');
    pageInstance = buildPageInstance();
    pageInstance.setData({ activityId: 'activity_1' });
  });

  afterEach(() => {
    delete global.Page;
    delete global.getApp;
    jest.dontMock('../../config/current-tenant');
    jest.dontMock('../../services/communityActivity.service');
    jest.dontMock('../../services/activity.service');
  });

  test('registers activity with the tenant activity reminder template grant', async () => {
    await pageInstance.handleRegister.call(pageInstance);

    expect(wx.requestSubscribeMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        tmplIds: ['TENANT_ACTIVITY_REMINDER_TEMPLATE']
      })
    );
    expect(communityActivityService.register).toHaveBeenCalledWith('activity_1', {
      reminderGranted: true,
      reminderGrant: {
        scene: 'activity_reminder',
        templateId: 'TENANT_ACTIVITY_REMINDER_TEMPLATE',
        result: 'accept'
      }
    });
    expect(pageInstance.data.registered).toBe(true);
    expect(activityService.track).toHaveBeenCalledWith('activity_enroll', {
      targetId: 'activity_1'
    });
  });

  test('skips subscribe request when tenant has no activity reminder template', async () => {
    jest.resetModules();
    pageConfig = null;
    global.Page = jest.fn(config => {
      pageConfig = config;
      return config;
    });
    jest.doMock('../../config/current-tenant', () => ({
      wxAppId: 'wx_test_tenant',
      subscribeTemplates: {}
    }));
    jest.doMock('../../services/communityActivity.service', () => communityActivityService);
    jest.doMock('../../services/activity.service', () => activityService);

    require('../../pages/community-activity-detail/community-activity-detail');
    pageInstance = buildPageInstance();
    pageInstance.setData({ activityId: 'activity_1' });
    wx.requestSubscribeMessage.mockClear();
    communityActivityService.register.mockClear();
    communityActivityService.register.mockResolvedValue({
      registrationId: 'reg_1'
    });

    await pageInstance.handleRegister.call(pageInstance);

    expect(wx.requestSubscribeMessage).not.toHaveBeenCalled();
    expect(communityActivityService.register).toHaveBeenCalledWith('activity_1', {
      reminderGranted: false,
      reminderGrant: null
    });
  });
});
