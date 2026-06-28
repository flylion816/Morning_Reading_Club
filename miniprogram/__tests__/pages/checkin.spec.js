jest.mock('../../services/checkin.service', () => ({
  submitCheckin: jest.fn(),
  updateCheckin: jest.fn(),
  getCheckinDetail: jest.fn(),
  uploadCheckinImage: jest.fn(),
  normalizeCheckinImages: jest.fn((images = [], maxCount = 9) =>
    (Array.isArray(images) ? images : [])
      .filter(Boolean)
      .map((url) =>
        typeof url === 'string' && url.startsWith('/uploads/')
          ? `https://wx.shubai01.com${url}`
          : url
      )
      .slice(0, maxCount)
  )
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
      'https://wx.shubai01.com/uploads/tenants/fanren/checkins/image-a.jpg'
    ]);

    await pageInstance.handleSubmit.call(pageInstance);

    expect(checkinService.submitCheckin).toHaveBeenCalledWith(
      expect.objectContaining({
        note: '今天的打卡',
        contentHtml: '<p>今天的打卡</p>',
        images: ['https://wx.shubai01.com/uploads/tenants/fanren/checkins/image-a.jpg']
      })
    );
  });

  test('should submit rich text html with plain text note', async () => {
    checkinService.submitCheckin.mockResolvedValue({ _id: 'checkin_rich' });
    pageInstance.setData({
      accessChecked: true,
      courseId: 'section_1',
      sectionId: 'section_1',
      periodId: 'period_1',
      sectionDay: 2
    });
    pageInstance.showCheckinCelebration = jest.fn();

    pageInstance.handleRichTextInput.call(pageInstance, {
      detail: {
        text: '要事第一：把注意力交还给生命主轴',
        html: '<p><strong>要事第一</strong>：<span style="color:#4a90e2">把注意力交还给生命主轴</span></p>'
      }
    });

    expect(pageInstance.data.showRichTextPreview).toBe(true);

    await pageInstance.handleSubmit.call(pageInstance);

    expect(checkinService.submitCheckin).toHaveBeenCalledWith(
      expect.objectContaining({
        note: '要事第一：把注意力交还给生命主轴',
        contentHtml: '<p><strong>要事第一</strong>：<span style="color:#4a90e2">把注意力交还给生命主轴</span></p>'
      })
    );
  });

  test('should format editor color with hex value and sync preview without resetting editor contents', () => {
    jest.useFakeTimers();
    const format = jest.fn();
    const getContents = jest.fn(options => {
      options.success({
        text: '红色重点\n',
        html: '<p><span style="color:#dc2626">红色重点</span></p>'
      });
    });
    const setContents = jest.fn();
    pageInstance._editorCtx = {
      format,
      getContents,
      setContents
    };
    pageInstance.setData({
      editorFormats: {
        color: 'rgb(220, 38, 38)'
      },
      isDirty: false
    });

    pageInstance.handleEditorStatusChange.call(pageInstance, {
      detail: {
        color: 'rgb(220, 38, 38)'
      }
    });

    expect(pageInstance.data.editorFormats.color).toBe('#dc2626');

    pageInstance.handleEditorFormat.call(pageInstance, {
      currentTarget: {
        dataset: {
          name: 'color',
          value: '#dc2626'
        }
      }
    });

    expect(format).toHaveBeenCalledWith('color', false);

    pageInstance.handleEditorFormat.call(pageInstance, {
      currentTarget: {
        dataset: {
          name: 'color',
          value: '#4a90e2'
        }
      }
    });

    expect(format).toHaveBeenLastCalledWith('color', '#4a90e2');

    jest.advanceTimersByTime(120);

    expect(getContents).toHaveBeenCalled();
    expect(setContents).not.toHaveBeenCalled();
    expect(pageInstance.data.diaryContent).toBe('红色重点');
    expect(pageInstance.data.diaryContentHtml).toBe('<p><span style="color:#dc2626">红色重点</span></p>');
    expect(pageInstance.data.showRichTextPreview).toBe(true);

    jest.useRealTimers();
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
      checkinImages: ['https://wx.shubai01.com/uploads/tenants/fanren/checkins/image-only.jpg']
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
        contentHtml: '',
        images: ['https://wx.shubai01.com/uploads/tenants/fanren/checkins/image-only.jpg']
      })
    );
  });

  test('should load and update images in edit mode', async () => {
    checkinService.getCheckinDetail.mockResolvedValue({
      note: '旧内容',
      contentHtml: '<p><strong>旧内容</strong></p>',
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
      'https://wx.shubai01.com/uploads/tenants/fanren/checkins/old.jpg'
    ]);
    expect(pageInstance.data.diaryContentHtml).toBe('<p><strong>旧内容</strong></p>');
    expect(pageInstance.data.visibility).toBe('admin');

    pageInstance.setData({
      diaryContent: '新内容',
      diaryContentHtml: '<p><em>新内容</em></p>',
      checkinImages: ['https://wx.shubai01.com/uploads/tenants/fanren/checkins/new.jpg']
    });

    const setTimeoutSpy = jest.spyOn(global, 'setTimeout').mockImplementation((callback) => {
      callback();
      return 0;
    });
    await pageInstance.handleSubmit.call(pageInstance);
    setTimeoutSpy.mockRestore();

    expect(checkinService.updateCheckin).toHaveBeenCalledWith('checkin_1', {
      note: '新内容',
      contentHtml: '<p><em>新内容</em></p>',
      images: ['https://wx.shubai01.com/uploads/tenants/fanren/checkins/new.jpg'],
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
