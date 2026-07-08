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
          <el-select
            v-model="filters.periodId"
            placeholder="选择期次"
            clearable
            filterable
            style="width: 200px; margin-left: 10px"
            @change="handleSearch"
          >
            <el-option
              v-for="period in periodOptions"
              :key="period._id"
              :label="period.name || period.title"
              :value="period._id"
            />
          </el-select>
          <el-button type="primary" style="margin-left: 10px" @click="handleSearch">
            搜索
          </el-button>
          <el-button
            type="success"
            style="margin-left: 10px"
            :loading="syncingNicknames"
            @click="handleSyncNicknames"
          >
            🔄 同步报名名称到昵称
          </el-button>
        </div>

        <!-- 批量操作工具栏 -->
        <div v-if="selectedEnrollments.length > 0" class="batch-operation-bar">
          <span class="selected-count">已选中 {{ selectedEnrollments.length }} 条记录</span>
          <div class="batch-actions">
            <el-button type="danger" size="small" @click="batchDelete"> 🗑️ 批量删除 </el-button>
            <el-button type="info" text size="small" @click="clearSelection"> 清除选择 </el-button>
          </div>
        </div>
      </el-card>

      <el-tabs v-model="activeTab" class="enrollment-tabs" @tab-change="handleTabChange">
        <el-tab-pane label="报名管理" name="list">
          <!-- 报名列表 -->
          <el-card>
        <template #header>
          <div class="card-header">
            <span style="font-weight: 600">报名管理</span>
            <div>
              <el-tag>总数: {{ pagination.total }}</el-tag>
            </div>
          </div>
        </template>

        <el-table
          ref="tableRef"
          v-loading="loading"
          :data="enrollments"
          stripe
          style="width: 100%"
          @selection-change="handleSelectionChange"
        >
          <el-table-column type="selection" width="45" />
          <el-table-column label="头像" width="70" align="center">
            <template #default="{ row }">
              <el-avatar
                :src="getEnrollmentUserAvatarUrl(row)"
                :size="36"
                class="user-avatar"
                :style="{ background: getEnrollmentUserAvatarColor(row) }"
              >
                {{ getEnrollmentUserAvatarText(row) }}
              </el-avatar>
            </template>
          </el-table-column>
          <el-table-column label="昵称" width="100" show-overflow-tooltip>
            <template #default="{ row }">
              {{ (row.userId && row.userId.nickname && row.userId.nickname.trim()) ? row.userId.nickname : '-' }}
            </template>
          </el-table-column>
          <el-table-column label="报名名称" width="100" show-overflow-tooltip>
            <template #default="{ row }">{{ (row.name && row.name.trim()) ? row.name : '-' }}</template>
          </el-table-column>
          <el-table-column label="省份" width="70">
            <template #default="{ row }">{{ row.province || '-' }}</template>
          </el-table-column>
          <el-table-column label="年龄" width="60">
            <template #default="{ row }">{{ row.age || '-' }}</template>
          </el-table-column>
          <el-table-column label="期次" width="110" show-overflow-tooltip>
            <template #default="{ row }">
              {{ row.periodId?.name || '未知' }}
            </template>
          </el-table-column>
          <el-table-column label="支付状态" width="85" align="center">
            <template #default="{ row }">
              <el-tag :type="getPaymentType(row.paymentStatus)" size="small">
                {{ formatPaymentStatus(row.paymentStatus) }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column label="报名时间" width="145">
            <template #default="{ row }">
              {{ formatDate(row.enrolledAt) }}
            </template>
          </el-table-column>
          <el-table-column label="操作" min-width="230">
            <template #default="{ row }">
              <el-button type="primary" text size="small" @click="showDetailDialog(row)">
                详情
              </el-button>
              <el-button
                v-if="row.paymentStatus === 'pending'"
                type="success"
                text
                size="small"
                @click="handleMarkAsFree(row)"
              >
                💳 免费
              </el-button>
              <el-button type="danger" text size="small" @click="handleDelete(row)">
                删除
              </el-button>
            </template>
          </el-table-column>
        </el-table>

        <!-- 分页 -->
        <div class="pagination">
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
        </el-tab-pane>

        <el-tab-pane label="报名信息统计" name="statistics">
          <el-card class="statistics-card">
            <template #header>
              <div class="card-header">
                <span style="font-weight: 600">报名信息统计</span>
                <el-tag v-if="statisticsData.summary">样本: {{ statisticsData.summary.total || 0 }}</el-tag>
              </div>
            </template>

            <div class="statistics-toolbar">
              <el-select
                v-model="statisticsFilters.periodId"
                placeholder="选择期次后查看统计"
                filterable
                style="width: 280px"
                @change="loadFormStatistics"
              >
                <el-option
                  v-for="period in periodOptions"
                  :key="period._id"
                  :label="period.name || period.title"
                  :value="period._id"
                />
              </el-select>
              <el-button
                type="primary"
                :loading="statisticsLoading"
                :disabled="!statisticsFilters.periodId"
                @click="loadFormStatistics"
              >
                刷新统计
              </el-button>
            </div>

            <el-empty
              v-if="!statisticsFilters.periodId"
              description="请选择一个期次查看报名信息统计"
              :image-size="96"
            />

            <div v-else v-loading="statisticsLoading" class="statistics-content">
              <div class="metric-grid">
                <div class="metric-item">
                  <span class="metric-label">报名总数</span>
                  <strong>{{ statisticsData.summary?.total || 0 }}</strong>
                </div>
                <div class="metric-item">
                  <span class="metric-label">已支付/免费</span>
                  <strong>{{ statisticsData.summary?.paidLikeCount || 0 }}</strong>
                </div>
                <div class="metric-item">
                  <span class="metric-label">平均年龄</span>
                  <strong>{{ statisticsData.summary?.averageAge || '-' }}</strong>
                </div>
                <div class="metric-item">
                  <span class="metric-label">有推荐人</span>
                  <strong>{{ statisticsData.summary?.withReferrerCount || 0 }}</strong>
                </div>
              </div>

              <div class="analysis-grid">
                <div class="analysis-panel">
                  <h3>性别分布</h3>
                  <div v-for="item in statisticsData.gender?.items || []" :key="item.key" class="distribution-row">
                    <span>{{ item.label }}</span>
                    <strong>{{ item.count }}人</strong>
                    <small>{{ item.names.join('、') || '-' }}</small>
                  </div>
                </div>
                <div class="analysis-panel">
                  <h3>年龄分布</h3>
                  <div v-for="item in statisticsData.ageGroups?.items || []" :key="item.key" class="distribution-row">
                    <span>{{ item.label }}</span>
                    <strong>{{ item.count }}人</strong>
                    <small>{{ item.names.join('、') || '-' }}</small>
                  </div>
                </div>
                <div class="analysis-panel">
                  <h3>地区分布</h3>
                  <div v-for="item in statisticsData.provinces?.items || []" :key="item.key" class="distribution-row">
                    <span>{{ item.label }}</span>
                    <strong>{{ item.count }}人</strong>
                    <small>{{ item.names.join('、') || '-' }}</small>
                  </div>
                </div>
                <div class="analysis-panel">
                  <h3>阅读经历</h3>
                  <div v-for="item in statisticsData.hasReadBook?.items || []" :key="item.key" class="distribution-row">
                    <span>{{ item.label }}</span>
                    <strong>{{ item.count }}人</strong>
                    <small>{{ item.names.join('、') || '-' }}</small>
                  </div>
                </div>
                <div class="analysis-panel">
                  <h3>承诺全程</h3>
                  <div v-for="item in statisticsData.commitment?.items || []" :key="item.key" class="distribution-row">
                    <span>{{ item.label }}</span>
                    <strong>{{ item.count }}人</strong>
                    <small>{{ item.names.join('、') || '-' }}</small>
                  </div>
                </div>
                <div class="analysis-panel">
                  <h3>支付状态</h3>
                  <div v-for="item in statisticsData.paymentStatus?.items || []" :key="item.key" class="distribution-row">
                    <span>{{ item.label }}</span>
                    <strong>{{ item.count }}人</strong>
                    <small>{{ item.names.join('、') || '-' }}</small>
                  </div>
                </div>
              </div>

              <div class="text-analysis-grid">
                <div class="analysis-panel text-panel">
                  <h3>缘起分析</h3>
                  <div class="keyword-list">
                    <el-tag
                      v-for="item in statisticsData.textAnalysis?.enrollReason?.keywords || []"
                      :key="item.word"
                      size="small"
                      effect="plain"
                    >
                      {{ item.word }} {{ item.count }}
                    </el-tag>
                  </div>
                  <div class="sample-list">
                    <p v-for="item in statisticsData.textAnalysis?.enrollReason?.samples || []" :key="item.name + item.text">
                      <strong>{{ item.name }}：</strong>{{ item.text }}
                    </p>
                  </div>
                </div>
                <div class="analysis-panel text-panel">
                  <h3>期待分析</h3>
                  <div class="keyword-list">
                    <el-tag
                      v-for="item in statisticsData.textAnalysis?.expectation?.keywords || []"
                      :key="item.word"
                      size="small"
                      effect="plain"
                    >
                      {{ item.word }} {{ item.count }}
                    </el-tag>
                  </div>
                  <div class="sample-list">
                    <p v-for="item in statisticsData.textAnalysis?.expectation?.samples || []" :key="item.name + item.text">
                      <strong>{{ item.name }}：</strong>{{ item.text }}
                    </p>
                  </div>
                </div>
              </div>

              <div class="details-section">
                <div class="section-title">报名填写明细</div>
                <el-table :data="statisticsData.details || []" border stripe style="width: 100%">
                  <el-table-column label="姓名" prop="name" width="100" fixed />
                  <el-table-column label="昵称" width="100">
                    <template #default="{ row }">{{ row.user?.nickname || '-' }}</template>
                  </el-table-column>
                  <el-table-column label="性别" prop="genderLabel" width="90" />
                  <el-table-column label="年龄" prop="age" width="80" />
                  <el-table-column label="地区" prop="province" width="100" />
                  <el-table-column label="读过" prop="hasReadBookLabel" width="90" />
                  <el-table-column label="遍数" prop="readTimes" width="80" />
                  <el-table-column label="承诺" prop="commitmentLabel" width="90" />
                  <el-table-column label="推荐人" prop="referrer" width="120" show-overflow-tooltip />
                  <el-table-column label="缘起" prop="enrollReason" min-width="220" show-overflow-tooltip />
                  <el-table-column label="期待" prop="expectation" min-width="220" show-overflow-tooltip />
                  <el-table-column label="支付" prop="paymentStatusLabel" width="100" />
                  <el-table-column label="报名时间" width="150">
                    <template #default="{ row }">{{ formatDate(row.enrolledAt) }}</template>
                  </el-table-column>
                </el-table>
              </div>
            </div>
          </el-card>
        </el-tab-pane>
      </el-tabs>

      <!-- 详情对话框 -->
      <el-dialog v-model="dialogs.detailVisible" title="报名详情" width="600px" @close="resetForm">
        <el-form v-if="currentEnrollment" label-width="100px">
          <el-form-item label="ID">
            <el-text copyable>{{
              typeof currentEnrollment.userId === 'object'
                ? currentEnrollment.userId._id
                : currentEnrollment.userId
            }}</el-text>
          </el-form-item>
          <el-form-item label="昵称">
            <el-text>{{
              typeof currentEnrollment.userId === 'object' ? currentEnrollment.userId.nickname : '-'
            }}</el-text>
          </el-form-item>
          <el-form-item label="报名名称">
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
// @ts-nocheck
import { ref, onMounted } from 'vue';
import AdminLayout from '../components/AdminLayout.vue';
import { enrollmentApi, periodApi } from '../services/api';
import { ElMessage, ElMessageBox } from 'element-plus';
import type { ListResponse, Enrollment } from '../types/api';
import {
  getAvatarColorByUserId,
  getLastTextChar,
  getUserAvatarUrl
} from '../utils/avatar';

const loading = ref(false);
const syncingNicknames = ref(false);
const activeTab = ref('list');
const statisticsLoading = ref(false);

const filters = ref({
  search: '',
  paymentStatus: '',
  periodId: ''
});

const periodOptions = ref<any[]>([]);
const statisticsFilters = ref({
  periodId: ''
});
const statisticsData = ref<any>({
  summary: null,
  gender: { items: [] },
  ageGroups: { items: [] },
  provinces: { items: [] },
  hasReadBook: { items: [] },
  commitment: { items: [] },
  paymentStatus: { items: [] },
  referrers: { items: [] },
  textAnalysis: {
    enrollReason: { keywords: [], samples: [] },
    expectation: { keywords: [], samples: [] }
  },
  details: []
});

const pagination = ref({
  page: 1,
  limit: 20,
  total: 0
});

const enrollments = ref<Enrollment[]>([]);
const currentEnrollment = ref<Enrollment | null>(null);
const currentForm = ref({
  notes: ''
});
const selectedEnrollments = ref<Enrollment[]>([]);
const tableRef = ref();

const dialogs = ref({
  detailVisible: false
});

onMounted(() => {
  loadEnrollments();
  loadPeriods();
});

async function loadPeriods() {
  try {
    const response: any = await periodApi.getPeriods({ page: 1, limit: 100 });
    periodOptions.value = response.list || response.data || [];
  } catch (err) {
    console.error('加载期次列表失败', err);
  }
}

async function loadEnrollments() {
  loading.value = true;
  try {
    const params: any = {
      page: pagination.value.page,
      limit: pagination.value.limit
    };
    if (filters.value.search) params.search = filters.value.search;
    if (filters.value.paymentStatus) params.paymentStatus = filters.value.paymentStatus;
    if (filters.value.periodId) params.periodId = filters.value.periodId;

    const response = (await enrollmentApi.getEnrollments(
      params
    )) as unknown as ListResponse<Enrollment>;
    enrollments.value = response.list || [];
    pagination.value.total = response.total || response.pagination?.total || 0;
  } catch (err: any) {
    ElMessage.error('加载报名列表失败');
    console.error(err);
  } finally {
    loading.value = false;
  }
}

function handleSearch() {
  pagination.value.page = 1;
  loadEnrollments();
}

function handleTabChange(tabName: string) {
  if (tabName !== 'statistics') return;
  if (!statisticsFilters.value.periodId && filters.value.periodId) {
    statisticsFilters.value.periodId = filters.value.periodId;
  }
  if (statisticsFilters.value.periodId) {
    loadFormStatistics();
  }
}

async function loadFormStatistics() {
  if (!statisticsFilters.value.periodId) return;

  statisticsLoading.value = true;
  try {
    const response: any = await enrollmentApi.getFormStatistics({
      periodId: statisticsFilters.value.periodId
    });
    statisticsData.value = {
      ...statisticsData.value,
      ...response
    };
  } catch (err) {
    ElMessage.error('加载报名信息统计失败');
    console.error(err);
  } finally {
    statisticsLoading.value = false;
  }
}

async function handleSyncNicknames() {
  try {
    await ElMessageBox.confirm(
      '将扫描所有昵称为「微信用户」等默认值的用户，使用其报名名称更新昵称。确定继续吗？',
      '同步报名名称到昵称',
      {
        confirmButtonText: '开始同步',
        cancelButtonText: '取消',
        type: 'info'
      }
    );

    syncingNicknames.value = true;
    const result: any = await enrollmentApi.syncNicknamesFromEnrollments();
    const updated = result?.updatedCount ?? 0;
    const candidates = result?.candidateCount ?? 0;
    const skipped = result?.skippedNoName ?? 0;
    ElMessage.success(
      `同步完成：扫描 ${candidates} 个用户，更新 ${updated} 个昵称，跳过 ${skipped} 个无报名名称的用户`
    );
    loadEnrollments();
  } catch (err: any) {
    if (err === 'cancel') return;
    ElMessage.error(err?.message || '同步失败');
    console.error(err);
  } finally {
    syncingNicknames.value = false;
  }
}

function showDetailDialog(enrollment: Enrollment) {
  currentEnrollment.value = enrollment;
  dialogs.value.detailVisible = true;
}

async function handleMarkAsFree(enrollment: Enrollment) {
  try {
    await ElMessageBox.confirm(`确定要将 ${enrollment.name} 的支付状态改为已支付吗？`, '确认', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'info'
    });

    // 更新支付状态为 'paid'
    await enrollmentApi.updateEnrollment(enrollment._id, {
      paymentStatus: 'paid',
      paymentMethod: 'free' // 标记为免费
    });
    ElMessage.success('已标记为免费');
    loadEnrollments();
  } catch (err) {
    if (err !== 'cancel') {
      ElMessage.error('操作失败');
    }
  }
}

