jest.mock('../../services/checkin.service', () => ({
  submitCheckin: jest.fn(),
  updateCheckin: jest.fn(),
  getCheckinDetail: jest.fn(),
  uploadCheckinImage: jest.fn()
}));

jest.mock('../../services/course.service', () => ({
  getCourseDetail: jest.fn(),
  getPeriods: jest.fn()
}));

jest.mock('../../services/activity.service', () => ({
  track: jest.fn(() => Promise.resolve())
}));

jest.mock('../../services/checkinConfig.service', () => ({
  getConfig: jest.fn(() => Promise.resolve({}))
}));

jest.mock('../../utils/subscribe-auto-topup', () => ({
  maybeAutoTopUpSubscriptions: jest.fn(() => Promise.resolve())
}));

jest.mock('../../utils/period-access', () => ({
  getPeriodAccess: jest.fn(() => Promise.resolve({ communityAccessState: 'enabled' })),
  extractId: jest.fn(value => value || ''),
  redirectAfterCommunityDenied: jest.fn()
}));

describe('checkin page', () => {
  let pageConfig;
  let pageInstance;
  let checkinService;
  let courseService;
  let periodAccess;

  beforeEach(() => {
    jest.resetModules();
    pageConfig = null;

    global.Page = jest.fn(config => {
      pageConfig = config;
      return config;
    });
    global.getApp = jest.fn(() => ({
      globalData: {
        userInfo: {
          id: 'user_1',
          nickname: '狮子'
        },
        currentPeriod: {
          _id: 'period_1'
        },
        periods: []
      }
    }));

    checkinService = require('../../services/checkin.service');
    courseService = require('../../services/course.service');
    periodAccess = require('../../utils/period-access');
    require('../../pages/checkin/checkin');

    pageInstance = {
      ...pageConfig,
      data: JSON.parse(JSON.stringify(pageConfig.data)),
      setData(update) {
        this.data = {
          ...this.data,
          ...update
        };
      }
    };

    checkinService.submitCheckin.mockReset();
    checkinService.updateCheckin.mockReset();
    checkinService.getCheckinDetail.mockReset();
    checkinService.uploadCheckinImage.mockReset();
    courseService.getCourseDetail.mockReset();
    periodAccess.getPeriodAccess.mockClear();
    periodAccess.redirectAfterCommunityDenied.mockClear();
    courseService.getCourseDetail.mockResolvedValue({
      _id: 'section_1',
      periodId: 'period_1',
      title: '第一课'
    });
    wx.showToast.mockClear();
    wx.showLoading.mockClear();
    wx.hideLoading.mockClear();
    wx.navigateBack.mockClear();
    wx.previewImage.mockClear();
    wx.chooseMedia = jest.fn();
    wx.enableAlertBeforeUnload = jest.fn();
    wx.disableAlertBeforeUnload = jest.fn();
  });

  afterEach(() => {
    if (pageInstance?._autoSaveTimer) clearTimeout(pageInstance._autoSaveTimer);
    if (pageInstance?._celebrationTimer) clearTimeout(pageInstance._celebrationTimer);
    if (pageInstance?._pageRevealTimer) clearTimeout(pageInstance._pageRevealTimer);
    delete global.Page;
    delete global.getApp;
  });

  test('should clamp diary input to 3000 characters', () => {
    pageInstance.handleInput.call(pageInstance, {
      detail: {
        value: 'x'.repeat(3200)
      }
    });

    expect(pageInstance.data.diaryContent).toHaveLength(3000);
    expect(pageInstance.data.maxDiaryLength).toBe(3000);
  });

  test('should block submit when diary exceeds 3000 characters', async () => {
    pageInstance.setData({
      accessChecked: true,
      diaryContent: 'x'.repeat(3001)
    });

    await pageInstance.handleSubmit.call(pageInstance);

    expect(wx.showToast).toHaveBeenCalledWith({
      title: '打卡内容不能超过3000字',
      icon: 'none'
    });
    expect(checkinService.submitCheckin).not.toHaveBeenCalled();
  });

  test('should upload selected images and include them in submit payload', async () => {
    wx.chooseMedia.mockImplementation(options => {
      options.success({
        tempFiles: [
          { tempFilePath: 'wxfile://image-a.jpg', size: 1024 }
        ]
      });
    });
    checkinService.uploadCheckinImage.mockResolvedValue({
      url: '/uploads/tenants/fanren/checkins/image-a.jpg'
    });
    checkinService.submitCheckin.mockResolvedValue({ _id: 'checkin_1' });

    pageInstance.setData({
      accessChecked: true,
      courseId: 'section_1',
      sectionId: 'section_1',
      periodId: 'period_1',
      sectionDay: 3,
      courseTitle: '第一课',
      diaryContent: '今天的打卡'
    });
    pageInstance.showCheckinCelebration = jest.fn();

    await pageInstance.handleChooseImages.call(pageInstance);
    expect(checkinService.uploadCheckinImage).toHaveBeenCalledWith('wxfile://image-a.jpg');
    expect(pageInstance.data.checkinImages).toEqual([
      '/uploads/tenants/fanren/checkins/image-a.jpg'
    ]);

    await pageInstance.handleSubmit.call(pageInstance);

    expect(checkinService.submitCheckin).toHaveBeenCalledWith(
      expect.objectContaining({
        note: '今天的打卡',
        images: ['/uploads/tenants/fanren/checkins/image-a.jpg']
      })
    );
  });

  test('should allow image-only checkin submit', async () => {
    checkinService.submitCheckin.mockResolvedValue({ _id: 'checkin_image_only' });
    pageInstance.setData({
      accessChecked: true,
      courseId: 'section_1',
      sectionId: 'section_1',
      periodId: 'period_1',
      sectionDay: 1,
      diaryContent: '',
      checkinImages: ['/uploads/tenants/fanren/checkins/image-only.jpg']
    });
    pageInstance.showCheckinCelebration = jest.fn();

    await pageInstance.handleSubmit.call(pageInstance);

    expect(wx.showToast).not.toHaveBeenCalledWith({
      title: '请输入内容或上传图片',
      icon: 'none'
    });
    expect(checkinService.submitCheckin).toHaveBeenCalledWith(
      expect.objectContaining({
        note: '',
        images: ['/uploads/tenants/fanren/checkins/image-only.jpg']
      })
    );
  });

  test('should load and update images in edit mode', async () => {
    checkinService.getCheckinDetail.mockResolvedValue({
      note: '旧内容',
      images: ['/uploads/tenants/fanren/checkins/old.jpg'],
      isPublic: false
    });
    checkinService.updateCheckin.mockResolvedValue({});

    await pageInstance.onLoad.call(pageInstance, {
      sectionId: 'section_1',
      periodId: 'period_1',
      checkinId: 'checkin_1'
    });

    expect(pageInstance.data.checkinImages).toEqual([
      '/uploads/tenants/fanren/checkins/old.jpg'
    ]);
    expect(pageInstance.data.visibility).toBe('admin');

    pageInstance.setData({
      diaryContent: '新内容',
      checkinImages: ['/uploads/tenants/fanren/checkins/new.jpg']
    });

    const setTimeoutSpy = jest.spyOn(global, 'setTimeout').mockImplementation((callback) => {
      callback();
      return 0;
    });
    await pageInstance.handleSubmit.call(pageInstance);
    setTimeoutSpy.mockRestore();

    expect(checkinService.updateCheckin).toHaveBeenCalledWith('checkin_1', {
      note: '新内容',
      images: ['/uploads/tenants/fanren/checkins/new.jpg'],
      isPublic: false
    });
  });

  test('should remove and preview selected image', () => {
    pageInstance.setData({
      checkinImages: ['/uploads/a.jpg', '/uploads/b.jpg']
    });

    pageInstance.handlePreviewImage.call(pageInstance, {
      currentTarget: {
        dataset: {
          url: '/uploads/b.jpg'
        }
      }
    });

    expect(wx.previewImage).toHaveBeenCalledWith({
      current: '/uploads/b.jpg',
      urls: ['/uploads/a.jpg', '/uploads/b.jpg']
    });

    pageInstance.handleRemoveImage.call(pageInstance, {
      currentTarget: {
        dataset: {
          index: 0
        }
      }
    });

    expect(pageInstance.data.checkinImages).toEqual(['/uploads/b.jpg']);
    expect(pageInstance.data.isDirty).toBe(true);
  });

  test('should not reveal checkin form when period access is denied', async () => {
    periodAccess.getPeriodAccess.mockResolvedValue({
      communityAccessState: 'locked'
    });

    await pageInstance.onLoad.call(pageInstance, {
      sectionId: 'section_1',
      periodId: 'period_1'
    });

    expect(pageInstance.data.accessChecked).toBe(false);
    expect(periodAccess.redirectAfterCommunityDenied).toHaveBeenCalledWith(
      '/pages/course-detail/course-detail?id=section_1'
    );
  });
});
