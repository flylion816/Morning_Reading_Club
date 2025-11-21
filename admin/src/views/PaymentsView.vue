<template>
  <AdminLayout>
    <div class="payments-container">
      <!-- 筛选面板 -->
      <el-card style="margin-bottom: 20px">
        <template #header>
          <span class="card-title">支付记录</span>
        </template>

        <div class="filter-panel">
          <el-input
            v-model="filters.search"
            placeholder="搜索订单号或用户名..."
            clearable
            style="width: 220px"
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
            @change="loadPayments"
          >
            <el-option label="待支付" value="pending" />
            <el-option label="处理中" value="processing" />
            <el-option label="已完成" value="completed" />
            <el-option label="失败" value="failed" />
            <el-option label="已取消" value="cancelled" />
          </el-select>

          <el-select
            v-model="filters.method"
            placeholder="支付方式"
            clearable
            style="width: 150px; margin-left: 16px"
            @change="loadPayments"
          >
            <el-option label="微信支付" value="wechat" />
            <el-option label="支付宝" value="alipay" />
            <el-option label="模拟支付" value="mock" />
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

      <!-- 支付统计 -->
      <div class="stats-row">
        <el-statistic title="总收入" :value="statistics.totalAmount">
          <template #prefix>¥</template>
        </el-statistic>
        <el-statistic
          title="已完成"
          :value="statistics.completedCount"
          style="margin-left: 32px"
        />
        <el-statistic
          title="处理中"
          :value="statistics.processingCount"
          style="margin-left: 32px"
        />
        <el-statistic
          title="失败/取消"
          :value="statistics.failedCount"
          style="margin-left: 32px"
        />
      </div>

      <!-- 支付列表 -->
      <el-card style="margin-top: 20px">
        <el-table
          :data="payments"
          stripe
          style="width: 100%"
          :default-sort="{ prop: 'createdAt', order: 'descending' }"
          v-loading="loading"
        >
          <el-table-column type="expand">
            <template #default="{ row }">
              <div class="expand-content">
                <el-descriptions :column="2" border>
                  <el-descriptions-item label="订单号">
                    {{ row.orderNo }}
                  </el-descriptions-item>
                  <el-descriptions-item label="金额">
                    ¥{{ (row.amount / 100).toFixed(2) }}
                  </el-descriptions-item>
                  <el-descriptions-item label="支付方式">
                    {{ formatPaymentMethod(row.paymentMethod) }}
                  </el-descriptions-item>
                  <el-descriptions-item label="状态">
                    <el-tag
                      :type="getPaymentStatusType(row.status)"
                      disable-transitions
                    >
                      {{ formatPaymentStatus(row.status) }}
                    </el-tag>
                  </el-descriptions-item>
                  <el-descriptions-item label="期次">
                    {{ row.periodId }}
                  </el-descriptions-item>
                  <el-descriptions-item label="报名ID">
                    {{ row.enrollmentId }}
                  </el-descriptions-item>
                  <el-descriptions-item
                    label="交易ID"
                    v-if="row.transactionId"
                  >
                    {{ row.transactionId }}
                  </el-descriptions-item>
                  <el-descriptions-item
                    label="完成时间"
                    v-if="row.successTime"
                  >
                    {{ formatDate(row.successTime) }}
                  </el-descriptions-item>
                  <el-descriptions-item label="创建时间">
                    {{ formatDate(row.createdAt) }}
                  </el-descriptions-item>
                </el-descriptions>
              </div>
            </template>
          </el-table-column>

          <el-table-column label="订单号" prop="orderNo" min-width="180" />
          <el-table-column label="用户" width="120">
            <template #default="{ row }">
              {{ row.userName || '未知' }}
            </template>
          </el-table-column>
          <el-table-column label="金额" width="100">
            <template #default="{ row }">
              <span style="color: #67c23a; font-weight: 600">
                ¥{{ (row.amount / 100).toFixed(2) }}
              </span>
            </template>
          </el-table-column>
          <el-table-column label="支付方式" width="120">
            <template #default="{ row }">
              {{ formatPaymentMethod(row.paymentMethod) }}
            </template>
          </el-table-column>
          <el-table-column label="状态" width="120">
            <template #default="{ row }">
              <el-tag
                :type="getPaymentStatusType(row.status)"
                disable-transitions
              >
                {{ formatPaymentStatus(row.status) }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column label="创建时间" width="180">
            <template #default="{ row }">
              {{ formatDate(row.createdAt) }}
            </template>
          </el-table-column>
          <el-table-column label="操作" width="120" fixed="right">
            <template #default="{ row }">
              <el-button
                v-if="row.status !== 'cancelled'"
                type="danger"
                text
                size="small"
                @click="cancelPayment(row)"
              >
                取消
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
            @current-page-change="loadPayments"
            @page-size-change="loadPayments"
          />
        </div>
      </el-card>

      <!-- 详情对话框 -->
      <el-dialog
        v-model="detailsDialog.visible"
        title="支付详情"
        width="600px"
      >
        <el-descriptions
          v-if="selectedPayment"
          :column="1"
          border
        >
          <el-descriptions-item label="订单号">
            {{ selectedPayment.orderNo }}
          </el-descriptions-item>
          <el-descriptions-item label="用户">
            {{ selectedPayment.userName }}
          </el-descriptions-item>
          <el-descriptions-item label="金额">
            <span style="color: #67c23a; font-weight: 600">
              ¥{{ (selectedPayment.amount / 100).toFixed(2) }}
            </span>
          </el-descriptions-item>
          <el-descriptions-item label="支付方式">
            {{ formatPaymentMethod(selectedPayment.paymentMethod) }}
          </el-descriptions-item>
          <el-descriptions-item label="状态">
            <el-tag
              :type="getPaymentStatusType(selectedPayment.status)"
              disable-transitions
            >
              {{ formatPaymentStatus(selectedPayment.status) }}
            </el-tag>
          </el-descriptions-item>
          <el-descriptions-item label="期次">
            {{ selectedPayment.periodId }}
          </el-descriptions-item>
          <el-descriptions-item label="报名ID">
            {{ selectedPayment.enrollmentId }}
          </el-descriptions-item>
          <el-descriptions-item
            label="交易ID"
            v-if="selectedPayment.transactionId"
          >
            {{ selectedPayment.transactionId }}
          </el-descriptions-item>
          <el-descriptions-item label="创建时间">
            {{ formatDate(selectedPayment.createdAt) }}
          </el-descriptions-item>
          <el-descriptions-item
            label="完成时间"
            v-if="selectedPayment.successTime"
          >
            {{ formatDate(selectedPayment.successTime) }}
          </el-descriptions-item>
        </el-descriptions>
      </el-dialog>
    </div>
  </AdminLayout>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import AdminLayout from '../components/AdminLayout.vue'
import { paymentApi } from '../services/api'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Search } from '@element-plus/icons-vue'

