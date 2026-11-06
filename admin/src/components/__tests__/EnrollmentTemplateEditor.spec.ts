import { describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import ElementPlus from 'element-plus';
import EnrollmentTemplateEditor from '../EnrollmentTemplateEditor.vue';

describe('EnrollmentTemplateEditor', () => {
  it('starts with the simple preset and previews only name and phone', () => {
    const wrapper = mount(EnrollmentTemplateEditor, { global: { plugins: [ElementPlus] } });
    expect(wrapper.text()).toContain('简洁报名');
    expect(wrapper.findAll('.phone-field')).toHaveLength(2);
    expect(wrapper.text()).toContain('姓名');
    expect(wrapper.text()).toContain('手机号');
  });

  it('switches to the full preset and emits a validated draft', async () => {
    const wrapper = mount(EnrollmentTemplateEditor, { global: { plugins: [ElementPlus] } });
    await wrapper.findAll('.preset-card')[1]!.trigger('click');
    expect(wrapper.findAll('.phone-field').length).toBeGreaterThan(2);
    await wrapper.find('input[placeholder="例如：空间管理简洁报名"]').setValue('空间管理报名');
    await wrapper.find('button[type="button"].el-button--primary').trigger('click');
    expect(wrapper.emitted('save')?.[0]?.[0]).toMatchObject({ name: '空间管理报名', preset: 'full' });
  });

  it('requires both stable identity fields', async () => {
    const wrapper = mount(EnrollmentTemplateEditor, {
      props: { initial: { name: '自定义', preset: 'custom', fields: [] } },
      global: { plugins: [ElementPlus] }
    });
    await wrapper.find('button[type="button"].el-button--primary').trigger('click');
    expect(wrapper.text()).toContain('报名模板必须收集姓名');
    expect(wrapper.emitted('save')).toBeUndefined();
  });
});
