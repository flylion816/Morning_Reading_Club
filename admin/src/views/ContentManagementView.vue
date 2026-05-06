<template>
  <AdminLayout>
    <div class="content-management-container">
      <!-- 期次选择 -->
      <el-card style="margin-bottom: 20px">
        <template #header>
          <div class="card-header">
            <span class="card-title">课程内容管理</span>
            <el-select
              v-model="selectedPeriodId"
              placeholder="选择期次"
              style="width: 200px"
              @change="loadSections"
            >
              <el-option
                v-for="period in periods"
                :key="period._id"
                :label="period.name"
                :value="period._id"
              />
            </el-select>
          </div>
        </template>
      </el-card>

      <!-- 课节列表 -->
      <el-card v-if="selectedPeriodId">
        <template #header>
          <div class="card-header">
            <span>{{ currentPeriod?.name }} - 课程列表</span>
            <el-button type="primary" @click="handleAddSection">+ 新增课节</el-button>
          </div>
        </template>

        <el-table :data="sections" stripe style="width: 100%; margin-bottom: 20px">
          <el-table-column prop="day" label="第几天" width="80" />
          <el-table-column prop="title" label="课程标题" min-width="200" />
          <el-table-column label="状态" width="100">
            <template #default="{ row }">
              <el-tag :type="row.isPublished ? 'success' : 'info'">
                {{ row.isPublished ? '已发布' : '草稿' }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column label="打卡数" width="80">
            <template #default="{ row }">
              {{ row.checkinCount || 0 }}
            </template>
          </el-table-column>
          <el-table-column label="操作" width="280" fixed="right">
            <template #default="{ row }">
              <div class="action-buttons">
                <el-button
                  type="primary"
                  size="small"
                  :loading="loadingSectionId === row._id"
                  @click="handleEditSection(row)"
                >
                  编辑
                </el-button>
                <el-button type="warning" size="small" @click="togglePublish(row)">
                  {{ row.isPublished ? '下架' : '发布' }}
                </el-button>
                <el-button type="danger" size="small" @click="handleDeleteSection(row)"
                  >删除</el-button
                >
              </div>
            </template>
          </el-table-column>
        </el-table>
      </el-card>

      <el-empty v-else description="请先选择一个期次" />

      <!-- 编辑课节弹窗 -->
      <el-dialog
        v-model="editDialogVisible"
        :title="isNewSection ? '新增课节' : '编辑课节'"
        width="900px"
        :close-on-click-modal="false"
        :close-on-press-escape="false"
        :before-close="handleDialogBeforeClose"
        @close="resetForm"
      >
        <el-form
          :model="editingSection"
          label-width="120px"
          style="max-height: 600px; overflow-y: auto"
        >
          <!-- 基本信息 -->
          <div class="form-section">
            <div class="section-title">基本信息</div>

            <el-form-item label="第几天">
              <el-input-number v-model="editingSection.day" :min="0" :max="30" />
            </el-form-item>

            <el-form-item label="课程标题">
              <el-input v-model="editingSection.title" placeholder="请输入课程标题" />
            </el-form-item>

            <el-form-item label="副标题">
              <el-input v-model="editingSection.subtitle" placeholder="可选" />
            </el-form-item>

            <el-form-item label="图标">
              <el-input v-model="editingSection.icon" placeholder="🎯" maxlength="10" />
            </el-form-item>
          </div>

          <!-- 5个学习模块 -->
          <div class="form-section">
            <div class="section-title">学习模块</div>

            <!-- 静一静 -->
            <el-form-item label="静一静">
              <el-input
                v-model="editingSection.meditation"
                type="textarea"
                placeholder="冥想或静思的内容"
                :rows="3"
                maxlength="500"
                show-word-limit
              />
            </el-form-item>

            <!-- 问一问 -->
            <el-form-item label="问一问">
              <el-input
                v-model="editingSection.question"
                type="textarea"
                placeholder="思考问题"
                :rows="3"
                maxlength="500"
                show-word-limit
              />
            </el-form-item>

            <!-- 读一读 -->
            <el-form-item label="正文格式">
              <div class="content-editor-mode">
                <el-button
                  size="small"
                  :type="contentEditorMode === 'markdown' ? 'primary' : 'default'"
                  @click="contentEditorMode = 'markdown'"
                >
                  Markdown
                </el-button>
                <el-button
                  size="small"
                  :type="contentEditorMode === 'richtext' ? 'primary' : 'default'"
                  @click="contentEditorMode = 'richtext'"
                >
                  富文本
                </el-button>
              </div>
              <div class="editor-mode-hint">
                Markdown 模式会原样保存语法，小程序正文自动按 Markdown 渲染；富文本模式继续兼容旧 HTML 内容。
              </div>
            </el-form-item>

            <el-form-item label="读一读">
              <el-input
                v-if="contentEditorMode === 'markdown'"
                v-model="editingSection.content"
                type="textarea"
                class="markdown-editor"
                placeholder="请输入 Markdown 正文，例如：# 标题 / - 列表 / **粗体**"
                :rows="16"
                show-word-limit
                maxlength="20000"
              />
              <RichTextEditor
                v-else
                v-model="editingSection.content"
                placeholder="主要课程内容（支持图片、链接、格式化）"
                height="400px"
              />
            </el-form-item>

            <!-- 想一想 -->
            <el-form-item label="想一想">
              <el-input
                v-model="editingSection.reflection"
                type="textarea"
                placeholder="反思内容"
                :rows="3"
                maxlength="500"
                show-word-limit
              />
            </el-form-item>

            <!-- 记一记 -->
            <el-form-item label="记一记">
              <el-input
                v-model="editingSection.action"
                type="textarea"
                placeholder="行动建议或笔记"
                :rows="3"
                maxlength="500"
                show-word-limit
              />
            </el-form-item>

            <!-- 学一学 -->
            <el-form-item label="学一学">
              <el-input
                v-model="editingSection.learn"
                type="textarea"
                placeholder="学习要点"
                :rows="3"
                maxlength="500"
                show-word-limit
              />
            </el-form-item>

            <!-- 摘一摘 -->
            <el-form-item label="摘一摘">
              <el-input
                v-model="editingSection.extract"
                type="textarea"
                placeholder="重点摘要"
                :rows="3"
                maxlength="500"
                show-word-limit
              />
            </el-form-item>

            <!-- 说一说 -->
            <el-form-item label="说一说">
              <el-input
                v-model="editingSection.say"
                type="textarea"
                placeholder="讨论主题"
                :rows="3"
                maxlength="500"
                show-word-limit
              />
            </el-form-item>
          </div>

          <!-- 扩展信息 -->
          <div class="form-section">
            <div class="section-title">扩展信息</div>

            <el-form-item label="时长（分钟）">
              <el-input-number v-model="editingSection.duration" :min="0" :max="600" />
            </el-form-item>

            <el-form-item label="发布状态">
              <el-switch v-model="editingSection.isPublished" />
              <span style="margin-left: 10px; color: #666">
                {{ editingSection.isPublished ? '已发布' : '草稿' }}
              </span>
            </el-form-item>
          </div>
        </el-form>

        <template #footer>
          <el-button @click="requestCloseDialog">取消</el-button>
          <el-button type="primary" :loading="saving" @click="saveSection">保存</el-button>
        </template>
      </el-dialog>
    </div>
  </AdminLayout>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue';
import { onBeforeRouteLeave } from 'vue-router';
import AdminLayout from '../components/AdminLayout.vue';
import RichTextEditor from '../components/RichTextEditor.vue';
import { periodApi } from '../services/api';
import { ElMessage, ElMessageBox } from 'element-plus';
import type { ListResponse, Period, Section } from '../types/api';

interface SectionForm {
  _id?: string;
  periodId?: string;
  day: number;
  title: string;
  subtitle: string;
  icon: string;
  meditation: string;
  question: string;
  content: string;
  reflection: string;
  action: string;
  learn: string;
  extract: string;
  say: string;
  duration: number;
  isPublished: boolean;
}

type SectionFormSource = Partial<SectionForm> & {
  _id?: string;
  periodId?: string | Period;
};

const selectedPeriodId = ref<string | null>(null);
const periods = ref<Period[]>([]);
const currentPeriod = ref<Period | null>(null);
const sections = ref<Section[]>([]);
const saving = ref(false);
const loadingSectionId = ref<string | null>(null);
const contentEditorMode = ref<'markdown' | 'richtext'>('markdown');
const sectionSnapshot = ref('');

// 编辑弹窗
const editDialogVisible = ref(false);
const isNewSection = ref(false);
const editingSection = ref<SectionForm>(createEmptySectionDraft());

onMounted(() => {
  loadPeriods();
});

// 加载期次列表
async function loadPeriods() {
  try {
    const response = (await periodApi.getPeriods({
      limit: 100
    })) as unknown as any;

    // 拦截器返回兼容格式：{list: [...], data: [...], ...pagination}
    periods.value = response?.list || response?.data || [];

    // 默认选择最新的期次
    const [firstPeriod] = periods.value;
    if (firstPeriod?._id) {
      selectedPeriodId.value = firstPeriod._id;
      await loadSections();
    }
  } catch (err: any) {
    ElMessage.error('加载期次列表失败');
  }
}

// 加载课节列表
async function loadSections() {
  if (!selectedPeriodId.value) return;

  try {
    const [period, response] = (await Promise.all([
      periodApi.getPeriodDetail(selectedPeriodId.value),
      periodApi.getAllSections(selectedPeriodId.value, { limit: 100 })
    ])) as unknown as [Period, ListResponse<Section>];

    currentPeriod.value = period;
    sections.value = response.list || response || [];
  } catch (err: any) {
    console.error('Failed to load sections:', err);
    ElMessage.error('加载课节列表失败');
    sections.value = [];
  }
}

// 新增课节
async function handleAddSection() {
  isNewSection.value = true;
  contentEditorMode.value = 'markdown';
  editingSection.value = createEmptySectionDraft({
    periodId: selectedPeriodId.value || undefined,
    day: sections.value.length,
  });
  sectionSnapshot.value = '';
  editDialogVisible.value = true;
  // 等表单组件全部挂载（el-input-number 等会规范化值）后再拍快照
  await nextTick();
  await nextTick();
  captureSectionSnapshot();
}

// 编辑课节
async function handleEditSection(section: Section) {
  if (!section._id) return;

  isNewSection.value = false;
  loadingSectionId.value = section._id;

  try {
    const detail = (await periodApi.getSectionDetail(section._id)) as unknown as Section;
    contentEditorMode.value = detectContentEditorMode(detail.content);
    editingSection.value = normalizeSectionForm(detail);
    sectionSnapshot.value = '';
    editDialogVisible.value = true;
    // 等所有表单组件挂载并完成值规范化后再拍快照，避免误判为有改动
    await nextTick();
    await nextTick();
    captureSectionSnapshot();
  } catch (err) {
    console.error('Failed to load section detail:', err);
    ElMessage.error('加载课节详情失败');
  } finally {
    loadingSectionId.value = null;
  }
}

// 保存课节
async function saveSection() {
  if (!selectedPeriodId.value) {
    ElMessage.error('请先选择期次');
    return;
  }

  if (!editingSection.value.title) {
    ElMessage.warning('请输入课程标题');
    return;
  }

  saving.value = true;
  try {
    const payload = buildSectionPayload(editingSection.value);

    if (isNewSection.value) {
      await periodApi.createSection(selectedPeriodId.value, payload);
      ElMessage.success('课节创建成功');
    } else {
      if (!editingSection.value._id) {
        throw new Error('missing section id');
      }

      await periodApi.updateSection(editingSection.value._id, payload);
      ElMessage.success('课节保存成功');
    }
    editDialogVisible.value = false;
    await loadSections();
  } catch (err) {
    console.error('Failed to save section:', err);
    ElMessage.error('保存失败');
  } finally {
    saving.value = false;
  }
}

// 发布/下架课节
async function togglePublish(section: any) {
  const newStatus = !section.isPublished;
  const action = newStatus ? '发布' : '下架';

  try {
    await ElMessageBox.confirm(`确定要${action}这个课节吗？`, '提示', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning'
    });

    await periodApi.updateSection(section._id, { isPublished: newStatus });
    ElMessage.success(`${action}成功`);
    await loadSections();
  } catch (err: any) {
    if (err.message !== 'cancel') {
      ElMessage.error(`${action}失败`);
    }
  }
}

