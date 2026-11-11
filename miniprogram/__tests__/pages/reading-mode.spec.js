jest.mock('../../services/course.service.js', () => ({
  getSectionDetail: jest.fn(),
  markReadingCompleted: jest.fn(() => Promise.resolve())
}));

jest.mock('../../utils/period-access.js', () => ({
  extractId: jest.fn(value => value),
  getPeriodAccess: jest.fn(() =>
    Promise.resolve({
      communityAccessState: 'enabled'
    })
  )
}));

jest.mock('../../services/presence.service.js', () => ({
  reportReading: jest.fn(() => Promise.resolve(null)),
  getMyRank: jest.fn()
}));

jest.mock('../../services/highlight.service.js', () => ({
  getSectionPopular: jest.fn(),
  addHighlight: jest.fn(),
  removeHighlight: jest.fn()
}));

let pageConfig;
let pageInstance;
let courseService;

describe('reading-mode page', () => {
  beforeEach(() => {
    jest.useRealTimers();
    jest.resetModules();
    pageConfig = null;

    global.Page = jest.fn(config => {
      pageConfig = config;
      return config;
    });

    courseService = require('../../services/course.service.js');
    require('../../pages/reading-mode/reading-mode.js');

    pageInstance = {
      ...pageConfig,
      data: JSON.parse(JSON.stringify(pageConfig.data)),
      setData(update, callback) {
        this.data = {
          ...this.data,
          ...update
        };
        if (typeof callback === 'function') {
          callback();
        }
      }
    };

    wx.setStorageSync.mockClear();
    wx.__storage = {};
    courseService.markReadingCompleted.mockClear();
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
    delete global.Page;
  });

  test('activates the final paragraph when the reader reaches the bottom', () => {
    pageInstance.data.sectionId = 'section_day_6';
    pageInstance.data.paragraphs = [
      { id: 'p1', text: '第一段' },
      { id: 'p2', text: '第二段' },
      { id: 'p3', text: '第三段' }
    ];
    pageInstance.data.currentParagraphIndex = 1;
    pageInstance._latestScrollTop = 360;

    pageInstance.handleScrollToLower();

    expect(pageInstance.data.currentParagraphIndex).toBe(2);
    expect(pageInstance.data.readingProgress).toBe(100);
    expect(wx.setStorageSync).toHaveBeenCalledWith(
      'reading_progress_section_day_6',
      expect.objectContaining({
        scrollTop: 360,
        currentParagraphIndex: 2
      })
    );
  });

  test('shows completion after qualified reading and five-second final dwell', () => {
    jest.useFakeTimers();
    const nowSpy = jest.spyOn(Date, 'now');
    nowSpy.mockReturnValue(0);

    pageInstance.data.sectionId = 'section_day_6';
    pageInstance.data.periodId = 'period_1';
    pageInstance.data.paragraphs = [
      { id: 'p1', text: '第一段' },
      { id: 'p2', text: '第二段' },
      { id: 'p3', text: '第三段' }
    ];
    pageInstance.data.currentParagraphIndex = 1;
    pageInstance.initReadingCompletionSession(
      { scrollTop: 0, currentParagraphIndex: 0 },
      3
    );
    [80, 180, 300, 430].forEach(scrollTop => {
      pageInstance.trackReadingScrollPattern({
        scrollTop,
        scrollHeight: 900
      });
    });

    nowSpy.mockReturnValue(61000);
    pageInstance.activateParagraph(2);

    expect(pageInstance.data.completionVisible).toBe(false);

    nowSpy.mockReturnValue(66000);
    jest.advanceTimersByTime(5000);

    expect(pageInstance.data.completionVisible).toBe(true);
    expect(pageInstance.data.completionDurationText).toBe('1 分 6 秒');
    expect(pageInstance.data.fireworksVisible).toBe(true);
    expect(wx.__storage.reading_completion_records.section_day_6).toEqual(
      expect.objectContaining({
        sectionId: 'section_day_6',
        periodId: 'period_1',
        durationMs: 66000
      })
    );
    expect(courseService.markReadingCompleted).toHaveBeenCalledWith(
      'section_day_6',
      expect.objectContaining({
        durationMs: 66000
      })
    );
  });

  test('does not complete when session duration is one minute or less', () => {
    jest.useFakeTimers();
    const nowSpy = jest.spyOn(Date, 'now');
    nowSpy.mockReturnValue(0);

    pageInstance.data.sectionId = 'section_day_6';
    pageInstance.data.paragraphs = [
      { id: 'p1', text: '第一段' },
      { id: 'p2', text: '第二段' },
      { id: 'p3', text: '第三段' }
    ];
    pageInstance.data.currentParagraphIndex = 1;
    pageInstance.initReadingCompletionSession(
      { scrollTop: 0, currentParagraphIndex: 0 },
      3
    );
    [80, 180, 300, 430].forEach(scrollTop => {
      pageInstance.trackReadingScrollPattern({
        scrollTop,
        scrollHeight: 900
      });
    });

    nowSpy.mockReturnValue(55000);
    pageInstance.activateParagraph(2);
    nowSpy.mockReturnValue(60000);
    jest.advanceTimersByTime(5000);

    expect(pageInstance.data.completionVisible).toBe(false);
    expect(wx.__storage.reading_completion_records).toBeUndefined();
  });

  test('does not complete after a direct bottom jump', () => {
    jest.useFakeTimers();
    const nowSpy = jest.spyOn(Date, 'now');
    nowSpy.mockReturnValue(0);

    pageInstance.data.sectionId = 'section_day_6';
    pageInstance.data.paragraphs = [
      { id: 'p1', text: '第一段' },
      { id: 'p2', text: '第二段' },
      { id: 'p3', text: '第三段' }
    ];
    pageInstance.data.currentParagraphIndex = 1;
    pageInstance.initReadingCompletionSession(
      { scrollTop: 0, currentParagraphIndex: 0 },
      3
    );
    pageInstance.trackReadingScrollPattern({
      scrollTop: 720,
      scrollHeight: 900
    });

    nowSpy.mockReturnValue(61000);
    pageInstance.activateParagraph(2);
    nowSpy.mockReturnValue(66000);
    jest.advanceTimersByTime(5000);

    expect(pageInstance.data.completionVisible).toBe(false);
    expect(wx.__storage.reading_completion_records).toBeUndefined();
  });

  test('shows saved completion card again when final paragraph is active', () => {
    wx.setStorageSync('reading_completion_records', {
      section_day_6: {
        sectionId: 'section_day_6',
        periodId: 'period_1',
        durationMs: 91000,
        completedAt: 1760000000000
      }
    });
    pageInstance.data.sectionId = 'section_day_6';
    pageInstance.data.paragraphs = [
      { id: 'p1', text: '第一段' },
      { id: 'p2', text: '第二段' },
      { id: 'p3', text: '第三段' }
    ];
    pageInstance.data.currentParagraphIndex = 2;
    pageInstance.initReadingCompletionSession(
      { scrollTop: 680, currentParagraphIndex: 2 },
      3,
      {
        durationMs: 91000,
        completedAt: 1760000000000
      }
    );

    pageInstance.activateParagraph(2);

    expect(pageInstance.data.completionVisible).toBe(true);
    expect(pageInstance.data.completionDurationText).toBe('1 分 31 秒');
    expect(pageInstance.data.fireworksVisible).toBe(false);
    expect(courseService.markReadingCompleted).not.toHaveBeenCalled();
  });

  test('shows completion card from route completion fallback', () => {
    const routeCompletion = pageInstance.getRouteReadingCompletion.call(
      pageInstance,
      {
        readingCompleted: '1',
        readingDurationMs: '91000',
        readingCompletedAt: '2026-05-15T08:00:00.000Z'
      }
    );
    pageInstance.data.sectionId = 'section_day_6';
    pageInstance.data.paragraphs = [
      { id: 'p1', text: '第一段' },
      { id: 'p2', text: '第二段' },
      { id: 'p3', text: '第三段' }
    ];
    pageInstance.data.currentParagraphIndex = 2;
    pageInstance.initReadingCompletionSession(
      { scrollTop: 680, currentParagraphIndex: 2 },
      3,
      routeCompletion
    );

    pageInstance.activateParagraph(2);

    expect(pageInstance.data.completionVisible).toBe(true);
    expect(pageInstance.data.completionDurationText).toBe('1 分 31 秒');
    expect(pageInstance.data.fireworksVisible).toBe(false);
    expect(courseService.markReadingCompleted).not.toHaveBeenCalled();
  });

  test('adds visible completion card to final paragraph poster items', () => {
    pageInstance.data.paragraphs = [
      { id: 'p1', text: '第一段' },
      { id: 'p2', text: '第二段' }
    ];
    pageInstance.data.currentParagraphIndex = 1;
    pageInstance.data.completionVisible = true;
    pageInstance.data.completionTitle = '狮子，你这一课，已经认真读完了！';
    pageInstance.data.completionDurationText = '9 分 41 秒';

    const posterItems = pageInstance.appendCompletionPosterItem([
      { id: 'p2', text: '第二段', active: true }
    ]);

    expect(posterItems).toHaveLength(2);
    expect(posterItems[1]).toEqual(
      expect.objectContaining({
        id: 'reading-completion',
        type: 'completion',
        kicker: '已完成本次晨读',
        title: '狮子，你这一课，已经认真读完了！',
        text: '本次阅读用时 9 分 41 秒。能耐心读到这里，就是今天很扎实的一步。'
      })
    );
  });

  test('does not add completion card to poster before final paragraph', () => {
    pageInstance.data.paragraphs = [
      { id: 'p1', text: '第一段' },
      { id: 'p2', text: '第二段' }
    ];
    pageInstance.data.currentParagraphIndex = 0;
    pageInstance.data.completionVisible = true;

    const posterItems = pageInstance.appendCompletionPosterItem([
      { id: 'p1', text: '第一段', active: true }
    ]);

    expect(posterItems).toHaveLength(1);
    expect(posterItems[0].id).toBe('p1');
  });

  test('maps poster paragraph metrics from reading page rpx styles', () => {
    pageInstance.data.fontSizeLevel = 'standard';

    const metrics = pageInstance.getPosterParagraphMetrics(900);

    expect(metrics.fontSize).toBeCloseTo(43.2);
    expect(metrics.lineHeight).toBeCloseTo(88.56);
    expect(metrics.paddingLeft).toBeCloseTo(26.4);
    expect(metrics.marginBottom).toBeCloseTo(40.8);
  });

  test('does not clamp inactive poster paragraphs to five lines', () => {
    const originalMeasureText = global.__mockCanvasContext.measureText;
    global.__mockCanvasContext.measureText = jest.fn(text => ({
      width: String(text || '').length * 20
    }));

    const lines = pageInstance.wrapCanvasText(
      global.__mockCanvasContext,
      '这是一段很长的上一段内容，用来验证分享海报不会把非当前段落只截断成五行，而是按照阅读页面完整换行展示出来。',
      120,
      99
    );

    expect(lines.length).toBeGreaterThan(5);
    expect(lines.join('')).not.toContain('...');

    global.__mockCanvasContext.measureText = originalMeasureText;
  });

  test('can qualify after restored progress if user scrolls back to top first', () => {
    jest.useFakeTimers();
    const nowSpy = jest.spyOn(Date, 'now');
    nowSpy.mockReturnValue(0);

    pageInstance.data.sectionId = 'section_day_6';
    pageInstance.data.periodId = 'period_1';
    pageInstance.data.paragraphs = [
      { id: 'p1', text: '第一段' },
      { id: 'p2', text: '第二段' },
      { id: 'p3', text: '第三段' }
    ];
    pageInstance.data.currentParagraphIndex = 1;
    pageInstance.initReadingCompletionSession(
      { scrollTop: 520, currentParagraphIndex: 1 },
      3
    );

    pageInstance.trackReadingScrollPattern({
      scrollTop: 0,
      scrollHeight: 900
    });
    [90, 190, 320, 460].forEach(scrollTop => {
      pageInstance.trackReadingScrollPattern({
        scrollTop,
        scrollHeight: 900
      });
    });

    nowSpy.mockReturnValue(61000);
    pageInstance.activateParagraph(2);
    nowSpy.mockReturnValue(66000);
    jest.advanceTimersByTime(5000);

    expect(pageInstance.data.completionVisible).toBe(true);
    expect(courseService.markReadingCompleted).toHaveBeenCalled();
  });

  test('fires a light haptic when the completion card appears', () => {
    const feedback = require('../../utils/feedback');
    const hapticSpy = jest.spyOn(feedback, 'haptic').mockImplementation(() => {});
    jest.useFakeTimers();
    const nowSpy = jest.spyOn(Date, 'now');
    nowSpy.mockReturnValue(0);

    pageInstance.data.sectionId = 'section_day_6';
    pageInstance.data.periodId = 'period_1';
    pageInstance.data.paragraphs = [
      { id: 'p1', text: '第一段' },
      { id: 'p2', text: '第二段' },
      { id: 'p3', text: '第三段' }
    ];
    pageInstance.data.currentParagraphIndex = 1;
    pageInstance.initReadingCompletionSession({ scrollTop: 0, currentParagraphIndex: 0 }, 3);
    [80, 180, 300, 430].forEach(scrollTop => {
      pageInstance.trackReadingScrollPattern({ scrollTop, scrollHeight: 900 });
    });
    nowSpy.mockReturnValue(61000);
    pageInstance.activateParagraph(2);
    expect(hapticSpy).not.toHaveBeenCalled();

    nowSpy.mockReturnValue(66000);
    jest.advanceTimersByTime(5000);

    expect(pageInstance.data.completionVisible).toBe(true);
    expect(hapticSpy).toHaveBeenCalledWith('light');
    hapticSpy.mockRestore();
    nowSpy.mockRestore();
    jest.useRealTimers();
  });

  describe('settings panel', () => {
    test('opens and closes the panel', () => {
      pageInstance.openSettingsPanel();
      expect(pageInstance.data.settingsPanelVisible).toBe(true);
      pageInstance.closeSettingsPanel();
      expect(pageInstance.data.settingsPanelVisible).toBe(false);
    });

    test('saves the three settings together in one stored object', () => {
      const pick = value => ({ currentTarget: { dataset: { value } } });
      pageInstance.handleSelectFontSize(pick('xlarge'));
      pageInstance.handleSelectFontFamily(pick('serif'));
      pageInstance.handleSelectPaperTheme(pick('night'));
      expect(pageInstance.data.fontSizeLevel).toBe('xlarge');
      expect(pageInstance.data.fontFamily).toBe('serif');
      expect(pageInstance.data.paperTheme).toBe('night');
      expect(wx.setStorageSync).toHaveBeenLastCalledWith(
        'reading_mode_settings',
        { fontSizeLevel: 'xlarge', fontFamily: 'serif', paperTheme: 'night' }
      );
    });

    test('ignores unknown values', () => {
      pageInstance.handleSelectPaperTheme({ currentTarget: { dataset: { value: 'neon' } } });
      expect(pageInstance.data.paperTheme).toBe('warm');
    });

    test('restores saved settings', () => {
      wx.__storage.reading_mode_settings = { fontSizeLevel: 'large', fontFamily: 'serif', paperTheme: 'cream' };
      pageInstance.data.sectionId = 's1';
      const saved = pageInstance.loadSavedState();
      expect(saved).toEqual(expect.objectContaining({ fontSizeLevel: 'large', fontFamily: 'serif', paperTheme: 'cream' }));
    });

    test('legacy data without new fields falls back to sans + warm', () => {
      wx.__storage.reading_mode_settings = { fontSizeLevel: 'large' };
      pageInstance.data.sectionId = 's1';
      const saved = pageInstance.loadSavedState();
      expect(saved.fontFamily).toBe('sans');
      expect(saved.paperTheme).toBe('warm');
      pageInstance.applyFontSizeClass('xlarge');
      expect(wx.setStorageSync).toHaveBeenLastCalledWith('reading_mode_settings', { fontSizeLevel: 'xlarge' });
    });

    test('cycleFontSize still cycles levels', () => {
      pageInstance.cycleFontSize();
      expect(pageInstance.data.fontSizeLevel).toBe('large');
    });
  });

  test('switches status bar colors with the paper theme', () => {
    wx.setNavigationBarColor = jest.fn();
    pageInstance.handleSelectPaperTheme({ currentTarget: { dataset: { value: 'night' } } });
    expect(wx.setNavigationBarColor).toHaveBeenLastCalledWith(
      expect.objectContaining({ frontColor: '#ffffff', backgroundColor: '#1f1d1a' })
    );
    pageInstance.handleSelectPaperTheme({ currentTarget: { dataset: { value: 'cream' } } });
    expect(wx.setNavigationBarColor).toHaveBeenLastCalledWith(
      expect.objectContaining({ frontColor: '#000000', backgroundColor: '#f5ecd7' })
    );
    wx.setNavigationBarColor = jest.fn(() => { throw new Error('fail'); });
    expect(() => pageInstance.applyNavigationBarColor('warm')).not.toThrow();
  });
  describe('companion features', () => {
    const { hashText } = require('../../utils/text-hash.js');
    const longText = '这是一段足够长的正文用来摘抄';
    let presence;
    let highlight;

    beforeEach(() => {
      presence = require('../../services/presence.service.js');
      highlight = require('../../services/highlight.service.js');
      presence.reportReading.mockClear();
      presence.getMyRank.mockReset();
      highlight.getSectionPopular.mockReset();
      highlight.addHighlight.mockReset();
      highlight.removeHighlight.mockReset();
      pageInstance.data.sectionId = 's1';
      pageInstance.data.paragraphs = [
        { id: 'a', text: '标题', hash: hashText('标题'), canHighlight: false },
        { id: 'b', text: longText, hash: hashText(longText), canHighlight: true }
      ];
      pageInstance.isLoggedIn = () => true;
    });

    afterEach(() => {
      pageInstance.stopPresenceReporting();
    });

    test('reports reading immediately, every 60s, and clears on hide', () => {
      jest.useFakeTimers();
      pageInstance.initCompanionFeatures(true);
      highlight.getSectionPopular.mockResolvedValue({ popular: [], mine: [] });
      expect(presence.reportReading).toHaveBeenCalledTimes(1);
      jest.advanceTimersByTime(120000);
      expect(presence.reportReading).toHaveBeenCalledTimes(3);
      pageInstance.onHide();
      jest.advanceTimersByTime(120000);
      expect(presence.reportReading).toHaveBeenCalledTimes(3);
    });

    test('does nothing when not enrolled or not logged in', () => {
      pageInstance.initCompanionFeatures(false);
      pageInstance.isLoggedIn = () => false;
      pageInstance.initCompanionFeatures(true);
      expect(presence.reportReading).not.toHaveBeenCalled();
      expect(highlight.getSectionPopular).not.toHaveBeenCalled();
    });

    test('shows completion rank, and keeps it hidden when unavailable', async () => {
      pageInstance._presenceEnabled = true;
      presence.getMyRank.mockResolvedValueOnce({ rank: 5 });
      await pageInstance.loadCompletionRank();
      expect(presence.getMyRank).toHaveBeenCalledWith('s1', 'reading');
      expect(pageInstance.data.completionRank).toBe(5);

      pageInstance.data.completionRank = 0;
      presence.getMyRank.mockRejectedValueOnce(new Error('403'));
      await pageInstance.loadCompletionRank();
      expect(pageInstance.data.completionRank).toBe(0);
    });

    test('computes popular and mine marks from section data', async () => {
      const hash = hashText(longText);
      highlight.getSectionPopular.mockResolvedValue({
        popular: [{ textHash: hash, count: 4 }, { textHash: hashText('标题'), count: 2 }],
        mine: [hash]
      });
      await pageInstance.loadHighlightMarks();
      expect(pageInstance.data.paragraphs[1].mine).toBe(true);
      expect(pageInstance.data.paragraphs[1].popularCount).toBe(4);
      expect(pageInstance.data.paragraphs[0].popularCount).toBe(0);
    });

    test('adding a highlight marks the paragraph, and removing uses the remembered id', async () => {
      pageInstance._highlightEnabled = true;
      highlight.addHighlight.mockResolvedValue({ id: 'h1' });
      highlight.removeHighlight.mockResolvedValue({});
      const item = pageInstance.data.paragraphs[1];
      await pageInstance.addParagraphHighlight(item);
      expect(highlight.addHighlight).toHaveBeenCalledWith('s1', longText);
      expect(pageInstance.data.paragraphs[1].mine).toBe(true);
      await pageInstance.removeParagraphHighlight(pageInstance.data.paragraphs[1]);
      expect(highlight.removeHighlight).toHaveBeenCalledWith('h1');
      expect(pageInstance.data.paragraphs[1].mine).toBe(false);
    });

    test('long press ignores short paragraphs and shows action sheet for long ones', () => {
      pageInstance._highlightEnabled = true;
      wx.showActionSheet = jest.fn();
      pageInstance.handleParagraphLongPress({ currentTarget: { dataset: { index: 0 } } });
      expect(wx.showActionSheet).not.toHaveBeenCalled();
      pageInstance.handleParagraphLongPress({ currentTarget: { dataset: { index: 1 } } });
      expect(wx.showActionSheet).toHaveBeenCalledWith(
        expect.objectContaining({ itemList: ['摘下来'] })
      );
    });

    test('paragraph hash and highlightability respect length limits', async () => {
      courseService.getSectionDetail.mockResolvedValue({
        content: ['短标题', longText, '长'.repeat(501)].join('\n\n'),
        periodId: 'p1'
      });
      pageInstance.data.sectionId = 's1';
      pageInstance.initReadingCompletionSession = jest.fn();
      pageInstance.applyFontSizeClass = jest.fn();
      pageInstance.applyNavigationBarColor = jest.fn();
      pageInstance.initCompanionFeatures = jest.fn();
      await pageInstance.loadReadingContent();
      const flags = pageInstance.data.paragraphs.map((p) => p.canHighlight);
      expect(flags).toEqual([false, true, false]);
      expect(pageInstance.initCompanionFeatures).toHaveBeenCalledWith(true);
    });

    test('popular request failure silently disables highlighting', async () => {
      pageInstance._highlightEnabled = true;
      highlight.getSectionPopular.mockRejectedValue(new Error('403'));
      await pageInstance.loadHighlightMarks();
      expect(pageInstance._highlightEnabled).toBe(false);
      expect(pageInstance.data.paragraphs[1].mine).toBeUndefined();
    });
  });
});
