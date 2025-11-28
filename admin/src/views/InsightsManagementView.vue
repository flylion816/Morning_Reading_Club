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
              @current-change="currentPage = $event; loadInsights()"
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

          <!-- 作者 -->
          <el-table-column label="作者" width="120">
            <template #default="{ row }">
              {{ row.userId?.nickname || '未知用户' }}
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
                <el-button type="primary" size="small" @click="handleEditInsight(row)">编辑</el-button>
                <el-button
                  :type="row.isPublished ? 'warning' : 'success'"
                  size="small"
                  @click="togglePublish(row)"
                >
                  {{ row.isPublished ? '下架' : '发布' }}
                </el-button>
                <el-button type="danger" size="small" @click="handleDeleteInsight(row)">删除</el-button>
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
        <el-form :model="editingInsight" label-width="120px" style="max-height: 600px; overflow-y: auto">
          <!-- 基本信息 -->
          <div class="form-section">
            <div class="section-title">基本信息</div>

            <el-form-item label="期次">
              <el-select v-model="editingInsight.periodId" placeholder="请选择期次">
                <el-option
                  v-for="period in periods"
                  :key="period._id"
                  :label="period.name"
                  :value="period._id"
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
                placeholder="请输入内容"
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
import { ref, onMounted, computed } from 'vue'
import AdminLayout from '../components/AdminLayout.vue'
import { insightApi, periodApi } from '../services/api'
import { ElMessage, ElMessageBox } from 'element-plus'

// 数据
const selectedPeriodId = ref<string>('')
const periods = ref<any[]>([])
const insights = ref<any[]>([])
const total = ref(0)
const currentPage = ref(1)
const pageSize = ref(10)
const saving = ref(false)

// 编辑弹窗
const editDialogVisible = ref(false)
const isNewInsight = ref(false)
const tagInput = ref('')
const imagePreview = ref('')

const editingInsight = ref<any>({
  periodId: '',
  type: 'insight',
  mediaType: 'text',
  content: '',
  imageUrl: '',
  summary: '',
  tags: [],
  isPublished: false
})

onMounted(() => {
  loadPeriods()
})

// 加载期次
async function loadPeriods() {
  try {
    const response = await periodApi.getPeriods({ limit: 100 })
    periods.value = response.list || []
  } catch (err) {
    console.error('加载期次失败:', err)
    ElMessage.error('加载期次失败')
  }
}

// 加载小凡看见列表
async function loadInsights() {
  try {
    const params = {
      page: currentPage.value,
      limit: pageSize.value
    }
    if (selectedPeriodId.value) {
      ;(params as any).periodId = selectedPeriodId.value
    }

    const response = await insightApi.getInsights(params)
    // 检查响应结构，可能是 {list, pagination} 或直接是数组
    if (Array.isArray(response)) {
      insights.value = response
      total.value = response.length
    } else {
      insights.value = response.list || []
      total.value = response.pagination?.total || response.total || 0
    }
  } catch (err) {
    console.error('加载小凡看见列表失败:', err)
    ElMessage.error('加载小凡看见列表失败')
  }
}

// 新增
function handleAddInsight() {
  isNewInsight.value = true
  editingInsight.value = {
    periodId: selectedPeriodId.value || '',
    type: 'insight',
    mediaType: 'text',
    content: '',
    imageUrl: '',
    summary: '',
    tags: [],
    isPublished: false
  }
  tagInput.value = ''
  imagePreview.value = ''
  editDialogVisible.value = true
}

// 编辑
function handleEditInsight(insight: any) {
  isNewInsight.value = false
  editingInsight.value = { ...insight }
  tagInput.value = ''
  imagePreview.value = insight.imageUrl || ''
  editDialogVisible.value = true
}

// 保存
async function saveInsight() {
  // 处理标签
  if (tagInput.value) {
    const newTags = tagInput.value
      .split(',')
      .map((t) => t.trim())
      .filter((t) => t)
    editingInsight.value.tags = [...new Set([...editingInsight.value.tags, ...newTags])]
  }

  if (!editingInsight.value.content) {
    ElMessage.warning('请输入内容')
    return
  }

  saving.value = true
  try {
    if (isNewInsight.value) {
      await insightApi.createInsight(editingInsight.value)
      ElMessage.success('创建成功')
    } else {
      await insightApi.updateInsight(editingInsight.value._id, editingInsight.value)
      ElMessage.success('保存成功')
    }
    editDialogVisible.value = false
    await loadInsights()
  } catch (err) {
    ElMessage.error('保存失败')
  } finally {
    saving.value = false
  }
}

// 发布/下架
async function togglePublish(insight: any) {
  const newStatus = !insight.isPublished
  const action = newStatus ? '发布' : '下架'

  try {
    await ElMessageBox.confirm(`确定要${action}吗？`, '提示', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning'
    })

    if (newStatus) {
      await insightApi.publishInsight(insight._id)
    } else {
      await insightApi.unpublishInsight(insight._id)
    }
    ElMessage.success(`${action}成功`)
    await loadInsights()
  } catch (err: any) {
    if (err.message !== 'cancel') {
      console.error(`${action}失败:`, err)
      ElMessage.error(`${action}失败`)
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
    })

    await insightApi.deleteInsight(insight._id)
    ElMessage.success('删除成功')
    await loadInsights()
  } catch (err: any) {
    if (err.message !== 'cancel') {
      console.error('删除失败:', err)
      ElMessage.error('删除失败')
    }
  }
}

// 图片预览
function previewImage() {
  if (editingInsight.value.imageUrl) {
    imagePreview.value = editingInsight.value.imageUrl
  }
}

// 重置表单
function resetForm() {
  editingInsight.value = {
    periodId: '',
    type: 'insight',
    mediaType: 'text',
    content: '',
    imageUrl: '',
    summary: '',
    tags: [],
    isPublished: false
  }
  tagInput.value = ''
  imagePreview.value = ''
}

// 工具函数
function truncateText(text: string, length: number) {
  return text.length > length ? text.substring(0, length) + '...' : text
}

function formatDate(date: string) {
  return new Date(date).toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  })
}

function getTypeLabel(type: string) {
  const labels: { [key: string]: string } = {
    daily: '每日',
    weekly: '周报',
    monthly: '月报',
    insight: '看见'
  }
  return labels[type] || type
}

function getTypeColor(type: string) {
  const colors: { [key: string]: string } = {
    daily: 'info',
    weekly: 'warning',
    monthly: 'danger',
    insight: 'success'
  }
  return colors[type] || 'info'
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
