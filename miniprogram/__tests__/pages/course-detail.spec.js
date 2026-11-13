jest.mock('../../services/course.service', () => ({
  getCourseDetail: jest.fn(),
  getPeriodSections: jest.fn()
}));
jest.mock('../../services/checkin.service', () => ({
  getCheckinDetail: jest.fn(),
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
jest.mock('../../services/comment.service', () => ({
  createComment: jest.fn(),
  getCommentsByCheckin: jest.fn()
}));
jest.mock('../../services/activity.service', () => ({
  track: jest.fn(() => Promise.resolve())
}));
jest.mock('../../services/subscribe-message.service', () => ({}));
jest.mock('../../services/seen-card.service', () => ({
  getSummary: jest.fn(() => Promise.resolve({})),
  sendSeen: jest.fn(),
  withdrawSeen: jest.fn()
}));
jest.mock('../../utils/subscribe-auto-topup', () => ({
  maybeAutoTopUpNextDayStudyReminder: jest.fn(() => Promise.resolve())
}));
jest.mock('../../config/constants', () => ({
  STORAGE_KEYS: {
    TOKEN: 'token'
  }
}));
jest.mock('../../utils/period-access', () => ({
  getPeriodAccess: jest.fn(),
  extractId: jest.fn()
}));

const currentTenant = require('../../config/current-tenant');
let periodAccess;

describe('course-detail page markdown support', () => {
  let pageConfig;
  let pageInstance;
  let commentService;
  let checkinService;
  let courseService;
  let getAvatarColorByUserId;
  let subscribeAutoTopUp;

  beforeEach(() => {
    jest.resetModules();
    periodAccess = require('../../utils/period-access');
    periodAccess.extractId.mockImplementation(value => {
      if (value && typeof value === 'object') return value._id || value.id || null;
      return value || null;
    });
    pageConfig = null;
    global.Page = jest.fn(config => {
      pageConfig = config;
      return config;
    });
    global.getApp = jest.fn(() => ({
      globalData: {
        userInfo: {
          _id: 'user_fox',
          nickname: '小狐狸',
          avatarUrl: ''
        }
      }
    }));

    commentService = require('../../services/comment.service');
    checkinService = require('../../services/checkin.service');
    courseService = require('../../services/course.service');
    ({ getAvatarColorByUserId } = require('../../utils/formatters'));
    subscribeAutoTopUp = require('../../utils/subscribe-auto-topup');
    require('../../pages/course-detail/course-detail');

    pageInstance = {
      ...pageConfig,
      data: JSON.parse(JSON.stringify(pageConfig.data)),
      setData(update, callback) {
        const nextData = { ...this.data };
        Object.entries(update).forEach(([key, value]) => {
          if (!key.includes('.')) {
            nextData[key] = value;
            return;
          }

          const parts = key.split('.');
          let target = nextData;
          parts.forEach((part, index) => {
            if (index === parts.length - 1) {
              target[part] = value;
              return;
            }
            target[part] = { ...(target[part] || {}) };
            target = target[part];
          });
        });
        this.data = nextData;
        if (typeof callback === 'function') {
          callback();
        }
      }
    };

    if (global.__mockCanvasContext?.drawImage) {
      global.__mockCanvasContext.drawImage.mockClear();
    }
    if (global.__mockCanvasCreateImage) {
      global.__mockCanvasCreateImage.mockClear();
    }
    if (Array.isArray(global.__mockCanvasImageSrcs)) {
      global.__mockCanvasImageSrcs.length = 0;
    }
    if (commentService.createComment) {
      commentService.createComment.mockReset();
    }
    checkinService.getCheckinDetail.mockReset();
    courseService.getCourseDetail.mockReset();
    courseService.getPeriodSections.mockReset();
    periodAccess.getPeriodAccess.mockReset();
    commentService.getCommentsByCheckin.mockReset();
    wx.showShareMenu = wx.showShareMenu || jest.fn();
    wx.hideShareMenu = wx.hideShareMenu || jest.fn();
    wx.showShareMenu.mockClear();
    wx.hideShareMenu.mockClear();
    wx.showModal.mockClear();
    wx.showToast.mockClear();
    wx.showShareImageMenu?.mockClear();
    wx.canvasToTempFilePath?.mockClear();
  });

  afterEach(() => {
    delete global.Page;
    delete global.getApp;
    delete global.wx.env;
    delete global.wx.getFileSystemManager;
    delete global.wx.shareFileMessage;
    delete global.wx.setClipboardData;
    delete global.wx.createVideoContext;
    delete global.wx.nextTick;
  });

  test('should render markdown course content into rich-text html', () => {
    const course = pageInstance.processCourseModules({
      meditation: '',
      question: '',
      content: '# 标题\n\n- 第一条\n- 第二条\n\n**加粗**',
      reflection: '',
      action: '',
      learn: '',
      extract: '',
      say: ''
    });

    expect(course.contentVisible).toBe(true);
    expect(course.content).toContain('<strong>标题</strong>');
    expect(course.content).toContain('<ul');
    expect(course.content).toContain('<li');
    expect(course.content).toContain('<strong>加粗</strong>');
  });

  test('should keep html content compatible with rich-text', () => {
    const course = pageInstance.processCourseModules({
      meditation: '',
      question: '',
      content: '<p class="ql-align-center">正文</p><img src="https://example.com/test.png" data-id="1">',
      reflection: '',
      action: '',
      learn: '',
      extract: '',
      say: ''
    });

    expect(course.contentVisible).toBe(true);
    expect(course.content).toContain('<p>正文</p>');
    expect(course.content).toContain('alt="图片"');
    expect(course.content).toContain('style="display:block;width:100%;height:auto;margin:12px 0;border-radius:4px;"');
    expect(course.content).not.toContain('class=');
    expect(course.content).not.toContain('data-id=');
  });

  test('should share focused checkin when opened from a diary detail entry', () => {
    pageInstance.setData({
      courseId: 'section_123',
      course: {
        title: '觉察日记'
      },
      shareCheckinId: 'checkin_456',
      shareCheckinUserName: '狮子'
    });

    const shareConfig = pageInstance.onShareAppMessage.call(pageInstance);

    expect(shareConfig.title).toBe('狮子的打卡日记');
    expect(shareConfig.path).toBe('/pages/course-detail/course-detail?id=section_123&checkinId=checkin_456');
  });

  test('should prefer generated podcast share image over brand illustration fallback', () => {
    pageInstance.setData({
      courseId: 'section_123',
      course: {
        title: '第七天晨读',
        coverImage: 'https://example.com/course-cover.jpg'
      },
      podcastShareMode: true,
      podcastShareImagePath: '/tmp/podcast-share.png'
    });

    const shareConfig = pageInstance.onShareAppMessage.call(pageInstance);

    expect(shareConfig.imageUrl).toBe('/tmp/podcast-share.png');
    expect(pageInstance.data.podcastShareMode).toBe(false);
  });

  test('should fall back to the tenant share cover for podcast sharing', () => {
    pageInstance.setData({
      courseId: 'section_123',
      course: { title: '第七天晨读' },
      podcastShareMode: true,
      podcastShareImagePath: ''
    });

    const shareConfig = pageInstance.onShareAppMessage.call(pageInstance);

    expect(shareConfig.imageUrl).toBe(currentTenant.shareCover);
  });

  test('should top up next-day reminder before entering immersive reading', async () => {
    pageInstance.data.courseId = 'section_123';
    pageInstance.data.periodId = 'period_123';

    await pageInstance.handleImmersiveReading.call(pageInstance);

    expect(subscribeAutoTopUp.maybeAutoTopUpNextDayStudyReminder).toHaveBeenCalledWith({
      periodId: 'period_123',
      sectionId: 'section_123',
      courseId: 'section_123',
      sourcePage: 'course-detail',
      sourceAction: 'immersive_reading_click'
    });
    expect(wx.navigateTo).toHaveBeenCalledWith({
      url: '/pages/reading-mode/reading-mode?id=section_123&periodId=period_123'
    });
  });

  test('should normalize closing video urls for display', () => {
    const course = pageInstance.processCourseModules({
      meditation: '',
      question: '',
      content: '',
      reflection: '',
      action: '',
      learn: '',
      extract: '',
      say: '',
      closingVideo: {
        url: '/uploads/tenants/default/closing.mp4',
        coverUrl: '/uploads/tenants/default/closing-cover.jpg',
        duration: 291
      }
    });

    expect(course.closingVideoVisible).toBe(true);
    expect(course.closingVideoUrl).toContain('/uploads/tenants/default/closing.mp4');
    expect(course.closingVideoCoverUrl).toContain('/uploads/tenants/default/closing-cover.jpg');
    expect(course.closingVideoDurationText).toBe('4:51');
    expect(course.closingVideo.url).toBe(course.closingVideoUrl);
    expect(course.closingVideo.coverUrl).toBe(course.closingVideoCoverUrl);
  });

  test('should activate closing video only after cover tap', () => {
    wx.createVideoContext = jest.fn(() => ({
      play: jest.fn()
    }));
    wx.nextTick = jest.fn(callback => callback());
    pageInstance.setData({
      closingVideoActivated: false,
      course: {
        closingVideoUrl: 'https://example.com/closing.mp4',
        closingVideoCoverUrl: 'https://example.com/closing-cover.jpg'
      }
    });

    pageInstance.handleClosingVideoPlay.call(pageInstance);

    expect(pageInstance.data.closingVideoActivated).toBe(true);
    expect(wx.createVideoContext).toHaveBeenCalledWith('closing-video-player', pageInstance);
  });

  test('should restore closing video cover when video load fails', () => {
    pageInstance.setData({
      closingVideoActivated: true,
      course: {
        closingVideoUrl: 'https://example.com/closing.mp4',
        closingVideoCoverUrl: 'https://example.com/closing-cover.jpg'
      }
    });

    pageInstance.handleClosingVideoError.call(pageInstance, { detail: { errMsg: 'fail' } });

    expect(pageInstance.data.closingVideoActivated).toBe(false);
    expect(wx.showToast).toHaveBeenCalledWith({
      title: '视频没加载出来，稍后再试试',
      icon: 'none'
    });
  });

  test('should expose closing video cover load diagnostics', () => {
    pageInstance.setData({
      course: {
        closingVideoCoverUrl: 'https://example.com/closing-cover.jpg'
      }
    });

    expect(() => {
      pageInstance.handleClosingVideoCoverLoad.call(pageInstance, { detail: { width: 854, height: 480 } });
      pageInstance.handleClosingVideoCoverError.call(pageInstance, { detail: { errMsg: 'fail' } });
    }).not.toThrow();
  });

  test('should use closing video cover for normal course share', () => {
    pageInstance.setData({
      courseId: 'section_123',
      course: {
        title: '结营词',
        closingVideoCoverUrl: 'https://example.com/closing-cover.jpg'
      },
      shareCheckinId: ''
    });

    const shareConfig = pageInstance.onShareAppMessage.call(pageInstance);

    expect(shareConfig).toMatchObject({
      title: '结营词',
      path: '/pages/course-detail/course-detail?id=section_123',
      imageUrl: 'https://example.com/closing-cover.jpg'
    });
  });

  test('should share closing video with video anchor and cover', () => {
    pageInstance.setData({
      courseId: 'section_123',
      course: {
        title: '结营词',
        closingVideoVisible: true,
        closingVideoCoverUrl: 'https://example.com/closing-cover.jpg'
      }
    });

    pageInstance.handleClosingVideoShare.call(pageInstance);
    const shareConfig = pageInstance.onShareAppMessage.call(pageInstance);

    expect(shareConfig).toMatchObject({
      title: '结营视频｜结营词',
      path: '/pages/course-detail/course-detail?id=section_123&anchor=closingVideo',
      imageUrl: 'https://example.com/closing-cover.jpg'
    });
    expect(pageInstance.data.closingVideoShareMode).toBe(false);
  });

  test('should prepare checkin txt file before showing share menu and forward it on tap', async () => {
    let writtenFile = null;
    global.wx.env = { USER_DATA_PATH: '/mock-user-data' };
    global.wx.getFileSystemManager = jest.fn(() => ({
      writeFile: jest.fn(options => {
        writtenFile = options;
        options.success();
      })
    }));
    global.wx.shareFileMessage = jest.fn();
    global.wx.setClipboardData = jest.fn();

    pageInstance.setData({
      course: { title: '觉察日记' },
      shareCheckinId: 'checkin_456',
      shareCheckinUserName: '狮子',
      detailCheckin: {
        id: 'checkin_456',
        userName: '狮子',
        metaLine: '第3课打卡',
        hashTag: '#第3课 思维方式的力量',
        periodChip: '内在之光',
        dateLabel: '2026-03-29 22:11:39',
        content: '哈哈哈哈笑死我了！'
      }
    });

    await pageInstance.openCheckinShareMenu.call(pageInstance);

    const expectedFilePath = `/mock-user-data/${currentTenant.brandName}：狮子的打卡日记.txt`;
    expect(writtenFile.filePath).toBe(expectedFilePath);
    expect(writtenFile.encoding).toBe('utf8');
    expect(writtenFile.data).toContain('狮子的打卡日记');
    expect(writtenFile.data).toContain('哈哈哈哈笑死我了！');
    expect(pageInstance.data.showCheckinShareMenu).toBe(true);
    expect(pageInstance.data.checkinTextShareFilePath).toBe(expectedFilePath);

    pageInstance.handleCheckinTextShare.call(pageInstance);

    expect(global.wx.shareFileMessage).toHaveBeenCalledWith(expect.objectContaining({
      filePath: expectedFilePath,
      fileName: `${currentTenant.brandName}：狮子的打卡日记.txt`
    }));
    expect(global.wx.setClipboardData).not.toHaveBeenCalled();
  });

  test('should not copy checkin text when txt file forwarding is unavailable', () => {
    global.wx.setClipboardData = jest.fn();
    global.wx.showToast = jest.fn();

    pageInstance.setData({
      detailCheckin: {
        id: 'checkin_456',
        userName: '狮子',
        content: '哈哈哈哈笑死我了！'
      },
      checkinTextShareFilePath: '/mock-user-data/若星生活家：狮子的打卡日记.txt',
      checkinTextShareFileName: '若星生活家：狮子的打卡日记.txt',
      showCheckinShareMenu: true
    });

    pageInstance.handleCheckinTextShare.call(pageInstance);

    expect(global.wx.setClipboardData).not.toHaveBeenCalled();
    expect(global.wx.showToast).toHaveBeenCalledWith({
      title: '当前微信版本不支持txt转发',
      icon: 'none'
    });
  });

  test('should enable dynamic detail mode when opened with checkinId', () => {
    pageInstance.loadCourseDetail = jest.fn();
    wx.setNavigationBarTitle = jest.fn();

    pageInstance.onLoad.call(pageInstance, {
      id: 'section_123',
      checkinId: 'checkin_456'
    });
    pageInstance.onReady.call(pageInstance);

    expect(pageInstance.data.isCheckinDetailMode).toBe(true);
    expect(pageInstance.data.shareCheckinId).toBe('checkin_456');
    expect(pageInstance.data.canShareCurrentCheckin).toBe(true);
    expect(wx.setNavigationBarTitle).toHaveBeenCalledWith({ title: '打卡详情' });
    expect(wx.showShareMenu).toHaveBeenCalled();
    expect(pageInstance.loadCourseDetail).toHaveBeenCalled();
  });

  test('should render anonymous public checkin details without course or comment requests', async () => {
    global.getApp.mockReturnValue({
      globalData: {
        isLogin: false,
        userInfo: {}
      }
    });
    checkinService.getCheckinDetail.mockResolvedValue({
      _id: 'checkin_public',
      userId: { _id: 'user_wang', nickname: '王可心' },
      periodId: { _id: 'period_1', name: '心想事成' },
      sectionId: { _id: 'section_1', title: '空间管理', day: 3 },
      note: '公开打卡正文',
      images: [],
      likes: []
    });
    pageInstance.setData({
      courseId: 'section_original',
      periodId: 'period_1',
      isCheckinDetailMode: true,
      shareCheckinId: 'checkin_public'
    });

    await pageInstance.loadCourseDetail.call(pageInstance);

    expect(checkinService.getCheckinDetail).toHaveBeenCalledWith('checkin_public');
    expect(courseService.getCourseDetail).not.toHaveBeenCalled();
    expect(courseService.getPeriodSections).not.toHaveBeenCalled();
    expect(periodAccess.getPeriodAccess).not.toHaveBeenCalled();
    expect(commentService.getCommentsByCheckin).not.toHaveBeenCalled();
    expect(pageInstance.data.loading).toBe(false);
    expect(pageInstance.data.showPageContent).toBe(true);
    expect(pageInstance.data.commentsLocked).toBe(true);
    expect(pageInstance.data.commentsLockedMessage).toBe('登录并加入营期后可查看评论');
    expect(pageInstance.data.detailCheckin).toMatchObject({
      id: 'checkin_public',
      userName: '王可心',
      content: '公开打卡正文',
      sectionTitle: '空间管理'
    });
  });

  test('should load checkin comments only after community access is enabled', async () => {
    global.getApp.mockReturnValue({
      globalData: {
        isLogin: true,
        userInfo: { _id: 'user_fox' }
      }
    });
    periodAccess.getPeriodAccess.mockResolvedValue({
      communityAccessState: 'enabled',
      canAccessCommunity: true,
      paymentStatus: 'paid'
    });
    checkinService.getCheckinDetail.mockResolvedValue({
      _id: 'checkin_public',
      userId: { _id: 'user_wang', nickname: '王可心' },
      periodId: { _id: 'period_1', name: '心想事成' },
      sectionId: { _id: 'section_1', title: '空间管理', day: 3 },
      note: '公开打卡正文'
    });
    commentService.getCommentsByCheckin.mockResolvedValue({ list: [] });
    pageInstance.setData({
      courseId: 'section_original',
      periodId: 'period_1',
      isCheckinDetailMode: true,
      shareCheckinId: 'checkin_public'
    });

    await pageInstance.loadCourseDetail.call(pageInstance);

    expect(courseService.getCourseDetail).not.toHaveBeenCalled();
    expect(periodAccess.getPeriodAccess).toHaveBeenCalledWith('period_1');
    expect(pageInstance.data.commentsLocked).toBe(false);
    expect(commentService.getCommentsByCheckin).toHaveBeenCalledWith(
      'checkin_public',
      { limit: 100 }
    );
  });

  test('should navigate to checkin detail when tapping a checkin card', () => {
    pageInstance.setData({
      courseId: 'section_123',
      isCheckinDetailMode: false,
      shareCheckinId: ''
    });

    pageInstance.handleCheckinDetailTap.call(pageInstance, {
      currentTarget: {
        dataset: {
          checkinId: 'checkin_456',
          sectionId: 'section_123'
        }
      }
    });

    expect(wx.navigateTo).toHaveBeenCalledWith({
      url: '/pages/course-detail/course-detail?id=section_123&checkinId=checkin_456'
    });
  });

  test('should build single checkin detail payload for dynamic detail view', () => {
    pageInstance.setData({
      course: {
        title: '统合综效',
        day: 20,
        periodId: {
          title: '心流之境'
        },
        comments: [
          {
            id: 'checkin_456',
            userId: 'user_1',
            userName: '狮子',
            content: '真知共识如同活细胞',
            likeCount: 3,
            isLiked: true,
            replies: [
              { id: 'comment_1', content: '写得真好' }
            ],
            images: [
              'https://wx.shubai01.com/uploads/tenants/fanren/checkins/a.jpg',
              'https://wx.shubai01.com/uploads/tenants/fanren/checkins/b.jpg'
            ],
            sectionTitle: '统合综效',
            sectionDay: 20,
            checkinDate: '2025-07-04T07:09:53.000Z'
          }
        ]
      },
      isCheckinDetailMode: true,
      shareCheckinId: 'checkin_456'
    });

    pageInstance.syncDetailCheckinState.call(pageInstance);

    expect(pageInstance.data.detailCheckin).toMatchObject({
      id: 'checkin_456',
      metaLine: '第21课打卡',
      hashTag: '#第21课 统合综效',
      periodChip: '心流之境',
      commentCount: 1,
      images: [
        'https://wx.shubai01.com/uploads/tenants/fanren/checkins/a.jpg',
        'https://wx.shubai01.com/uploads/tenants/fanren/checkins/b.jpg'
      ]
    });
    expect(pageInstance.data.detailCheckin.dateLabel).toBe('2025-07-04 15:09:53');
  });

  test('keeps one-based lesson numbers unchanged in course checkin details', () => {
    pageInstance.setData({
      lessonNumberingBase: 1,
      course: {
        comments: [
          {
            id: 'checkin_one_based',
            userName: '狮子',
            content: '空间创造',
            sectionTitle: '空间创造四步曲',
            sectionDay: 8,
            checkinDate: '2026-11-08T07:09:53.000Z'
          }
        ]
      },
      isCheckinDetailMode: true,
      shareCheckinId: 'checkin_one_based'
    });

    pageInstance.syncDetailCheckinState.call(pageInstance);

    expect(pageInstance.data.detailCheckin).toMatchObject({
      metaLine: '第8课打卡',
      hashTag: '#第8课 空间创造四步曲'
    });
  });

  test('should share selected poster image to WeChat friend', () => {
    pageInstance.setData({
      selectedPoster: {
        tempFilePath: 'wxfile://selected-poster.png'
      }
    });

    pageInstance.handleShareSelectedPoster.call(pageInstance);

    expect(wx.showShareImageMenu).toHaveBeenCalledWith(
      expect.objectContaining({
        path: 'wxfile://selected-poster.png'
      })
    );
  });

  test('should show toast when poster image sharing is unavailable', () => {
    const originalShowShareImageMenu = wx.showShareImageMenu;
    delete wx.showShareImageMenu;
    pageInstance.setData({
      selectedPoster: {
        tempFilePath: 'wxfile://selected-poster.png'
      }
    });

    pageInstance.handleShareSelectedPoster.call(pageInstance);

    expect(wx.showToast).toHaveBeenCalledWith({
      title: '当前微信版本不支持图片分享',
      icon: 'none'
    });

    wx.showShareImageMenu = originalShowShareImageMenu;
  });

  test('should allow sharing for other users detail checkin', () => {
    pageInstance.setData({
      course: {
        comments: [
          {
            id: 'checkin_999',
            userId: 'user_other',
            userName: '陌生人',
            content: '这是别人的小凡看见'
          }
        ]
      },
      isCheckinDetailMode: true,
      shareCheckinId: 'checkin_999'
    });

    pageInstance.syncDetailCheckinState.call(pageInstance);

    expect(pageInstance.data.detailCheckin.canShare).toBe(true);
    expect(pageInstance.data.canShareCurrentCheckin).toBe(true);
    expect(wx.showShareMenu).toHaveBeenCalled();
    expect(wx.hideShareMenu).not.toHaveBeenCalled();
  });

  test('should mark long checkin content as expandable and toggle expanded state', () => {
    const longCheckin = pageInstance.buildCheckinItem.call(pageInstance, {
      _id: 'checkin_long',
      userId: 'user_fox',
      note: '这是很长的打卡内容'.repeat(20)
    });

    pageInstance.setData({
      course: {
        comments: [longCheckin]
      }
    });

    expect(longCheckin.canExpandContent).toBe(true);
    expect(longCheckin.contentExpanded).toBe(false);

    pageInstance.toggleCheckinContent.call(pageInstance, {
      currentTarget: {
        dataset: {
          checkinId: 'checkin_long'
        }
      }
    });

    expect(pageInstance.data.course.comments[0].contentExpanded).toBe(true);
  });

  test('should build poster snapshot from detail checkin data', () => {
    const snapshot = pageInstance.buildPosterSnapshot.call(pageInstance, {
      userName: '狮子',
      content: '第一段内容\n第二段内容',
      hashTag: '#第21课 统合综效',
      periodChip: '心流之境',
      dateLabel: '2025-07-04 15:09:53',
      sectionTitle: '统合综效',
      likeCount: 4,
      commentCount: 2
    });

    expect(snapshot.width).toBe(1040);
    expect(snapshot.height).toBeGreaterThanOrEqual(900);
    expect(snapshot.titleLines[0]).toContain('狮子的打卡日记');
    expect(snapshot.contentLines).toContain('第一段内容');
    expect(snapshot.contentTruncated).toBe(false);
    expect(snapshot.tagLines[0]).toBe('#第21课 统合综效');
    expect(snapshot.statsLine).toBe('获赞 4 · 评论 2');
    expect(snapshot.miniProgramCodePath).toBe('/assets/images/mini-program-code.jpg');
  });

  test('should place ordered checkin images between content and hash-tag', () => {
    const snapshot = pageInstance.buildPosterSnapshot.call(
      pageInstance,
      {
        userName: '狮子',
        content: '正文内容',
        hashTag: '#第1课 第一天',
        periodChip: '七个习惯晨读营'
      },
      undefined,
      {
        imageInfos: [
          {
            sourceUrl: 'https://example.com/first.jpg',
            drawSource: 'wxfile://first',
            sourceWidth: 1200,
            sourceHeight: 800
          },
          {
            sourceUrl: 'https://example.com/second.jpg',
            drawSource: 'wxfile://second',
            sourceWidth: 800,
            sourceHeight: 1200
          }
        ]
      }
    );

    expect(snapshot.hasImages).toBe(true);
    expect(snapshot.imageLayouts.map(image => image.sourceUrl)).toEqual([
      'https://example.com/first.jpg',
      'https://example.com/second.jpg'
    ]);
    expect(snapshot.imageLayouts[0].width).toBe(896);
    expect(snapshot.imageLayouts[0].x).toBe(72);
    expect(snapshot.imageLayouts[0].height).toBeCloseTo(597.33, 1);
    expect(snapshot.imageLayouts[1].height).toBeCloseTo(1344, 1);
    expect(snapshot.tagLines[0]).toBe('#第1课 第一天');
    expect(snapshot.imageSectionHeight).toBeGreaterThan(1900);
  });

  test('should proportionally scale an extreme image batch within its height budget', () => {
    const imageInfos = Array.from({ length: 9 }, (_, index) => ({
      sourceUrl: `https://example.com/${index}.jpg`,
      drawSource: `wxfile://${index}`,
      sourceWidth: 800,
      sourceHeight: 2400
    }));

    const layout = pageInstance.buildPosterImageLayouts.call(
      pageInstance,
      imageInfos
    );

    expect(layout.imageSectionHeight).toBeLessThanOrEqual(7200);
    expect(layout.layouts[0].width).toBeLessThan(896);
    expect(layout.layouts[0].height / layout.layouts[0].width).toBeCloseTo(3, 5);
  });

  test('should draw prepared checkin images in order and preserve their layout', async () => {
    const imageLayouts = [
      {
        sourceUrl: 'https://example.com/first.jpg',
        drawSource: 'wxfile://first',
        x: 72,
        width: 896,
        height: 597.33
      },
      {
        sourceUrl: 'https://example.com/second.jpg',
        drawSource: 'wxfile://second',
        x: 72,
        width: 896,
        height: 1344
      }
    ];
    pageInstance.loadPosterImage = jest
      .fn()
      .mockImplementation(async (canvas, candidates) => ({
        source: candidates[0]
      }));

    const result = await pageInstance.drawPosterImages.call(
      pageInstance,
      global.__mockCanvasContext,
      {},
      imageLayouts,
      500
    );

    expect(pageInstance.loadPosterImage.mock.calls.map(call => call[1][0])).toEqual([
      'wxfile://first',
      'wxfile://second'
    ]);
    expect(global.__mockCanvasContext.drawImage.mock.calls).toEqual([
      [
        { source: 'wxfile://first' },
        72,
        500,
        896,
        597.33
      ],
      [
        { source: 'wxfile://second' },
        72,
        1129.33,
        896,
        1344
      ]
    ]);
    expect(result.drawnImageCount).toBe(2);
  });

  test('should keep images in fallback posters while truncating oversized text', () => {
    const content = Array.from({ length: 180 }, (_, index) => `第${index + 1}句很长的打卡正文`).join('，');
    const snapshot = pageInstance.buildPosterSnapshot.call(
      pageInstance,
      {
        userName: '狮子',
        content,
        hashTag: '#第1课 第一天',
        periodChip: '七个习惯晨读营'
      },
      undefined,
      {
        maxHeight: 2400,
        imageInfos: [
          {
            sourceUrl: 'https://example.com/tall.jpg',
            drawSource: 'wxfile://tall',
            sourceWidth: 800,
            sourceHeight: 1800
          },
          {
            sourceUrl: 'https://example.com/tall-2.jpg',
            drawSource: 'wxfile://tall-2',
            sourceWidth: 800,
            sourceHeight: 1800
          }
        ]
      }
    );

    expect(snapshot.hasImages).toBe(true);
    expect(snapshot.contentTruncated).toBe(true);
    expect(snapshot.contentLines).toContain('进入小程序查看完整内容');
    expect(snapshot.imageSectionHeight).toBeGreaterThan(4000);
    expect(snapshot.height).toBeGreaterThan(2400);
  });

  test('should keep oversized poster content complete by default', () => {
    const content = Array.from({ length: 180 }, (_, index) => `第${index + 1}句很长的打卡正文`).join('，');

    const snapshot = pageInstance.buildPosterSnapshot.call(pageInstance, {
      userName: '狮子',
      content,
      hashTag: '#第4课 第三天 以原则为中心的思维方式',
      periodChip: '秩序之锚 - 七个习惯晨读营',
      dateLabel: '2026-05-12 10:41:25',
      sectionTitle: '第三天 以原则为中心的思维方式'
    });

    expect(snapshot.height).toBeGreaterThan(2400);
    expect(snapshot.contentTruncated).toBe(false);
    expect(snapshot.contentLines).not.toContain('进入小程序查看完整内容');
  });

  test('should truncate oversized poster content only for fallback poster', () => {
    const content = Array.from({ length: 180 }, (_, index) => `第${index + 1}句很长的打卡正文`).join('，');

    const snapshot = pageInstance.buildPosterSnapshot.call(
      pageInstance,
      {
        userName: '狮子',
        content,
        hashTag: '#第4课 第三天 以原则为中心的思维方式',
        periodChip: '秩序之锚 - 七个习惯晨读营',
        dateLabel: '2026-05-12 10:41:25',
        sectionTitle: '第三天 以原则为中心的思维方式'
      },
      undefined,
      { maxHeight: 2400 }
    );

    expect(snapshot.height).toBeLessThanOrEqual(2400);
    expect(snapshot.contentTruncated).toBe(true);
    expect(snapshot.contentLines).toContain('进入小程序查看完整内容');
  });

  test('should prepare and export checkin images with memory-safe poster settings', async () => {
    const originalGetImageInfo = wx.getImageInfo;
    wx.getImageInfo = jest.fn(({ src, success }) => {
      success({
        path: `wxfile://${src.split('/').pop()}`,
        width: 1200,
        height: 800
      });
    });

    try {
      await pageInstance.generateLongImagePoster.call(pageInstance, {
        userName: '狮子',
        content: '测试正文',
        images: [
          'https://example.com/first.jpg',
          'https://example.com/second.jpg'
        ],
        hashTag: '#第1课 第一天',
        periodChip: '七个习惯晨读营'
      });
    } finally {
      if (originalGetImageInfo) {
        wx.getImageInfo = originalGetImageInfo;
      } else {
        delete wx.getImageInfo;
      }
    }

    expect(wx.canvasToTempFilePath).toHaveBeenCalledWith(
      expect.objectContaining({
        destWidth: 1040,
        fileType: 'jpg',
        quality: 0.88
      })
    );
    expect(global.__mockCanvasImageSrcs).toEqual(
      expect.arrayContaining([
        'wxfile://first.jpg',
        'wxfile://second.jpg',
        '/assets/images/mini-program-code.jpg'
      ])
    );
    expect(global.__mockCanvasContext.drawImage.mock.calls.length).toBeGreaterThanOrEqual(3);
  });

  test('should draw mini program qr code into poster canvas', async () => {
    await pageInstance.generateLongImagePoster.call(pageInstance, {
      userName: '狮子',
      content: '测试正文',
      hashTag: '#第21课 统合综效',
      periodChip: '心流之境',
      dateLabel: '2025-07-04 15:09:53',
      sectionTitle: '统合综效',
      likeCount: 1,
      commentCount: 0
    });

    expect(global.__mockCanvasCreateImage).toHaveBeenCalled();
    expect(global.__mockCanvasImageSrcs).toContain('/assets/images/mini-program-code.jpg');
    expect(global.__mockCanvasContext.drawImage).toHaveBeenCalled();
  });

  test('should retry poster export with lower scale after timeout', async () => {
    wx.canvasToTempFilePath
      .mockImplementationOnce((options) => {
        options.fail({ errMsg: 'canvasToTempFilePath:fail timeout' });
      })
      .mockImplementationOnce((options) => {
        options.success({ tempFilePath: '/tmp/retry-poster.png' });
      });

    const tempFilePath = await pageInstance.exportPosterCanvasToTempFilePath.call(
      pageInstance,
      {},
      {
        width: 1040,
        height: 1480
      }
    );

    expect(tempFilePath).toBe('/tmp/retry-poster.png');
    expect(wx.canvasToTempFilePath).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        destWidth: 2080,
        destHeight: 2960
      })
    );
    expect(wx.canvasToTempFilePath).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        destWidth: 1560,
        destHeight: 2220
      })
    );
  });

  test('should create all poster template entries and generate the first one', async () => {
    pageInstance.generateLongImagePoster = jest
      .fn()
      .mockResolvedValueOnce('/tmp/poster-1.png');

    const galleryItems = await pageInstance.generatePosterGallery.call(pageInstance, {
      id: 'checkin_123',
      userName: '狮子',
      content: '测试正文'
    });

    expect(pageInstance.generateLongImagePoster).toHaveBeenCalledTimes(1);
    expect(galleryItems.map(item => item.name)).toEqual(['青岚', '暮紫', '晴空', '留白']);
    expect(galleryItems.map(item => item.tempFilePath)).toEqual([
      '/tmp/poster-1.png',
      '',
      '',
      ''
    ]);
  });

  test('should fall back to clipped poster when first template export fails', async () => {
    pageInstance.generateLongImagePoster = jest
      .fn()
      .mockRejectedValueOnce(new Error('timeout'))
      .mockResolvedValueOnce('/tmp/poster-fallback.png');

    const galleryItems = await pageInstance.generatePosterGallery.call(pageInstance, {
      id: 'checkin_123',
      userName: '狮子',
      content: '测试正文'
    });

    expect(pageInstance.generateLongImagePoster).toHaveBeenCalledTimes(2);
    expect(pageInstance.generateLongImagePoster).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ id: 'checkin_123' }),
      expect.objectContaining({ id: 'aurora' }),
      { maxHeight: 2400 }
    );
    expect(galleryItems.map(item => item.tempFilePath)).toEqual([
      '/tmp/poster-fallback.png',
      '',
      '',
      ''
    ]);
  });

  test('should generate selected poster template on demand', async () => {
    pageInstance.generateLongImagePoster = jest
      .fn()
      .mockResolvedValueOnce('/tmp/poster-lilac.png');
    pageInstance.setData({
      detailCheckin: {
        id: 'checkin_123',
        userName: '狮子',
        content: '测试正文'
      },
      posterGalleryItems: [
        { id: 'aurora', name: '青岚', tempFilePath: '/tmp/poster-1.png', generated: true },
        { id: 'lilac', name: '暮紫', tempFilePath: '', generated: false },
        { id: 'sky', name: '晴空', tempFilePath: '', generated: false },
        { id: 'paper', name: '留白', tempFilePath: '', generated: false }
      ]
    });

    await pageInstance.handlePosterTemplateSelect.call(pageInstance, {
      currentTarget: {
        dataset: {
          index: 1
        }
      }
    });

    expect(pageInstance.generateLongImagePoster).toHaveBeenCalledTimes(1);
    expect(pageInstance.generateLongImagePoster).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'checkin_123' }),
      expect.objectContaining({ id: 'lilac' })
    );
    expect(pageInstance.data.posterSelectedIndex).toBe(1);
    expect(pageInstance.data.selectedPoster).toMatchObject({
      id: 'lilac',
      tempFilePath: '/tmp/poster-lilac.png',
      generated: true
    });
  });

  test('should show toast when generating long image without detail checkin', () => {
    pageInstance.handleLongImageShare.call(pageInstance);

    expect(wx.showToast).toHaveBeenCalledWith({
      title: '这里还没有可以生成的内容',
      icon: 'none'
    });
  });

  test('should generate poster gallery panel when detail checkin exists', async () => {
    pageInstance.generatePosterGallery = jest.fn(() => Promise.resolve([
      { id: 'aurora', name: '青岚', tempFilePath: '/tmp/poster-1.png' },
      { id: 'lilac', name: '暮紫', tempFilePath: '/tmp/poster-2.png' }
    ]));
    pageInstance.setData({
      detailCheckin: {
        id: 'checkin_123',
        userName: '狮子',
        content: '测试正文'
      }
    });

    pageInstance.handleLongImageShare.call(pageInstance);
    await Promise.resolve();
    await Promise.resolve();

    expect(pageInstance.generatePosterGallery).toHaveBeenCalledWith({
      id: 'checkin_123',
      userName: '狮子',
      content: '测试正文'
    });
    expect(pageInstance.data.posterGalleryVisible).toBe(true);
    expect(pageInstance.data.posterGalleryItems).toHaveLength(2);
    expect(pageInstance.data.selectedPoster).toMatchObject({
      id: 'aurora',
      tempFilePath: '/tmp/poster-1.png'
    });
  });

  test('should keep local comment avatar text aligned with author avatar rule', async () => {
    commentService.createComment.mockResolvedValue({
      _id: 'comment_1'
    });
    wx.showModal.mockImplementation(({ success }) => {
      success({
        confirm: true,
        content: '哈哈哈[偷笑]'
      });
    });
    pageInstance.triggerAutoTopUp = jest.fn();
    pageInstance._requireInteraction = jest.fn(() => true);
    pageInstance.setData({
      communityAccessState: 'enabled',
      course: {
        comments: [
          {
            id: 'checkin_1',
            userName: '小狐狸',
            replies: []
          }
        ]
      }
    });

    await pageInstance.handleReplyComment.call(pageInstance, {
      currentTarget: {
        dataset: {
          id: 'checkin_1'
        }
      }
    });
    await Promise.resolve();
    await Promise.resolve();

    expect(commentService.createComment).toHaveBeenCalledWith({
      checkinId: 'checkin_1',
      content: '哈哈哈🤭'
    });
    expect(pageInstance.data.course.comments[0].replies[0]).toMatchObject({
      userName: '小狐狸',
      content: '哈哈哈🤭',
      avatarText: '狸',
      avatarUrl: '',
      avatarColor: getAvatarColorByUserId('user_fox')
    });
  });

  test('should use stable avatar color rule for checkin author and comments', () => {
    const checkinItem = pageInstance.buildCheckinItem.call(pageInstance, {
      _id: 'checkin_1',
      content: '今天很开心[庆祝]',
      images: ['https://wx.shubai01.com/uploads/tenants/fanren/checkins/a.jpg'],
      userId: {
        _id: 'user_fox',
        nickname: '小狐狸',
        avatarUrl: ''
      }
    });

    expect(checkinItem.avatarColor).toBe(getAvatarColorByUserId('user_fox'));
    expect(checkinItem.content).toBe('今天很开心🎉');
    expect(checkinItem.images).toEqual(['https://wx.shubai01.com/uploads/tenants/fanren/checkins/a.jpg']);
    expect(checkinItem.imageCount).toBe(1);
  });

  test('should preserve rich text html for checkin display', () => {
    const checkinItem = pageInstance.buildCheckinItem.call(pageInstance, {
      _id: 'checkin_rich',
      note: '要事第一：把注意力交还给生命主轴',
      contentHtml: '<p><strong>要事第一</strong>：<span style="color:#4a90e2">把注意力交还给生命主轴</span></p>',
      userId: {
        _id: 'user_fox',
        nickname: '小狐狸',
        avatarUrl: ''
      }
    });

    expect(checkinItem.content).toBe('要事第一：把注意力交还给生命主轴');
    expect(checkinItem.contentHtml).toContain('<strong>要事第一</strong>');
    expect(checkinItem.contentHtml).toContain('color:#4a90e2');
    expect(checkinItem.hasRichContent).toBe(true);
  });

  test('should use plain text highlight instead of rich html in checkin search mode', () => {
    pageInstance.setData({ searchKeyword: '注意力' });

    const checkinItem = pageInstance.buildCheckinItem.call(pageInstance, {
      _id: 'checkin_search',
      note: '要事第一：把注意力交还给生命主轴',
      contentHtml: '<p><strong>要事第一</strong>：<span style="color:#4a90e2">把注意力交还给生命主轴</span></p>'
    });

    expect(checkinItem.contentHtml).toContain('background:#fff3b0');
    expect(checkinItem.contentHtml).not.toContain('color:#4a90e2');
  });

  test('should preview all images from selected checkin', () => {
    pageInstance.setData({
      course: {
        comments: [
          {
            id: 'checkin_1',
            images: [
              'https://wx.shubai01.com/uploads/tenants/fanren/checkins/a.jpg',
              'https://wx.shubai01.com/uploads/tenants/fanren/checkins/b.jpg'
            ]
          }
        ]
      }
    });

    pageInstance.handleCheckinImagePreview.call(pageInstance, {
      currentTarget: {
        dataset: {
          checkinId: 'checkin_1',
          url: 'https://wx.shubai01.com/uploads/tenants/fanren/checkins/b.jpg'
        }
      }
    });

    expect(wx.previewImage).toHaveBeenCalledWith({
      current: 'https://wx.shubai01.com/uploads/tenants/fanren/checkins/b.jpg',
      urls: [
        'https://wx.shubai01.com/uploads/tenants/fanren/checkins/a.jpg',
        'https://wx.shubai01.com/uploads/tenants/fanren/checkins/b.jpg'
      ],
      showmenu: true
    });
  });

  test('prefetches the next TTS chunk while the current chunk is playing', async () => {
    const audio = {
      onEnded: jest.fn(),
      onError: jest.fn(),
      play: jest.fn(),
      pause: jest.fn(),
      destroy: jest.fn(),
      src: ''
    };
    const textToSpeech = jest.fn(({ content, success }) => {
      success({ filename: `audio-${content.slice(0, 1)}.mp3` });
    });
    wx.createInnerAudioContext = jest.fn(() => audio);
    global.requirePlugin = jest.fn(() => ({ textToSpeech }));

    pageInstance._ttsChunks = ['第一段。', '第二段。'];
    pageInstance._ttsChunkIndex = 0;
    pageInstance._ttsAudioFiles = [];
    pageInstance._ttsPending = new Map();
    pageInstance._ttsPlayChunk();

    await Promise.resolve();
    expect(textToSpeech).toHaveBeenCalledTimes(2);
  });

  test('pops the like icon and fires haptic only when liking, not when unliking', async () => {
    const feedback = require('../../utils/feedback');
    const hapticSpy = jest.spyOn(feedback, 'haptic').mockImplementation(() => {});
    jest.useFakeTimers();
    commentService.likeCheckin = jest.fn().mockResolvedValue({});
    commentService.unlikeCheckin = jest.fn().mockResolvedValue({});
    pageInstance._requireInteraction = jest.fn(() => true);
    pageInstance.triggerAutoTopUp = jest.fn();
    pageInstance.syncDetailCheckinState = jest.fn();
    pageInstance.data.course = {
      comments: [{ id: 'checkin_1', isLiked: false, likeCount: 0, likeAvatars: [] }]
    };

    await pageInstance.handleLikeComment.call(pageInstance, {
      currentTarget: { dataset: { id: 'checkin_1' } }
    });

    expect(pageInstance.data.likePopId).toBe('checkin_1');
    expect(hapticSpy).toHaveBeenCalledWith('light');
    jest.advanceTimersByTime(400);
    expect(pageInstance.data.likePopId).toBe('');

    hapticSpy.mockClear();
    await pageInstance.handleLikeComment.call(pageInstance, {
      currentTarget: { dataset: { id: 'checkin_1' } }
    });

    expect(pageInstance.data.course.comments[0].isLiked).toBe(false);
    expect(pageInstance.data.likePopId).toBe('');
    expect(hapticSpy).not.toHaveBeenCalled();
    hapticSpy.mockRestore();
    jest.useRealTimers();
  });

  describe('mood summary and seen cards', () => {
    let seenService;
    beforeEach(() => {
      seenService = require('../../services/seen-card.service');
      seenService.getSummary = jest.fn();
      seenService.sendSeen = jest.fn().mockResolvedValue({});
      seenService.withdrawSeen = jest.fn().mockResolvedValue({});
      global.getApp = jest.fn(() => ({
        globalData: { isLogin: true, userInfo: { _id: 'user_fox' } }
      }));
      pageInstance.data.communityAccessState = 'enabled';
      pageInstance.data.courseId = 'sec1';
    });

    test('builds mood summary text sorted by count, skipping zeros', () => {
      expect(pageInstance.buildMoodSummaryText({ happy: 2, calm: 5, low: 3, other: 0 }))
        .toBe('今天营里：5 多云 · 3 小雨 · 2 晴');
      expect(pageInstance.buildMoodSummaryText(null)).toBe('');
      expect(pageInstance.buildMoodSummaryText({ happy: 0 })).toBe('');
    });

    test('mood summary shows text when counts present, hidden for null, failure or locked', async () => {
      checkinService.getSectionMoodSummary = jest.fn().mockResolvedValue({ total: 5, counts: { happy: 4, low: 1 } });
      await pageInstance.loadMoodSummary();
      expect(checkinService.getSectionMoodSummary).toHaveBeenCalledWith('sec1');
      expect(pageInstance.data.moodSummaryText).toBe('今天营里：4 晴 · 1 小雨');

      checkinService.getSectionMoodSummary = jest.fn().mockResolvedValue({ total: 1, counts: null });
      await pageInstance.loadMoodSummary();
      expect(pageInstance.data.moodSummaryText).toBe('');

      pageInstance.data.moodSummaryText = '旧';
      checkinService.getSectionMoodSummary = jest.fn().mockRejectedValue(new Error('x'));
      await pageInstance.loadMoodSummary();
      expect(pageInstance.data.moodSummaryText).toBe('旧');

      pageInstance.data.communityAccessState = 'locked';
      checkinService.getSectionMoodSummary = jest.fn();
      await pageInstance.loadMoodSummary();
      expect(checkinService.getSectionMoodSummary).not.toHaveBeenCalled();
    });

    test('merges seen summary in batches of 50 and hides button on own checkins', async () => {
      const comments = Array.from({ length: 120 }, (_, i) => ({ id: `c${i}`, userId: i === 1 ? 'user_fox' : 'other' }));
      pageInstance.data.course = { comments };
      seenService.getSummary.mockImplementation(async (ids) =>
        ids.reduce((m, id) => ({ ...m, [id]: { total: id === 'c0' ? 3 : 0, mine: id === 'c0' ? 'persist' : null } }), {})
      );
      await pageInstance.loadSeenSummary();
      expect(seenService.getSummary.mock.calls.map(c => c[0].length)).toEqual([50, 50, 20]);
      const merged = pageInstance.data.course.comments;
      expect(merged[0]).toMatchObject({ seenAvailable: true, seenTotal: 3, seenMine: 'persist' });
      expect(merged[1].seenAvailable).toBe(false);
    });

    test('does not request seen summary when logged out or community locked', async () => {
      pageInstance.data.course = { comments: [{ id: 'c1', userId: 'o' }] };
      pageInstance.data.communityAccessState = 'locked';
      await pageInstance.loadSeenSummary();
      global.getApp = jest.fn(() => ({ globalData: { isLogin: false } }));
      pageInstance.data.communityAccessState = 'enabled';
      await pageInstance.loadSeenSummary();
      expect(seenService.getSummary).not.toHaveBeenCalled();
    });

    test('send, switch and withdraw update total and mine; haptic only on send', async () => {
      const feedback = require('../../utils/feedback');
      const hapticSpy = jest.spyOn(feedback, 'haptic').mockImplementation(() => {});
      pageInstance.data.course = {
        comments: [{ id: 'c1', userId: 'o', seenAvailable: true, seenTotal: 0, seenMine: null }]
      };
      const open = () => pageInstance.openSeenPanel({ currentTarget: { dataset: { id: 'c1' } } });
      const choose = (key) => pageInstance.chooseSeenPhrase({ currentTarget: { dataset: { key } } });

      open();
      await choose('persist');
      expect(seenService.sendSeen).toHaveBeenCalledWith('c1', 'persist');
      expect(pageInstance.data.course.comments[0]).toMatchObject({ seenTotal: 1, seenMine: 'persist' });
      expect(hapticSpy).toHaveBeenCalledWith('light');
      expect(pageInstance.data.seenPanelId).toBe('');

      hapticSpy.mockClear();
      open();
      await choose('thanks');
      expect(seenService.sendSeen).toHaveBeenLastCalledWith('c1', 'thanks');
      expect(pageInstance.data.course.comments[0]).toMatchObject({ seenTotal: 1, seenMine: 'thanks' });

      hapticSpy.mockClear();
      open();
      await choose('thanks');
      expect(seenService.withdrawSeen).toHaveBeenCalledWith('c1');
      expect(pageInstance.data.course.comments[0]).toMatchObject({ seenTotal: 0, seenMine: null });
      expect(hapticSpy).not.toHaveBeenCalled();
      hapticSpy.mockRestore();
    });

    test('stale summary does not overwrite a seen card changed locally while it was in flight', async () => {
      pageInstance.data.course = {
        comments: [
          { id: 'c1', userId: 'o', seenAvailable: true, seenTotal: 0, seenMine: null },
          { id: 'c2', userId: 'o', seenAvailable: true, seenTotal: 0, seenMine: null }
        ]
      };
      let resolveSummary;
      seenService.getSummary.mockImplementation(() => new Promise((r) => { resolveSummary = r; }));
      const pending = pageInstance.loadSeenSummary();

      pageInstance.openSeenPanel({ currentTarget: { dataset: { id: 'c1' } } });
      await pageInstance.chooseSeenPhrase({ currentTarget: { dataset: { key: 'persist' } } });

      resolveSummary({ c1: { total: 0, mine: null }, c2: { total: 4, mine: 'thanks' } });
      await pending;

      const [c1, c2] = pageInstance.data.course.comments;
      expect(c1).toMatchObject({ seenTotal: 1, seenMine: 'persist' });
      expect(c2).toMatchObject({ seenTotal: 4, seenMine: 'thanks' });
    });

    test('failure keeps state and shows an inline hint; own checkin cannot open panel', async () => {
      pageInstance.data.course = {
        comments: [
          { id: 'c1', seenAvailable: true, seenTotal: 2, seenMine: null },
          { id: 'c2', seenAvailable: false }
        ]
      };
      pageInstance.openSeenPanel({ currentTarget: { dataset: { id: 'c2' } } });
      expect(pageInstance.data.seenPanelId).toBe('');
      pageInstance.openSeenPanel({ currentTarget: { dataset: { id: 'c1' } } });
      seenService.sendSeen.mockRejectedValue(new Error('x'));
      await pageInstance.chooseSeenPhrase({ currentTarget: { dataset: { key: 'metoo' } } });
      expect(pageInstance.data.seenPanelError).toBeTruthy();
      expect(pageInstance.data.seenPanelId).toBe('c1');
      expect(pageInstance.data.course.comments[0]).toMatchObject({ seenTotal: 2, seenMine: null });
    });
  });

  describe('nine-step progress', () => {
    const fixedCourse = {
      customTemplate: false,
      meditationVisible: true,
      questionVisible: true,
      learnVisible: false,
      contentVisible: true,
      lookImageVisible: false,
      reflectionVisible: true,
      actionVisible: false,
      extractVisible: false,
      sayVisible: true
    };

    test('fixed template lists only visible modules in page order', () => {
      const steps = pageInstance.buildCourseSteps(fixedCourse);
      expect(steps.map(s => s.label)).toEqual(['静', '问', '读', '想', '说']);
      expect(steps.find(s => s.label === '读').id).toBe('reading-section');
      expect(steps[0].id).toBe('section-meditation');
    });

    test('custom template uses first character of module name or the index', () => {
      const steps = pageInstance.buildCourseSteps({
        customTemplate: true,
        dynamicModules: [
          { id: 'a', type: 'text', name: '晨光一刻' },
          { id: 'b', type: 'body', name: '正文' },
          { id: 'c', type: 'text', name: '' }
        ]
      });
      expect(steps.map(s => s.label)).toEqual(['晨', '正', '3']);
      expect(steps.map(s => s.id)).toEqual(['section-dyn-0', 'reading-section', 'section-dyn-2']);
    });

    test('returns empty list when fewer than two steps', () => {
      expect(pageInstance.buildCourseSteps({ customTemplate: false, sayVisible: true })).toEqual([]);
      expect(pageInstance.buildCourseSteps(null)).toEqual([]);
    });

    test('appends closing video and podcast after modules', () => {
      const steps = pageInstance.buildCourseSteps({
        ...fixedCourse,
        closingVideoVisible: true,
        podcastUrl: 'https://example.com/a.mp3'
      });
      expect(steps.slice(-2).map(s => s.label)).toEqual(['影', '播']);
      expect(steps.slice(-2).map(s => s.id)).toEqual(['closing-video-section', 'podcast-section']);
    });

    test('a lone module plus podcast still shows two steps', () => {
      const steps = pageInstance.buildCourseSteps({ customTemplate: false, sayVisible: true, podcastUrl: 'x' });
      expect(steps.map(s => s.label)).toEqual(['说', '播']);
    });

    test('tapping a step scrolls to its section and updates the current step', () => {
      pageInstance.data.course = { steps: [{ id: 'section-meditation', label: '静' }, { id: 'reading-section', label: '读' }] };
      wx.pageScrollTo = jest.fn();
      pageInstance.handleStepTap({ currentTarget: { dataset: { index: 1 } } });
      expect(pageInstance.data.currentStepIndex).toBe(1);
      expect(wx.pageScrollTo).toHaveBeenCalledWith(expect.objectContaining({ selector: '#reading-section' }));
    });

    test('scroll only updates data when the current step changes and timer is cleared on unload', () => {
      jest.useFakeTimers();
      pageInstance.data.course = { steps: [{ id: 'a', label: '静' }, { id: 'b', label: '读' }] };
      pageInstance.data.currentStepIndex = 0;
      pageInstance.setData = jest.fn(pageInstance.setData);
      wx.createSelectorQuery = jest.fn(() => {
        const q = {
          select: jest.fn(() => ({ boundingClientRect: jest.fn(() => q) })),
          selectViewport: jest.fn(() => ({ scrollOffset: jest.fn(() => q) }))
        };
        q.exec = cb => cb([{ top: -400 }, { top: 40 }]);
        return q;
      });
      pageInstance.onPageScroll();
      pageInstance.onPageScroll();
      jest.advanceTimersByTime(150);
      expect(pageInstance.setData).toHaveBeenCalledTimes(1);
      expect(pageInstance.data.currentStepIndex).toBe(1);
      pageInstance.setData.mockClear();
      pageInstance.onPageScroll();
      jest.advanceTimersByTime(150);
      expect(pageInstance.setData).not.toHaveBeenCalled();
      pageInstance.onPageScroll();
      pageInstance.onUnload();
      expect(pageInstance._stepScrollTimer).toBeNull();
      jest.useRealTimers();
    });
  });

  test('highlights the last step when scrolled to the page bottom', () => {
    jest.useFakeTimers();
    pageInstance.data.course = { steps: [{ id: 'a', label: '静' }, { id: 'b', label: '读' }, { id: 'c', label: '说' }] };
    pageInstance.data.currentStepIndex = 0;
    wx.getWindowInfo = jest.fn(() => ({ windowHeight: 700 }));
    wx.createSelectorQuery = jest.fn(() => {
      const q = {
        select: jest.fn(() => ({ boundingClientRect: jest.fn(() => q) })),
        selectViewport: jest.fn(() => ({ scrollOffset: jest.fn(() => q) }))
      };
      q.exec = cb => cb([{ top: -900 }, { top: -300 }, { top: 640 }, { scrollTop: 2300, scrollHeight: 3000 }]);
      return q;
    });
    pageInstance.onPageScroll();
    jest.advanceTimersByTime(150);
    expect(pageInstance.data.currentStepIndex).toBe(2);
    jest.useRealTimers();
  });
});
