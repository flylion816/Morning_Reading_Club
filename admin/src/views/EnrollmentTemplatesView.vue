<template>
  <AdminLayout>
    <div class="enrollment-page">
      <header class="page-hero">
        <div><span class="eyebrow">业务配置 / 报名</span><h1>报名模板</h1><p>把必填资料收得恰到好处，让不同课程都有合适的报名入口。</p></div>
        <el-button type="primary" size="large" @click="openEditor()">＋新建模板</el-button>
      </header>

      <el-alert class="rule-card" type="info" :closable="false" show-icon>
        <template #title>使用规则</template>
        <span>报名模板只收集资料，价格由期次设置。模板被期次使用后仍可编辑，已绑定期次保留创建时的快照；停用后不能绑定新期次。</span>
      </el-alert>

      <section class="template-grid" v-loading="loading">
        <article v-for="template in templates" :key="template._id || template.id" class="template-card" :class="{ muted: !template.active }">
          <div class="card-top"><div><span class="template-type">{{ template.preset === 'full' ? '完整资料' : '快速报名' }}</span><h2>{{ template.name }}</h2></div><el-tag :type="template.builtIn ? 'info' : template.active ? 'success' : 'info'" effect="plain">{{ template.builtIn ? '内置' : template.active ? '启用' : '已停用' }}</el-tag></div>
          <p class="card-description">{{ template.preset === 'full' ? '适合需要了解学员背景、缘起与课程期待的长期营。' : '姓名与手机号两项必填，一页完成，适合轻量课程。' }}</p>
          <div class="field-chips"><span v-for="field in template.fields.slice(0, 6)" :key="field.key">{{ field.label }}<b v-if="field.required">必填</b></span><span v-if="template.fields.length > 6" class="more">+{{ template.fields.length - 6 }}</span></div>
          <footer class="card-footer"><small>{{ template.usageCount ? `已绑定 ${template.usageCount} 个期次` : '尚未绑定期次' }}</small><div><el-button text @click="preview = template">预览</el-button><el-button v-if="!template.builtIn" text @click="openEditor(template)">编辑</el-button><el-button text @click="openEditor(template, true)">复制</el-button><el-button v-if="!template.builtIn" text :type="template.active ? 'danger' : 'success'" :loading="changing === template._id" @click="toggle(template)">{{ template.active ? '停用' : '启用' }}</el-button></div></footer>
        </article>
        <div v-if="!loading && !templates.length" class="empty-state"><span>01</span><strong>还没有报名模板</strong><p>从简洁报名开始，几分钟内完成第一份表单。</p><el-button type="primary" plain @click="openEditor()">新建报名模板</el-button></div>
      </section>

      <el-dialog v-model="editing" :title="editingId ? '编辑报名模板' : '新建报名模板'" width="min(1080px, 96vw)" top="4vh" append-to-body :close-on-click-modal="false" destroy-on-close><EnrollmentTemplateEditor v-if="editing" :initial="draft" :saving="saving" @save="save" @cancel="editing = false" /></el-dialog>
      <el-dialog :model-value="!!preview" title="手机预览 · 示例内容" width="min(1000px, 96vw)" append-to-body @close="preview = null" destroy-on-close><EnrollmentTemplateEditor v-if="preview" :initial="preview" @cancel="preview = null" /></el-dialog>
    </div>
  </AdminLayout>
</template>

<script setup lang="ts">
import { onMounted, ref, watch } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import AdminLayout from '../components/AdminLayout.vue';
import EnrollmentTemplateEditor from '../components/EnrollmentTemplateEditor.vue';
import { enrollmentTemplateApi } from '../services/api';
import { useTenantStore } from '../stores/tenant';
import type { EnrollmentTemplate, EnrollmentTemplateDraft } from '../types/enrollment-template';

