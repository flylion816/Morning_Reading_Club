<template>
  <AdminLayout>
    <div class="enrollments-container">
      <!-- 筛选面板 -->
      <el-card style="margin-bottom: 20px">
        <template #header>
          <span class="card-title">报名管理</span>
        </template>

        <div class="filter-panel">
          <el-input
            v-model="filters.search"
            placeholder="搜索姓名或邮箱..."
            clearable
            style="width: 200px"
            @input="handleSearch"
          >
            <template #prefix>
              <el-icon><Search /></el-icon>
            </template>
          </el-input>

          <el-select
            v-model="filters.status"
            placeholder="筛选状态"
            clearable
            style="width: 150px; margin-left: 16px"
            @change="loadEnrollments"
          >
            <el-option label="待审批" value="pending" />
            <el-option label="已批准" value="approved" />
            <el-option label="已拒绝" value="rejected" />
          </el-select>

          <el-select
            v-model="filters.period"
            placeholder="筛选期次"
            clearable
            style="width: 150px; margin-left: 16px"
            @change="loadEnrollments"
          >
            <el-option
              v-for="period in periods"
              :key="period._id"
              :label="period.name"
              :value="period._id"
            />
          </el-select>

          <el-button
            type="primary"
            style="margin-left: auto"
            @click="handleRefresh"
          >
            刷新
          </el-button>
        </div>
      </el-card>

      <!-- 报名列表 -->
      <el-card>
        <el-table
          :data="enrollments"
          stripe
          style="width: 100%"
          :default-sort="{ prop: 'createdAt', order: 'descending' }"
          v-loading="loading"
        >
          <el-table-column type="expand">
            <template #default="{ row }">
              <div class="expand-content">
                <el-descriptions :column="2" border>
                  <el-descriptions-item label="性别">
                    {{ row.gender === 'male' ? '男' : '女' }}
                  </el-descriptions-item>
                  <el-descriptions-item label="年龄">
                    {{ row.age }}
                  </el-descriptions-item>
                  <el-descriptions-item label="地址">
                    {{ row.province }} {{ row.detailedAddress }}
                  </el-descriptions-item>
                  <el-descriptions-item label="推荐人">
                    {{ row.referrer || '-' }}
                  </el-descriptions-item>
                  <el-descriptions-item label="是否读过">
                    {{ row.hasReadBook ? '是' : '否' }}
                  </el-descriptions-item>
                  <el-descriptions-item label="读过次数">
                    {{ row.readTimes || '-' }}
                  </el-descriptions-item>
                  <el-descriptions-item label="参加缘起" :span="2">
                    {{ row.enrollReason }}
                  </el-descriptions-item>
                  <el-descriptions-item label="期待" :span="2">
                    {{ row.expectation }}
                  </el-descriptions-item>
                  <el-descriptions-item label="承诺事项" :span="2">
                    {{ row.commitment }}
                  </el-descriptions-item>
                </el-descriptions>
              </div>
            </template>
          </el-table-column>

          <el-table-column label="姓名" prop="name" width="120" />
          <el-table-column label="邮箱" prop="email" min-width="180" />
          <el-table-column label="期次" width="150">
            <template #default="{ row }">
              {{ getPeriodName(row.periodId) }}
            </template>
          </el-table-column>
          <el-table-column label="状态" width="120">
            <template #default="{ row }">
              <el-tag
                :type="getStatusType(row.approvalStatus)"
                disable-transitions
              >
                {{ formatStatus(row.approvalStatus) }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column label="报名时间" width="180">
            <template #default="{ row }">
              {{ formatDate(row.createdAt) }}
            </template>
          </el-table-column>
          <el-table-column label="操作" width="200" fixed="right">
            <template #default="{ row }">
              <el-button
                v-if="row.approvalStatus === 'pending'"
                type="success"
                text
                size="small"
                @click="approveEnrollment(row)"
              >
                批准
              </el-button>
              <el-button
                v-if="row.approvalStatus === 'pending'"
                type="danger"
                text
                size="small"
                @click="rejectEnrollment(row)"
              >
                拒绝
              </el-button>
              <el-button
                type="primary"
                text
                size="small"
                @click="viewDetails(row)"
              >
                详情
              </el-button>
            </template>
          </el-table-column>
        </el-table>

        <!-- 分页 -->
        <div class="pagination">
          <el-pagination
            v-model:current-page="pagination.page"
            v-model:page-size="pagination.pageSize"
            :page-sizes="[10, 20, 50, 100]"
            :total="pagination.total"
            layout="total, sizes, prev, pager, next, jumper"
            @current-page-change="loadEnrollments"
            @page-size-change="loadEnrollments"
          />
        </div>
      </el-card>

      <!-- 审批对话框 -->
      <el-dialog
        v-model="approvalDialog.visible"
        :title="approvalDialog.type === 'approve' ? '批准报名' : '拒绝报名'"
        width="500px"
      >
        <el-form :model="approvalForm">
          <el-form-item label="备注" v-if="approvalDialog.type === 'reject'">
            <el-input
              v-model="approvalForm.notes"
              type="textarea"
              placeholder="请输入拒绝原因"
              :rows="4"
            />
          </el-form-item>
        </el-form>

        <template #footer>
          <el-button @click="approvalDialog.visible = false">取消</el-button>
          <el-button
            type="primary"
            @click="confirmApproval"
            :loading="approvalDialog.loading"
          >
            确定
          </el-button>
        </template>
      </el-dialog>

      <!-- 详情对话框 -->
      <el-dialog
        v-model="detailsDialog.visible"
        title="报名详情"
        width="700px"
      >
        <el-descriptions
          v-if="selectedEnrollment"
          :column="1"
          border
        >
          <el-descriptions-item label="姓名">
            {{ selectedEnrollment.name }}
          </el-descriptions-item>
          <el-descriptions-item label="邮箱">
            {{ selectedEnrollment.email }}
          </el-descriptions-item>
          <el-descriptions-item label="期次">
            {{ getPeriodName(selectedEnrollment.periodId) }}
          </el-descriptions-item>
          <el-descriptions-item label="性别">
            {{ selectedEnrollment.gender === 'male' ? '男' : '女' }}
          </el-descriptions-item>
          <el-descriptions-item label="年龄">
            {{ selectedEnrollment.age }}
          </el-descriptions-item>
          <el-descriptions-item label="地址">
            {{ selectedEnrollment.province }} {{ selectedEnrollment.detailedAddress }}
          </el-descriptions-item>
          <el-descriptions-item label="推荐人">
            {{ selectedEnrollment.referrer || '-' }}
          </el-descriptions-item>
          <el-descriptions-item label="是否读过">
            {{ selectedEnrollment.hasReadBook ? '是' : '否' }}
          </el-descriptions-item>
          <el-descriptions-item label="读过次数" v-if="selectedEnrollment.hasReadBook">
            {{ selectedEnrollment.readTimes }}
          </el-descriptions-item>
          <el-descriptions-item label="参加缘起">
            {{ selectedEnrollment.enrollReason }}
          </el-descriptions-item>
          <el-descriptions-item label="期待">
            {{ selectedEnrollment.expectation }}
          </el-descriptions-item>
          <el-descriptions-item label="承诺事项">
            {{ selectedEnrollment.commitment }}
          </el-descriptions-item>
          <el-descriptions-item label="报名时间">
            {{ formatDate(selectedEnrollment.createdAt) }}
          </el-descriptions-item>
          <el-descriptions-item label="状态">
            <el-tag
              :type="getStatusType(selectedEnrollment.approvalStatus)"
              disable-transitions
            >
              {{ formatStatus(selectedEnrollment.approvalStatus) }}
            </el-tag>
          </el-descriptions-item>
        </el-descriptions>
      </el-dialog>
    </div>
  </AdminLayout>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import AdminLayout from '../components/AdminLayout.vue'
import { enrollmentApi, periodApi } from '../services/api'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Search } from '@element-plus/icons-vue'

