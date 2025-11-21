<template>
  <AdminLayout>
    <div class="enrollments-container">
      <!-- 工具栏 -->
      <el-card style="margin-bottom: 20px">
        <div class="filter-panel">
          <el-input
            v-model="filters.search"
            placeholder="搜索姓名..."
            clearable
            style="width: 200px"
            @keyup.enter="handleSearch"
          />
          <el-select
            v-model="filters.approvalStatus"
            placeholder="审批状态"
            clearable
            style="width: 140px; margin-left: 10px"
            @change="handleSearch"
          >
            <el-option label="待审批" value="pending" />
            <el-option label="已批准" value="approved" />
            <el-option label="已拒绝" value="rejected" />
          </el-select>
          <el-select
            v-model="filters.paymentStatus"
            placeholder="支付状态"
            clearable
            style="width: 140px; margin-left: 10px"
            @change="handleSearch"
          >
            <el-option label="待支付" value="pending" />
            <el-option label="已支付" value="paid" />
            <el-option label="已退款" value="refunded" />
          </el-select>
          <el-button type="primary" @click="handleSearch" style="margin-left: 10px">
            搜索
          </el-button>
        </div>

        <!-- 批量操作工具栏 -->
        <div v-if="selectedEnrollments.length > 0" class="batch-operation-bar">
          <span class="selected-count">已选中 {{ selectedEnrollments.length }} 条记录</span>
          <div class="batch-actions">
            <el-button
              type="success"
              size="small"
              @click="batchApprove"
              :disabled="!hasSelectedPending"
            >
              ✅ 批量批准
            </el-button>
            <el-button
              type="warning"
              size="small"
              @click="batchReject"
              :disabled="!hasSelectedPending"
            >
              ❌ 批量拒绝
            </el-button>
            <el-button
              type="danger"
              size="small"
              @click="batchDelete"
            >
              🗑️ 批量删除
            </el-button>
            <el-button
              type="info"
              text
              size="small"
              @click="clearSelection"
            >
              清除选择
            </el-button>
          </div>
        </div>
      </el-card>

      <!-- 报名列表 -->
      <el-card>
        <template #header>
          <div class="card-header">
            <span style="font-weight: 600">报名管理</span>
            <div>
              <el-tag>总数: {{ pagination.total }}</el-tag>
              <el-tag type="warning" style="margin-left: 10px">待审批: {{ pendingCount }}</el-tag>
            </div>
          </div>
        </template>

        <el-table
          :data="enrollments"
          stripe
          style="width: 100%"
          v-loading="loading"
          @selection-change="handleSelectionChange"
          ref="tableRef"
        >
          <el-table-column type="selection" width="50" />
          <el-table-column prop="name" label="姓名" width="100" />
          <el-table-column prop="province" label="省份" width="100" />
          <el-table-column prop="age" label="年龄" width="80" />
          <el-table-column label="期次" width="120">
            <template #default="{ row }">
              {{ row.periodId?.name || '未知' }}
            </template>
          </el-table-column>
          <el-table-column label="审批状态" width="100">
            <template #default="{ row }">
              <el-tag :type="getApprovalType(row.approvalStatus)">
                {{ formatApprovalStatus(row.approvalStatus) }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column label="支付状态" width="100">
            <template #default="{ row }">
              <el-tag :type="getPaymentType(row.paymentStatus)">
                {{ formatPaymentStatus(row.paymentStatus) }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column label="报名时间" width="180">
            <template #default="{ row }">
              {{ formatDate(row.enrolledAt) }}
            </template>
          </el-table-column>
          <el-table-column label="操作" width="280" fixed="right">
            <template #default="{ row }">
              <el-button
                v-if="row.approvalStatus === 'pending'"
                type="success"
                text
                size="small"
                @click="showApproveDialog(row)"
              >
                批准
              </el-button>
              <el-button
                v-if="row.approvalStatus === 'pending'"
                type="danger"
                text
                size="small"
                @click="showRejectDialog(row)"
              >
                拒绝
              </el-button>
              <el-button
                type="primary"
                text
                size="small"
                @click="showDetailDialog(row)"
              >
                详情
              </el-button>
              <el-button
                type="danger"
                text
                size="small"
                @click="handleDelete(row)"
              >
                删除
              </el-button>
            </template>
          </el-table-column>
        </el-table>

        <!-- 分页 -->
        <div style="margin-top: 20px; text-align: right">
          <el-pagination
            v-model:current-page="pagination.page"
            v-model:page-size="pagination.limit"
            :page-sizes="[10, 20, 50, 100]"
            :total="pagination.total"
            layout="total, sizes, prev, pager, next, jumper"
            @change="loadEnrollments"
          />
        </div>
      </el-card>

      <!-- 批准对话框 -->
      <el-dialog
        v-model="dialogs.approveVisible"
        title="批准报名"
        width="500px"
        @close="resetForm"
      >
        <el-form v-if="currentEnrollment">
          <el-form-item label="报名人">
            <el-text>{{ currentEnrollment?.name }}</el-text>
          </el-form-item>
          <el-form-item label="期次">
            <el-text>{{ currentEnrollment?.periodId?.name }}</el-text>
          </el-form-item>
          <el-form-item label="备注">
            <el-input
              v-model="currentForm.notes"
              type="textarea"
              rows="3"
              placeholder="输入审批备注（可选）"
            />
          </el-form-item>
        </el-form>
        <template #footer>
          <el-button @click="dialogs.approveVisible = false">取消</el-button>
          <el-button type="primary" @click="handleApprove" :loading="approveLoading">
            确认批准
          </el-button>
        </template>
      </el-dialog>

      <!-- 拒绝对话框 -->
      <el-dialog
        v-model="dialogs.rejectVisible"
        title="拒绝报名"
        width="500px"
        @close="resetForm"
      >
        <el-form v-if="currentEnrollment">
          <el-form-item label="报名人">
            <el-text>{{ currentEnrollment?.name }}</el-text>
          </el-form-item>
          <el-form-item label="期次">
            <el-text>{{ currentEnrollment?.periodId?.name }}</el-text>
          </el-form-item>
          <el-form-item label="拒绝原因">
            <el-input
              v-model="currentForm.notes"
              type="textarea"
              rows="3"
              placeholder="输入拒绝原因"
            />
          </el-form-item>
        </el-form>
        <template #footer>
          <el-button @click="dialogs.rejectVisible = false">取消</el-button>
          <el-button type="danger" @click="handleReject" :loading="rejectLoading">
            确认拒绝
          </el-button>
        </template>
      </el-dialog>

      <!-- 详情对话框 -->
      <el-dialog
        v-model="dialogs.detailVisible"
        title="报名详情"
        width="600px"
        @close="resetForm"
      >
        <el-form v-if="currentEnrollment" label-width="100px">
          <el-form-item label="姓名">
            <el-text>{{ currentEnrollment.name }}</el-text>
          </el-form-item>
          <el-form-item label="性别">
            <el-text>{{ formatGender(currentEnrollment.gender) }}</el-text>
          </el-form-item>
          <el-form-item label="年龄">
            <el-text>{{ currentEnrollment.age }}</el-text>
          </el-form-item>
          <el-form-item label="省份">
            <el-text>{{ currentEnrollment.province }}</el-text>
          </el-form-item>
          <el-form-item label="详细地址">
            <el-text>{{ currentEnrollment.detailedAddress }}</el-text>
          </el-form-item>
          <el-form-item label="推荐人">
            <el-text>{{ currentEnrollment.referrer || '-' }}</el-text>
          </el-form-item>
          <el-form-item label="参加缘起">
            <el-text>{{ currentEnrollment.enrollReason }}</el-text>
          </el-form-item>
          <el-form-item label="期待">
            <el-text>{{ currentEnrollment.expectation }}</el-text>
          </el-form-item>
        </el-form>
      </el-dialog>
    </div>
  </AdminLayout>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import AdminLayout from '../components/AdminLayout.vue'
import { enrollmentApi } from '../services/api'
import { ElMessage, ElMessageBox } from 'element-plus'

const loading = ref(false)
const approveLoading = ref(false)
const rejectLoading = ref(false)

const filters = ref({
  search: '',
  approvalStatus: '',
  paymentStatus: ''
})

const pagination = ref({
  page: 1,
  limit: 20,
  total: 0
})

const enrollments = ref<any[]>([])
const currentEnrollment = ref<any>(null)
const currentForm = ref({
  notes: ''
})
const selectedEnrollments = ref<any[]>([])
const tableRef = ref()

const dialogs = ref({
  approveVisible: false,
  rejectVisible: false,
  detailVisible: false
})

const pendingCount = computed(() => {
  return enrollments.value.filter(e => e.approvalStatus === 'pending').length
})

const hasSelectedPending = computed(() => {
  return selectedEnrollments.value.some(e => e.approvalStatus === 'pending')
})

onMounted(() => {
  loadEnrollments()
})

async function loadEnrollments() {
  loading.value = true
  try {
    const params = {
      page: pagination.value.page,
      limit: pagination.value.limit,
      approvalStatus: filters.value.approvalStatus,
      paymentStatus: filters.value.paymentStatus
    }

    const response = await enrollmentApi.getEnrollments(params)
    enrollments.value = response.list || []
    pagination.value.total = response.total || 0
  } catch (err) {
    ElMessage.error('加载报名列表失败')
    console.error(err)
  } finally {
    loading.value = false
  }
}

function handleSearch() {
  pagination.value.page = 1
  loadEnrollments()
}

function showApproveDialog(enrollment: any) {
  currentEnrollment.value = enrollment
  currentForm.value.notes = ''
  dialogs.value.approveVisible = true
}

function showRejectDialog(enrollment: any) {
  currentEnrollment.value = enrollment
  currentForm.value.notes = ''
  dialogs.value.rejectVisible = true
}

function showDetailDialog(enrollment: any) {
  currentEnrollment.value = enrollment
  dialogs.value.detailVisible = true
}

async function handleApprove() {
  if (!currentEnrollment.value) return

  approveLoading.value = true
  try {
    await enrollmentApi.approveEnrollment(currentEnrollment.value._id, {
      notes: currentForm.value.notes
    })
    ElMessage.success('批准成功')
    dialogs.value.approveVisible = false
    loadEnrollments()
  } catch (err) {
    ElMessage.error('批准失败')
    console.error(err)
  } finally {
    approveLoading.value = false
  }
}

async function handleReject() {
  if (!currentEnrollment.value) return
  if (!currentForm.value.notes) {
    ElMessage.error('请输入拒绝原因')
    return
  }

  rejectLoading.value = true
  try {
    await enrollmentApi.rejectEnrollment(currentEnrollment.value._id, {
      notes: currentForm.value.notes
    })
    ElMessage.success('拒绝成功')
    dialogs.value.rejectVisible = false
    loadEnrollments()
  } catch (err) {
    ElMessage.error('拒绝失败')
    console.error(err)
  } finally {
    rejectLoading.value = false
  }
}

async function handleDelete(enrollment: any) {
  try {
    await ElMessageBox.confirm(
      `确定要删除 ${enrollment.name} 的报名记录吗？`,
      '警告',
      {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning'
      }
    )

    await enrollmentApi.updateEnrollment(enrollment._id, { deleted: true })
    ElMessage.success('删除成功')
    loadEnrollments()
  } catch (err) {
    if (err !== 'cancel') {
      ElMessage.error('删除失败')
    }
  }
}

// 批量操作函数
function handleSelectionChange(selection: any[]) {
  selectedEnrollments.value = selection
}

function clearSelection() {
  selectedEnrollments.value = []
  tableRef.value?.clearSelection()
}

async function batchApprove() {
  if (selectedEnrollments.value.length === 0) {
    ElMessage.warning('请先选择要批准的报名')
    return
  }

  try {
    await ElMessageBox.confirm(
      `确定要批准选中的 ${selectedEnrollments.value.length} 条报名吗？`,
      '批量批准',
      {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning'
      }
    )

    loading.value = true
    const ids = selectedEnrollments.value.map((e: any) => e._id)

    // 并行发送所有请求
    const promises = ids.map((id: string) =>
      enrollmentApi.updateEnrollment(id, { approvalStatus: 'approved' })
    )
    await Promise.all(promises)

    ElMessage.success(`成功批准 ${ids.length} 条报名`)
    clearSelection()
    loadEnrollments()
  } catch (err) {
    if (err !== 'cancel') {
      ElMessage.error('批量批准失败')
    }
  } finally {
    loading.value = false
  }
}

async function batchReject() {
  if (selectedEnrollments.value.length === 0) {
    ElMessage.warning('请先选择要拒绝的报名')
    return
  }

  try {
    await ElMessageBox.confirm(
      `确定要拒绝选中的 ${selectedEnrollments.value.length} 条报名吗？`,
      '批量拒绝',
      {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning'
      }
    )

    loading.value = true
    const ids = selectedEnrollments.value.map((e: any) => e._id)

    // 并行发送所有请求
    const promises = ids.map((id: string) =>
      enrollmentApi.updateEnrollment(id, { approvalStatus: 'rejected' })
    )
    await Promise.all(promises)

    ElMessage.success(`成功拒绝 ${ids.length} 条报名`)
    clearSelection()
    loadEnrollments()
  } catch (err) {
    if (err !== 'cancel') {
      ElMessage.error('批量拒绝失败')
    }
  } finally {
    loading.value = false
  }
}

async function batchDelete() {
  if (selectedEnrollments.value.length === 0) {
    ElMessage.warning('请先选择要删除的报名')
    return
  }

  try {
    await ElMessageBox.confirm(
      `确定要删除选中的 ${selectedEnrollments.value.length} 条报名吗？此操作不可撤销`,
      '批量删除',
      {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'error'
      }
    )

    loading.value = true
    const ids = selectedEnrollments.value.map((e: any) => e._id)

    // 并行发送所有请求
    const promises = ids.map((id: string) =>
      enrollmentApi.updateEnrollment(id, { deleted: true })
    )
    await Promise.all(promises)

    ElMessage.success(`成功删除 ${ids.length} 条报名`)
    clearSelection()
    loadEnrollments()
  } catch (err) {
    if (err !== 'cancel') {
      ElMessage.error('批量删除失败')
    }
  } finally {
    loading.value = false
  }
}

function resetForm() {
  currentEnrollment.value = null
  currentForm.value = { notes: '' }
}

function formatApprovalStatus(status: string): string {
  const statusMap: Record<string, string> = {
    pending: '待审批',
    approved: '已批准',
    rejected: '已拒绝'
  }
  return statusMap[status] || status
}

function getApprovalType(status: string): string {
  const typeMap: Record<string, string> = {
    pending: 'warning',
    approved: 'success',
    rejected: 'danger'
  }
  return typeMap[status] || 'info'
}

function formatPaymentStatus(status: string): string {
  const statusMap: Record<string, string> = {
    pending: '待支付',
    paid: '已支付',
    refunded: '已退款',
    free: '免费'
  }
  return statusMap[status] || status
}

function getPaymentType(status: string): string {
  const typeMap: Record<string, string> = {
    pending: 'warning',
    paid: 'success',
    refunded: 'info',
    free: 'success'
  }
  return typeMap[status] || 'info'
}

function formatDate(dateString: string): string {
  if (!dateString) return '-'
  const date = new Date(dateString)
  return date.toLocaleDateString('zh-CN') + ' ' + date.toLocaleTimeString('zh-CN').slice(0, 5)
}

function formatGender(gender: string): string {
  const genderMap: Record<string, string> = {
    male: '男',
    female: '女',
    prefer_not_to_say: '保密'
  }
  return genderMap[gender] || gender
}
</script>

<style scoped>
.enrollments-container {
  padding: 24px;
}

.filter-panel {
  display: flex;
  gap: 10px;
  align-items: center;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  width: 100%;
}

.batch-operation-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 16px;
  padding: 12px 16px;
  background: linear-gradient(135deg, #f5f7fa 0%, #ffffff 100%);
  border: 1px solid #dcdfe6;
  border-radius: 4px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.04);
  animation: slideDown 0.3s ease-out;
}

.selected-count {
  font-weight: 600;
  color: #303133;
  font-size: 14px;
  display: flex;
  align-items: center;
}

.batch-actions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  justify-content: flex-end;
}

.batch-actions :deep(.el-button) {
  padding: 8px 16px;
  font-size: 14px;
}

@keyframes slideDown {
  from {
    opacity: 0;
    transform: translateY(-10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@media (max-width: 768px) {
  .batch-operation-bar {
    flex-direction: column;
    gap: 12px;
    align-items: flex-start;
  }

  .batch-actions {
    width: 100%;
    justify-content: flex-start;
  }
}
</style>