async function handleDelete(enrollment: Enrollment) {
  try {
    await ElMessageBox.confirm(`确定要删除 ${enrollment.name} 的报名记录吗？`, '警告', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning'
    });

    await enrollmentApi.updateEnrollment(enrollment._id, { deleted: true });
    ElMessage.success('删除成功');
    loadEnrollments();
  } catch (err) {
    if (err !== 'cancel') {
      ElMessage.error('删除失败');
    }
  }
}

// 批量操作函数
function handleSelectionChange(selection: any[]) {
  selectedEnrollments.value = selection;
}

function clearSelection() {
  selectedEnrollments.value = [];
  tableRef.value?.clearSelection();
}

async function batchDelete() {
  if (selectedEnrollments.value.length === 0) {
    ElMessage.warning('请先选择要删除的报名');
    return;
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
    );

    loading.value = true;
    const ids = selectedEnrollments.value.map((e: any) => e._id);

    // 并行发送所有请求
    const promises = ids.map((id: string) => enrollmentApi.updateEnrollment(id, { deleted: true }));
    await Promise.all(promises);

    ElMessage.success(`成功删除 ${ids.length} 条报名`);
    clearSelection();
    loadEnrollments();
  } catch (err) {
    if (err !== 'cancel') {
      ElMessage.error('批量删除失败');
    }
  } finally {
    loading.value = false;
  }
}

