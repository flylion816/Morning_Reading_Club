jest.mock('../../services/completion-report.service', () => ({
  getReportDetail: jest.fn()
}));

describe('completion report detail page', () => {
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

    wx.downloadFile = jest.fn(options => {
      options.success({
        statusCode: 200,
        tempFilePath: '/tmp/report.pdf'
      });
    });
    wx.openDocument = jest.fn(options => {
      options.success({});
    });
    wx.shareFileMessage = jest.fn(options => {
      options.success({});
    });
    wx.setClipboardData = jest.fn(options => {
      options.success({});
    });
    wx.showToast.mockClear();

    completionReportService = require('../../services/completion-report.service');
    completionReportService.getReportDetail.mockResolvedValue({
      periodId: 'period_1',
      periodName: '第 12 期晨读营',
      reportTitle: '小狐狸分享实录',
      hasReport: true,
      fileName: 'report.pdf',
      fullFileUrl: 'https://example.com/report.pdf'
    });

    require('../../pages/completion-report-detail/completion-report-detail');

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

  test('should load report detail by period id', async () => {
    await pageInstance.onLoad.call(pageInstance, { periodId: 'period_1' });

    expect(completionReportService.getReportDetail).toHaveBeenCalledWith('period_1');
    expect(pageInstance.data.report.reportTitle).toBe('小狐狸分享实录');
  });

  test('should download and open pdf with document viewer', async () => {
    pageInstance.setData({
      report: {
        hasReport: true,
        fullFileUrl: 'https://example.com/report.pdf'
      }
    });

    await pageInstance.handleOpenPdf.call(pageInstance);

    expect(wx.downloadFile).toHaveBeenCalledWith(
      expect.objectContaining({
        url: 'https://example.com/report.pdf'
      })
    );
    expect(wx.openDocument).toHaveBeenCalledWith(
      expect.objectContaining({
        filePath: '/tmp/report.pdf',
        fileType: 'pdf',
        showMenu: true
      })
    );
  });

  test('should fallback when shareFileMessage is unavailable', async () => {
    wx.shareFileMessage = undefined;
    pageInstance.setData({
      report: {
        hasReport: true,
        fullFileUrl: 'https://example.com/report.pdf'
      }
    });

    await pageInstance.handleShareFile.call(pageInstance);

    expect(wx.showToast).toHaveBeenCalledWith({
      title: '可在 PDF 预览页右上角菜单分享',
      icon: 'none'
    });
  });

  test('should not expose copy link action', () => {
    expect(pageConfig.handleCopyLink).toBeUndefined();
  });
});
