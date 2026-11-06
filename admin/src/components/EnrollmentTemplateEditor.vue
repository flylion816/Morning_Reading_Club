<template>
  <div class="enrollment-editor">
    <div class="editor-main">
      <div class="editor-intro">
        <div><span class="eyebrow">报名资料</span><h2>搭一份刚刚好的报名表</h2><p>费用由期次设置，报名模板只负责收集必要信息。</p></div>
        <el-tag effect="plain">{{ selectedFieldCount }} 项资料</el-tag>
      </div>

      <el-form label-position="top">
        <el-form-item label="模板名称" required>
          <el-input v-model="draft.name" maxlength="30" show-word-limit placeholder="例如：空间管理简洁报名" />
        </el-form-item>
      </el-form>

      <section class="preset-section" aria-labelledby="preset-title">
        <div class="section-heading"><div><span class="section-kicker">01</span><strong id="preset-title">先选一个起点</strong></div><span>可再调整资料项</span></div>
        <div class="preset-grid">
          <button v-for="preset in presets" :key="preset.value" type="button" class="preset-card" :class="{ selected: draft.preset === preset.value }" @click="applyPreset(preset.value)">
            <span class="preset-mark">{{ preset.value === 'simple' ? '01' : '07' }}</span><span><strong>{{ preset.label }}</strong><small>{{ preset.description }}</small></span><span class="check">{{ draft.preset === preset.value ? '✓' : '' }}</span>
          </button>
        </div>
      </section>

      <section class="field-section" aria-labelledby="fields-title">
        <div class="section-heading"><div><span class="section-kicker">02</span><strong id="fields-title">收集哪些资料</strong></div><span>字段来自现有报名资料目录</span></div>
        <div v-for="group in fieldGroups" :key="group" class="field-group">
          <div class="field-group-title">{{ group }}</div>
          <label v-for="field in fieldsByGroup(group)" :key="field.key" class="field-row">
            <el-checkbox :model-value="hasField(field.key)" @change="toggleField(field)"><span class="field-label">{{ field.label }}</span></el-checkbox>
            <span v-if="hasField(field.key)" class="field-options"><el-checkbox :model-value="fieldState(field.key)?.required" size="small" @update:model-value="setRequired(field.key, $event)">必填</el-checkbox><el-input v-model="fieldState(field.key)!.label" size="small" maxlength="20" aria-label="字段显示名称" /></span>
            <span v-if="field.help && hasField(field.key)" class="field-help">{{ field.help }}</span>
          </label>
        </div>
      </section>
      <p v-if="error" class="editor-error" role="alert">{{ error }}</p>
      <div class="editor-actions"><el-button @click="$emit('cancel')">取消</el-button><el-button type="primary" :loading="saving" @click="submit">保存报名模板</el-button></div>
    </div>

    <aside class="preview-side">
      <div class="preview-heading"><div><span class="eyebrow">手机预览</span><strong>{{ draft.preset === 'full' ? '分步报名' : '一页完成' }}</strong></div><span>示例效果</span></div>
      <div class="phone-preview">
        <div class="phone-status"><span>9:41</span><span>••• ▰</span></div><div class="phone-nav"><span>‹</span><strong>课程报名</strong><span>···</span></div>
        <div class="phone-content"><div class="phone-kicker">SPACE MANAGEMENT</div><h3>{{ draft.name || '课程报名' }}</h3><p class="phone-note">填写资料后即可加入本期课程</p><div class="phone-progress" v-if="draft.preset === 'full'"><span class="active"></span><span></span><span></span></div><div v-for="field in previewFields" :key="field.key" class="phone-field"><label>{{ field.label }}<em v-if="field.required">*</em></label><div>{{ field.key === 'phone' ? '请输入手机号' : '请输入' + field.label }}</div></div></div>
        <div class="phone-footer"><div><small>报名费用</small><strong>以期次设置为准</strong></div><button type="button">{{ draft.preset === 'simple' ? '确认报名' : '下一步' }}</button></div>
      </div>
      <p class="preview-tip">这是排版预览，不会提交报名或产生支付。</p>
    </aside>
  </div>
</template>

