<template>
  <AdminLayout>
    <div class="insights-management-container">
      <!-- 页次选择 -->
      <el-card style="margin-bottom: 20px">
        <template #header>
          <div class="card-header">
            <span class="card-title">小凡看见管理</span>
            <div class="controls">
              <el-select
                v-model="selectedPeriodId"
                placeholder="选择期次"
                style="width: 200px; margin-right: 10px"
                @change="loadInsights"
              >
                <el-option label="全部期次" value="" />
                <el-option
                  v-for="period in periods"
                  :key="period._id"
                  :label="period.name"
                  :value="period._id"
                />
              </el-select>
              <el-button type="primary" @click="handleAddInsight">+ 新增小凡看见</el-button>
            </div>
          </div>
        </template>
      </el-card>

      <!-- 小凡看见列表 -->
      <el-card>
        <template #header>
          <div class="card-header">
            <span>小凡看见列表 (共 {{ total }} 条)</span>
            <el-pagination
              :current-page="currentPage"
              :page-size="pageSize"
              :total="total"
              @current-change="
                currentPage = $event;
                loadInsights();
              "
              style="margin-left: auto"
            />
          </div>
        </template>

        <el-table :data="insights" stripe style="width: 100%">
          <!-- 内容类型 -->
          <el-table-column label="类型" width="80">
            <template #default="{ row }">
              <el-tag :type="getTypeColor(row.type)">
                {{ getTypeLabel(row.type) }}
              </el-tag>
            </template>
          </el-table-column>

          <!-- 媒体类型 -->
          <el-table-column label="媒体" width="80">
            <template #default="{ row }">
              <el-tag :type="row.mediaType === 'image' ? 'warning' : 'info'">
                {{ row.mediaType === 'image' ? '📷 图片' : '📝 文本' }}
              </el-tag>
            </template>
          </el-table-column>

          <!-- 内容预览 -->
          <el-table-column label="内容" min-width="250">
            <template #default="{ row }">
              <div class="content-preview">
                <div v-if="row.mediaType === 'image' && row.imageUrl" class="image-preview">
                  <img :src="row.imageUrl" :alt="row.content" />
                </div>
                <div v-else class="text-preview">
                  {{ truncateText(row.content, 50) }}
                </div>
              </div>
            </template>
          </el-table-column>

          <!-- 期次 -->
          <el-table-column label="期次" width="150">
            <template #default="{ row }">
              {{ row.periodId?.name || '-' }}
            </template>
          </el-table-column>

          <!-- 被看见人 -->
          <el-table-column label="被看见人" width="120">
            <template #default="{ row }">
              {{
                typeof row.targetUserId === 'object'
                  ? row.targetUserId?.nickname || '未指定'
                  : '未指定'
              }}
            </template>
          </el-table-column>

          <!-- 发布状态 -->
          <el-table-column label="发布状态" width="100">
            <template #default="{ row }">
              <el-tag :type="row.isPublished ? 'success' : 'info'">
                {{ row.isPublished ? '已发布' : '草稿' }}
              </el-tag>
            </template>
          </el-table-column>

          <!-- 创建时间 -->
          <el-table-column label="创建时间" width="160">
            <template #default="{ row }">
              {{ formatDate(row.createdAt) }}
            </template>
          </el-table-column>

          <!-- 操作 -->
          <el-table-column label="操作" width="220" fixed="right">
            <template #default="{ row }">
              <div class="action-buttons">
                <el-button type="primary" size="small" @click="handleEditInsight(row)"
                  >编辑</el-button
                >
                <el-button
                  :type="row.isPublished ? 'warning' : 'success'"
                  size="small"
                  @click="togglePublish(row)"
                >
                  {{ row.isPublished ? '下架' : '发布' }}
                </el-button>
                <el-button type="danger" size="small" @click="handleDeleteInsight(row)"
                  >删除</el-button
                >
              </div>
            </template>
          </el-table-column>
        </el-table>
      </el-card>

      <!-- 编辑小凡看见弹窗 -->
      <el-dialog
        v-model="editDialogVisible"
        :title="isNewInsight ? '新增小凡看见' : '编辑小凡看见'"
        width="900px"
        @close="resetForm"
      >
        <el-form
          :model="editingInsight"
          label-width="120px"
          style="max-height: 600px; overflow-y: auto"
        >
          <!-- 基本信息 -->
          <div class="form-section">
            <div class="section-title">基本信息</div>

            <el-form-item label="期次">
              <el-select v-model="editingInsight.periodId" placeholder="请选择期次" @change="handlePeriodChange">
                <el-option
                  v-for="period in periods"
                  :key="period._id"
                  :label="period.name"
                  :value="period._id"
                />
              </el-select>
            </el-form-item>

            <el-form-item label="课程">
              <el-select
                v-model="editingInsight.sectionId"
                placeholder="选择课程（可选）"
                clearable
                :loading="loadingSections"
                :disabled="!editingInsight.periodId"
                @change="handleSectionChange"
              >
                <el-option
                  v-for="section in sectionOptions"
                  :key="section._id"
                  :label="`第${section.day}天 - ${section.title}`"
                  :value="section._id"
                />
              </el-select>
            </el-form-item>

            <el-form-item label="被看见人">
              <el-select
                v-model="editingInsight.targetUserId"
                placeholder="选择被看见人（可选）"
                clearable
                filterable
                :remote="true"
                :remote-method="searchUsers"
                :loading="loadingUsers"
              >
                <el-option
                  v-for="user in userOptions"
                  :key="user._id"
                  :label="`${user.nickname}${user.email ? ' (' + user.email + ')' : ''}`"
                  :value="user._id"
                />
              </el-select>
            </el-form-item>

            <el-form-item label="内容类型">
              <el-select v-model="editingInsight.type" placeholder="请选择类型">
                <el-option label="每日洞察" value="daily" />
                <el-option label="周报" value="weekly" />
                <el-option label="月报" value="monthly" />
                <el-option label="小凡看见" value="insight" />
              </el-select>
            </el-form-item>

            <el-form-item label="媒体类型">
              <el-select v-model="editingInsight.mediaType" placeholder="请选择媒体类型">
                <el-option label="文本" value="text" />
                <el-option label="图片" value="image" />
              </el-select>
            </el-form-item>
          </div>

          <!-- 内容区域 -->
          <div class="form-section">
            <div class="section-title">内容</div>

            <el-form-item label="内容">
              <el-input
                v-model="editingInsight.content"
                type="textarea"
                placeholder="请输入内容，支持 Markdown"
                :rows="5"
                show-word-limit
                maxlength="2000"
              />
            </el-form-item>

            <el-form-item v-if="editingInsight.mediaType === 'image'" label="图片链接">
              <el-input
                v-model="editingInsight.imageUrl"
                placeholder="请输入图片URL"
                @input="previewImage"
              />
              <div v-if="imagePreview" class="image-preview-box">
                <img :src="imagePreview" alt="图片预览" />
              </div>
            </el-form-item>
          </div>

          <!-- 元数据 -->
          <div class="form-section">
            <div class="section-title">元数据</div>

            <el-form-item label="标签">
              <el-input v-model="tagInput" placeholder="请输入标签，多个标签用逗号分隔" />
              <div class="tags">
                <el-tag
                  v-for="(tag, index) in editingInsight.tags"
                  :key="index"
                  closable
                  @close="editingInsight.tags.splice(index, 1)"
                >
                  {{ tag }}
                </el-tag>
              </div>
            </el-form-item>

            <el-form-item label="摘要">
              <el-input
                v-model="editingInsight.summary"
                type="textarea"
                placeholder="可选：简短摘要"
                :rows="2"
                maxlength="500"
                show-word-limit
              />
            </el-form-item>
          </div>

          <!-- 发布设置 -->
          <div class="form-section">
            <div class="section-title">发布设置</div>

            <el-form-item label="发布状态">
              <el-switch v-model="editingInsight.isPublished" />
              <span style="margin-left: 10px; color: #666">
                {{ editingInsight.isPublished ? '已发布' : '草稿' }}
              </span>
            </el-form-item>
          </div>
        </el-form>

        <template #footer>
          <el-button @click="editDialogVisible = false">取消</el-button>
          <el-button type="primary" @click="saveInsight" :loading="saving">保存</el-button>
        </template>
      </el-dialog>
    </div>
  </AdminLayout>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import AdminLayout from '../components/AdminLayout.vue';
