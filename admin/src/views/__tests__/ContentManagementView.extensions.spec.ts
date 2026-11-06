import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';
import ElementPlus from 'element-plus';
import ContentManagementView from '../ContentManagementView.vue';

const api = vi.hoisted(() => ({
  getPeriods: vi.fn(), getPeriodDetail: vi.fn(), getAllSections: vi.fn()
}));
vi.mock('../../services/api', () => ({ periodApi: api, uploadApi: {} }));
vi.mock('../../stores/auth', () => ({ useAuthStore: () => ({ adminInfo: { role: 'platform_superadmin' } }) }));
vi.mock('vue-router', () => ({ onBeforeRouteLeave: vi.fn() }));

describe('lesson extension visibility', () => {
  let wrapper: ReturnType<typeof mount>;
  beforeEach(() => {
    api.getPeriods.mockResolvedValue({ list: [{ _id: 'period-1', name: '课程期次' }] });
    api.getAllSections.mockResolvedValue({ list: [] });
  });
  afterEach(() => wrapper?.unmount());

  async function openLesson(extensions?: { duration: boolean; closingVideo: boolean; podcast: boolean }) {
    api.getPeriodDetail.mockResolvedValue({
      _id: 'period-1', name: '课程期次',
      courseTemplateSnapshot: { templateId: 'custom', name: '空间管理', modules: [], extensions }
    });
    wrapper = mount(ContentManagementView, {
      global: { plugins: [ElementPlus], stubs: {
        AdminLayout: { template: '<div><slot /></div>' },
        CourseModulesForm: true, RichTextEditor: true,
        ElTable: true, ElTableColumn: true,
        ElDialog: { props: ['modelValue'], template: '<div v-if="modelValue"><slot /><slot name="footer" /></div>' }
      } }
    });
    await flushPromises();
    await wrapper.findAll('button').find(button => button.text().includes('新增课节'))!.trigger('click');
    await flushPromises();
  }

  it('hides every extension field and heading when all capabilities are disabled, while keeping publication', async () => {
    await openLesson({ duration: false, closingVideo: false, podcast: false });
    for (const label of ['扩展信息', '时长（分钟）', '结营视频', '凡人播客', '播客音频', '播客时长（秒）', '播客介绍']) {
      expect(wrapper.text()).not.toContain(label);
    }
    expect(wrapper.text()).toContain('发布状态');
    expect(wrapper.text()).toContain('保存');
  });

  it('hides podcast duration and description independently from other enabled extensions', async () => {
    await openLesson({ duration: true, closingVideo: true, podcast: false });
    expect(wrapper.text()).toContain('时长（分钟）');
    expect(wrapper.text()).toContain('结营视频');
    expect(wrapper.text()).not.toContain('播客音频');
    expect(wrapper.text()).not.toContain('播客时长（秒）');
    expect(wrapper.text()).not.toContain('播客介绍');
  });

  it('keeps the complete podcast group for legacy snapshots without capability settings', async () => {
    await openLesson();
    for (const label of ['时长（分钟）', '结营视频', '播客音频', '播客时长（秒）', '播客介绍', '发布状态']) {
      expect(wrapper.text()).toContain(label);
    }
  });
});