<script setup lang="ts">
import { computed, reactive, ref } from 'vue';
import type { EnrollmentFieldKey, EnrollmentTemplateDraft, EnrollmentTemplateField } from '../types/enrollment-template';
import { ENROLLMENT_FIELD_CATALOG, FULL_ENROLLMENT_FIELDS, SIMPLE_ENROLLMENT_FIELDS } from '../types/enrollment-template';

const props = defineProps<{ initial?: EnrollmentTemplateDraft; saving?: boolean }>();
const emit = defineEmits<{ save: [value: EnrollmentTemplateDraft]; cancel: [] }>();
const draft = reactive<EnrollmentTemplateDraft>({ name: props.initial?.name || '', preset: props.initial?.preset || 'simple', fields: props.initial?.fields?.map(field => ({ ...field })) || SIMPLE_ENROLLMENT_FIELDS.map(field => ({ ...field })), revision: props.initial?.revision });
const error = ref('');
const presets = [{ value: 'simple' as const, label: '简洁报名', description: '姓名、手机号，适合快速报名' }, { value: 'full' as const, label: '七个习惯完整版', description: '基本信息、缘起、期待与承诺' }];
const fieldGroups = [...new Set(ENROLLMENT_FIELD_CATALOG.map(field => field.group))];
const selectedFieldCount = computed(() => draft.fields.length);
const previewFields = computed(() => draft.fields.slice(0, 5));
function fieldsByGroup(group: string) { return ENROLLMENT_FIELD_CATALOG.filter(field => field.group === group); }
function hasField(key: EnrollmentFieldKey) { return draft.fields.some(field => field.key === key); }
function fieldState(key: EnrollmentFieldKey) { return draft.fields.find(field => field.key === key); }
function setRequired(key: EnrollmentFieldKey, value: boolean | string | number) { const field = fieldState(key); if (field) field.required = Boolean(value); }
function applyPreset(preset: 'simple' | 'full') { draft.preset = preset; draft.fields = (preset === 'simple' ? SIMPLE_ENROLLMENT_FIELDS : FULL_ENROLLMENT_FIELDS).map(field => ({ ...field })); }
function toggleField(field: EnrollmentTemplateField) {
  const index = draft.fields.findIndex(item => item.key === field.key);
  if (index >= 0) draft.fields.splice(index, 1);
  else draft.fields.push({ key: field.key, label: field.label, required: field.required, help: field.help });
  if (draft.preset !== 'simple' && draft.preset !== 'full') draft.preset = 'custom';
}
function submit() {
  if (!draft.name.trim()) { error.value = '请输入模板名称'; return; }
  if (!draft.fields.some(field => field.key === 'name')) { error.value = '报名模板必须收集姓名'; return; }
  if (!draft.fields.some(field => field.key === 'phone')) { error.value = '报名模板必须收集手机号'; return; }
  error.value = '';
  emit('save', { name: draft.name.trim(), preset: draft.preset, fields: draft.fields.map(field => ({ ...field, label: field.label.trim() })), revision: draft.revision });
}
</script>

