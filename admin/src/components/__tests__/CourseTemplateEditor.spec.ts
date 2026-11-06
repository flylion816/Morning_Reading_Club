import { describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import ElementPlus from 'element-plus';
import CourseTemplateEditor from '../CourseTemplateEditor.vue';

function createEditor(initial = {
  name: '空间管理',
  modules: [
    { id: 'one', name: '观察空间', type: 'text' as const },
    { id: 'two', name: '学习内容', type: 'body' as const }
  ],
  revision: 1
}) {
  return mount(CourseTemplateEditor, {
    props: { initial },
    global: { plugins: [ElementPlus] }
  });
}

describe('CourseTemplateEditor', () => {
  it('starts a new template with all extensions unchecked and saves that choice', async () => {
    const wrapper = mount(CourseTemplateEditor, { global: { plugins: [ElementPlus] } });
    const checkboxes = wrapper.findAll('.extensions-config input[type="checkbox"]');
    expect(checkboxes).toHaveLength(3);
    expect(checkboxes.every(input => !(input.element as HTMLInputElement).checked)).toBe(true);
    await wrapper.get('input[placeholder="例如：空间管理"]').setValue('空间管理');
    await wrapper.findAll('button').find(button => button.text() === '＋添加模块')!.trigger('click');
    await wrapper.get('input[aria-label="模块名称"]').setValue('观察空间');
    await wrapper.findAll('button').find(button => button.text() === '保存模板')!.trigger('click');
    expect((wrapper.emitted('save')?.[0]?.[0] as any).extensions).toEqual({
      duration: false, closingVideo: false, podcast: false
    });
  });

  it('preserves saved extension selections when editing', async () => {
    const wrapper = mount(CourseTemplateEditor, {
      props: {
        initial: {
          name: '已有模板',
          modules: [{ id: 'one', name: '正文', type: 'body' }],
          extensions: { duration: true, closingVideo: false, podcast: true }
        }
      },
      global: { plugins: [ElementPlus] }
    });
    expect(wrapper.findAll('.extensions-config input[type="checkbox"]').map(input =>
      (input.element as HTMLInputElement).checked
    )).toEqual([true, false, true]);
    await wrapper.findAll('button').find(button => button.text() === '保存模板')!.trigger('click');
    expect((wrapper.emitted('save')?.[0]?.[0] as any).extensions).toEqual({
      duration: true, closingVideo: false, podcast: true
    });
  });

  it('previews module names in order and reflects reordering', async () => {
    const wrapper = createEditor();
    expect(wrapper.findAll('.preview-module h4').map(node => node.text())).toEqual(['观察空间', '学习内容']);
    await wrapper.findAll('[aria-label="下移模块"]')[0]!.trigger('click');
    expect(wrapper.findAll('.preview-module h4').map(node => node.text())).toEqual(['学习内容', '观察空间']);
  });

  it('rejects empty module names and multiple bodies before emitting save', async () => {
    const wrapper = createEditor({
      name: '课程',
      modules: [
        { id: 'one', name: '', type: 'body' },
        { id: 'two', name: '正文', type: 'body' }
      ],
      revision: 1
    });
    await wrapper.findAll('button').find(button => button.text() === '保存模板')!.trigger('click');
    expect(wrapper.text()).toContain('请填写每个模块的名称');
    expect(wrapper.emitted('save')).toBeUndefined();
    await wrapper.findAll('input')[1]!.setValue('另一个正文');
    await wrapper.findAll('button').find(button => button.text() === '保存模板')!.trigger('click');
    expect(wrapper.text()).toContain('正文模块最多一个');
    expect(wrapper.emitted('save')).toBeUndefined();
  });

  it('emits a trimmed copy without changing the supplied template', async () => {
    const initial = {
      name: ' 空间管理 ',
      modules: [{ id: 'one', name: ' 观察空间 ', type: 'text' as const }],
      revision: 1
    };
    const wrapper = createEditor(initial);
    await wrapper.findAll('button').find(button => button.text() === '保存模板')!.trigger('click');
    expect(wrapper.emitted('save')?.[0]?.[0]).toEqual({
      name: '空间管理', modules: [{ id: 'one', name: '观察空间', type: 'text' }],
      extensions: { duration: true, closingVideo: true, podcast: true }, revision: 1
    });
    expect(initial.modules[0]?.name).toBe(' 观察空间 ');
  });

  it('emits cancel from the cancel button', async () => {
    const wrapper = createEditor();
    await wrapper.findAll('button').find(button => button.text() === '取消')!.trigger('click');
    expect(wrapper.emitted('cancel')).toHaveLength(1);
  });
});