function resetForm() {
  currentEnrollment.value = null;
  currentForm.value = { notes: '' };
}

function formatPaymentStatus(status: string): string {
  const statusMap: Record<string, string> = {
    pending: '待支付',
    paid: '已支付',
    refunded: '已退款',
    free: '免费'
  };
  return statusMap[status] || status;
}

function getPaymentType(status: string): string {
  const typeMap: Record<string, string> = {
    pending: 'warning',
    paid: 'success',
    refunded: 'info',
    free: 'success'
  };
  return typeMap[status] || 'info';
}

function formatDate(dateString: string): string {
  if (!dateString) return '-';
  const date = new Date(dateString);
  return date.toLocaleDateString('zh-CN') + ' ' + date.toLocaleTimeString('zh-CN').slice(0, 5);
}

function formatGender(gender: string): string {
  const genderMap: Record<string, string> = {
    male: '男',
    female: '女',
    prefer_not_to_say: '保密'
  };
  return genderMap[gender] || gender;
}

function getEnrollmentUser(enrollment: Enrollment): any {
  return enrollment.userId && typeof enrollment.userId === 'object' ? enrollment.userId : null;
}

function getEnrollmentUserAvatarUrl(enrollment: Enrollment): string {
  return getUserAvatarUrl(getEnrollmentUser(enrollment));
}

