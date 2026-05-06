<template>
  <div class="rich-text-editor">
    <input
      ref="fileInput"
      type="file"
      accept="image/*"
      style="display: none"
      @change="handleImageSelect"
    />
    <div ref="editorRef" class="editor"></div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, watch } from 'vue';
import Quill from 'quill';
import 'quill/dist/quill.core.css';
import 'quill/dist/quill.snow.css';
import { ElMessage } from 'element-plus';

// 将字号格式配置为 inline style（font-size:16px），而非 class（ql-size-large）
// 必须在任何 Quill 实例创建前执行，否则已有实例不会受影响
const SizeStyle = Quill.import('attributors/style/size') as any;
const FONT_SIZES = ['12px', false, '16px', '18px', '20px', '24px', '28px'];
if (SizeStyle) {
  SizeStyle.whitelist = FONT_SIZES;
  Quill.register(SizeStyle, true);
}

interface Props {
  modelValue: string;
  placeholder?: string;
  height?: string;
}

interface Emits {
  (e: 'update:modelValue', value: string): void;
}

const props = withDefaults(defineProps<Props>(), {
  placeholder: '请输入内容...',
  height: '300px'
});

const emit = defineEmits<Emits>();

const editorRef = ref<HTMLElement>();
const fileInput = ref<HTMLInputElement>();
let quill: Quill | null = null;

const handleImageSelect = async (e: Event) => {
  const target = e.target as HTMLInputElement;
  const files = target.files;
  if (!files || files.length === 0) return;

  const file = files[0];

  if (file.size > 5 * 1024 * 1024) {
    ElMessage.error('图片大小不能超过 5MB');
    return;
  }

  try {
    const formData = new FormData();
    formData.append('file', file);

    const response = await fetch('/api/v1/upload', {
      method: 'POST',
      body: formData,
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('adminToken')}`
      }
    });

    if (!response.ok) {
      throw new Error(`上传失败: ${response.statusText}`);
    }

    const data = await response.json();
    const imageUrl = data.data?.url || data.url;

    if (!imageUrl) {
      throw new Error('未获得图片 URL');
    }

    if (quill) {
      const range = quill.getSelection();
      if (range) {
        quill.insertEmbed(range.index, 'image', imageUrl);

        setTimeout(() => {
          const imgElements = quill!.root.querySelectorAll('img');
          if (imgElements.length > 0) {
            const lastImg = imgElements[imgElements.length - 1] as HTMLImageElement;
            lastImg.style.maxWidth = '100%';
            lastImg.style.height = 'auto';
            lastImg.style.borderRadius = '8px';
            lastImg.style.margin = '12px 0';
            lastImg.alt = '课程内容图片';
          }
        }, 0);

        quill.setSelection(range.index + 1);
      }
    }

    ElMessage.success('图片上传成功');
  } catch (error) {
    console.error('图片上传失败:', error);
    ElMessage.error(`图片上传失败: ${error instanceof Error ? error.message : '未知错误'}`);
  }

  target.value = '';
};

onMounted(() => {
  if (!editorRef.value) return;

  quill = new Quill(editorRef.value, {
    theme: 'snow',
    placeholder: props.placeholder,
    modules: {
      toolbar: [
        ['bold', 'italic', 'underline'],
        [{ 'color': [] }, { 'size': FONT_SIZES }],
        ['image', 'link'],
        [{ 'list': 'ordered'}, { 'list': 'bullet' }],
        [{ 'align': [] }],
      ]
    }
  });

  const toolbar = quill.getModule('toolbar');
  toolbar.addHandler('image', () => {
    fileInput.value?.click();
  });

  if (props.modelValue) {
    quill.root.innerHTML = props.modelValue;
  }

  quill.on('text-change', (_delta: any, _old: any, source: string) => {
    if (source !== 'user') return;
    const html = quill!.root.innerHTML;
    emit('update:modelValue', html === '<p><br></p>' ? '' : html);
  });
});

watch(() => props.modelValue, (newVal) => {
  if (quill && quill.root.innerHTML !== newVal) {
    quill.root.innerHTML = newVal || '';
  }
});
</script>

<style scoped>
.rich-text-editor {
  width: 100%;
}

:deep(.ql-container) {
  font-size: 14px;
  border-bottom-left-radius: 4px;
  border-bottom-right-radius: 4px;
  min-height: v-bind(height);
}

:deep(.ql-editor) {
  min-height: v-bind(height);
  padding: 12px;
}

:deep(.ql-editor strong),
:deep(.ql-editor b) {
  font-weight: 700;
}

/* 确保粗体+斜体+下划线可叠加 */
:deep(.ql-editor strong em),
:deep(.ql-editor em strong) {
  font-weight: 700;
  font-style: italic;
}

:deep(.ql-editor strong u),
:deep(.ql-editor u strong) {
  font-weight: 700;
  text-decoration: underline;
}

:deep(.ql-editor em u),
:deep(.ql-editor u em) {
  font-style: italic;
  text-decoration: underline;
}

:deep(.ql-editor strong em u),
:deep(.ql-editor strong u em),
:deep(.ql-editor em strong u),
:deep(.ql-editor em u strong),
:deep(.ql-editor u strong em),
:deep(.ql-editor u em strong) {
  font-weight: 700;
  font-style: italic;
  text-decoration: underline;
}

:deep(.ql-editor img) {
  max-width: 100%;
  height: auto;
}

:deep(.ql-toolbar) {
  border-top-left-radius: 4px;
  border-top-right-radius: 4px;
  border-color: #dcdfe6;
}

:deep(.ql-toolbar.ql-snow) {
  padding: 8px;
}

/* 字号下拉框宽度 */
:deep(.ql-size) {
  width: 70px;
}

/* 字号下拉选项中文标注 */
:deep(.ql-size .ql-picker-item[data-value="12px"]::before) { content: '12px 小'; }
:deep(.ql-size .ql-picker-item[data-value="16px"]::before) { content: '16px 大'; }
:deep(.ql-size .ql-picker-item[data-value="18px"]::before) { content: '18px'; }
:deep(.ql-size .ql-picker-item[data-value="20px"]::before) { content: '20px'; }
:deep(.ql-size .ql-picker-item[data-value="24px"]::before) { content: '24px 标题'; }
:deep(.ql-size .ql-picker-item[data-value="28px"]::before) { content: '28px 大标题'; }

/* 字号选中值显示标签 */
:deep(.ql-size .ql-picker-label[data-value="12px"]::before) { content: '12px'; }
:deep(.ql-size .ql-picker-label[data-value="16px"]::before) { content: '16px'; }
:deep(.ql-size .ql-picker-label[data-value="18px"]::before) { content: '18px'; }
:deep(.ql-size .ql-picker-label[data-value="20px"]::before) { content: '20px'; }
:deep(.ql-size .ql-picker-label[data-value="24px"]::before) { content: '24px'; }
:deep(.ql-size .ql-picker-label[data-value="28px"]::before) { content: '28px'; }
</style>
