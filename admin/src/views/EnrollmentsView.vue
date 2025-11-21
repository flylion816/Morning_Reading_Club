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
        >
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

const dialogs = ref({
  approveVisible: false,
  rejectVisible: false,
  detailVisible: false
})

const pendingCount = computed(() => {
  return enrollments.value.filter(e => e.approvalStatus === 'pending').length
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
</style>
