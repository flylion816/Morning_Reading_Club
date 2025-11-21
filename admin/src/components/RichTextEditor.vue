<template>
  <div class="rich-text-editor">
    <div class="editor-toolbar">
      <button @click="insertFormat('bold')" class="toolbar-btn" title="加粗">
        <strong>B</strong>
      </button>
      <button @click="insertFormat('italic')" class="toolbar-btn" title="斜体">
        <em>I</em>
      </button>
      <button @click="insertFormat('underline')" class="toolbar-btn" title="下划线">
        <u>U</u>
      </button>
      <div class="divider"></div>
      <button @click="insertFormat('h1')" class="toolbar-btn">H1</button>
      <button @click="insertFormat('h2')" class="toolbar-btn">H2</button>
      <button @click="insertFormat('h3')" class="toolbar-btn">H3</button>
      <div class="divider"></div>
      <button @click="insertFormat('ul')" class="toolbar-btn" title="无序列表">•</button>
      <button @click="insertFormat('ol')" class="toolbar-btn" title="有序列表">1.</button>
      <button @click="insertFormat('blockquote')" class="toolbar-btn" title="引用">"</button>
      <div class="divider"></div>
      <button @click="insertFormat('link')" class="toolbar-btn" title="链接">🔗</button>
      <button @click="triggerImageUpload" class="toolbar-btn" title="图片">🖼️</button>
      <input
        ref="imageInput"
        type="file"
        accept="image/*"
        style="display: none"
        @change="handleImageUpload"
      />
      <div class="divider"></div>
      <button @click="insertFormat('clear')" class="toolbar-btn" title="清除格式">✕</button>
    </div>

    <textarea
      ref="editorRef"
      v-model="content"
      class="editor-textarea"
      placeholder="输入您的内容..."
      @input="updateContent"
    ></textarea>

    <div class="editor-info">
      <span>字数：{{ content.length }}</span>
      <span v-if="maxLength">/ {{ maxLength }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'

interface Props {
  modelValue?: string
  maxLength?: number
}

interface Emits {
  (e: 'update:modelValue', value: string): void
  (e: 'imageUpload', file: File): void
}

const props = withDefaults(defineProps<Props>(), {
  modelValue: '',
  maxLength: undefined
})

const emit = defineEmits<Emits>()

const content = ref(props.modelValue)
const editorRef = ref<HTMLTextAreaElement>()
const imageInput = ref<HTMLInputElement>()

watch(
  () => props.modelValue,
  (newVal) => {
    content.value = newVal
  }
)

function updateContent() {
  if (props.maxLength && content.value.length > props.maxLength) {
    content.value = content.value.substring(0, props.maxLength)
  }
  emit('update:modelValue', content.value)
}

function insertFormat(format: string) {
  const textarea = editorRef.value
  if (!textarea) return

  const start = textarea.selectionStart
  const end = textarea.selectionEnd
  const selectedText = content.value.substring(start, end) || '文本'

  let formatted = ''

  switch (format) {
    case 'bold':
      formatted = `**${selectedText}**`
      break
    case 'italic':
      formatted = `*${selectedText}*`
      break
    case 'underline':
      formatted = `<u>${selectedText}</u>`
      break
    case 'h1':
      formatted = `# ${selectedText}`
      break
    case 'h2':
      formatted = `## ${selectedText}`
      break
    case 'h3':
      formatted = `### ${selectedText}`
      break
    case 'ul':
      formatted = `- ${selectedText}`
      break
    case 'ol':
      formatted = `1. ${selectedText}`
      break
    case 'blockquote':
      formatted = `> ${selectedText}`
      break
    case 'link':
      formatted = `[${selectedText}](url)`
      break
    case 'clear':
      formatted = selectedText
      break
    default:
      return
  }

  const newContent = content.value.substring(0, start) + formatted + content.value.substring(end)
  content.value = newContent
  updateContent()

  // 更新光标位置
  setTimeout(() => {
    textarea.selectionStart = start + formatted.length
    textarea.selectionEnd = start + formatted.length
    textarea.focus()
  }, 0)
}

function triggerImageUpload() {
  imageInput.value?.click()
}

function handleImageUpload(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (file) {
    emit('imageUpload', file)
  }
}
</script>

<style scoped>
.rich-text-editor {
  display: flex;
  flex-direction: column;
  border: 1px solid #dcdfe6;
  border-radius: 4px;
  overflow: hidden;
}

.editor-toolbar {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 8px;
  background: #f5f7fa;
  border-bottom: 1px solid #dcdfe6;
  flex-wrap: wrap;
}

.toolbar-btn {
  padding: 6px 12px;
  background: white;
  border: 1px solid #dcdfe6;
  border-radius: 3px;
  cursor: pointer;
  font-size: 12px;
  transition: all 0.3s;
}

.toolbar-btn:hover {
  color: #409eff;
  border-color: #409eff;
}

.toolbar-btn:active {
  background: #f0f9ff;
}

.divider {
  width: 1px;
  height: 20px;
  background: #dcdfe6;
  margin: 0 4px;
}

.editor-textarea {
  flex: 1;
  padding: 12px;
  border: none;
  outline: none;
  resize: vertical;
  min-height: 200px;
  font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
  font-size: 14px;
  line-height: 1.6;
}

.editor-info {
  display: flex;
  justify-content: space-between;
  padding: 8px 12px;
  background: #f5f7fa;
  border-top: 1px solid #dcdfe6;
  font-size: 12px;
  color: #999;
}
</style>