import { insightApi, periodApi, userApi } from '../services/api';
import { ElMessage, ElMessageBox } from 'element-plus';
import type { ListResponse, Period, Insight, User } from '../types/api';

// 数据
const selectedPeriodId = ref<string>('');
const periods = ref<Period[]>([]);
const insights = ref<Insight[]>([]);
const total = ref(0);
const currentPage = ref(1);
const pageSize = ref(10);
const saving = ref(false);

// 编辑弹窗
const editDialogVisible = ref(false);
const isNewInsight = ref(false);
const tagInput = ref('');
const imagePreview = ref('');

// 用户选择相关
const userOptions = ref<User[]>([]);
const loadingUsers = ref(false);

// 课程选择相关
const sectionOptions = ref<any[]>([]);
const loadingSections = ref(false);

const editingInsight = ref<Partial<Insight>>({
  periodId: '',
  sectionId: '',
  title: '',
  periodName: '',
  targetUserId: '',
  type: 'insight' as any,
  mediaType: 'text' as any,
  content: '',
  imageUrl: '',
  summary: '',
  tags: [],
  isPublished: false
});

onMounted(() => {
  loadPeriods();
  loadInsights(); // 默认加载所有期次的数据
});

// 加载期次
async function loadPeriods() {
  try {
    const response = (await periodApi.getPeriods({
      limit: 100
    })) as unknown as ListResponse<Period>;
    periods.value = response.list || [];
  } catch (err) {
    console.error('加载期次失败:', err);
    ElMessage.error('加载期次失败');
  }
}

