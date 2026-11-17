jest.mock('../../services/companion-note.service', () => ({
  normalizeNote: jest.fn(item => ({ id: item._id || item.id, ...item })),
  getOne: jest.fn(),
  getComments: jest.fn(),
  createComment: jest.fn(),
  reply: jest.fn(),
  markRead: jest.fn(),
  like: jest.fn(),
  unlike: jest.fn(),
  likeComment: jest.fn(),
  unlikeComment: jest.fn(),
  removeComment: jest.fn(),
  removeReply: jest.fn()
}));

jest.mock('../../utils/dialog', () => ({
  showActionSheet: jest.fn(),
  showModal: jest.fn()
}));

describe('companion notes detail page', () => {
  let pageConfig;
  let pageInstance;
  let service;

  beforeEach(() => {
    jest.resetModules();
    pageConfig = null;
    global.Page = jest.fn(config => {
      pageConfig = config;
      return config;
    });
    global.getApp = jest.fn(() => ({ globalData: { userInfo: { _id: 'user_1', nickname: '小狐狸' } } }));
    wx.showToast.mockClear();
    service = require('../../services/companion-note.service');
    require('../../pages/companion-notes/detail/detail');
    pageInstance = {
      ...pageConfig,
      data: JSON.parse(JSON.stringify(pageConfig.data)),
      setData(update, callback) {
        this.data = { ...this.data, ...update };
        if (callback) callback();
      }
    };
  });

  afterEach(() => {
    delete global.Page;
    delete global.getApp;
  });

  test.each([
    [{ statusCode: 400 }, '这句话没有通过检查，换个说法试试'],
    [{ statusCode: 503 }, '现在发不出去，内容先帮你留着，过一会儿再试']
  ])('keeps composer text when content check fails (%s)', async (error, message) => {
    service.createComment.mockRejectedValue(error);
    pageInstance.setData({
      note: { id: 'note_1', commentCount: 0, companionUserId: '' },
      comments: [],
      composer: { visible: true, text: '我想留住这一句', placeholder: '留一句回响……', commentId: '', replyToUserId: '' }
    });

    await pageInstance.submitComposer();

    expect(pageInstance.data.composer.text).toBe('我想留住这一句');
    expect(wx.showToast).toHaveBeenCalledWith({ title: message, icon: 'none' });
    expect(pageInstance.data.comments).toEqual([]);
  });

  test('optimistically adds a valid comment and clears the composer after success', async () => {
    service.createComment.mockResolvedValue({ _id: 'comment_1', content: '谢谢', user: { _id: 'user_1', nickname: '小狐狸' } });
    pageInstance.setData({
      note: { id: 'note_1', commentCount: 0, companionUserId: '' },
      comments: [],
      composer: { visible: true, text: '谢谢', placeholder: '留一句回响……', commentId: '', replyToUserId: '' }
    });

    await pageInstance.submitComposer();

    expect(service.createComment).toHaveBeenCalledWith('note_1', '谢谢');
    expect(pageInstance.data.comments[0]).toMatchObject({ id: 'comment_1', content: '谢谢' });
    expect(pageInstance.data.composer).toMatchObject({ visible: false, text: '' });
  });

  test('maps the content safety status to the page message', () => {
    expect(pageConfig.getPromptText({ statusCode: 400 })).toContain('没有通过检查');
    expect(pageConfig.getPromptText({ statusCode: 503 })).toContain('内容先帮你留着');
  });

  test('replaces an optimistic reply with the reply from a parent-comment response', async () => {
    service.reply.mockResolvedValue({
      _id: 'comment_1',
      replies: [{ _id: 'reply_1', content: '收到', user: { _id: 'user_2', nickname: '陪伴人' } }]
    });
    pageInstance.setData({
      note: { id: 'note_1', commentCount: 1, companionUserId: 'user_2' },
      comments: [{ id: 'comment_1', content: '原回响', userId: 'user_2', replies: [], replyCount: 0 }],
      composer: { visible: true, text: '收到', placeholder: '回复原回响……', commentId: 'comment_1', replyToUserId: 'user_2' }
    });

    await pageInstance.submitComposer();

    expect(service.reply).toHaveBeenCalledWith('comment_1', '收到', 'user_2');
    expect(pageInstance.data.comments[0].replies).toHaveLength(1);
    expect(pageInstance.data.comments[0].replies[0]).toMatchObject({ id: 'reply_1', content: '收到' });
  });
});
