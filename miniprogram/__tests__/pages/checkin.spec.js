jest.mock('../../utils/social-access', () => ({
  guardSocialPage: jest.fn(() => true)
}));

const fs = require('fs');
const path = require('path');

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
  getPeriods: jest.fn(),
  getPeriodSections: jest.fn()
}));

jest.mock('../../services/enrollment.service', () => ({
  getUserEnrollments: jest.fn()
}));

jest.mock('../../services/activity.service', () => ({
  track: jest.fn(() => Promise.resolve())
}));

jest.mock('../../services/presence.service', () => ({
  getMyRank: jest.fn()
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
  let enrollmentService;
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
    enrollmentService = require('../../services/enrollment.service');
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
    courseService.getPeriodSections.mockReset();
    enrollmentService.getUserEnrollments.mockReset();
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
    wx.redirectTo.mockClear();
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

  test('defaults to the current period and lesson and can switch to another enrolled period', async () => {
    enrollmentService.getUserEnrollments.mockResolvedValue({ list: [
      { periodId: 'other', periodTitle: '另一课程', status: 'active', paymentStatus: 'paid' },
      { periodId: 'current', periodTitle: '当前期次', status: 'active', paymentStatus: 'free' },
      { periodId: 'pending', periodTitle: '未支付', status: 'active', paymentStatus: 'pending' }
    ], totalPages: 1 });
    courseService.getPeriodSections.mockImplementation(async id => id === 'current'
      ? [{ _id: 'day0', day: 0, title: '序课' }, { _id: 'today', day: 1, title: '今日课程' }]
      : [{ _id: 'other1', day: 1, title: '另一课' }, { _id: 'other2', day: 2, title: '第二课' }]);

    await pageInstance.onLoad.call(pageInstance, { select: '1', periodId: 'current', sectionId: 'today' });
    expect(pageInstance.data.selectablePeriods.map(item => item.id)).toEqual(['other', 'current']);
    expect(pageInstance.data.selectedPeriodIndex).toBe(1);
    expect(pageInstance.data.selectableSections[pageInstance.data.selectedSectionIndex].id).toBe('today');
    pageInstance.handleCheckinPeriodChange.call(pageInstance, { detail: { value: '0' } });
    await new Promise(resolve => setImmediate(resolve));
    pageInstance.handleCheckinSectionChange.call(pageInstance, { detail: { value: '1' } });
    pageInstance.startSelectedCheckin.call(pageInstance);
    expect(wx.redirectTo).toHaveBeenCalledWith({
      url: '/pages/checkin/checkin?periodId=other&sectionId=other2'
    });
  });

  test('shows an empty state when there is no eligible enrollment', async () => {
    enrollmentService.getUserEnrollments.mockResolvedValue({ list: [
      { periodId: 'pending', status: 'active', paymentStatus: 'pending' }
    ] });
    await pageInstance.onLoad.call(pageInstance, { select: '1' });
    expect(pageInstance.data.selectablePeriods).toEqual([]);
    expect(pageInstance.data.selectionLoading).toBe(false);
    expect(courseService.getPeriodSections).not.toHaveBeenCalled();
    pageInstance.startSelectedCheckin.call(pageInstance);
    expect(wx.redirectTo).not.toHaveBeenCalled();
  });

  test('clears old lessons and reports an error when switching periods fails', async () => {
    enrollmentService.getUserEnrollments.mockResolvedValue({ list: [
      { periodId: 'first', status: 'active', paymentStatus: 'paid' },
      { periodId: 'second', status: 'active', paymentStatus: 'paid' }
    ] });
    courseService.getPeriodSections.mockResolvedValueOnce([{ _id: 'lesson', title: '课程', day: 1 }])
      .mockRejectedValueOnce(new Error('network error'));
    await pageInstance.onLoad.call(pageInstance, { select: '1' });
    pageInstance.handleCheckinPeriodChange.call(pageInstance, { detail: { value: '1' } });
    await new Promise(resolve => setImmediate(resolve));
    expect(pageInstance.data.selectableSections).toEqual([]);
    expect(pageInstance.data.selectionError).toBe('课程加载失败，请重试');
    expect(wx.redirectTo).not.toHaveBeenCalled();
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

  test('should keep leave guard disabled when editor emits clear input after successful submit', async () => {
    checkinService.submitCheckin.mockResolvedValue({ _id: 'checkin_success' });
    pageInstance.setData({
      accessChecked: true,
      courseId: 'section_1',
      sectionId: 'section_1',
      periodId: 'period_1',
      sectionDay: 1,
      diaryContent: '已完成打卡',
      diaryContentHtml: '<p>已完成打卡</p>',
      isDirty: true
    });
    pageInstance._editorCtx = {
      clear: jest.fn()
    };
    pageInstance.showCheckinCelebration = jest.fn();

    await pageInstance.handleSubmit.call(pageInstance);
    pageInstance.handleEditorInput.call(pageInstance, {
      detail: {
        text: '\n',
        html: '<p><br></p>'
      }
    });

    expect(pageInstance.data.isDirty).toBe(false);
    expect(wx.disableAlertBeforeUnload).toHaveBeenCalled();
    expect(wx.enableAlertBeforeUnload).not.toHaveBeenCalledWith({
      message: '日记内容尚未发布，确定要离开？'
    });
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

  test('celebration falls back to dawn ritual style C without config and fires medium haptic', () => {
    const feedback = require('../../utils/feedback');
    const hapticSpy = jest.spyOn(feedback, 'haptic').mockImplementation(() => {});
    pageInstance._celebrationCfg = undefined;

    pageInstance.showCheckinCelebration.call(pageInstance);

    expect(pageInstance.data.showCelebration).toBe(true);
    expect(pageInstance.data.celebrationStyle).toBe('C');
    expect(hapticSpy).toHaveBeenCalledWith('medium');
    hapticSpy.mockRestore();
  });

  test('celebration follows backend configured style when config exists', () => {
    const feedback = require('../../utils/feedback');
    const hapticSpy = jest.spyOn(feedback, 'haptic').mockImplementation(() => {});
    pageInstance._celebrationCfg = { animationStyle: 'B', message: '读完了' };

    pageInstance.showCheckinCelebration.call(pageInstance);

    expect(pageInstance.data.celebrationStyle).toBe('B');
    expect(hapticSpy).toHaveBeenCalledWith('medium');
    hapticSpy.mockRestore();
  });

  test('records the lesson day for the dawn ritual using the loaded period numbering base', async () => {
    pageInstance._lessonNumberingBases = { period_1: 1 };
    await pageInstance.loadCourseDetail.call(pageInstance, {
      _id: 'section_1',
      periodId: 'period_1',
      title: '第七课',
      day: 7
    });
    expect(pageInstance.data.celebrationDay).toBe(7);

    await pageInstance.loadCourseDetail.call(pageInstance, {
      _id: 'section_2',
      periodId: 'period_1',
      title: '无序号'
    });
    expect(pageInstance.data.celebrationDay).toBe(0);
  });

  test('shows day 2 for the second lesson of a zero-based period', async () => {
    pageInstance._lessonNumberingBases = { period_0: 0 };
    await pageInstance.loadCourseDetail.call(pageInstance, {
      _id: 'section_b',
      periodId: 'period_0',
      title: '第二课',
      day: 1
    });
    expect(pageInstance.data.celebrationDay).toBe(2);
  });

  test('hides the ritual day when the numbering base is unknown', async () => {
    pageInstance._lessonNumberingBases = undefined;
    await pageInstance.loadCourseDetail.call(pageInstance, {
      _id: 'section_c',
      periodId: 'period_x',
      title: '未知基准',
      day: 1
    });
    expect(pageInstance.data.celebrationDay).toBe(0);
  });
  describe('editor height follows its content (the editor has no auto-height)', () => {
    let page;
    let rects;
    let originals;

    beforeEach(() => {
      jest.useFakeTimers();
      originals = { query: wx.createSelectorQuery, windowInfo: wx.getWindowInfo };
      wx.getWindowInfo = jest.fn(() => ({ windowWidth: 375 }));
      rects = [];
      wx.createSelectorQuery = jest.fn(() => {
        const query = {
          in: () => query,
          select: selector => {
            query.selector = selector;
            return query;
          },
          boundingClientRect: () => query,
          exec: callback => callback([rects.shift() || null])
        };
        return query;
      });
      // 这里要用 setData 的回调（渲染完再去量），和别的用例里只合并数据的 setData 不同
      page = {
        ...pageInstance,
        data: { ...pageInstance.data },
        setData(update, callback) {
          this.data = { ...this.data, ...update };
          if (callback) callback();
        }
      };
      page._editorCtx = { scrollIntoView: jest.fn() };
    });

    afterEach(() => {
      jest.clearAllTimers();
      jest.useRealTimers();
      wx.createSelectorQuery = originals.query;
      if (originals.windowInfo) wx.getWindowInfo = originals.windowInfo;
      else delete wx.getWindowInfo;
    });

    const type = (text, html = `<p>${text}</p>`) => page.handleRichTextInput({ detail: { text, html } });

    test('long text: measures the hidden node after typing, sets the editor height in rpx and keeps the caret in view', () => {
      rects.push({ height: 600 });
      const text = '很长的一段内容\n'.repeat(30);
      type(text, '<p>很长的一段内容</p>');

      expect(page.data.editorHeight).toBe(360);
      jest.advanceTimersByTime(80);

      expect(wx.createSelectorQuery).toHaveBeenCalledTimes(1);
      expect(wx.createSelectorQuery.mock.results[0].value.selector).toBe('#checkin-editor-measure');
      expect(page.data.editorMeasureText).toBe(`${text.replace(/\n$/, '')}​`);
      expect(page.data.editorHeight).toBe(1248); // 600px × 2 + 48
      expect(page._editorCtx.scrollIntoView).toHaveBeenCalledTimes(1);
    });

    test('typing quickly only measures once, after the last input', () => {
      rects.push({ height: 500 });
      ['一', '一二', '一二三'].forEach(text => type(text));
      jest.advanceTimersByTime(79);
      expect(wx.createSelectorQuery).not.toHaveBeenCalled();
      jest.advanceTimersByTime(1);
      expect(wx.createSelectorQuery).toHaveBeenCalledTimes(1);
      expect(page.data.editorMeasureText).toBe('一二三​');
    });

    test('short content keeps the minimum height, and it shrinks again when text is deleted', () => {
      rects.push({ height: 1000 });
      type('长'.repeat(500), '<p>x</p>');
      jest.advanceTimersByTime(80);
      expect(page.data.editorHeight).toBe(2048);

      rects.push({ height: 90 });
      type('短');
      jest.advanceTimersByTime(80);
      expect(page.data.editorHeight).toBe(360);
    });

    test('headings add a little extra height', () => {
      rects.push({ height: 600 });
      type('标题\n内容', '<h2>标题</h2><p>内容</p>');
      jest.advanceTimersByTime(80);
      expect(page.data.editorHeight).toBe(1200 + 48 + 28);
    });

    test('restoring content (not typing) grows the editor but does not move the page to the caret', () => {
      rects.push({ height: 600 });
      page.setData({ diaryContent: '草稿里的内容', diaryContentHtml: '<p>草稿里的内容</p>' });
      page._syncEditorHeight();
      jest.advanceTimersByTime(80);
      expect(page.data.editorHeight).toBe(1248);
      expect(page._editorCtx.scrollIntoView).not.toHaveBeenCalled();
    });

    test('a failed measurement leaves the height alone and does not move the page; no query API is fine too', () => {
      type('内容'); // 没有量到（返回 null）
      jest.advanceTimersByTime(80);
      expect(page.data.editorHeight).toBe(360);
      expect(page._editorCtx.scrollIntoView).not.toHaveBeenCalled();

      wx.createSelectorQuery = undefined;
      type('内容二');
      expect(() => jest.advanceTimersByTime(80)).not.toThrow();
      expect(page.data.editorHeight).toBe(360);
    });

    test('page wires the editor to the measured height, and the measuring view is invisible and out of the way', () => {
      const wxml = fs.readFileSync(path.join(__dirname, '../../pages/checkin/checkin.wxml'), 'utf8');
      const wxss = fs.readFileSync(path.join(__dirname, '../../pages/checkin/checkin.wxss'), 'utf8');
      const editor = wxml.match(/<editor[\s\S]*?\/>/)[0];
      expect(editor).toContain('id="checkin-rich-editor"');
      expect(editor).toContain('style="height: {{editorHeight}}rpx;"');
      expect(wxml).toContain('id="checkin-editor-measure"');
      expect(wxml).toContain('{{editorMeasureText}}');
      const rule = wxss.match(/\.rich-editor\.rich-editor-measure\s*\{[^}]*\}/)[0];
      ['position: absolute', 'visibility: hidden', 'pointer-events: none', 'min-height: 0', 'height: auto', 'white-space: pre-wrap'].forEach(token =>
        expect(rule).toContain(token)
      );
      expect(wxss).toMatch(/\.rich-editor-wrap\s*\{[^}]*position:\s*relative/);
    });
  });

  describe('mood weather, rank and daily card', () => {
    let presenceService;
    beforeEach(() => {
      presenceService = require('../../services/presence.service');
    });
    const baseData = {
      accessChecked: true,
      courseId: 'section_1',
      sectionId: 'section_1',
      periodId: 'period_1',
      sectionDay: 3,
      courseTitle: '第一课',
      diaryContent: '今天读完了。明天继续'
    };

    test('selects and deselects a mood', () => {
      pageInstance.handleMoodSelect.call(pageInstance, { currentTarget: { dataset: { value: 'calm' } } });
      expect(pageInstance.data.mood).toBe('calm');
      pageInstance.handleMoodSelect.call(pageInstance, { currentTarget: { dataset: { value: 'calm' } } });
      expect(pageInstance.data.mood).toBe('');
    });

    test('places mood selection above the diary editor', () => {
      const markup = fs.readFileSync(
        path.join(__dirname, '../../pages/checkin/checkin.wxml'),
        'utf8'
      );
      const moodIndex = markup.indexOf('mood-section-first');
      const editorIndex = markup.indexOf('class="rich-editor-wrap"');

      expect(moodIndex).toBeGreaterThan(-1);
      expect(editorIndex).toBeGreaterThan(moodIndex);
    });

    test('submits with mood only when selected', async () => {
      checkinService.submitCheckin.mockResolvedValue({ _id: 'c1' });
      presenceService.getMyRank.mockResolvedValue(null);
      pageInstance.showCheckinCelebration = jest.fn();
      pageInstance.setData({ ...baseData, mood: 'inspired' });
      await pageInstance.handleSubmit.call(pageInstance);
      expect(checkinService.submitCheckin.mock.calls[0][0]).toMatchObject({ mood: 'inspired', moodSource: 'picker' });

      checkinService.submitCheckin.mockClear();
      pageInstance.setData({ ...baseData, mood: '' });
      await pageInstance.handleSubmit.call(pageInstance);
      expect(checkinService.submitCheckin.mock.calls[0][0]).not.toHaveProperty('mood');
      expect(checkinService.submitCheckin.mock.calls[0][0]).not.toHaveProperty('moodSource');
    });

    test('echoes the existing mood in edit mode and tolerates null', async () => {
      checkinService.getCheckinDetail.mockResolvedValue({ note: 'x', mood: 'low' });
      await pageInstance.onLoad.call(pageInstance, { sectionId: 'section_1', periodId: 'period_1', checkinId: 'c1' });
      expect(pageInstance.data.mood).toBe('low');

      checkinService.getCheckinDetail.mockResolvedValue({ note: 'x', mood: null });
      await pageInstance.onLoad.call(pageInstance, { sectionId: 'section_1', periodId: 'period_1', checkinId: 'c1' });
      expect(pageInstance.data.mood).toBe('');
    });

    test('update sends mood with source, or null when the original mood is cleared', async () => {
      checkinService.updateCheckin.mockResolvedValue({});
      checkinService.getCheckinDetail.mockResolvedValue({ note: 'x', mood: 'low' });
      await pageInstance.onLoad.call(pageInstance, { sectionId: 'section_1', periodId: 'period_1', checkinId: 'c1' });
      pageInstance.setData({ diaryContent: 'x', mood: '' });
      const spy = jest.spyOn(global, 'setTimeout').mockImplementation((cb) => { cb(); return 0; });
      await pageInstance.handleSubmit.call(pageInstance);
      expect(checkinService.updateCheckin.mock.calls[0][1]).toMatchObject({ mood: null, moodSource: 'picker' });

      pageInstance.setData({ mood: 'calm' });
      await pageInstance.handleSubmit.call(pageInstance);
      expect(checkinService.updateCheckin.mock.calls[1][1]).toMatchObject({ mood: 'calm', moodSource: 'picker' });
      spy.mockRestore();
    });

    test('mood select clears the previous autosave timer', () => {
      const clearSpy = jest.spyOn(global, 'clearTimeout');
      pageInstance._autoSaveTimer = 12345;
      pageInstance.handleMoodSelect.call(pageInstance, { currentTarget: { dataset: { value: 'calm' } } });
      expect(clearSpy).toHaveBeenCalledWith(12345);
      clearSpy.mockRestore();
    });

    test('puts the think-module text in its own card, tags stripped, and keeps a plain question as placeholder', async () => {
      await pageInstance.loadCourseDetail.call(pageInstance, {
        _id: 'section_1',
        periodId: 'period_1',
        title: '课',
        reflection: '<p>今天  <strong>想</strong>一想</p>'
      });
      expect(pageInstance.data.thinkText).not.toMatch(/[<>]/);
      expect(pageInstance.data.thinkText).toBe('今天 想 一想');
      expect(pageInstance.data.diaryPlaceholder).toBe('今天读到哪一句，让你停了一下？');
    });

    test('shows the streak on the rite only when it is above one', async () => {
      const spy = jest.fn();
      checkinService.getUserCalendar = spy;
      spy.mockResolvedValueOnce({ currentStreak: 5 });
      await pageInstance.loadCelebrationStreak.call(pageInstance);
      expect(spy).toHaveBeenCalledWith(undefined, { suppressError: true });
      expect(pageInstance.data.celebrationStreak).toBe(5);

      pageInstance.setData({ celebrationStreak: 0 });
      spy.mockResolvedValueOnce({ currentStreak: 1 });
      await pageInstance.loadCelebrationStreak.call(pageInstance);
      spy.mockRejectedValueOnce(new Error('x'));
      await pageInstance.loadCelebrationStreak.call(pageInstance);
      expect(pageInstance.data.celebrationStreak).toBe(0);
      delete checkinService.getUserCalendar;
    });

    test('see-others goes back when the previous page is this course, otherwise opens the course page', () => {
      pageInstance.setData({ sectionId: 'section_1', showCelebration: true });
      global.getCurrentPages = jest.fn(() => [
        { route: 'pages/course-detail/course-detail', options: { id: 'section_1' } },
        { route: 'pages/checkin/checkin' }
      ]);
      wx.navigateBack = jest.fn();
      wx.redirectTo = jest.fn();
      pageInstance.handleSeeOthersCheckins.call(pageInstance);
      expect(wx.navigateBack).toHaveBeenCalledTimes(1);
      expect(wx.redirectTo).not.toHaveBeenCalled();
      expect(pageInstance.data.showCelebration).toBe(false);

      global.getCurrentPages = jest.fn(() => [{ route: 'pages/index/index' }, { route: 'pages/checkin/checkin' }]);
      pageInstance.handleSeeOthersCheckins.call(pageInstance);
      expect(wx.redirectTo).toHaveBeenCalledWith({ url: '/pages/course-detail/course-detail?id=section_1' });
    });

    test('shows the rank when available and stays empty otherwise', async () => {
      presenceService.getMyRank.mockResolvedValueOnce({ rank: 5 });
      await pageInstance.loadCelebrationRank.call(pageInstance, 'section_1');
      expect(presenceService.getMyRank).toHaveBeenCalledWith('section_1', 'checkin');
      expect(pageInstance.data.celebrationRank).toBe(5);

      pageInstance.setData({ celebrationRank: 0 });
      presenceService.getMyRank.mockRejectedValueOnce(new Error('x'));
      await pageInstance.loadCelebrationRank.call(pageInstance, 'section_1');
      expect(pageInstance.data.celebrationRank).toBe(0);
    });

    test('jumps to the daily card with the first sentence as the main quote, stopping the auto close timer', () => {
      wx.redirectTo.mockClear();
      pageInstance._celebrationTimer = setTimeout(() => {}, 100000);
      pageInstance._lastSubmittedNote = '今天读完了。明天继续';
      pageInstance.setData({ celebrationDay: 3, courseTitle: '第一课' });
      pageInstance.handleMakeDailyCard.call(pageInstance);
      expect(pageInstance._celebrationTimer).toBeNull();
      const url = wx.redirectTo.mock.calls[0][0].url;
      expect(url).toContain('/pages/daily-card/daily-card?');
      expect(url).toContain(`source=${encodeURIComponent('第 3 天 · 第一课')}`);
      expect(url).toContain('day=3');
      expect(url).toContain(`quote=${encodeURIComponent('今天读完了')}`);
      expect(url).not.toContain('note=');

      wx.redirectTo.mockClear();
      pageInstance.setData({ celebrationDay: 0 });
      pageInstance.handleMakeDailyCard.call(pageInstance);
      const url2 = wx.redirectTo.mock.calls[0][0].url;
      expect(url2).toContain(`source=${encodeURIComponent('第一课')}`);
      expect(url2).not.toContain('day=');
    });
  });
});