// 删除课节
async function handleDeleteSection(section: any) {
  try {
    await ElMessageBox.confirm('确定要删除这个课节吗？此操作不可撤销。', '提示', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning'
    });

    await periodApi.deleteSection(section._id);
    ElMessage.success('删除成功');
    await loadSections();
  } catch (err: any) {
    if (err.message !== 'cancel') {
      ElMessage.error('删除失败');
    }
  }
}

// 重置表单
function resetForm() {
  contentEditorMode.value = 'markdown';
  editingSection.value = createEmptySectionDraft();
  sectionSnapshot.value = '';
}

function buildDirtySnapshot() {
  return JSON.stringify({
    ...buildSectionPayload(editingSection.value),
    contentEditorMode: contentEditorMode.value
  });
}

function captureSectionSnapshot() {
  sectionSnapshot.value = buildDirtySnapshot();
}

const isSectionDirty = computed(() => {
  // sectionSnapshot 为空时说明快照尚未就绪（等待组件挂载），不判断为脏
  return editDialogVisible.value && sectionSnapshot.value !== '' && sectionSnapshot.value !== buildDirtySnapshot();
});

async function confirmDiscardChanges() {
  if (!isSectionDirty.value) return true;

  try {
    await ElMessageBox.confirm('内容已修改但尚未保存，确定要关闭窗口吗？', '未保存内容', {
      confirmButtonText: '确定关闭',
      cancelButtonText: '继续编辑',
      type: 'warning'
    });
    return true;
  } catch {
    return false;
  }
}