const loading = ref(false)
const enrollments = ref<any[]>([])
const periods = ref<any[]>([])
const selectedEnrollment = ref<any>(null)

const filters = ref({
  search: '',
  status: '',
  period: ''
})

const pagination = ref({
  page: 1,
  pageSize: 10,
  total: 0
})

const approvalDialog = ref({
  visible: false,
  type: 'approve' as 'approve' | 'reject',
  enrollmentId: '',
  loading: false
})

const approvalForm = ref({
  notes: ''
})

const detailsDialog = ref({
  visible: false
})

onMounted(async () => {
  await Promise.all([
    loadEnrollments(),
    loadPeriods()
  ])
})

async function loadEnrollments() {
  loading.value = true
  try {
    const params: any = {
      page: pagination.value.page,
      limit: pagination.value.pageSize
    }

    if (filters.value.search) {
      params.search = filters.value.search
    }
    if (filters.value.status) {
      params.status = filters.value.status
    }
    if (filters.value.period) {
      params.periodId = filters.value.period
    }

    const response = await enrollmentApi.getEnrollments(params)
    enrollments.value = response.list || []
    pagination.value.total = response.total || 0
  } catch (err) {
    ElMessage.error('加载报名数据失败')
  } finally {
    loading.value = false
  }
}

async function loadPeriods() {
  try {
    const response = await periodApi.getPeriods({ limit: 100 })
    periods.value = response.list || []
  } catch (err) {
    ElMessage.error('加载期次数据失败')
  }
}

