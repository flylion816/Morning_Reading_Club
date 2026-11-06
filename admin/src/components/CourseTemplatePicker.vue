<template>
  <div class="template-picker">
    <el-select :model-value="modelValue" :disabled="disabled || loading" placeholder="选择课程模板" @update:model-value="$emit('update:modelValue', $event)">
      <el-option v-for="item in options" :key="item._id || item.id" :value="item._id || item.id || ''" :label="item.name" :disabled="!item.active" />
    </el-select>
    <el-button :disabled="disabled" @click="creating = true">＋新建模板</el-button>
    <p v-if="selected" class="template-summary">{{ selected.modules.map(module => module.name).join(' · ') }}</p>
    <p v-if="disabled" class="template-summary">已有课节的期次不能更换模板。</p>
    <el-dialog v-model="creating" title="新建课程模板" width="min(1100px, 96vw)" top="4vh" append-to-body show-close :close-on-click-modal="false" destroy-on-close>
      <CourseTemplateEditor v-if="creating" :saving="saving" @save="save" @cancel="creating = false" />
    </el-dialog>
  </div>
</template>
<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { ElMessage } from 'element-plus';
import { courseTemplateApi } from '../services/api';
import { useTenantStore } from '../stores/tenant';
import CourseTemplateEditor from './CourseTemplateEditor.vue';
import type { CourseTemplate, CourseTemplateDraft } from '../types/course-template';
const props = defineProps<{ modelValue: string; disabled?: boolean; currentName?: string }>();
const emit = defineEmits<{ 'update:modelValue': [value: string] }>();
const options = ref<CourseTemplate[]>([]);
const creating = ref(false);
const loading = ref(false);
const saving = ref(false);
const tenantStore = useTenantStore();
let loadSequence = 0;
const selected = computed(() => options.value.find(item => (item._id || item.id) === props.modelValue));
async function load() {
  const sequence = ++loadSequence;
  loading.value = true;
  try {
    const response: any = await courseTemplateApi.list();
    if (sequence !== loadSequence) return;
    options.value = response.list || response.data || [];
    if (props.modelValue && !selected.value && props.currentName) options.value.push({ id: props.modelValue, name: props.currentName, active: false, modules: [], revision: 1 });
  } catch (error: any) {
    if (sequence !== loadSequence) return;
    const message = error?.response?.data?.message || error?.message;
    ElMessage.error(message ? `课程模板加载失败：${message}` : '课程模板加载失败，请刷新后重试');
  }
  finally { if (sequence === loadSequence) loading.value = false; }
}
async function save(draft: CourseTemplateDraft) {
  const tenantId = tenantStore.activeTenantId;
  saving.value = true;
  try {
    const created: any = await courseTemplateApi.create(draft);
    if (tenantStore.activeTenantId !== tenantId) return;
    await load();
    emit('update:modelValue', created._id);
    creating.value = false;
    ElMessage.success('模板已创建并选中');
  } catch (error: any) { ElMessage.error(error?.response?.data?.message || '保存模板失败'); }
  finally { saving.value = false; }
}
onMounted(load);
watch(() => tenantStore.activeTenantId, () => { creating.value = false; options.value = []; load(); });
</script>
<style scoped>
.template-picker { width: 100%; }
.template-picker > .el-select { width: min(100%, 260px); margin-right: 8px; }
.template-summary { margin: 8px 0 0; color: #788478; font-size: 12px; line-height: 1.7; }
</style>