async function requestCloseDialog() {
  const shouldClose = await confirmDiscardChanges();
  if (shouldClose) {
    editDialogVisible.value = false;
  }
}

async function handleDialogBeforeClose(done: () => void) {
  const shouldClose = await confirmDiscardChanges();
  if (shouldClose) {
    done();
  }
}

function createEmptySectionDraft(overrides: Partial<SectionForm> = {}): SectionForm {
  return {
    periodId: selectedPeriodId.value || undefined,
    day: 0,
    title: '',
    subtitle: '',
    icon: '📖',
    meditation: '',
    question: '',
    content: '',
    reflection: '',
    action: '',
    learn: '',
    extract: '',
    say: '',
    duration: 0,
    isPublished: false,
    ...overrides
  };
}

function normalizeSectionForm(section: SectionFormSource): SectionForm {
  const periodId =
    typeof section.periodId === 'string'
      ? section.periodId
      : section.periodId?._id || selectedPeriodId.value || undefined;

  return createEmptySectionDraft({
    _id: section._id,
    periodId,
    day: section.day,
    title: section.title,
    subtitle: section.subtitle,
    icon: section.icon,
    meditation: section.meditation,
    question: section.question,
    content: section.content,
    reflection: section.reflection,
    action: section.action,
    learn: section.learn,
    extract: section.extract,
    say: section.say,
    duration: section.duration,
    isPublished: section.isPublished
  });
}

