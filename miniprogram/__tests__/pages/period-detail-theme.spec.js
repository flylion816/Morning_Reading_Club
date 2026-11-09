jest.mock('../../services/course.service', () => ({
  getPeriodSections: jest.fn(() => Promise.resolve({ list: [] }))
}));

jest.mock('../../utils/request', () => ({
  get: jest.fn(() => Promise.resolve({
    _id: 'period_1',
    name: '连接之力',
    color: '#d65f4b',
    coverColor: '#d65f4b',
    startDate: '2026-11-14T00:00:00.000Z',
    endDate: '2026-12-06T00:00:00.000Z',
    enrollmentOpen: true,
    price: 1
  }))
}));

jest.mock('../../utils/period-access', () => ({
  getPeriodAccess: jest.fn(() => Promise.resolve({
    isEnrolled: false,
    paymentStatus: null,
    enrollmentId: ''
  }))
}));

describe('period detail theme', () => {
  let pageConfig;
  let pageInstance;
  let appState;

  const loadPage = async () => {
    await pageInstance.loadPeriodDetail.call(pageInstance, 'period_1');
    return pageInstance;
  };

  beforeEach(() => {
    jest.resetModules();
    pageConfig = null;
    appState = { globalData: { isLogin: false, userInfo: null } };

    global.Page = jest.fn(config => {
      pageConfig = config;
      return config;
    });
    global.getApp = jest.fn(() => appState);

    require('../../pages/period-detail/period-detail');
    pageInstance = {
      ...pageConfig,
      data: JSON.parse(JSON.stringify(pageConfig.data)),
      setData(update) {
        this.data = { ...this.data, ...update };
      }
    };
  });

  afterEach(() => {
    delete global.Page;
    delete global.getApp;
  });

  test('uses the unified tenant color for logged-out visitors', async () => {
    const { THEME_PRIMARY } = require('../../utils/theme');
    await loadPage();

    expect(pageInstance.data.period.displayColor).toBe(THEME_PRIMARY);
  });

  test('keeps the unified color after login', async () => {
    await loadPage();
    appState.globalData.isLogin = true;

    await pageInstance.onShow.call(pageInstance);

    const { THEME_PRIMARY } = require('../../utils/theme');
    expect(pageInstance.data.period.displayColor).toBe(THEME_PRIMARY);
  });

  test('keeps the hero width aligned with content cards', () => {
    const css = require('fs').readFileSync(
      require('path').join(__dirname, '../../pages/period-detail/period-detail.wxss'),
      'utf8'
    );
    const heroRule = css.match(/\.detail-hero\s*\{([\s\S]*?)\}/)?.[1] || '';

    expect(heroRule).toContain('margin: 24rpx 24rpx 0');
  });

  test('keeps one-based period lesson numbers unchanged', async () => {
    const courseService = require('../../services/course.service');
    courseService.getPeriodSections.mockResolvedValue({
      list: [
        { _id: 'section_1', day: 1, title: '空间构想' },
        { _id: 'section_8', day: 8, title: '空间创造四步曲' }
      ]
    });

    await loadPage();

    expect(pageInstance.data.sections.map(section => section.lessonNumber))
      .toEqual([1, 8]);
  });
});
