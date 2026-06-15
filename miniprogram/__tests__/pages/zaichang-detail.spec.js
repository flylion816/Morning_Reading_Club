jest.mock('../../services/imprint.service', () => ({
  detail: jest.fn(),
  listComments: jest.fn(),
  createComment: jest.fn(),
  deleteComment: jest.fn(),
  react: jest.fn(),
  cancelReaction: jest.fn(),
  attend: jest.fn(),
  cancelAttend: jest.fn()
}));

jest.mock('../../utils/subscribe-auto-topup', () => ({
  maybeAutoTopUpSubscriptions: jest.fn(() => Promise.resolve())
}));

jest.mock('../../utils/require-login', () => ({
  requireLogin: jest.fn(() => true)
}));

jest.mock('../../services/activity.service', () => ({
  track: jest.fn()
}));

let pageConfig;
let pageInstance;
let imprintService;

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

describe('zaichang detail comments', () => {
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
          _id: 'user_1',
          nickname: '测试用户',
          avatarUrl: 'https://example.com/avatar.jpg'
        }
      }
    }));

    imprintService = require('../../services/imprint.service');
    Object.values(imprintService).forEach(mockFn => mockFn.mockReset());

    require('../../pages/zaichang/detail/detail');
    pageInstance = createPageInstance();
    pageInstance._id = 'imprint_1';
    pageInstance.setData({
      currentUserId: 'user_1',
      imprint: { commentCount: 0 }
    });
  });

  afterEach(() => {
    delete global.Page;
    delete global.getApp;
  });

  test('normalizes WeChat emoji tokens when loading comments', async () => {
    imprintService.listComments.mockResolvedValue({
      list: [
        {
          _id: 'comment_1',
          content: '收到[爱心]',
          createdAt: '2026-06-15T08:03:00.000Z'
        }
      ]
    });

    await pageInstance.loadComments(true);

    expect(pageInstance.data.comments[0].content).toBe('收到❤️');
  });

  test('normalizes WeChat emoji tokens before submitting comments', async () => {
    imprintService.createComment.mockResolvedValue({
      _id: 'comment_2',
      content: '一起加油💪',
      createdAt: '2026-06-15T08:05:00.000Z'
    });

    pageInstance.onCommentInput({ detail: { value: '一起加油[加油]' } });
    await pageInstance.onSubmitComment();

    expect(pageInstance.data.commentInput).toBe('');
    expect(imprintService.createComment).toHaveBeenCalledWith('imprint_1', {
      content: '一起加油💪'
    });
    expect(pageInstance.data.comments[0].content).toBe('一起加油💪');
  });
});
