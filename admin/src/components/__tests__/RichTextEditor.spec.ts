/**
 * RichTextEditor 组件单元测试
 * 测试富文本编辑器的格式化和内容管理
 * 共 8 个测试用例
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import RichTextEditor from '../RichTextEditor.vue';
import { ElMessage } from 'element-plus';

vi.mock('element-plus', () => ({
  ElMessage: {
    error: vi.fn(),
    success: vi.fn(),
    warning: vi.fn()
  }
}));

vi.mock('../services/api', () => ({
  uploadApi: {
    uploadFile: vi.fn()
  }
}));

describe('RichTextEditor - 富文本编辑器', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  // ============ 组件渲染 (2 个) ============
  describe('组件渲染', () => {
    it('[Render-1] 应该正确渲染编辑器结构', () => {
      const wrapper = mount(RichTextEditor, {
        props: {
          modelValue: ''
        }
      });

      expect(wrapper.find('.rich-text-editor').exists()).toBe(true);
      expect(wrapper.find('.editor-toolbar').exists()).toBe(true);
      expect(wrapper.find('.editor-textarea').exists()).toBe(true);
      expect(wrapper.find('.editor-info').exists()).toBe(true);
    });

    it('[Render-2] 应该显示所有格式化按钮', () => {
      const wrapper = mount(RichTextEditor, {
        props: {
          modelValue: ''
        }
      });

      const buttons = wrapper.findAll('.toolbar-btn');
      // 应该至少有 12 个按钮 (B, I, U, H1, H2, H3, •, 1., ", 🔗, 🖼️, ✕)
      expect(buttons.length).toBeGreaterThanOrEqual(12);
    });
  });

  // ============ 内容管理 (2 个) ============
  describe('内容管理', () => {
    it('[Content-1] 应该正确绑定 modelValue', () => {
      const wrapper = mount(RichTextEditor, {
        props: {
          modelValue: '初始内容'
        }
      });

      const textarea = wrapper.find('.editor-textarea') as any;
      expect(textarea.element.value).toBe('初始内容');
    });

    it('[Content-2] 应该在内容变化时发出 update:modelValue 事件', async () => {
      const wrapper = mount(RichTextEditor, {
        props: {
          modelValue: ''
        }
      });

      const textarea = wrapper.find('.editor-textarea');
      await textarea.setValue('新内容');

      expect(wrapper.emitted('update:modelValue')).toBeTruthy();
      expect(wrapper.emitted('update:modelValue')?.[0]).toEqual(['新内容']);
    });
  });

  // ============ 最大长度限制 (2 个) ============
  describe('最大长度限制', () => {
    it('[MaxLength-1] 应该显示当前字数', () => {
      const wrapper = mount(RichTextEditor, {
        props: {
          modelValue: '测试内容'
        }
      });

      expect(wrapper.find('.editor-info').text()).toContain('字数：4');
    });

    it('[MaxLength-2] 超过最大长度时应该截断内容', async () => {
      const wrapper = mount(RichTextEditor, {
        props: {
          modelValue: '',
          maxLength: 5
        }
      });

      const textarea = wrapper.find('.editor-textarea');
      await textarea.setValue('超过最大长度的内容测试');

      // 内容应该被截断到 5 个字符
      expect(wrapper.vm.content.length).toBeLessThanOrEqual(5);
    });
  });

  // ============ 格式化功能 (2 个) ============
  describe('格式化功能', () => {
    it('[Format-1] 粗体按钮应该添加 ** 标记', async () => {
      const wrapper = mount(RichTextEditor, {
        props: {
          modelValue: '文本'
        }
      });

      // 获取第一个按钮（粗体）
      const boldButton = wrapper.find('.toolbar-btn');
      await boldButton.trigger('click');

      // 应该插入粗体格式
      expect(wrapper.vm.content).toContain('**');
    });

    it('[Format-2] insertFormat 方法应该正确处理不同的格式类型', async () => {
      const wrapper = mount(RichTextEditor, {
        props: {
          modelValue: '测试'
        }
      });

      // 测试 h1 格式
      wrapper.vm.insertFormat('h1');
      expect(wrapper.vm.content).toContain('#');

      // 重置
      wrapper.vm.content = '测试';

      // 测试列表格式
      wrapper.vm.insertFormat('ul');
      expect(wrapper.vm.content).toContain('-');
    });
  });

  // ============ 文件上传验证 (1 个) ============
  describe('文件上传验证', () => {
    it('[Upload-1] 非图片文件应该显示错误信息', async () => {
      const wrapper = mount(RichTextEditor, {
        props: {
          modelValue: ''
        }
      });

      // 模拟非图片文件选择 - 创建一个模拟的 input 元素事件
      const mockInput = document.createElement('input');
      const file = new File(['test'], 'test.txt', { type: 'text/plain' });
      const dataTransfer = new DataTransfer();
      dataTransfer.items.add(file);
      mockInput.files = dataTransfer.files;

      const event = new Event('change', { bubbles: true });
      Object.defineProperty(event, 'target', {
        writable: false,
        value: mockInput
      });

      await wrapper.vm.handleImageUpload(event as any);

      // 应该显示错误提示
      expect(ElMessage.error).toHaveBeenCalledWith('请选择图片文件');
    });
  });
});
