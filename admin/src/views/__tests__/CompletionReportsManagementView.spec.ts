import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import CompletionReportsManagementView from '../CompletionReportsManagementView.vue';
import { completionReportApi, periodApi, uploadApi } from '../../services/api';
import { ElMessage } from 'element-plus';

vi.mock('../../services/api', () => ({
  completionReportApi: {
    getReports: vi.fn(),
    bindReport: vi.fn(),
    clearReport: vi.fn()
  },
  periodApi: {
    getPeriods: vi.fn()
  },
  uploadApi: {
    uploadFile: vi.fn()
  }
}));

vi.mock('element-plus', () => ({
  ElMessage: {
    error: vi.fn(),
    success: vi.fn(),
    warning: vi.fn()
  },
  ElMessageBox: {
    confirm: vi.fn().mockResolvedValue(true)
  }
}));

const globalConfig = {
  stubs: {
    AdminLayout: { template: '<div><slot /></div>' },
    'el-card': { template: '<div><slot name="header" /><slot /></div>' },
    'el-select': true,
    'el-option': true,
    'el-input': true,
    'el-checkbox': true,
    'el-button': true,
    'el-tag': true,
    'el-table': true,
    'el-table-column': true,
    'el-avatar': true,
    'el-pagination': true
  }
};

describe('CompletionReportsManagementView', () => {
  beforeEach(() => {
    vi.mocked(periodApi.getPeriods).mockResolvedValue({
      list: [{ _id: 'period_1', name: '第 12 期' }]
    } as any);
    vi.mocked(completionReportApi.getReports).mockResolvedValue({
      list: [],
      total: 0
    } as any);
    vi.mocked(uploadApi.uploadFile).mockResolvedValue({
      url: '/uploads/tenants/default/report.pdf',
      filename: 'report.pdf',
      size: 1024,
      mimetype: 'application/pdf'
    } as any);
    vi.mocked(completionReportApi.bindReport).mockResolvedValue({} as any);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('只看未上传时应该向接口传递 onlyMissing 和 hasReport 参数', async () => {
    const wrapper = mount(CompletionReportsManagementView, {
      global: globalConfig
    });
    await flushPromises();
    vi.mocked(completionReportApi.getReports).mockClear();

    (wrapper.vm as any).filters.onlyMissing = true;
    (wrapper.vm as any).filters.periodId = 'period_1';
    (wrapper.vm as any).filters.search = '狮子';
    await (wrapper.vm as any).loadReports();

    expect(completionReportApi.getReports).toHaveBeenCalledWith(
      expect.objectContaining({
        periodId: 'period_1',
        search: '狮子',
        onlyMissing: true,
        hasReport: false
      })
    );
  });

  it('选择非 PDF 文件时应该阻止上传和绑定', async () => {
    const wrapper = mount(CompletionReportsManagementView, {
      global: globalConfig
    });
    await flushPromises();

    (wrapper.vm as any).selectedRow = { _id: 'enrollment_1' };
    const input = document.createElement('input');
    const file = new File(['not pdf'], 'report.txt', { type: 'text/plain' });
    Object.defineProperty(input, 'files', {
      value: [file],
      configurable: true
    });
    const event = new Event('change');
    Object.defineProperty(event, 'target', {
      value: input
    });

    await (wrapper.vm as any).handleFileSelected(event);

    expect(ElMessage.error).toHaveBeenCalledWith('只能上传 PDF 文件');
    expect(uploadApi.uploadFile).not.toHaveBeenCalled();
    expect(completionReportApi.bindReport).not.toHaveBeenCalled();
  });
});

