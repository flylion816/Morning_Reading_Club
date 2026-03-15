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

// 处理图片选择
const handleImageSelect = async (e: Event) => {
  const target = e.target as HTMLInputElement;
  const files = target.files;
  if (!files || files.length === 0) return;

  const file = files[0];
  
  // 验证文件大小（限制 5MB）
  if (file.size > 5 * 1024 * 1024) {
    ElMessage.error('图片大小不能超过 5MB');
    return;
  }

  try {
    // 上传图片
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

    // 在编辑器中插入图片
    if (quill) {
      const range = quill.getSelection();
      if (range) {
        quill.insertEmbed(range.index, 'image', imageUrl);

        // 设置图片的样式属性（响应式宽度）
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

  // 重置 input
  target.value = '';
};

onMounted(() => {
  if (!editorRef.value) return;

  // 配置 Quill
  quill = new Quill(editorRef.value, {
    theme: 'snow',
    placeholder: props.placeholder,
    modules: {
      toolbar: [
        ['bold', 'italic', 'underline'],
        ['image', 'link'],
        [{ 'list': 'ordered'}, { 'list': 'bullet' }],
        [{ 'align': [] }],
      ]
    }
  });

  // 自定义图片处理 - 点击图片按钮时打开文件选择
  const toolbar = quill.getModule('toolbar');
  toolbar.addHandler('image', () => {
    fileInput.value?.click();
  });

  // 设置初始内容
  if (props.modelValue) {
    quill.root.innerHTML = props.modelValue;
  }

  // 监听编辑器变化
  quill.on('text-change', () => {
    const html = quill!.root.innerHTML;
    emit('update:modelValue', html === '<p><br></p>' ? '' : html);
  });
});

// 监听 modelValue 变化
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
</style>