const templates = ref<EnrollmentTemplate[]>([]); const loading = ref(false); const editing = ref(false); const editingId = ref(''); const draft = ref<EnrollmentTemplateDraft>(); const saving = ref(false); const changing = ref(''); const preview = ref<EnrollmentTemplate | null>(null); const tenantStore = useTenantStore();
async function load() { loading.value = true; try { const response: any = await enrollmentTemplateApi.list(); templates.value = response.list || response.data || []; } catch (error: any) { ElMessage.error(error?.response?.data?.message || '报名模板加载失败，请刷新后重试'); } finally { loading.value = false; } }
function openEditor(template?: EnrollmentTemplate, copy = false) { editingId.value = copy ? '' : template?._id || ''; draft.value = template ? { name: copy ? `${template.name.slice(0, 25)}（副本）` : template.name, preset: template.preset, fields: template.fields.map(field => ({ ...field })), revision: copy ? undefined : template.revision } : undefined; editing.value = true; }
async function save(value: EnrollmentTemplateDraft) { const tenantId = tenantStore.activeTenantId; saving.value = true; try { if (editingId.value) await enrollmentTemplateApi.update(editingId.value, value); else await enrollmentTemplateApi.create(value); if (tenantStore.activeTenantId !== tenantId) return; editing.value = false; await load(); ElMessage.success('报名模板已保存'); } catch (error: any) { ElMessage.error(error?.response?.data?.message || '保存报名模板失败'); } finally { saving.value = false; } }
async function toggle(template: EnrollmentTemplate) { try { await ElMessageBox.confirm(template.active ? '停用后不能绑定新期次，已绑定期次不受影响。' : '重新启用这个报名模板？', '确认模板状态'); } catch { return; } changing.value = template._id || ''; try { await enrollmentTemplateApi.update(template._id!, { active: !template.active, revision: template.revision }); await load(); } catch (error: any) { ElMessage.error(error?.response?.data?.message || '修改状态失败'); } finally { changing.value = ''; } }
onMounted(load); watch(() => tenantStore.activeTenantId, () => { editing.value = false; preview.value = null; templates.value = []; load(); });
</script>

<style scoped>
.enrollment-page { padding: 28px; max-width: 1320px; margin: 0 auto; }.page-hero { display:flex; justify-content:space-between; align-items:flex-end; gap:20px; margin-bottom:22px; }.eyebrow, .template-type { color:var(--admin-primary,#5b7f4a); font-size:11px; letter-spacing:.12em; text-transform:uppercase; }.page-hero h1 { font-size:30px; letter-spacing:-.04em; margin:7px 0 7px; color:var(--admin-ink,#243329); }.page-hero p { color:var(--admin-ink-muted,#788478); margin:0; font-size:13px; }.rule-card { margin-bottom:24px; border:1px solid var(--admin-primary-alpha-12,#e1eadd); background:var(--admin-primary-soft,#f2f6ef); }.template-grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(330px,1fr)); gap:16px; }.template-card, .empty-state { background:var(--admin-paper,#fffdf8); border:1px solid var(--admin-paper-border,#e2e8df); border-radius:16px; padding:20px; box-shadow:0 12px 28px rgba(44,61,45,.06); transition:.2s ease; }.template-card:hover { transform:translateY(-2px); box-shadow:0 18px 34px rgba(44,61,45,.1); }.template-card.muted { opacity:.7; }.card-top { display:flex; justify-content:space-between; gap:12px; }.template-card h2 { font-size:19px; letter-spacing:-.02em; margin:6px 0 0; }.card-description { color:var(--admin-ink-muted,#788478); font-size:12px; line-height:1.7; min-height:42px; margin:16px 0; }.field-chips { display:flex; flex-wrap:wrap; gap:7px; min-height:48px; }.field-chips span { border:1px solid #e1e8dd; border-radius:7px; padding:6px 8px; background:#f8faf6; font-size:12px; }.field-chips b { font-size:10px; color:var(--admin-primary,#5b7f4a); margin-left:5px; font-weight:500; }.field-chips .more { color:var(--admin-ink-muted,#788478); border-style:dashed; }.card-footer { display:flex; justify-content:space-between; gap:10px; align-items:center; border-top:1px solid #edf0ea; margin-top:19px; padding-top:13px; }.card-footer small { color:var(--admin-ink-muted,#788478); font-size:11px; }.card-footer :deep(.el-button + .el-button) { margin-left:4px; }.empty-state { grid-column:1/-1; text-align:center; padding:60px 20px; }.empty-state > span { display:block; color:var(--admin-primary,#5b7f4a); font:600 12px var(--admin-font-number,monospace); }.empty-state strong { display:block; margin:10px 0 5px; font-size:18px; }.empty-state p { color:var(--admin-ink-muted,#788478); font-size:13px; margin:0 0 18px; }
@media (max-width:700px) { .enrollment-page { padding:16px 12px; }.page-hero { align-items:flex-start; flex-direction:column; }.page-hero h1 { font-size:26px; }.template-grid { grid-template-columns:1fr; }.card-footer { align-items:flex-start; flex-direction:column; }.card-footer > div { width:100%; display:flex; justify-content:flex-end; flex-wrap:wrap; } }
</style>
