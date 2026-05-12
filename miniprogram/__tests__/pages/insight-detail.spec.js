jest.mock('../../services/insight.service', () => ({}));
jest.mock('../../services/activity.service', () => ({
  track: jest.fn(() => Promise.resolve())
}));
jest.mock('../../config/env', () => ({
  currentEnv: 'test'
}));

describe('insight-detail poster rendering', () => {
  let pageConfig;
  let pageInstance;

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
          nickname: '测试用户'
        }
      }
    }));

    require('../../pages/insight-detail/insight-detail');
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
  });

  afterEach(() => {
    delete global.Page;
    delete global.getApp;
  });

  test('should keep list items when poster content mixes paragraphs and lists', () => {
    const paragraphs = pageInstance._parseHtmlToParagraphs.call(
      pageInstance,
      '<p>第一段</p><ul><li>第一条</li><li><strong>第二条</strong></li></ul><p>最后一段</p>'
    );

    expect(paragraphs).toHaveLength(4);
    expect(paragraphs.map(item => item.runs.map(run => run.text).join(''))).toEqual([
      '第一段',
      '• 第一条',
      '• 第二条',
      '最后一段'
    ]);
    expect(paragraphs[2].runs).toEqual([
      { text: '• ', bold: false },
      { text: '第二条', bold: true }
    ]);
  });

  test('should preserve paragraph breaks inside rich text wrappers', () => {
    const paragraphs = pageInstance._parseHtmlToParagraphs.call(
      pageInstance,
      '<div><p>第一段</p><p><strong>第二段</strong></p></div>'
    );

    expect(paragraphs).toHaveLength(2);
    expect(paragraphs.map(item => item.runs.map(run => run.text).join(''))).toEqual([
      '第一段',
      '第二段'
    ]);
    expect(paragraphs[1].runs).toEqual([
      { text: '第二段', bold: true }
    ]);
  });

  test('should wrap before appending an overflowing styled run', () => {
    const ctx = {
      font: '',
      measureText: jest.fn(text => ({
        width: String(text || '').length * 3
      }))
    };

    const lines = pageInstance._wrapRunsForCanvas.call(
      pageInstance,
      ctx,
      [
        { text: 'abc', bold: false },
        { text: 'Z', bold: true }
      ],
      10,
      '28px sans-serif',
      'bold 28px sans-serif'
    );

    expect(lines).toEqual([
      [{ text: 'abc', bold: false }],
      [{ text: 'Z', bold: true }]
    ]);
  });
});
