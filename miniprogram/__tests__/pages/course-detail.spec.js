jest.mock('../../services/course.service', () => ({}));
jest.mock('../../services/checkin.service', () => ({
  getCheckinDetail: jest.fn()
}));
jest.mock('../../services/comment.service', () => ({
  createComment: jest.fn()
}));
jest.mock('../../services/subscribe-message.service', () => ({}));
jest.mock('../../utils/subscribe-auto-topup', () => ({}));
jest.mock('../../config/constants', () => ({}));
jest.mock('../../utils/period-access', () => ({
  getPeriodAccess: jest.fn(),
  extractId: jest.fn()
}));

describe('course-detail page markdown support', () => {
  let pageConfig;
  let pageInstance;
  let commentService;
  let getAvatarColorByUserId;

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
          _id: 'user_fox',
          nickname: '小狐狸',
          avatarUrl: ''
        }
      }
    }));

    commentService = require('../../services/comment.service');
    ({ getAvatarColorByUserId } = require('../../utils/formatters'));
    require('../../pages/course-detail/course-detail');

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
    wx.showModal.mockClear();
  });

  afterEach(() => {
    delete global.Page;
    delete global.getApp;
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

  test('should enable dynamic detail mode when opened with checkinId', () => {
    pageInstance.loadCourseDetail = jest.fn();
    wx.setNavigationBarTitle = jest.fn();

    pageInstance.onLoad.call(pageInstance, {
      id: 'section_123',
      checkinId: 'checkin_456'
    });

    expect(pageInstance.data.isCheckinDetailMode).toBe(true);
    expect(pageInstance.data.shareCheckinId).toBe('checkin_456');
    expect(wx.setNavigationBarTitle).toHaveBeenCalledWith({ title: '动态详情' });
    expect(pageInstance.loadCourseDetail).toHaveBeenCalled();
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
      metaLine: '第20天打卡 | 第20个任务',
      hashTag: '#第20天 统合综效',
      periodChip: '心流之境',
      commentCount: 1
    });
    expect(pageInstance.data.detailCheckin.dateLabel).toBe('2025-07-04 15:09:53');
  });

  test('should build poster snapshot from detail checkin data', () => {
    const snapshot = pageInstance.buildPosterSnapshot.call(pageInstance, {
      userName: '狮子',
      content: '第一段内容\n第二段内容',
      hashTag: '#第20天 统合综效',
      periodChip: '心流之境',
      dateLabel: '2025-07-04 15:09:53',
      sectionTitle: '统合综效',
      likeCount: 4,
      commentCount: 2
    });

    expect(snapshot.width).toBe(1040);
    expect(snapshot.height).toBeGreaterThanOrEqual(1480);
    expect(snapshot.titleLines[0]).toContain('狮子的打卡日记');
    expect(snapshot.contentLines).toContain('第一段内容');
    expect(snapshot.tagLines[0]).toBe('#第20天 统合综效');
    expect(snapshot.statsLine).toBe('获赞 4 · 评论 2');
    expect(snapshot.miniProgramCodePath).toBe('/assets/images/mini-program-code.png');
  });

  test('should draw mini program qr code into poster canvas', async () => {
    await pageInstance.generateLongImagePoster.call(pageInstance, {
      userName: '狮子',
      content: '测试正文',
      hashTag: '#第20天 统合综效',
      periodChip: '心流之境',
      dateLabel: '2025-07-04 15:09:53',
      sectionTitle: '统合综效',
      likeCount: 1,
      commentCount: 0
    });

    expect(global.__mockCanvasCreateImage).toHaveBeenCalled();
    expect(global.__mockCanvasImageSrcs).toContain('/assets/images/mini-program-code.png');
    expect(global.__mockCanvasContext.drawImage).toHaveBeenCalled();
  });

  test('should generate poster gallery for all built-in styles', async () => {
    pageInstance.generateLongImagePoster = jest
      .fn()
      .mockResolvedValueOnce('/tmp/poster-1.png')
      .mockResolvedValueOnce('/tmp/poster-2.png')
      .mockResolvedValueOnce('/tmp/poster-3.png')
      .mockResolvedValueOnce('/tmp/poster-4.png');

    const galleryItems = await pageInstance.generatePosterGallery.call(pageInstance, {
      id: 'checkin_123',
      userName: '狮子',
      content: '测试正文'
    });

    expect(pageInstance.generateLongImagePoster).toHaveBeenCalledTimes(4);
    expect(galleryItems.map(item => item.name)).toEqual(['青岚', '暮紫', '晴空', '留白']);
    expect(galleryItems.map(item => item.tempFilePath)).toEqual([
      '/tmp/poster-1.png',
      '/tmp/poster-2.png',
      '/tmp/poster-3.png',
      '/tmp/poster-4.png'
    ]);
  });

  test('should show toast when generating long image without detail checkin', () => {
    pageInstance.handleLongImageShare.call(pageInstance);

    expect(wx.showToast).toHaveBeenCalledWith({
      title: '暂无可生成的内容',
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
        content: '哈哈哈'
      });
    });
    pageInstance.triggerAutoTopUp = jest.fn();
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

    expect(pageInstance.data.course.comments[0].replies[0]).toMatchObject({
      userName: '小狐狸',
      avatarText: '小',
      avatarUrl: '',
      avatarColor: getAvatarColorByUserId('user_fox')
    });
  });

  test('should use stable avatar color rule for checkin author and comments', () => {
    const checkinItem = pageInstance.buildCheckinItem.call(pageInstance, {
      _id: 'checkin_1',
      userId: {
        _id: 'user_fox',
        nickname: '小狐狸',
        avatarUrl: ''
      }
    });

    expect(checkinItem.avatarColor).toBe(getAvatarColorByUserId('user_fox'));
  });
});
