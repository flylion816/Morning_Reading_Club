const completionReportService = require('../../services/completion-report.service');
const request = require('../../utils/request');

jest.mock('../../utils/request');

describe('completion report service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('should fetch and normalize my reports', async () => {
    request.get.mockResolvedValue({
      list: [
        {
          periodId: 'period_1',
          periodName: '第 12 期晨读营',
          reportTitle: '小狐狸分享实录',
          hasReport: true,
          fileUrl: '/uploads/tenants/default/report.pdf',
          fileSize: 1536,
          uploadedAt: '2026-05-30T10:00:00.000Z'
        }
      ]
    });

    const res = await completionReportService.getMyReports();

    expect(request.get).toHaveBeenCalledWith('/enrollments/my-completion-reports');
    expect(res.list[0]).toMatchObject({
      periodId: 'period_1',
      hasReport: true,
      fileSizeText: '2KB'
    });
    expect(res.list[0].fullFileUrl).toContain('/uploads/tenants/default/report.pdf');
  });

  test('should fetch report detail by period id', async () => {
    request.get.mockResolvedValue({
      periodId: 'period_1',
      hasReport: false,
      reportTitle: '小狐狸分享实录'
    });

    const detail = await completionReportService.getReportDetail('period_1');

    expect(request.get).toHaveBeenCalledWith(
      '/enrollments/my-completion-reports/period_1'
    );
    expect(detail.hasReport).toBe(false);
  });
});