function buildSectionPayload(section: SectionForm) {
  const normalized = normalizeSectionForm(section);

  return {
    periodId: normalized.periodId,
    day: normalized.day,
    title: normalized.title,
    subtitle: normalized.subtitle,
    icon: normalized.icon,
    meditation: normalized.meditation,
    question: normalized.question,
    content: normalized.content,
    reflection: normalized.reflection,
    action: normalized.action,
    learn: normalized.learn,
    extract: normalized.extract,
    say: normalized.say,
    duration: normalized.duration,
    isPublished: normalized.isPublished
  };
}

function detectContentEditorMode(content?: string) {
  return isLikelyHtml(content) ? 'richtext' : 'markdown';
}

function isLikelyHtml(content?: string) {
  return typeof content === 'string' && /<\/?[a-z][\s\S]*>/i.test(content);
}

onBeforeRouteLeave(async () => {
  if (!isSectionDirty.value) return true;
  return confirmDiscardChanges();
});

function handleBeforeUnload(event: BeforeUnloadEvent) {
  if (!isSectionDirty.value) return;
  event.preventDefault();
  event.returnValue = '';
}

onMounted(() => {
  window.addEventListener('beforeunload', handleBeforeUnload);
});

onBeforeUnmount(() => {
  window.removeEventListener('beforeunload', handleBeforeUnload);
});
</script>

<style scoped>
.content-management-container {
  padding: 24px;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  width: 100%;
}

.card-title {
  font-size: 16px;
  font-weight: 600;
}

.form-section {
  margin-bottom: 20px;
}

.section-title {
  font-size: 14px;
  font-weight: 600;
  color: #333;
  padding-bottom: 12px;
  border-bottom: 1px solid #ebeef5;
  margin-bottom: 16px;
}

.action-buttons {
  display: flex;
  gap: 8px;
  flex-wrap: nowrap;
  align-items: center;
}

.action-buttons :deep(.el-button) {
  flex-shrink: 0;
  white-space: nowrap;
  padding: 6px 12px;
  font-size: 12px;
}

.content-editor-mode {
  display: flex;
  gap: 8px;
}

.editor-mode-hint {
  margin-top: 8px;
  color: #667085;
  font-size: 12px;
  line-height: 1.6;
}

.markdown-editor :deep(.el-textarea__inner) {
  font-family:
    'SFMono-Regular',
    'JetBrains Mono',
    'Fira Code',
    'Menlo',
    monospace;
  line-height: 1.7;
}
</style>
