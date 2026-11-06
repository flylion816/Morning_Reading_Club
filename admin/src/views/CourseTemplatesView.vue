<template>
  <AdminLayout>
    <el-card>
      <template #header><div class="template-toolbar"><span>课程模板</span><el-button type="primary" @click="open()">＋新建模板</el-button></div></template>
      <p class="template-hint">创建模板后，在新建期次时选择使用。修改模板只影响以后绑定的期次。</p>
      <el-alert class="template-rules" type="info" :closable="false" show-icon>
        <template #title>使用规则</template>
        <ul>
          <li>模板被期次使用后仍可编辑；修改只影响以后新建并绑定的期次，已有期次保持原模板快照。</li>
          <li>模板可以停用；停用后不能被新期次选择，已绑定期次继续正常使用。</li>
          <li>内置“七个习惯晨读营”模板不能直接修改或停用，需要先复制成自定义模板。</li>
          <li>期次已有课节后不能更换模板；需要新结构时请复制模板并创建新期次。</li>
        </ul>
      </el-alert>
      <el-table v-loading="loading" :data="templates" stripe>
        <el-table-column prop="name" label="模板名称" min-width="160" />
        <el-table-column label="课程模块" min-width="260"><template #default="{ row }">{{ row.modules.map((module: any) => module.name).join(' · ') }}</template></el-table-column>
        <el-table-column label="状态" width="100"><template #default="{ row }"><el-tag>{{ row.builtIn ? '内置' : row.active ? '启用' : '停用' }}</el-tag></template></el-table-column>
        <el-table-column label="操作" min-width="260"><template #default="{ row }">
          <el-button text @click="preview = row">预览</el-button>
          <el-button v-if="!row.builtIn" text @click="open(row)">编辑</el-button>
          <el-button text @click="open(row, true)">复制</el-button>
          <el-button v-if="!row.builtIn" text :loading="changing === row._id" @click="toggle(row)">{{ row.active ? '停用' : '启用' }}</el-button>
        </template></el-table-column>
      </el-table>
    </el-card>
    <el-dialog v-model="editing" :title="editingId ? '编辑课程模板' : '新建课程模板'" width="min(1100px, 96vw)" top="4vh" append-to-body show-close :close-on-click-modal="false" destroy-on-close>
      <CourseTemplateEditor v-if="editing" :initial="draft" :saving="saving" @save="save" @cancel="editing = false" />
    </el-dialog>
    <el-dialog :model-value="!!preview" title="手机预览 · 示例内容" width="min(460px, 96vw)" append-to-body show-close @close="preview = null" destroy-on-close>
      <div v-if="preview" class="saved-preview"><CourseTemplateEditor :initial="preview" /></div>
    </el-dialog>
  </AdminLayout>
</template>
<script setup lang="ts">
import { onMounted, ref, watch } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import AdminLayout from '../components/AdminLayout.vue';
import CourseTemplateEditor from '../components/CourseTemplateEditor.vue';
import { courseTemplateApi } from '../services/api';
import { useTenantStore } from '../stores/tenant';
import type { CourseTemplate, CourseTemplateDraft } from '../types/course-template';
const templates = ref<CourseTemplate[]>([]);
const loading = ref(false);
const editing = ref(false);
const editingId = ref('');
const draft = ref<CourseTemplateDraft>();
const saving = ref(false);
const changing = ref('');
const preview = ref<CourseTemplate | null>(null);
const tenantStore = useTenantStore();
let loadSequence = 0;
async function load() {
  const sequence = ++loadSequence;
  loading.value = true;
  try { const response: any = await courseTemplateApi.list(); if (sequence === loadSequence) templates.value = response.list || response.data || []; }
  catch (error: any) {
    if (sequence !== loadSequence) return;
    const status = error?.response?.status || error?.status;
    const message = error?.response?.data?.message || error?.message;
    ElMessage.error(status === 403 && message ? `模板加载失败：${message}` : '模板加载失败，请刷新后重试');
  }
  finally { if (sequence === loadSequence) loading.value = false; }
}
function open(template?: CourseTemplate, copy = false) {
  editingId.value = copy ? '' : template?._id || '';
  draft.value = template ? { name: copy ? `${template.name.slice(0, 25)}（副本）` : template.name, modules: template.modules.map(module => ({ ...module })), extensions: { duration: template.extensions?.duration !== false, closingVideo: template.extensions?.closingVideo !== false, podcast: template.extensions?.podcast !== false }, revision: copy ? undefined : template.revision } : undefined;
  editing.value = true;
}
async function save(value: CourseTemplateDraft) {
  const tenantId = tenantStore.activeTenantId;
  saving.value = true;
  try {
    if (editingId.value) await courseTemplateApi.update(editingId.value, value);
    else await courseTemplateApi.create(value);
    if (tenantStore.activeTenantId !== tenantId) return;
    editing.value = false;
    await load();
    ElMessage.success('课程模板已保存');
  } catch (error: any) { ElMessage.error(error?.response?.data?.message || '保存失败'); }
  finally { saving.value = false; }
}
async function toggle(template: CourseTemplate) {
  try { await ElMessageBox.confirm(template.active ? '停用后不再供新期次选择，已绑定期次不受影响。' : '启用此课程模板？', '确认模板状态'); }
  catch { return; }
  changing.value = template._id || '';
  try { await courseTemplateApi.update(template._id!, { ...template, active: !template.active }); await load(); }
  catch (error: any) { ElMessage.error(error?.response?.data?.message || '修改状态失败'); }
  finally { changing.value = ''; }
}
onMounted(load);
watch(() => tenantStore.activeTenantId, () => { editing.value = false; preview.value = null; templates.value = []; load(); });
</script>
<style scoped>
.template-toolbar { display: flex; justify-content: space-between; align-items: center; }
.template-hint { color: #788478; margin-top: 0; }
.template-rules { margin: 14px 0 18px; }
.template-rules :deep(ul) { margin: 6px 0 0; padding-left: 20px; line-height: 1.8; }
.saved-preview :deep(.el-form), .saved-preview :deep(.actions), .saved-preview :deep(.preview-heading) { display: none; }
.saved-preview :deep(.template-editor) { display: block; }
.saved-preview :deep(.phone-preview) { width: min(100%, 320px); margin: 0 auto; }
</style>