function getEnrollmentUserAvatarText(enrollment: Enrollment): string {
  const user = getEnrollmentUser(enrollment);
  const nickname = user?.nickname || enrollment.name || '';
  return getLastTextChar(nickname, '用');
}

function getEnrollmentUserAvatarColor(enrollment: Enrollment): string {
  const user = getEnrollmentUser(enrollment);
  return getAvatarColorByUserId(user?._id || user?.id || String(enrollment.userId || ''));
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

.user-avatar {
  color: #fff;
  font-weight: 600;
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

.pagination {
  display: flex;
  justify-content: flex-end;
  margin-top: 20px;
}

.enrollment-tabs {
  --el-tabs-header-height: 44px;
}

.statistics-card {
  min-height: 520px;
}

.statistics-toolbar {
  display: flex;
  gap: 12px;
  align-items: center;
  margin-bottom: 18px;
}

.statistics-content {
  min-height: 360px;
}

.metric-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(140px, 1fr));
  gap: 12px;
  margin-bottom: 18px;
}

.metric-item {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 16px;
  background: #f8fafc;
  border: 1px solid #e5e7eb;
  border-radius: 6px;
}

.metric-label {
  color: #6b7280;
  font-size: 13px;
}

.metric-item strong {
  color: #1f2937;
  font-size: 24px;
  line-height: 1;
}

