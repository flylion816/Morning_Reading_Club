<template>
  <AdminLayout>
    <div class="dashboard-container">
      <!-- 统计卡片 -->
      <div class="stats-grid">
        <el-card class="stat-card">
          <div class="stat-item">
            <div class="stat-value">{{ stats.totalEnrollments || 0 }}</div>
            <div class="stat-label">总报名数</div>
            <el-icon class="stat-icon"><User /></el-icon>
          </div>
        </el-card>

        <el-card class="stat-card">
          <div class="stat-item">
            <div class="stat-value">{{ stats.pendingApprovals || 0 }}</div>
            <div class="stat-label">待审批</div>
            <el-icon class="stat-icon warning"><Clock /></el-icon>
          </div>
        </el-card>

        <el-card class="stat-card">
          <div class="stat-item">
            <div class="stat-value">{{ stats.totalPayments || 0 }}</div>
            <div class="stat-label">支付总额</div>
            <el-icon class="stat-icon success"><Money /></el-icon>
          </div>
        </el-card>

        <el-card class="stat-card">
          <div class="stat-item">
            <div class="stat-value">{{ stats.activePeriods || 0 }}</div>
            <div class="stat-label">活跃期次</div>
            <el-icon class="stat-icon info"><Calendar /></el-icon>
          </div>
        </el-card>
      </div>

      <!-- 最近报名 -->
      <el-card style="margin-top: 24px">
        <template #header>
          <div class="card-header">
            <span class="title">最近报名</span>
            <el-button type="primary" text @click="navigateTo('/enrollments')">
              查看全部
            </el-button>
          </div>
        </template>

        <el-table
          :data="recentEnrollments"
          stripe
          style="width: 100%"
          :default-sort="{ prop: 'createdAt', order: 'descending' }"
        >
          <el-table-column prop="name" label="姓名" width="120" />
          <el-table-column prop="email" label="邮箱" min-width="180" />
          <el-table-column prop="period" label="期次" width="150" />
          <el-table-column label="状态" width="100">
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
          <el-table-column label="操作" width="100" fixed="right">
            <template #default="{ row }">
              <el-button
                type="primary"
                text
                size="small"
                @click="navigateTo('/enrollments')"
              >
                查看
              </el-button>
            </template>
          </el-table-column>
        </el-table>
      </el-card>

      <!-- 最近支付 -->
      <el-card style="margin-top: 24px">
        <template #header>
          <div class="card-header">
            <span class="title">最近支付</span>
            <el-button type="primary" text @click="navigateTo('/payments')">
              查看全部
            </el-button>
          </div>
        </template>

        <el-table
          :data="recentPayments"
          stripe
          style="width: 100%"
          :default-sort="{ prop: 'createdAt', order: 'descending' }"
        >
          <el-table-column prop="orderNo" label="订单号" min-width="200" />
          <el-table-column prop="userName" label="用户" width="120" />
          <el-table-column label="金额" width="100">
            <template #default="{ row }">
              ¥{{ (row.amount / 100).toFixed(2) }}
            </template>
          </el-table-column>
          <el-table-column label="状态" width="100">
            <template #default="{ row }">
              <el-tag
                :type="getPaymentStatusType(row.status)"
                disable-transitions
              >
                {{ formatPaymentStatus(row.status) }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column label="支付时间" width="180">
            <template #default="{ row }">
              {{ formatDate(row.createdAt) }}
            </template>
          </el-table-column>
        </el-table>
      </el-card>
    </div>
  </AdminLayout>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import AdminLayout from '../components/AdminLayout.vue'
import { statsApi, enrollmentApi, paymentApi } from '../services/api'
import { User, Clock, Money, Calendar } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'

const router = useRouter()

const stats = ref({
  totalEnrollments: 0,
  pendingApprovals: 0,
  totalPayments: 0,
  activePeriods: 0
})

const recentEnrollments = ref<any[]>([])
const recentPayments = ref<any[]>([])

onMounted(async () => {
  await Promise.all([
    loadStats(),
    loadRecentEnrollments(),
    loadRecentPayments()
  ])
})

async function loadStats() {
  try {
    const response = await statsApi.getDashboardStats()
    stats.value = response
  } catch (err) {
    ElMessage.error('加载统计数据失败')
  }
}

async function loadRecentEnrollments() {
  try {
    const response = await enrollmentApi.getEnrollments({
      limit: 5,
      sort: '-createdAt'
    })
    recentEnrollments.value = response.list || []
  } catch (err) {
    ElMessage.error('加载报名数据失败')
  }
}

async function loadRecentPayments() {
  try {
    const response = await paymentApi.getPayments({
      limit: 5,
      sort: '-createdAt'
    })
    recentPayments.value = response.list || []
  } catch (err) {
    ElMessage.error('加载支付数据失败')
  }
}

function navigateTo(path: string) {
  router.push(path)
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

function formatPaymentStatus(status: string): string {
  const statusMap: Record<string, string> = {
    pending: '待支付',
    processing: '处理中',
    completed: '已完成',
    failed: '失败',
    cancelled: '已取消'
  }
  return statusMap[status] || status
}

function getPaymentStatusType(status: string): string {
  const typeMap: Record<string, string> = {
    pending: 'warning',
    processing: 'info',
    completed: 'success',
    failed: 'danger',
    cancelled: 'danger'
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
.dashboard-container {
  padding: 24px;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
  gap: 20px;
  margin-bottom: 24px;
}

.stat-card {
  box-shadow: 0 2px 12px 0 rgba(0, 0, 0, 0.08);
  transition: all 0.3s ease;
}

.stat-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 4px 24px 0 rgba(0, 0, 0, 0.12);
}

.stat-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 20px;
  position: relative;
}

.stat-value {
  font-size: 32px;
  font-weight: 600;
  color: #333;
}

.stat-label {
  font-size: 14px;
  color: #999;
  margin-top: 8px;
}

.stat-icon {
  font-size: 48px;
  opacity: 0.1;
  position: absolute;
  right: 20px;
  top: 20px;
}

.stat-icon.warning {
  color: #e6a23c;
}

.stat-icon.success {
  color: #67c23a;
}

.stat-icon.info {
  color: #409eff;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.title {
  font-weight: 600;
  font-size: 16px;
}
</style>
