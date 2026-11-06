<template>
  <div class="form-section course-modules-section">
    <div class="module-section-heading">
      <div>
        <h3><span class="module-section-index">02</span>学习内容</h3>
        <p>按模板填写本节内容，可暂时留空稍后补充。</p>
      </div>
      <span class="module-count">{{ snapshot.modules.length }} 个模块</span>
    </div>
    <el-form-item v-for="(module, index) in snapshot.modules" :key="module.id" :label="module.name" class="course-module-field">
      <template #label>
        <span class="course-module-label">
          <span class="course-module-order">{{ String(index + 1).padStart(2, '0') }}</span>
          <span>{{ module.name }}</span>
          <span class="course-module-type">{{ typeLabels[module.type] }}</span>
        </span>
      </template>
      <template v-if="module.type === 'body'">
        <div class="body-editor">
          <el-radio-group v-model="mode"><el-radio-button value="markdown">Markdown</el-radio-button><el-radio-button value="richtext">富文本</el-radio-button></el-radio-group>
          <el-input v-if="mode === 'markdown'" :model-value="values[module.id] || ''" type="textarea" :rows="12" maxlength="20000" show-word-limit placeholder="在这里编写课程正文…" @update:model-value="set(module.id, $event)" />
          <RichTextEditor v-else :model-value="values[module.id] || ''" @update:model-value="set(module.id, $event)" />
        </div>
      </template>
      <div v-else-if="module.type === 'image'" class="image-field">
        <input :id="`${imageInputPrefix}-${module.id}`" type="file" accept="image/*" :disabled="!!uploading" :aria-label="module.name" hidden @change="upload(module.id, $event)" />
        <div v-if="!values[module.id]" class="image-upload-empty">
          <el-icon class="image-upload-symbol"><Picture /></el-icon>
          <div class="image-upload-copy"><strong>添加课程图片</strong><span>JPG / PNG / GIF / WebP，最大 10MB</span></div>
          <el-button :loading="uploading === module.id" :disabled="!!uploading" @click="chooseImage(module.id)">选择图片</el-button>
        </div>
        <div v-else class="image-upload-preview">
          <img :src="values[module.id]" :alt="module.name" />
          <div class="image-preview-actions">
            <span>已添加 1 张图片</span>
            <div><el-button text :loading="uploading === module.id" :disabled="!!uploading" @click="chooseImage(module.id)">更换图片</el-button><el-button text type="danger" :disabled="!!uploading" @click="set(module.id, '')">删除图片</el-button></div>
          </div>
        </div>
      </div>
      <el-input v-else :model-value="values[module.id] || ''" :type="module.type === 'shortText' ? 'text' : 'textarea'" :rows="3" :maxlength="module.type === 'shortText' ? 200 : 500" :placeholder="`填写${module.name}…`" show-word-limit @update:model-value="set(module.id, $event)" />
    </el-form-item>
  </div>
</template>
<script setup lang="ts">
import { computed, ref, useId } from 'vue';
import { ElMessage } from 'element-plus';
import { Picture } from '@element-plus/icons-vue';
import RichTextEditor from './RichTextEditor.vue';
import { uploadApi } from '../services/api';
import type { CourseTemplateSnapshot } from '../types/course-template';
const props = defineProps<{ snapshot: CourseTemplateSnapshot; modelValue?: Record<string, string> }>();
const emit = defineEmits<{ 'update:modelValue': [value: Record<string, string>] }>();
const values = computed(() => props.modelValue || {});
const body = props.snapshot.modules.find(module => module.type === 'body');
const mode = ref(body && /<\/?[a-z][\s\S]*>/i.test(values.value[body.id] || '') ? 'richtext' : 'markdown');
const uploading = ref('');
const imageInputPrefix = useId();
const typeLabels = { shortText: '短文本', text: '多行文本', body: '正文', image: '图片' };
function chooseImage(id: string) { document.getElementById(`${imageInputPrefix}-${id}`)?.click(); }
function set(id: string, value: string) { emit('update:modelValue', { ...values.value, [id]: value }); }
async function upload(id: string, event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  if (!file) return;
  if (!/^image\/(jpeg|png|gif|webp)$/.test(file.type) || file.size > 10 * 1024 * 1024) {
    ElMessage.error('请选择不超过10MB的 JPG、PNG、GIF 或 WebP 图片'); input.value = ''; return;
  }
  uploading.value = id;
  try { const result: any = await uploadApi.uploadFile(file); set(id, result.url || result.data?.url || ''); }
  catch (error: any) { ElMessage.error(error?.response?.data?.message || '图片上传失败'); }
  finally { uploading.value = ''; input.value = ''; }
}
</script>
<style scoped>
.module-section-heading { display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; margin-bottom: 20px; }
.module-section-heading h3 { display: flex; gap: 10px; align-items: center; margin: 0; font-size: 15px; font-weight: 600; color: var(--admin-ink); }
.module-section-heading p { margin: 6px 0 0; font-size: 12px; line-height: 1.6; color: var(--admin-ink-muted); }
.module-section-index { color: var(--admin-primary); font-size: 11px; font-variant-numeric: tabular-nums; }
.module-count { flex-shrink: 0; color: var(--admin-ink-muted); font-size: 12px; padding-top: 2px; }
.course-module-field { margin-bottom: 22px; }
.course-module-field:last-child { margin-bottom: 0; }
.course-module-label { display: flex; width: 100%; gap: 8px; align-items: center; font-weight: 500; }
.course-module-order { color: var(--admin-ink-muted); font-size: 11px; font-variant-numeric: tabular-nums; }
.course-module-type { color: var(--admin-ink-muted); font-size: 11px; margin-left: auto; font-weight: 400; }
.body-editor, .image-field { width: 100%; }
.body-editor .el-radio-group { margin-bottom: 12px; }
.image-upload-empty { display: flex; gap: 14px; align-items: center; width: 100%; padding: 20px; border: 1px dashed var(--admin-primary-tint, #cfd9c8); border-radius: 8px; background: var(--admin-primary-alpha-08, #f6f8f3); }
.image-upload-symbol { font-size: 24px; color: var(--admin-primary); }
.image-upload-copy { display: flex; flex: 1; flex-direction: column; gap: 4px; min-width: 0; line-height: 1.5; }
.image-upload-copy strong { color: var(--admin-ink-soft); font-size: 13px; font-weight: 500; }
.image-upload-copy span { color: var(--admin-ink-muted); font-size: 11px; }
.image-upload-preview { width: 100%; border: 1px solid var(--admin-border); border-radius: 8px; overflow: hidden; background: var(--admin-page); }
.image-field img { display: block; max-width: 100%; max-height: 240px; margin: 12px auto; object-fit: contain; }
.image-preview-actions { display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; padding: 8px 14px; gap: 8px; background: var(--admin-paper, #fff); }
.image-preview-actions > span { font-size: 12px; color: var(--admin-ink-muted); }
@media (max-width: 540px) {
  .image-upload-empty { padding: 14px; gap: 10px; flex-wrap: wrap; }
  .image-upload-empty > .el-button { margin-left: 34px; }
}
</style>