.analysis-grid,
.text-analysis-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(220px, 1fr));
  gap: 14px;
  margin-bottom: 18px;
}

.text-analysis-grid {
  grid-template-columns: repeat(2, minmax(280px, 1fr));
}

.analysis-panel {
  padding: 16px;
  border: 1px solid #e5e7eb;
  border-radius: 6px;
  background: #fff;
}

.analysis-panel h3 {
  margin: 0 0 12px;
  color: #1f2937;
  font-size: 15px;
  font-weight: 600;
}

.distribution-row {
  display: grid;
  grid-template-columns: 76px 56px 1fr;
  gap: 8px;
  align-items: start;
  padding: 8px 0;
  border-top: 1px solid #f1f5f9;
  color: #374151;
  font-size: 13px;
}

.distribution-row:first-of-type {
  border-top: 0;
}

.distribution-row small {
  color: #6b7280;
  line-height: 1.5;
  word-break: break-word;
}

.keyword-list {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  min-height: 28px;
  margin-bottom: 12px;
}

.sample-list {
  max-height: 240px;
  overflow: auto;
}

.sample-list p {
  margin: 0;
  padding: 8px 0;
  border-top: 1px solid #f1f5f9;
  color: #374151;
  font-size: 13px;
  line-height: 1.6;
}

.details-section {
  margin-top: 20px;
}

.section-title {
  margin-bottom: 12px;
  color: #1f2937;
  font-weight: 600;
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
  .filter-panel,
  .statistics-toolbar {
    flex-wrap: wrap;
  }

  .metric-grid,
  .analysis-grid,
  .text-analysis-grid {
    grid-template-columns: 1fr;
  }

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
