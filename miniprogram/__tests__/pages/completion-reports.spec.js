jest.mock('../../services/completion-report.service', () => ({
  getMyReports: jest.fn()
}));

describe('completion reports page', () => {
  let pageConfig;
  let pageInstance;
  let completionReportService;

  beforeEach(() => {
    jest.resetModules();
    pageConfig = null;

    global.Page = jest.fn(config => {
      pageConfig = config;
      return config;
    });

    wx.navigateTo.mockClear();
    wx.showToast.mockClear();

    completionReportService = require('../../services/completion-report.service');
    completionReportService.getMyReports.mockResolvedValue({
      list: [
        {
          periodId: 'period_1',
          periodName: '第 12 期晨读营',
          reportTitle: '小狐狸分享实录',
          hasReport: true
        },
        {
          periodId: 'period_2',
          periodName: '第 11 期晨读营',
          reportTitle: '小狐狸分享实录',
          hasReport: false
        }
      ]
    });

    require('../../pages/completion-reports/completion-reports');

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
  });

  test('should load uploaded and organizing report cards', async () => {
    await pageInstance.loadReports.call(pageInstance);

    expect(completionReportService.getMyReports).toHaveBeenCalled();
    expect(pageInstance.data.reports).toHaveLength(2);
    expect(pageInstance.data.reports[0].hasReport).toBe(true);
    expect(pageInstance.data.reports[1].hasReport).toBe(false);
    expect(pageInstance.data.empty).toBe(false);
  });

  test('should navigate to report detail by period id', () => {
    pageInstance.handleReportTap.call(pageInstance, {
      currentTarget: {
        dataset: {
          periodId: 'period_1'
        }
      }
    });

    expect(wx.navigateTo).toHaveBeenCalledWith({
      url: '/pages/completion-report-detail/completion-report-detail?periodId=period_1'
    });
  });
});
