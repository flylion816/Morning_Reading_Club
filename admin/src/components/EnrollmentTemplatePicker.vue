<template>
  <div class="enrollment-picker">
    <div class="picker-line"><el-select :model-value="selectedId || modelValue" :disabled="disabled || loading" placeholder="选择报名模板" @update:model-value="$emit('update:modelValue', $event)"><el-option v-for="item in options" :key="optionId(item)" :label="item.name" :value="optionId(item)" :disabled="!item.active" /></el-select><el-button :disabled="disabled" @click="creating = true">＋新建模板</el-button></div>
    <p v-if="modelValue && (selected || currentName)" class="picker-summary"><strong>{{ selected?.name || currentName }}</strong><span v-if="selected?.fields?.length"> · {{ selected.fields.map(field => field.label).join(' · ') }}</span></p>
    <p v-if="disabled" class="picker-help">已有报名记录的期次不能更换报名模板。</p>
    <el-dialog v-model="creating" title="新建报名模板" width="min(1050px, 96vw)" top="4vh" append-to-body :close-on-click-modal="false" destroy-on-close><EnrollmentTemplateEditor v-if="creating" :saving="saving" @save="save" @cancel="creating = false" /></el-dialog>
  </div>
</template>
<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { ElMessage } from 'element-plus';
import { enrollmentTemplateApi } from '../services/api';
import { useTenantStore } from '../stores/tenant';
import EnrollmentTemplateEditor from './EnrollmentTemplateEditor.vue';
import type { EnrollmentTemplate, EnrollmentTemplateDraft } from '../types/enrollment-template';
const props = defineProps<{ modelValue: string; disabled?: boolean; currentName?: string }>();
const emit = defineEmits<{ 'update:modelValue': [value: string] }>();
const options = ref<EnrollmentTemplate[]>([]); const creating = ref(false); const loading = ref(false); const saving = ref(false); const tenantStore = useTenantStore();
function optionId(item: any) { return String(item?._id || item?.id || item?.templateId || ''); }
function matches(item: any, value: string) {
  const normalized = String(value || '');
  if (!normalized) return false;
  return optionId(item) === normalized ||
    String(item?.templateId || '') === normalized ||
    String(item?.builtInKey || '') === normalized ||
    (normalized === 'simple' && item?.preset === 'simple') ||
    (normalized === 'full' && item?.preset === 'full');
}
const selected = computed(() => options.value.find(item => matches(item, props.modelValue)));
const selectedId = computed(() => selected.value ? optionId(selected.value) : '');
async function load() { loading.value = true; try { const response: any = await enrollmentTemplateApi.list(); options.value = response.list || response.data || []; if (props.modelValue && !selected.value && props.currentName) options.value.push({ id: props.modelValue, name: props.currentName, active: false, preset: 'custom', fields: [], revision: 1 }); } catch (error: any) { ElMessage.error(error?.response?.data?.message || '报名模板加载失败'); } finally { loading.value = false; } }
async function save(draft: EnrollmentTemplateDraft) { const tenantId = tenantStore.activeTenantId; saving.value = true; try { const created: any = await enrollmentTemplateApi.create(draft); if (tenantStore.activeTenantId !== tenantId) return; await load(); emit('update:modelValue', created?._id || created?.id || created?.data?._id); creating.value = false; ElMessage.success('报名模板已创建并选中'); } catch (error: any) { ElMessage.error(error?.response?.data?.message || '保存报名模板失败'); } finally { saving.value = false; } }
onMounted(load); watch(() => tenantStore.activeTenantId, () => { options.value = []; load(); });
</script>
<style scoped>
.enrollment-picker { width: 100%; min-width: 0; }
.picker-line { display: flex; gap: 8px; align-items: center; }
.picker-line :deep(.el-select) { width: min(100%, 260px); min-width: 0; }
.picker-line .el-button { flex-shrink: 0; }
.picker-summary, .picker-help { margin: 8px 0 0; color: #788478; font-size: 12px; line-height: 1.7; overflow-wrap: anywhere; }
.picker-summary strong { font-weight: 500; }
</style>
