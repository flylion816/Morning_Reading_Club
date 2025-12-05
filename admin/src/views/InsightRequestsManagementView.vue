<template>
  <AdminLayout>
    <div class="insight-requests-container">
      <!-- 统计卡片 -->
      <div class="stats-cards">
        <el-card class="stat-card">
          <template #header>
            <div class="stat-header">总申请数</div>
          </template>
          <div class="stat-value">{{ stats.totalRequests }}</div>
          <div class="stat-label">条申请</div>
        </el-card>

        <el-card class="stat-card">
          <template #header>
            <div class="stat-header">待审批</div>
          </template>
          <div class="stat-value pending">{{ stats.pendingRequests }}</div>
          <div class="stat-label">个待处理</div>
        </el-card>

        <el-card class="stat-card">
          <template #header>
            <div class="stat-header">已同意</div>
          </template>
          <div class="stat-value approved">{{ stats.approvedRequests }}</div>
          <div class="stat-label">个已同意</div>
        </el-card>

        <el-card class="stat-card">
          <template #header>
            <div class="stat-header">已拒绝</div>
          </template>
          <div class="stat-value rejected">{{ stats.rejectedRequests }}</div>
          <div class="stat-label">个已拒绝</div>
        </el-card>

        <el-card class="stat-card">
          <template #header>
            <div class="stat-header">平均响应时间</div>
          </template>
          <div class="stat-value">{{ stats.avgResponseTime }}</div>
          <div class="stat-label">审批时间</div>
        </el-card>
      </div>

      <!-- 搜索和筛选 -->
      <el-card style="margin-bottom: 20px">
        <template #header>
          <div class="card-header">
            <span class="card-title">搜索和筛选</span>
          </div>
        </template>

        <el-form :model="filters" layout="inline">
          <el-form-item label="申请状态">
            <el-select
              v-model="filters.status"
              placeholder="选择状态"
              clearable
              @change="loadRequests"
            >
              <el-option label="待审批" value="pending" />
              <el-option label="已同意" value="approved" />
              <el-option label="已拒绝" value="rejected" />
              <el-option label="已撤销" value="revoked" />
              <el-option label="全部" value="all" />
            </el-select>
          </el-form-item>

          <el-form-item label="申请者">
            <el-input
              v-model="filters.fromUser"
              placeholder="搜索申请者"
              clearable
              @input="handleSearch"
            />
          </el-form-item>

          <el-form-item label="被申请者">
            <el-input
              v-model="filters.toUser"
              placeholder="搜索被申请者"
              clearable
              @input="handleSearch"
            />
          </el-form-item>

          <el-form-item>
            <el-button type="primary" @click="loadRequests">查询</el-button>
            <el-button @click="resetFilters">重置</el-button>
          </el-form-item>
        </el-form>
      </el-card>

      <!-- 申请列表 -->
      <el-card>
        <template #header>
          <div class="card-header">
            <span class="card-title">查看申请列表</span>
            <div class="header-actions">
              <el-button type="success" @click="batchApprove" :disabled="selectedRequests.length === 0">
                批量同意 ({{ selectedRequests.length }})
              </el-button>
              <el-button type="danger" @click="batchReject" :disabled="selectedRequests.length === 0">
                批量拒绝 ({{ selectedRequests.length }})
              </el-button>
              <el-dropdown @command="handleExport">
                <el-button>
                  导出数据 <el-icon class="el-icon--right"><arrow-down /></el-icon>
                </el-button>
                <template #dropdown>
                  <el-dropdown-menu>
                    <el-dropdown-item command="excel">📊 导出为 Excel</el-dropdown-item>
                    <el-dropdown-item command="csv">📋 导出为 CSV</el-dropdown-item>
                    <el-dropdown-item command="json">📄 导出为 JSON</el-dropdown-item>
                  </el-dropdown-menu>
                </template>
              </el-dropdown>
            </div>
          </div>
        </template>

        <el-table
          :data="requests"
          :default-sort="{ prop: 'createdAt', order: 'descending' }"
          @selection-change="handleSelectionChange"
          stripe
          style="width: 100%"
        >
          <el-table-column type="selection" width="50" />
          <el-table-column prop="fromUserId.nickname" label="申请者" width="120" />
          <el-table-column prop="toUserId.nickname" label="被申请者" width="120" />
          <el-table-column label="申请状态" width="100">
            <template #default="{ row }">
              <el-tag
                :type="getStatusTagType(row.status)"
                :hit="true"
              >
                {{ getStatusLabel(row.status) }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column prop="createdAt" label="申请时间" width="180">
            <template #default="{ row }">
              {{ formatTime(row.createdAt) }}
            </template>
          </el-table-column>
          <el-table-column
            v-if="filters.status !== 'pending'"
            prop="approvedAt"
            label="处理时间"
            width="180"
          >
            <template #default="{ row }">
              {{
                row.approvedAt ? formatTime(row.approvedAt) : row.rejectedAt ? formatTime(row.rejectedAt) : '-'
              }}
            </template>
          </el-table-column>
          <el-table-column label="操作" width="300" fixed="right">
            <template #default="{ row }">
              <div class="action-buttons">
                <el-button
                  v-if="row.status === 'pending'"
                  type="success"
                  size="small"
                  @click="openApproveDialog(row)"
                >
                  同意
                </el-button>
                <el-button
                  v-if="row.status === 'pending'"
                  type="danger"
                  size="small"
                  @click="openRejectDialog(row)"
                >
                  拒绝
                </el-button>
                <el-button type="info" size="small" @click="openDetailDialog(row)">
                  详情
                </el-button>
                <el-button
                  type="danger"
                  size="small"
                  text
                  @click="handleDeleteRequest(row)"
                >
                  删除
                </el-button>
              </div>
            </template>
          </el-table-column>
        </el-table>

        <!-- 分页 -->
        <el-pagination
          v-model:current-page="pagination.page"
          v-model:page-size="pagination.limit"
          :page-sizes="[10, 20, 50, 100]"
          :total="pagination.total"
          layout="total, sizes, prev, pager, next, jumper"
          style="margin-top: 20px; text-align: right"
          @change="loadRequests"
        />
      </el-card>

      <!-- 同意申请对话框 -->
      <el-dialog v-model="dialogApprove.visible" title="同意查看申请" width="40%">
        <el-form :model="dialogApprove.form">
          <el-form-item label="申请者">
            <span>{{ dialogApprove.form.fromUserName }}</span>
          </el-form-item>
          <el-form-item label="被申请者">
            <span>{{ dialogApprove.form.toUserName }}</span>
          </el-form-item>
          <el-form-item label="允许查看期次">
            <el-select v-model="dialogApprove.form.periodId" placeholder="选择期次">
              <el-option
                v-for="period in periods"
                :key="period._id"
                :label="period.name"
                :value="period._id"
              />
            </el-select>
          </el-form-item>
          <el-form-item label="管理员备注">
            <el-input v-model="dialogApprove.form.adminNote" type="textarea" rows="3" />
          </el-form-item>
        </el-form>
        <template #footer>
          <el-button @click="dialogApprove.visible = false">取消</el-button>
          <el-button type="primary" @click="submitApprove" :loading="dialogApprove.loading">
            确认同意
          </el-button>
        </template>
      </el-dialog>

      <!-- 拒绝申请对话框 -->
      <el-dialog v-model="dialogReject.visible" title="拒绝查看申请" width="40%">
        <el-form :model="dialogReject.form">
          <el-form-item label="申请者">
            <span>{{ dialogReject.form.fromUserName }}</span>
          </el-form-item>
          <el-form-item label="被申请者">
            <span>{{ dialogReject.form.toUserName }}</span>
          </el-form-item>
          <el-form-item label="拒绝原因">
            <el-input v-model="dialogReject.form.adminNote" type="textarea" rows="3" placeholder="请输入拒绝原因" />
          </el-form-item>
        </el-form>
        <template #footer>
          <el-button @click="dialogReject.visible = false">取消</el-button>
          <el-button type="primary" @click="submitReject" :loading="dialogReject.loading">
            确认拒绝
          </el-button>
        </template>
      </el-dialog>

      <!-- 详情对话框 -->
      <el-dialog v-model="dialogDetail.visible" title="申请详情" width="50%">
        <el-form :model="dialogDetail.request" label-width="100px">
          <el-form-item label="申请者">
            <span>{{ dialogDetail.request?.fromUserId?.nickname }}</span>
          </el-form-item>
          <el-form-item label="被申请者">
            <span>{{ dialogDetail.request?.toUserId?.nickname }}</span>
          </el-form-item>
          <el-form-item label="申请原因">
            <span>{{ dialogDetail.request?.reason || '无' }}</span>
          </el-form-item>
          <el-form-item label="申请时间">
            <span>{{ formatTime(dialogDetail.request?.createdAt) }}</span>
          </el-form-item>
          <el-form-item label="申请状态">
            <el-tag :type="getStatusTagType(dialogDetail.request?.status)">
              {{ getStatusLabel(dialogDetail.request?.status) }}
            </el-tag>
          </el-form-item>

          <el-divider />
          <h4>审计日志</h4>
          <el-timeline>
            <el-timeline-item
              v-for="log in dialogDetail.request?.auditLog"
              :key="log.timestamp"
              :timestamp="formatTime(log.timestamp)"
              placement="top"
            >
              <div class="audit-log-item">
                <strong>{{ getActionLabel(log.action) }}</strong>
                <p>执行者: {{ log.actorType === 'admin' ? '[管理员]' : '[用户]' }}</p>
                <p v-if="log.note">备注: {{ log.note }}</p>
                <p v-if="log.reason">原因: {{ log.reason }}</p>
              </div>
            </el-timeline-item>
          </el-timeline>
        </el-form>
      </el-dialog>
    </div>
  </AdminLayout>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { ArrowDown } from '@element-plus/icons-vue'
import AdminLayout from '../components/AdminLayout.vue'
import api from '../services/api'
import { exportToCSV, exportToExcel, exportToJSON, generateFilename } from '../utils/exportUtils'

// 统计数据
const stats = ref({
  totalRequests: 0,
  pendingRequests: 0,
  approvedRequests: 0,
  rejectedRequests: 0,
  avgResponseTime: '0分钟'
})

// 筛选条件
const filters = ref({
  status: 'pending',
  fromUser: '',
  toUser: ''
})

// 申请列表
const requests = ref([])
const selectedRequests = ref([])

// 分页
const pagination = ref({
  page: 1,
  limit: 20,
  total: 0
})

// 期次列表
const periods = ref([])

// 对话框状态
const dialogApprove = ref({
  visible: false,
  loading: false,
  form: {
    fromUserName: '',
    toUserName: '',
    periodId: '',
    adminNote: ''
  },
  requestId: ''
})

const dialogReject = ref({
  visible: false,
  loading: false,
  form: {
    fromUserName: '',
    toUserName: '',
    adminNote: ''
  },
  requestId: ''
})

const dialogDetail = ref({
  visible: false,
  request: null
})

// 加载统计数据
const loadStats = async () => {
  try {
    const response = await api.get('/admin/insights/requests/stats')
    if (response.data && response.data.data) {
      stats.value = response.data.data
    }
  } catch (error) {
    ElMessage.error('加载统计数据失败')
  }
}

// 加载申请列表
const loadRequests = async () => {
  try {
    const params = {
      status: filters.value.status,
      page: pagination.value.page,
      limit: pagination.value.limit,
      fromUser: filters.value.fromUser,
      toUser: filters.value.toUser
    }

    const response = await api.get('/admin/insights/requests', { params })
    if (response.data && response.data.data) {
      requests.value = response.data.data.requests
      pagination.value.total = response.data.data.pagination.total
    }
  } catch (error) {
    ElMessage.error('加载申请列表失败')
  }
}

// 加载期次列表
const loadPeriods = async () => {
  try {
    const response = await api.get('/periods')
    if (response.data && response.data.data) {
      periods.value = response.data.data
    }
  } catch (error) {
    ElMessage.error('加载期次列表失败')
  }
}

// 打开同意对话框
const openApproveDialog = (row) => {
  dialogApprove.value.form = {
    fromUserName: row.fromUserId?.nickname || '未知',
    toUserName: row.toUserId?.nickname || '未知',
    periodId: '',
    adminNote: ''
  }
  dialogApprove.value.requestId = row._id
  dialogApprove.value.visible = true
}

// 提交同意
const submitApprove = async () => {
  if (!dialogApprove.value.form.periodId) {
    ElMessage.error('请选择允许查看的期次')
    return
  }

  dialogApprove.value.loading = true
  try {
    await api.put(`/admin/insights/requests/${dialogApprove.value.requestId}/approve`, {
      periodId: dialogApprove.value.form.periodId,
      adminNote: dialogApprove.value.form.adminNote
    })
    ElMessage.success('申请已同意')
    dialogApprove.value.visible = false
    loadRequests()
    loadStats()
  } catch (error) {
    ElMessage.error(error.response?.data?.message || '操作失败')
  } finally {
    dialogApprove.value.loading = false
  }
}

// 打开拒绝对话框
const openRejectDialog = (row) => {
  dialogReject.value.form = {
    fromUserName: row.fromUserId?.nickname || '未知',
    toUserName: row.toUserId?.nickname || '未知',
    adminNote: ''
  }
  dialogReject.value.requestId = row._id
  dialogReject.value.visible = true
}

// 提交拒绝
const submitReject = async () => {
  dialogReject.value.loading = true
  try {
    await api.put(`/admin/insights/requests/${dialogReject.value.requestId}/reject`, {
      adminNote: dialogReject.value.form.adminNote
    })
    ElMessage.success('申请已拒绝')
    dialogReject.value.visible = false
    loadRequests()
    loadStats()
  } catch (error) {
    ElMessage.error(error.response?.data?.message || '操作失败')
  } finally {
    dialogReject.value.loading = false
  }
}

// 打开详情对话框
const openDetailDialog = (row) => {
  dialogDetail.value.request = row
  dialogDetail.value.visible = true
}

// 删除申请
const handleDeleteRequest = (row) => {
  ElMessageBox.confirm('确认删除此申请吗？此操作不可恢复', '删除确认', {
    confirmButtonText: '确定删除',
    cancelButtonText: '取消',
    type: 'warning'
  })
    .then(async () => {
      try {
        await api.delete(`/admin/insights/requests/${row._id}`, {
          data: {
            adminNote: '管理员删除'
          }
        })
        ElMessage.success('申请已删除')
        loadRequests()
        loadStats()
      } catch (error) {
        ElMessage.error(error.response?.data?.message || '删除失败')
      }
    })
    .catch(() => {})
}

// 批量同意
const batchApprove = () => {
  ElMessageBox.confirm('确认批量同意选中的申请吗?', '提示', {
    confirmButtonText: '确定',
    cancelButtonText: '取消',
    type: 'warning'
  })
    .then(async () => {
      ElMessage.warning('批量同意需要先选择期次，请逐个处理')
    })
    .catch(() => {})
}

// 批量拒绝
const batchReject = () => {
  ElMessageBox.confirm('确认批量拒绝选中的申请吗?', '提示', {
    confirmButtonText: '确定',
    cancelButtonText: '取消',
    type: 'warning'
  })
    .then(async () => {
      try {
        for (const request of selectedRequests.value) {
          await api.put(`/admin/insights/requests/${request._id}/reject`, {
            adminNote: '批量拒绝'
          })
        }
        ElMessage.success('批量拒绝成功')
        loadRequests()
        loadStats()
        selectedRequests.value = []
      } catch (error) {
        ElMessage.error('批量拒绝失败')
      }
    })
    .catch(() => {})
}

// 生成导出数据
const generateExportData = () => {
  const headers = ['申请者', '被申请者', '申请原因', '申请时间', '申请状态', '处理时间']
  const rows = requests.value.map(req => [
    req.fromUserId?.nickname || '-',
    req.toUserId?.nickname || '-',
    req.reason || '-',
    formatTime(req.createdAt),
    getStatusLabel(req.status),
    req.approvedAt ? formatTime(req.approvedAt) : req.rejectedAt ? formatTime(req.rejectedAt) : '-'
  ])
  return { headers, rows }
}

// 导出数据 - 支持多种格式
const handleExport = async (command: string) => {
  const { headers, rows } = generateExportData()
  const filename = generateFilename('insight-requests-export')

  try {
    if (command === 'excel') {
      await exportToExcel(filename, headers, rows, {
        sheetName: '查看申请列表',
        frozenHeader: true,
        columnWidths: [15, 15, 20, 20, 12, 20],
        headerBackgroundColor: 'FF4472C4',
        headerTextColor: 'FFFFFFFF'
      })
      ElMessage.success('Excel 导出成功')
    } else if (command === 'csv') {
      exportToCSV(filename, headers, rows)
      ElMessage.success('CSV 导出成功')
    } else if (command === 'json') {
      exportToJSON(filename, headers, rows)
      ElMessage.success('JSON 导出成功')
    }
  } catch (error) {
    if (command === 'excel') {
      ElMessage.warning('Excel 导出失败，自动使用 CSV 格式')
      exportToCSV(filename, headers, rows)
    } else {
      ElMessage.error('导出失败: ' + error.message)
    }
  }
}

// 处理搜索
const handleSearch = () => {
  pagination.value.page = 1
  loadRequests()
}

// 重置筛选
const resetFilters = () => {
  filters.value = {
    status: 'pending',
    fromUser: '',
    toUser: ''
  }
  pagination.value.page = 1
  loadRequests()
}

// 处理表格选择变化
const handleSelectionChange = (selection) => {
  selectedRequests.value = selection
}

// 格式化时间
const formatTime = (date) => {
  if (!date) return '-'
  return new Date(date).toLocaleString('zh-CN')
}

// 获取状态标签类型
const getStatusTagType = (status) => {
  const types = {
    pending: 'warning',
    approved: 'success',
    rejected: 'danger'
  }
  return types[status] || 'info'
}

// 获取状态标签文本
const getStatusLabel = (status) => {
  const labels = {
    pending: '待审批',
    approved: '已同意',
    rejected: '已拒绝',
    revoked: '已撤销'
  }
  return labels[status] || '未知'
}

// 获取操作标签文本
const getActionLabel = (action) => {
  const labels = {
    create: '创建申请',
    approve: '用户同意',
    reject: '用户拒绝',
    admin_approve: '管理员同意',
    admin_reject: '管理员拒绝',
    revoke: '撤销权限',
    admin_delete: '管理员删除'
  }
  return labels[action] || '未知操作'
}

// 初始化
onMounted(() => {
  loadStats()
  loadRequests()
  loadPeriods()
})
</script>

<style scoped>
.insight-requests-container {
  padding: 20px;
}

.stats-cards {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 20px;
  margin-bottom: 20px;
}

.stat-card {
  text-align: center;
  cursor: pointer;
  transition: all 0.3s;
}

.stat-card:hover {
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  transform: translateY(-2px);
}

.stat-header {
  font-weight: 600;
  font-size: 14px;
  color: #666;
}

.stat-value {
  font-size: 32px;
  font-weight: bold;
  color: #409eff;
  margin: 10px 0;
}

.stat-value.pending {
  color: #e6a23c;
}

.stat-value.approved {
  color: #67c23a;
}

.stat-value.rejected {
  color: #f56c6c;
}

.stat-label {
  font-size: 12px;
  color: #999;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  width: 100%;
}

.card-title {
  font-weight: 600;
}

.header-actions {
  display: flex;
  gap: 10px;
}

.action-buttons {
  display: flex;
  gap: 5px;
  flex-wrap: wrap;
}

.action-buttons :deep(.el-button) {
  padding: 5px 10px;
  font-size: 12px;
}

.audit-log-item {
  padding: 10px;
  background: #f5f7fa;
  border-radius: 4px;
}

.audit-log-item strong {
  display: block;
  margin-bottom: 5px;
}

.audit-log-item p {
  margin: 3px 0;
  font-size: 12px;
  color: #666;
}
</style>
