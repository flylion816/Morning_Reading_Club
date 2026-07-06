<template>
  <AdminLayout>
    <div class="dashboard-container">
      <div v-if="dashboardError" class="dashboard-alert">
        {{ dashboardError }}
      </div>

      <div class="stats-grid" :class="{ 'is-loading': dashboardLoading }">
        <button
          v-for="item in statCards"
          :key="item.label"
          class="stat-card"
          :class="{ urgent: item.urgent }"
          type="button"
          @click="navigateTo(item.path)"
        >
          <span class="stat-icon" :class="item.tone">
            <el-icon><component :is="item.icon" /></el-icon>
          </span>
          <span class="stat-label">{{ item.label }}</span>
          <span class="stat-value">{{ item.value }}</span>
          <span class="stat-hint">{{ item.hint }}</span>
        </button>
      </div>

      <el-card class="todo-card">
        <template #header>
          <div class="card-header">
            <span class="title">待处理事项</span>
            <span class="card-note">优先处理会影响学员体验的事项</span>
          </div>
        </template>

        <div class="todo-grid">
          <button class="todo-item" type="button" @click="navigateTo('/enrollments')">
            <div>
              <div class="todo-title">待审批报名</div>
              <div class="todo-desc">需要确认是否通过的报名记录</div>
            </div>
            <div class="todo-count">{{ stats.pendingEnrollments || 0 }}</div>
          </button>

          <button class="todo-item" type="button" @click="navigateTo('/payments')">
            <div>
              <div class="todo-title">待完成支付</div>
              <div class="todo-desc">已发起但尚未完成的支付订单</div>
            </div>
            <div class="todo-count">{{ pendingPaymentsTotal }}</div>
          </button>

          <button class="todo-item" type="button" @click="navigateTo('/analytics')">
            <div>
              <div class="todo-title">今日活跃检查</div>
              <div class="todo-desc">查看访问、打卡、小凡看见等关键行为</div>
            </div>
            <div class="todo-count">去看</div>
          </button>
        </div>
      </el-card>

      <div class="activity-grid">
        <el-card class="activity-card">
          <template #header>
            <div class="card-header">
              <span class="title">最近报名</span>
              <el-button type="primary" text @click="navigateTo('/enrollments')">
                查看全部
              </el-button>
            </div>
          </template>

          <el-skeleton v-if="enrollmentsLoading" :rows="4" animated />
          <el-empty
            v-else-if="recentEnrollments.length === 0"
            description="暂无新的报名记录"
            :image-size="88"
          />
          <el-table
            v-else
            :data="recentEnrollments"
            style="width: 100%"
            :default-sort="{ prop: 'createdAt', order: 'descending' }"
          >
            <el-table-column label="学员" min-width="150">
              <template #default="{ row }">
                <div class="person-cell">
                  <el-avatar
                    :src="getEnrollmentAvatarUrl(row)"
                    :size="32"
                    class="user-avatar"
                    :style="{ background: getEnrollmentAvatarColor(row) }"
                  >
                    {{ getEnrollmentAvatarText(row) }}
                  </el-avatar>
                  <span>{{ row.userId?.nickname || '匿名' }}</span>
                </div>
              </template>
            </el-table-column>
            <el-table-column label="期次" min-width="130">
              <template #default="{ row }">
                {{ row.periodId?.name || '-' }}
              </template>
            </el-table-column>
            <el-table-column label="状态" width="96">
              <template #default="{ row }">
                <el-tag
                  :type="getStatusType(row.approvalStatus)"
                  disable-transitions
                >
                  {{ formatStatus(row.approvalStatus) }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column label="报名时间" min-width="170">
              <template #default="{ row }">
                {{ formatDate(row.enrolledAt || row.createdAt) }}
              </template>
            </el-table-column>
            <el-table-column label="操作" width="88" fixed="right">
              <template #default>
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

        <el-card class="activity-card">
          <template #header>
            <div class="card-header">
              <span class="title">最近支付</span>
              <el-button type="primary" text @click="navigateTo('/payments')">
                查看全部
              </el-button>
            </div>
          </template>

          <el-skeleton v-if="paymentsLoading" :rows="4" animated />
          <el-empty
            v-else-if="recentPayments.length === 0"
            description="暂无新的支付记录"
            :image-size="88"
          />
          <el-table
            v-else
            :data="recentPayments"
            style="width: 100%"
            :default-sort="{ prop: 'createdAt', order: 'descending' }"
          >
            <el-table-column label="订单" min-width="180">
              <template #default="{ row }">
                <span class="order-no">{{ row.orderNo || '-' }}</span>
              </template>
            </el-table-column>
            <el-table-column label="学员" min-width="140">
              <template #default="{ row }">
                <div class="person-cell">
                  <el-avatar
                    :src="getPaymentAvatarUrl(row)"
                    :size="32"
                    class="user-avatar"
                    :style="{ background: getPaymentAvatarColor(row) }"
                  >
                    {{ getPaymentAvatarText(row) }}
                  </el-avatar>
                  <span>{{ row.userName || '未知' }}</span>
                </div>
              </template>
            </el-table-column>
            <el-table-column label="金额" width="112">
              <template #default="{ row }">
                <span class="money">¥{{ (row.amount / 100).toFixed(2) }}</span>
              </template>
            </el-table-column>
            <el-table-column label="状态" width="96">
              <template #default="{ row }">
                <el-tag
                  :type="getPaymentStatusType(row.status)"
                  disable-transitions
                >
                  {{ formatPaymentStatus(row.status) }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column label="时间" min-width="170">
              <template #default="{ row }">
                {{ formatDate(row.createdAt) }}
              </template>
            </el-table-column>
          </el-table>
        </el-card>
      </div>
    </div>
  </AdminLayout>
</template>

<script setup lang="ts">
import { computed, ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import AdminLayout from '../components/AdminLayout.vue';
import { statsApi, enrollmentApi, paymentApi } from '../services/api';
import { ElMessage } from 'element-plus';
import {
  Calendar,
  Checked,
  CreditCard,
  EditPen,
  Timer,
  User
} from '@element-plus/icons-vue';
import type { ListResponse, Enrollment, Payment } from '../types/api';
import {
  getAvatarColorByUserId,
  getLastTextChar,
  getUserAvatarUrl
} from '../utils/avatar';

const router = useRouter();

const stats = ref({
  totalUsers: 0,
  totalEnrollments: 0,
  pendingEnrollments: 0,
  paidEnrollments: 0,
  totalPayments: 0,
  totalPaymentAmount: 0,
  activePeriods: 0
});

const recentEnrollments = ref<Enrollment[]>([]);
const recentPayments = ref<Payment[]>([]);
const pendingPaymentsTotal = ref(0);
const statsLoading = ref(true);
const enrollmentsLoading = ref(true);
const paymentsLoading = ref(true);
const pendingPaymentsLoading = ref(true);
const dashboardError = ref('');

const dashboardLoading = computed(
  () =>
    statsLoading.value ||
    enrollmentsLoading.value ||
    paymentsLoading.value ||
    pendingPaymentsLoading.value
);

const statCards = computed(() => [
  {
    label: '总用户数',
    value: statsLoading.value ? '...' : stats.value.totalUsers || 0,
    hint: '已进入系统的学员',
    path: '/users',
    icon: User,
    tone: 'primary'
  },
  {
    label: '总报名数',
    value: statsLoading.value ? '...' : stats.value.totalEnrollments || 0,
    hint: '全部期次报名',
    path: '/enrollments',
    icon: EditPen,
    tone: 'primary'
  },
  {
    label: '待审批',
    value: statsLoading.value ? '...' : stats.value.pendingEnrollments || 0,
    hint: '建议优先处理',
    path: '/enrollments',
    icon: Timer,
    tone: 'warning',
    urgent: (stats.value.pendingEnrollments || 0) > 0
  },
  {
    label: '已支付报名',
    value: statsLoading.value ? '...' : stats.value.paidEnrollments || 0,
    hint: '已完成支付链路',
    path: '/enrollments',
    icon: Checked,
    tone: 'success'
  },
  {
    label: '支付总额',
    value: statsLoading.value
      ? '...'
      : `¥${((stats.value.totalPaymentAmount || 0) / 100).toFixed(2)}`,
    hint: '累计到账金额',
    path: '/payments',
    icon: CreditCard,
    tone: 'success'
  },
  {
    label: '活跃期次',
    value: statsLoading.value ? '...' : stats.value.activePeriods || 0,
    hint: '当前进行中的营期',
    path: '/periods',
    icon: Calendar,
    tone: 'primary'
  }
]);

onMounted(async () => {
  await Promise.all([
    loadStats(),
    loadRecentEnrollments(),
    loadRecentPayments(),
    loadPendingPayments()
  ]);
});

async function loadStats() {
  statsLoading.value = true;
  try {
    const response = await statsApi.getDashboardStats();
    stats.value = response;
  } catch (err) {
    dashboardError.value = '统计数据暂时无法加载，请稍后刷新。';
    ElMessage.error('加载统计数据失败');
  } finally {
    statsLoading.value = false;
  }
}

async function loadRecentEnrollments() {
  enrollmentsLoading.value = true;
  try {
    const response = (await enrollmentApi.getEnrollments({
      limit: 5,
      sort: '-createdAt'
    })) as unknown as ListResponse<Enrollment>;
    recentEnrollments.value = response.list || [];
  } catch (err: any) {
    ElMessage.error('加载报名数据失败');
  } finally {
    enrollmentsLoading.value = false;
  }
}

async function loadRecentPayments() {
  paymentsLoading.value = true;
  try {
    const response = (await paymentApi.getPayments({
      limit: 5,
      sort: '-createdAt'
    })) as unknown as ListResponse<Payment>;
    recentPayments.value = response.list || [];
  } catch (err: any) {
    ElMessage.error('加载支付数据失败');
  } finally {
    paymentsLoading.value = false;
  }
}

async function loadPendingPayments() {
  pendingPaymentsLoading.value = true;
  try {
    const response = (await paymentApi.getPayments({
      status: 'pending',
      limit: 1
    })) as unknown as ListResponse<Payment>;
    pendingPaymentsTotal.value =
      response.pagination?.total ||
      response.total ||
      response.list?.length ||
      0;
  } catch (err: any) {
    pendingPaymentsTotal.value = 0;
  } finally {
    pendingPaymentsLoading.value = false;
  }
}

function navigateTo(path: string) {
  router.push(path);
}

function formatStatus(status: string): string {
  const statusMap: Record<string, string> = {
    pending: '待审批',
    approved: '已批准',
    rejected: '已拒绝'
  };
  return statusMap[status] || status;
}

function getStatusType(status: string): string {
  const typeMap: Record<string, string> = {
    pending: 'warning',
    approved: 'success',
    rejected: 'danger'
  };
  return typeMap[status] || 'info';
}

function formatPaymentStatus(status: string): string {
  const statusMap: Record<string, string> = {
    pending: '待支付',
    processing: '处理中',
    completed: '已完成',
    failed: '失败',
    cancelled: '已取消'
  };
  return statusMap[status] || status;
}

function getPaymentStatusType(status: string): string {
  const typeMap: Record<string, string> = {
    pending: 'warning',
    processing: 'info',
    completed: 'success',
    failed: 'danger',
    cancelled: 'danger'
  };
  return typeMap[status] || 'info';
}

function formatDate(dateString: string): string {
  if (!dateString) return '-';
  const date = new Date(dateString);
  return (
    date.toLocaleDateString('zh-CN') + ' ' + date.toLocaleTimeString('zh-CN')
  );
}

function getEnrollmentAvatarUrl(row: Enrollment): string {
  const user = row.userId as any;
  return getUserAvatarUrl(user);
}

function getEnrollmentAvatarText(row: Enrollment): string {
  const user = row.userId as any;
  const nickname = user?.nickname || (row as any).name || '';
  return getLastTextChar(nickname, '用');
}

function getEnrollmentAvatarColor(row: Enrollment): string {
  const user = row.userId as any;
  return getAvatarColorByUserId(user?._id || user?.id || String(row.userId || ''));
}

function getPaymentAvatarUrl(row: Payment): string {
  return (row as any).userAvatarUrl || '';
}

function getPaymentAvatarText(row: Payment): string {
  const nickname = row.userName || '';
  return getLastTextChar(nickname, '用');
}

function getPaymentAvatarColor(row: Payment): string {
  return getAvatarColorByUserId(String((row as any).userId?._id || (row as any).userId || ''));
}
</script>

<style scoped>
.dashboard-container {
  width: min(100%, 1380px);
  margin: 0 auto;
  padding: 28px;
}

.dashboard-alert {
  margin-bottom: 16px;
  padding: 12px 14px;
  color: var(--admin-danger);
  background: rgba(185, 76, 67, 0.08);
  border: 1px solid rgba(185, 76, 67, 0.16);
  border-radius: 12px;
  font-size: 13px;
  font-weight: 500;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 18px;
  margin-bottom: 24px;
}

.stat-card {
  min-height: 150px;
  position: relative;
  display: block;
  text-align: left;
  border: 1px solid var(--admin-border);
  border-radius: 16px;
  background:
    linear-gradient(145deg, rgba(255, 255, 255, 0.96), rgba(250, 249, 244, 0.92)),
    var(--admin-surface);
  box-shadow: var(--admin-shadow-sm);
  padding: 20px;
  color: var(--admin-ink);
  cursor: pointer;
  transition:
    transform 0.2s ease,
    box-shadow 0.2s ease,
    border-color 0.2s ease;
}

.stat-card.urgent {
  border-color: rgba(183, 121, 31, 0.38);
  background:
    linear-gradient(145deg, rgba(255, 255, 255, 0.96), rgba(255, 249, 235, 0.96)),
    var(--admin-surface);
}

.stat-card:hover {
  transform: translateY(-3px);
  border-color: var(--admin-primary-alpha-24);
  box-shadow: var(--admin-shadow-md);
}

.stat-card:active {
  transform: translateY(-1px) scale(0.99);
}

.stats-grid.is-loading .stat-card {
  pointer-events: none;
}

.stat-icon {
  position: absolute;
  top: 20px;
  right: 20px;
  width: 42px;
  height: 42px;
  display: grid;
  place-items: center;
  border-radius: 12px;
  color: var(--admin-primary-dark);
  background: var(--admin-primary-soft);
}

.stat-icon.warning {
  color: #8a5f18;
  background: rgba(183, 121, 31, 0.13);
}

.stat-icon.success {
  color: var(--admin-success);
  background: rgba(79, 122, 69, 0.13);
}

.stat-label {
  display: block;
  padding-right: 54px;
  color: var(--admin-ink-muted);
  font-size: 13px;
  font-weight: 600;
  line-height: 1.25;
}

.stat-value {
  display: block;
  margin-top: 24px;
  font-family: var(--admin-font-number);
  font-size: 34px;
  font-weight: 600;
  line-height: 1.05;
  color: var(--admin-ink);
  letter-spacing: 0;
}

.stat-hint {
  display: block;
  margin-top: 18px;
  color: var(--admin-ink-muted);
  font-size: 12px;
  font-weight: 500;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
}

.title {
  font-weight: 600;
  font-size: 16px;
  color: var(--admin-ink);
}

.card-note {
  color: var(--admin-ink-muted);
  font-size: 12px;
}

.todo-card {
  margin-bottom: 24px;
}

.todo-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
  gap: 16px;
}

.todo-item {
  display: flex;
  justify-content: space-between;
  gap: 16px;
  align-items: center;
  width: 100%;
  text-align: left;
  padding: 18px;
  border: 1px solid var(--admin-border);
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.62);
  color: inherit;
  cursor: pointer;
  transition:
    transform 0.18s ease,
    background-color 0.18s ease,
    border-color 0.18s ease;
}

.todo-item:hover {
  border-color: var(--admin-primary-alpha-24);
  background: var(--admin-primary-soft);
  transform: translateY(-2px);
}

.todo-title {
  font-weight: 600;
  color: var(--admin-ink);
}

.todo-desc {
  margin-top: 6px;
  color: var(--admin-ink-muted);
  font-size: 13px;
  line-height: 1.45;
}

.activity-grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 24px;
}

.activity-card :deep(.el-card__body) {
  min-height: 238px;
}

.person-cell {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
  color: var(--admin-ink);
  font-weight: 500;
}

.user-avatar {
  flex-shrink: 0;
  font-size: 14px;
  color: #fff;
  font-weight: 600;
  border-radius: 10px !important;
}

.todo-count {
  min-width: 48px;
  text-align: right;
  font-size: 20px;
  font-family: var(--admin-font-number);
  font-weight: 600;
  color: var(--admin-primary);
}

.order-no,
.money {
  font-family: var(--admin-font-number);
  font-weight: 600;
  color: var(--admin-ink);
}

@media (min-width: 1280px) {
  .stats-grid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}

@media (max-width: 1120px) {
  .stats-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 860px) {
  .dashboard-container {
    padding: 18px;
  }

  .stats-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 560px) {
  .stats-grid {
    grid-template-columns: 1fr;
  }

  .card-header {
    align-items: flex-start;
    flex-direction: column;
  }
}
</style>