<style scoped>
.enrollment-editor { display: grid; grid-template-columns: minmax(0, 1fr) 300px; gap: 28px; color: var(--admin-ink, #243329); }
.editor-main { min-width: 0; }
.editor-intro, .section-heading, .preview-heading { display: flex; justify-content: space-between; align-items: flex-start; gap: 12px; }
.eyebrow, .section-kicker { color: var(--admin-primary, #5b7f4a); font-size: 11px; letter-spacing: .12em; text-transform: uppercase; }
.editor-intro h2 { margin: 5px 0 4px; font-size: 23px; letter-spacing: -.03em; }
.editor-intro p, .section-heading > span, .preview-heading > span, .preview-tip { color: var(--admin-ink-muted, #788478); font-size: 12px; line-height: 1.7; }
.editor-intro { margin-bottom: 22px; }
.section-heading { margin: 22px 0 12px; padding-top: 18px; border-top: 1px solid var(--admin-paper-divider, #e9ece4); }
.section-heading > div { display: flex; align-items: center; gap: 10px; }
.preset-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
.preset-card { border: 1px solid var(--admin-paper-border, #dfe6db); background: var(--admin-paper, #fffdf8); color: inherit; border-radius: 12px; display: grid; grid-template-columns: 34px 1fr 20px; text-align: left; gap: 10px; align-items: center; padding: 14px; cursor: pointer; transition: .2s ease; }
.preset-card:hover, .preset-card.selected { border-color: var(--admin-primary, #5b7f4a); background: var(--admin-primary-soft, #eef3eb); }
.preset-card strong, .preset-card small { display: block; }.preset-card small { color: var(--admin-ink-muted, #788478); margin-top: 4px; font-size: 12px; line-height: 1.5; }.preset-mark { color: var(--admin-primary, #5b7f4a); font: 600 12px var(--admin-font-number, monospace); }.check { color: var(--admin-primary, #5b7f4a); font-size: 18px; }
.field-group { border-bottom: 1px solid #edf0ea; }.field-group-title { padding: 11px 0 4px; color: var(--admin-ink-muted, #788478); font-size: 12px; }.field-row { display: flex; align-items: center; gap: 10px; min-height: 46px; border-bottom: 1px solid #f1f3ef; position: relative; }.field-label { font-size: 13px; }.field-options { margin-left: auto; display: flex; align-items: center; gap: 8px; }.field-options :deep(.el-input) { width: 145px; }.field-help { position: absolute; left: 30px; bottom: 2px; color: var(--admin-ink-muted, #788478); font-size: 10px; }.editor-error { color: var(--admin-danger, #b84636); font-size: 12px; margin: 16px 0; }.editor-actions { display: flex; justify-content: flex-end; gap: 8px; margin-top: 22px; }
.preview-side { border-left: 1px solid var(--admin-paper-divider, #e9ece4); padding-left: 24px; }.preview-heading strong { display: block; margin-top: 5px; font-size: 16px; }.phone-preview { overflow: hidden; border: 5px solid #243a2a; border-radius: 25px; background: #f7f6ef; box-shadow: 0 16px 28px rgba(36,58,42,.16); margin-top: 18px; }.phone-status, .phone-nav { display: flex; justify-content: space-between; align-items: center; }.phone-status { background: var(--admin-primary, #5b7f4a); color: #fff; padding: 8px 14px; font-size: 10px; }.phone-nav { background: var(--admin-primary, #5b7f4a); color: #fff; padding: 10px 14px 14px; }.phone-content { min-height: 430px; padding: 20px 15px 16px; }.phone-kicker { color: var(--admin-primary, #5b7f4a); font-size: 9px; letter-spacing: .14em; }.phone-content h3 { font-size: 19px; margin: 8px 0 4px; }.phone-note { color: #849184; font-size: 11px; margin: 0 0 18px; }.phone-progress { display: flex; gap: 4px; margin: 12px 0 18px; }.phone-progress span { height: 3px; background: #dce4d8; flex: 1; border-radius: 3px; }.phone-progress .active { background: var(--admin-primary, #5b7f4a); }.phone-field { margin: 12px 0; }.phone-field label { display: block; font-weight: 600; font-size: 11px; margin-bottom: 5px; }.phone-field em { color: #b84636; font-style: normal; }.phone-field div { border: 1px solid #e0e6dc; background: #fff; color: #a6b0a5; border-radius: 7px; padding: 9px; font-size: 11px; }.phone-footer { border-top: 1px solid #e6eadf; background: #fff; padding: 12px 14px 14px; }.phone-footer > div { display: flex; justify-content: space-between; align-items: center; margin-bottom: 9px; }.phone-footer small { color: #89968b; }.phone-footer strong { font-size: 11px; }.phone-footer button { width: 100%; border: 0; background: var(--admin-primary, #5b7f4a); color: #fff; border-radius: 9px; padding: 10px; font-weight: 600; }
@media (max-width: 800px) { .enrollment-editor { grid-template-columns: 1fr; }.preview-side { border-left: 0; border-top: 1px solid var(--admin-paper-divider, #e9ece4); padding: 22px 0 0; }.phone-preview { max-width: 300px; margin-inline: auto; }.preset-grid { grid-template-columns: 1fr; } }
@media (max-width: 500px) { .field-row { align-items: flex-start; flex-direction: column; padding: 10px 0; }.field-options { margin-left: 0; width: 100%; }.field-options :deep(.el-input) { flex: 1; width: auto; } }
</style>