const loading = ref(false)
const payments = ref<any[]>([])
const selectedPayment = ref<any>(null)

const filters = ref({
  search: '',
  status: '',
  method: ''
})

const pagination = ref({
  page: 1,
  pageSize: 10,
  total: 0
})

const statistics = ref({
  totalAmount: 0,
  completedCount: 0,
  processingCount: 0,
  failedCount: 0
})

const detailsDialog = ref({
  visible: false
})

onMounted(async () => {
  await loadPayments()
  await loadStatistics()
})

async function loadPayments() {
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
    if (filters.value.method) {
      params.method = filters.value.method
    }

    const response = await paymentApi.getPayments(params)
    payments.value = response.list || []
    pagination.value.total = response.total || 0
  } catch (err) {
    ElMessage.error('加载支付数据失败')
  } finally {
    loading.value = false
  }
}

async function loadStatistics() {
  try {
    // 在这里可以调用统计API，现在仅计算当前数据
    const completed = payments.value.filter(p => p.status === 'completed').length
    const processing = payments.value.filter(p => p.status === 'processing').length
    const failed = payments.value.filter(p => ['failed', 'cancelled'].includes(p.status)).length
    const total = payments.value.reduce((sum, p) => sum + (p.amount || 0), 0)

    statistics.value = {
      totalAmount: (total / 100).toFixed(2) as any,
      completedCount: completed,
      processingCount: processing,
      failedCount: failed
    }
  } catch (err) {
    console.error('加载统计数据失败:', err)
  }
}

function handleSearch() {
  pagination.value.page = 1
  loadPayments()
}

function handleRefresh() {
  loadPayments()
  ElMessage.success('已刷新')
}

async function cancelPayment(row: any) {
  ElMessageBox.confirm(
    '确定要取消该支付订单吗？',
    '警告',
    {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning'
    }
  )
    .then(async () => {
      try {
        await paymentApi.cancelPayment(row._id)
        ElMessage.success('取消成功')
        await loadPayments()
      } catch (err: any) {
        ElMessage.error(err.message || '取消失败')
      }
    })
    .catch(() => {
      // 用户取消了操作
    })
}

function viewDetails(row: any) {
  selectedPayment.value = row
  detailsDialog.value.visible = true
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

function formatPaymentMethod(method: string): string {
  const methodMap: Record<string, string> = {
    wechat: '微信支付',
    alipay: '支付宝',
    mock: '模拟支付'
  }
  return methodMap[method] || method
}

function formatDate(dateString: string): string {
  if (!dateString) return '-'
  const date = new Date(dateString)
  return date.toLocaleDateString('zh-CN') + ' ' + date.toLocaleTimeString('zh-CN')
}
</script>

<style scoped>
.payments-container {
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

.stats-row {
  display: flex;
  gap: 40px;
  margin: 20px 0;
  padding: 20px;
  background: white;
  border-radius: 4px;
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
