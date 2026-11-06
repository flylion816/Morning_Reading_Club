<template>
  <div class="template-editor">
    <el-form label-position="top">
      <el-form-item label="模板名称" required>
        <el-input v-model="draft.name" maxlength="30" show-word-limit placeholder="例如：空间管理" />
      </el-form-item>
      <div class="editor-heading">
        <strong>课程模块</strong>
        <el-button :disabled="draft.modules.length >= 20" @click="addModule">＋添加模块</el-button>
      </div>
      <p class="hint">同一期次的课节使用相同的模块和顺序；正文最多一个。</p>
      <div v-for="(module, index) in draft.modules" :key="module.id" class="module-row">
        <span class="order">{{ index + 1 }}</span>
        <el-input v-model="module.name" maxlength="30" placeholder="模块名称" aria-label="模块名称" />
        <el-select v-model="module.type" aria-label="模块类型" style="width: 132px; flex-shrink: 0">
          <el-option label="短文本" value="shortText" />
          <el-option label="多行文本" value="text" />
          <el-option label="正文" value="body" />
          <el-option label="图片" value="image" />
        </el-select>
        <el-button :disabled="index === 0" aria-label="上移模块" @click="move(index, -1)">↑</el-button>
        <el-button :disabled="index === draft.modules.length - 1" aria-label="下移模块" @click="move(index, 1)">↓</el-button>
        <el-button text type="danger" aria-label="删除模块" @click="draft.modules.splice(index, 1)">删除</el-button>
      </div>
      <div class="extensions-config">
        <strong>扩展能力</strong>
        <p class="hint">控制新增课节时是否显示时长、结营视频和凡人播客配置。</p>
        <el-checkbox v-model="draft.extensions!.duration">时长（分钟）</el-checkbox>
        <el-checkbox v-model="draft.extensions!.closingVideo">结营视频</el-checkbox>
        <el-checkbox v-model="draft.extensions!.podcast">凡人播客</el-checkbox>
      </div>
    </el-form>

    <div class="preview-heading"><strong>手机预览</strong><span>模拟效果 · 示例内容</span></div>
    <div class="phone-preview">
      <div class="phone-header">课程详情</div>
      <div class="phone-body">
        <div class="preview-day">DAY 01</div>
        <h3>示例课程标题</h3>
        <div v-for="module in draft.modules" :key="module.id" class="preview-module">
          <h4>{{ module.name || '未命名模块' }}</h4>
          <div v-if="module.type === 'image'" class="image-placeholder">图片展示区域</div>
          <p v-else-if="module.type === 'body'">这是正文示例。课程内容可以包含段落、图片和其他排版。</p>
          <p v-else-if="module.type === 'shortText'">这里展示简短内容</p>
          <p v-else>这里展示课程的文字内容。学员将在手机上按此顺序阅读。</p>
        </div>
      </div>
    </div>
    <div v-if="error" role="alert" class="error">{{ error }}</div>
    <div class="actions">
      <el-button @click="$emit('cancel')">取消</el-button>
      <el-button type="primary" :loading="saving" @click="submit">保存模板</el-button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { reactive, ref } from 'vue';

import type { CourseTemplateDraft as TemplateDraft } from '../types/course-template';

const props = defineProps<{ initial?: TemplateDraft; saving?: boolean }>();
const emit = defineEmits<{ save: [value: TemplateDraft]; cancel: [] }>();
const draft = reactive<TemplateDraft>({
  name: props.initial?.name || '',
  modules: props.initial?.modules?.map(module => ({ ...module })) || [],
  extensions: {
    duration: props.initial ? props.initial.extensions?.duration !== false : false,
    closingVideo: props.initial ? props.initial.extensions?.closingVideo !== false : false,
    podcast: props.initial ? props.initial.extensions?.podcast !== false : false
  },
  revision: props.initial?.revision
});
const error = ref('');

function addModule() {
  const id = `m_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
  draft.modules.push({ id, name: '', type: 'text' });
}

function move(index: number, direction: number) {
  const target = index + direction;
  if (target < 0 || target >= draft.modules.length) return;
  const [module] = draft.modules.splice(index, 1);
  if (module) draft.modules.splice(target, 0, module);
}

function submit() {
  if (!draft.name.trim()) error.value = '请输入模板名称';
  else if (!draft.modules.length) error.value = '请至少添加一个模块';
  else if (draft.modules.some(module => !module.name.trim())) error.value = '请填写每个模块的名称';
  else if (draft.modules.filter(module => module.type === 'body').length > 1) error.value = '正文模块最多一个';
  else {
    error.value = '';
    emit('save', {
      name: draft.name.trim(),
      modules: draft.modules.map(module => ({ ...module, name: module.name.trim() })),
      extensions: {
        duration: draft.extensions?.duration !== false,
        closingVideo: draft.extensions?.closingVideo !== false,
        podcast: draft.extensions?.podcast !== false
      },
      revision: draft.revision
    });
  }
}
</script>

<style scoped>
.template-editor { display: grid; grid-template-columns: minmax(0, 1fr) minmax(240px, 300px); gap: 16px 24px; position: relative; }
.editor-heading, .preview-heading { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
.extensions-config { grid-column: 1; margin-top: 8px; padding: 12px; border: 1px solid #e6eadd; border-radius: 8px; background: #fafbf7; }
.extensions-config .hint { margin: 6px 0; }
.preview-heading { grid-column: 2; grid-row: 1; align-self: start; font-size: 14px; }
.preview-heading span, .hint { color: #788478; font-size: 12px; }
.module-row { display: flex; gap: 6px; align-items: center; margin: 8px 0; }
.module-row .el-button + .el-button { margin-left: 0; }
.order { color: #788478; min-width: 20px; }
.phone-preview { grid-column: 2; grid-row: 1; align-self: start; margin-top: 34px; border: 6px solid var(--admin-primary-deep, #293a2b); border-radius: 24px; overflow: hidden; background: #f9f7ef; max-height: 570px; overflow-y: auto; }
.phone-header { padding: 18px; background: var(--admin-primary-soft, #e8eee4); text-align: center; color: var(--admin-primary-deep, #243c2b); font-weight: 600; }
.phone-body { padding: 18px; }
.preview-day { font-size: 11px; color: #81977d; letter-spacing: 2px; }
.phone-body h3 { margin: 8px 0 20px; font-size: 19px; }
.preview-module { border-top: 1px solid #e6eadd; padding: 6px 0; }
.preview-module h4 { margin: 10px 0; color: var(--admin-primary-dark, #536f4b); }
.preview-module p { font-size: 13px; line-height: 1.7; color: #455348; }
.image-placeholder { background: var(--admin-primary-tint, #e1e9d9); color: #788d72; padding: 30px 8px; text-align: center; font-size: 12px; }
.error { color: #b84636; grid-column: 1 / -1; }
.actions { grid-column: 1 / -1; display: flex; justify-content: flex-end; }
@media (max-width: 800px) {
  .template-editor { grid-template-columns: minmax(0, 1fr); }
  .preview-heading, .phone-preview { grid-column: 1; grid-row: auto; }
  .phone-preview { margin: 0 auto; width: min(100%, 300px); }
  .module-row { flex-wrap: wrap; }
  .module-row .el-input { min-width: 120px; flex: 1; }
}
</style>