function handleSearch() {
  pagination.value.page = 1
  loadEnrollments()
}

function handleRefresh() {
  loadEnrollments()
  ElMessage.success('已刷新')
}

function approveEnrollment(row: any) {
  approvalDialog.value.visible = true
  approvalDialog.value.type = 'approve'
  approvalDialog.value.enrollmentId = row._id
  approvalForm.value.notes = ''
}

function rejectEnrollment(row: any) {
  approvalDialog.value.visible = true
  approvalDialog.value.type = 'reject'
  approvalDialog.value.enrollmentId = row._id
  approvalForm.value.notes = ''
}

async function confirmApproval() {
  approvalDialog.value.loading = true
  try {
    if (approvalDialog.value.type === 'approve') {
      await enrollmentApi.approveEnrollment(approvalDialog.value.enrollmentId)
      ElMessage.success('批准成功')
    } else {
      await enrollmentApi.rejectEnrollment(
        approvalDialog.value.enrollmentId,
        { notes: approvalForm.value.notes }
      )
      ElMessage.success('拒绝成功')
    }

    approvalDialog.value.visible = false
    await loadEnrollments()
  } catch (err: any) {
    ElMessage.error(err.message || '操作失败')
  } finally {
    approvalDialog.value.loading = false
  }
}

function viewDetails(row: any) {
  selectedEnrollment.value = row
  detailsDialog.value.visible = true
}

function getPeriodName(periodId: string): string {
  const period = periods.value.find(p => p._id === periodId)
  return period?.name || '-'
}

function formatStatus(status: string): string {
  const statusMap: Record<string, string> = {
    pending: '待审批',
    approved: '已批准',
    rejected: '已拒绝'
  }
  return statusMap[status] || status
}

function getStatusType(status: string): string {
  const typeMap: Record<string, string> = {
    pending: 'warning',
    approved: 'success',
    rejected: 'danger'
  }
  return typeMap[status] || 'info'
}

function formatDate(dateString: string): string {
  if (!dateString) return '-'
  const date = new Date(dateString)
  return date.toLocaleDateString('zh-CN') + ' ' + date.toLocaleTimeString('zh-CN')
}
</script>

<style scoped>
.enrollments-container {
  padding: 24px;
}

.card-title {
  font-size: 16px;
  font-weight: 600;
}

.filter-panel {
  display: flex;
  align-items: center;
  gap: 16px;
}

.pagination {
  display: flex;
  justify-content: flex-end;
  margin-top: 20px;
}

.expand-content {
  padding: 20px;
  background: #f5f7fa;
}
</style>