// 加载课程列表（根据期次ID）
async function loadSections(periodId: string) {
  if (!periodId) {
    sectionOptions.value = [];
    return;
  }
  loadingSections.value = true;
  try {
    const response = await periodApi.getAllSections(periodId, { limit: 100 });
    // 响应可能是数组或 { list: [...] }
    if (Array.isArray(response)) {
      sectionOptions.value = response;
    } else if (response && Array.isArray(response.list)) {
      sectionOptions.value = response.list;
    } else {
      sectionOptions.value = response || [];
    }
  } catch (err) {
    console.error('加载课程列表失败:', err);
    sectionOptions.value = [];
  } finally {
    loadingSections.value = false;
  }
}

// 期次变更时：加载该期次的课程列表，并自动填充期次名称
function handlePeriodChange(periodId: string) {
  // 清空已选课程
  editingInsight.value.sectionId = '';
  editingInsight.value.title = '';
  // 自动填充期次名称
  const period = periods.value.find((p: any) => p._id === periodId);
  editingInsight.value.periodName = period?.name || '';
  // 加载课程列表
  loadSections(periodId);
}

// 课程变更时：自动填充 title 和 day
function handleSectionChange(sectionId: string) {
  if (!sectionId) {
    editingInsight.value.title = '';
    return;
  }
  const section = sectionOptions.value.find((s: any) => s._id === sectionId);
  if (section) {
    editingInsight.value.title = section.title || '';
  }
}

// 加载小凡看见列表
async function loadInsights() {
  try {
    const params = {
      page: currentPage.value,
      limit: pageSize.value
    };
    if (selectedPeriodId.value) {
      (params as any).periodId = selectedPeriodId.value;
    }

    const response = (await insightApi.getInsights(params)) as unknown as ListResponse<Insight>;
    // 检查响应结构，可能是 {list, pagination} 或直接是数组
    if (Array.isArray(response)) {
      insights.value = response;
      total.value = response.length;
    } else {
      insights.value = response.list || [];
      total.value = response.pagination?.total || response.total || 0;
    }
  } catch (err) {
    console.error('加载小凡看见列表失败:', err);
    ElMessage.error('加载小凡看见列表失败');
  }
}

// 新增
function handleAddInsight() {
  isNewInsight.value = true;
  editingInsight.value = {
    periodId: selectedPeriodId.value || '',
    sectionId: '',
    title: '',
    periodName: '',
    targetUserId: '',
    type: 'insight',
    mediaType: 'text',
    content: '',
    imageUrl: '',
    summary: '',
    tags: [],
    isPublished: false
  };
  sectionOptions.value = [];
  tagInput.value = '';
  imagePreview.value = '';
  // 如果已选期次，自动加载该期次的课程列表
  if (selectedPeriodId.value) {
    loadSections(selectedPeriodId.value);
  }
  editDialogVisible.value = true;
}

// 编辑
function handleEditInsight(insight: any) {
  isNewInsight.value = false;
  // ✅ 修复：提取 ID 字符串而不是整个对象
  const periodIdStr = typeof insight.periodId === 'object' ? insight.periodId?._id : insight.periodId;
  editingInsight.value = {
    ...insight,
    // 确保 targetUserId、periodId、sectionId 都是字符串 ID
    targetUserId:
      typeof insight.targetUserId === 'object' ? insight.targetUserId?._id : insight.targetUserId,
    periodId: periodIdStr,
    sectionId: typeof insight.sectionId === 'object' ? insight.sectionId?._id : insight.sectionId || '',
    title: insight.title || (typeof insight.sectionId === 'object' ? insight.sectionId?.title : '') || '',
    periodName: insight.periodName || (typeof insight.periodId === 'object' ? insight.periodId?.name : '') || ''
  };
  tagInput.value = '';
  imagePreview.value = insight.imageUrl || '';
  // 加载该期次的课程列表
  if (periodIdStr) {
    loadSections(periodIdStr);
  }

  // ✅ 修复：如果有 targetUserId（已 populate 的对象），添加到 userOptions 中以便显示
  if (insight.targetUserId && typeof insight.targetUserId === 'object') {
    // 检查 userOptions 中是否已存在该用户，避免重复
    const userExists = userOptions.value.some(u => u._id === insight.targetUserId._id);
    if (!userExists) {
      userOptions.value.unshift(insight.targetUserId);
    }
  }

  editDialogVisible.value = true;
}

// 保存
async function saveInsight() {
  // 验证必填字段
  if (!editingInsight.value.periodId) {
    ElMessage.warning('请选择期次');
    return;
  }
  if (!editingInsight.value.type) {
    ElMessage.warning('请选择内容类型');
    return;
  }
  if (!editingInsight.value.mediaType) {
    ElMessage.warning('请选择媒体类型');
    return;
  }
  if (!editingInsight.value.content && !editingInsight.value.imageUrl) {
    ElMessage.warning('请输入内容或填写图片链接');
    return;
  }

  // 处理标签
  if (tagInput.value) {
    const newTags = tagInput.value
      .split(',')
      .map(t => t.trim())
      .filter(t => t);
    editingInsight.value.tags = [...new Set([...editingInsight.value.tags, ...newTags])];
  }

  // ✅ 修复：确保 targetUserId 是字符串 ID，不是对象
  // 这是为了处理 el-select 可能返回的对象情况
  if (editingInsight.value.targetUserId && typeof editingInsight.value.targetUserId === 'object') {
    editingInsight.value.targetUserId = editingInsight.value.targetUserId._id;
  }

  console.log('[InsightForm] 保存前的数据:', {
    periodId: editingInsight.value.periodId,
    targetUserId: editingInsight.value.targetUserId,
    type: editingInsight.value.type,
    mediaType: editingInsight.value.mediaType,
    content: editingInsight.value.content ? '有内容' : '无内容'
  });

  saving.value = true;
  try {
    if (isNewInsight.value) {
      await insightApi.createInsight(editingInsight.value);
      ElMessage.success('创建成功');
    } else {
      await insightApi.updateInsight(editingInsight.value._id, editingInsight.value);
      ElMessage.success('保存成功');
    }
    editDialogVisible.value = false;
    await loadInsights();
  } catch (err: any) {
    console.error('[InsightForm] 保存失败，错误信息:', err);
    ElMessage.error(err.message || '保存失败');
  } finally {
    saving.value = false;
  }
}

// 发布/下架
async function togglePublish(insight: any) {
  const newStatus = !insight.isPublished;
  const action = newStatus ? '发布' : '下架';

  try {
    await ElMessageBox.confirm(`确定要${action}吗？`, '提示', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning'
    });

    if (newStatus) {
      await insightApi.publishInsight(insight._id);
    } else {
      await insightApi.unpublishInsight(insight._id);
    }
    ElMessage.success(`${action}成功`);
    await loadInsights();
  } catch (err: any) {
    if (err.message !== 'cancel') {
      console.error(`${action}失败:`, err);
      ElMessage.error(`${action}失败`);
    }
  }
}

// 删除
async function handleDeleteInsight(insight: any) {
  try {
    await ElMessageBox.confirm('确定要删除吗？此操作不可撤销。', '提示', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning'
    });

    await insightApi.deleteInsight(insight._id);
    ElMessage.success('删除成功');
    await loadInsights();
  } catch (err: any) {
    if (err.message !== 'cancel') {
      console.error('删除失败:', err);
      ElMessage.error('删除失败');
    }
  }
}

// 图片预览
function previewImage() {
  if (editingInsight.value.imageUrl) {
    imagePreview.value = editingInsight.value.imageUrl;
  }
}

// 搜索用户
async function searchUsers(keyword: string) {
  if (!keyword) {
    userOptions.value = [];
    return;
  }

  loadingUsers.value = true;
  try {
    const response = (await userApi.getUsers({
      search: keyword,
      limit: 20
    })) as unknown as ListResponse<User>;
    // 过滤掉 nickname 为空的用户（email可能为空）
    userOptions.value = (response.list || []).filter(user => user.nickname);
  } catch (err) {
    console.error('搜索用户失败:', err);
    userOptions.value = [];
  } finally {
    loadingUsers.value = false;
  }
}

// 重置表单
function resetForm() {
  editingInsight.value = {
    periodId: '',
    targetUserId: '',
    type: 'insight',
    mediaType: 'text',
    content: '',
    imageUrl: '',
    summary: '',
    tags: [],
    isPublished: false
  };
  tagInput.value = '';
  imagePreview.value = '';
}

// 工具函数
function stripHtmlTags(text: string): string {
  // 移除HTML标签，保留纯文本内容
  return text.replace(/<[^>]+>/g, '').trim();
}

function stripMarkdownSyntax(text: string): string {
  return text
    .replace(/!\[([^\]]*)\]\((https?:\/\/[^\s)]+)\)/g, '$1')
    .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '$1')
    .replace(/`([^`\n]+)`/g, '$1')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/__([^_]+)__/g, '$1')
    .replace(/(^|[^*])\*([^*\n]+)\*(?=[^*]|$)/g, '$1$2')
    .replace(/(^|[^_])_([^_\n]+)_(?=[^_]|$)/g, '$1$2')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/^>\s+/gm, '')
    .replace(/^[-*+]\s+/gm, '')
    .replace(/^\d+\.\s+/gm, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function truncateText(text: string, length: number) {
  // 先移除 HTML 和 Markdown 标记，再截断
  const plainText = stripMarkdownSyntax(stripHtmlTags(text)).replace(/\s+/g, ' ').trim();
  return plainText.length > length ? plainText.substring(0, length) + '...' : plainText;
}

function formatDate(date: string) {
  return new Date(date).toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  });
}

function getTypeLabel(type: string) {
  const labels: { [key: string]: string } = {
    daily: '每日',
    weekly: '周报',
    monthly: '月报',
    insight: '看见'
  };
  return labels[type] || type;
}

function getTypeColor(type: string) {
  const colors: { [key: string]: string } = {
    daily: 'info',
    weekly: 'warning',
    monthly: 'danger',
    insight: 'success'
  };
  return colors[type] || 'info';
}
</script>

<style scoped>
.insights-management-container {
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

.controls {
  display: flex;
  gap: 10px;
  align-items: center;
}

.content-preview {
  display: flex;
  align-items: center;
  gap: 10px;
}

.image-preview {
  width: 80px;
  height: 60px;
  border-radius: 4px;
  overflow: hidden;
  background: #f0f0f0;
}

.image-preview img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.text-preview {
  color: #666;
  font-size: 14px;
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

.image-preview-box {
  margin-top: 10px;
  padding: 10px;
  background: #f5f5f5;
  border-radius: 4px;
  max-width: 300px;
}

.image-preview-box img {
  width: 100%;
  border-radius: 4px;
}

.tags {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 10px;
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
</style>
