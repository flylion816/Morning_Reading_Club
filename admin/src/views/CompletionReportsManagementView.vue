<template>
  <AdminLayout>
    <div class="completion-reports-container">
      <el-card class="filter-card">
        <div class="filter-panel">
          <el-select
            v-model="filters.periodId"
            placeholder="选择期次"
            clearable
            filterable
            style="width: 220px"
            @change="handleSearch"
          >
            <el-option
              v-for="period in periodOptions"
              :key="period._id"
              :label="period.name || period.title"
              :value="period._id"
            />
          </el-select>
          <el-input
            v-model="filters.search"
            placeholder="搜索成员姓名、昵称或手机号"
            clearable
            style="width: 260px"
            @keyup.enter="handleSearch"
            @clear="handleSearch"
          />
          <el-checkbox v-model="filters.onlyMissing" @change="handleSearch">
            只看未上传
          </el-checkbox>
          <el-button type="primary" @click="handleSearch">搜索</el-button>
          <el-button @click="resetFilters">重置</el-button>
        </div>
      </el-card>

      <el-card>
        <template #header>
          <div class="card-header">
            <span style="font-weight: 600">实录报告列表</span>
            <el-tag>总数: {{ pagination.total }}</el-tag>
          </div>
        </template>

        <el-table v-loading="loading" :data="reports" stripe style="width: 100%">
          <el-table-column label="成员" min-width="180" fixed="left">
            <template #default="{ row }">
              <div class="member-cell">
                <el-avatar
                  :src="getUserAvatar(row)"
                  :size="36"
                  :style="{ background: getAvatarColor(row) }"
                >
                  {{ getAvatarText(row) }}
                </el-avatar>
                <div class="member-info">
                  <div class="member-name">{{ getUserNickname(row) || '-' }}</div>
                  <div class="member-sub">报名：{{ row.name || '-' }}</div>
                </div>
              </div>
            </template>
          </el-table-column>

          <el-table-column label="手机号" width="130">
            <template #default="{ row }">{{ row.phone || '-' }}</template>
          </el-table-column>

          <el-table-column label="期次" min-width="150" show-overflow-tooltip>
            <template #default="{ row }">{{ getPeriodName(row) }}</template>
          </el-table-column>

          <el-table-column label="支付状态" width="100" align="center">
            <template #default="{ row }">
              <el-tag :type="getPaymentTagType(row.paymentStatus)" size="small">
                {{ formatPaymentStatus(row.paymentStatus) }}
              </el-tag>
            </template>
          </el-table-column>

          <el-table-column label="报告状态" width="110" align="center">
            <template #default="{ row }">
              <el-tag :type="hasReport(row) ? 'success' : 'info'" size="small">
                {{ hasReport(row) ? '已上传' : '未上传' }}
              </el-tag>
            </template>
          </el-table-column>

          <el-table-column label="文件名" min-width="220" show-overflow-tooltip>
            <template #default="{ row }">
              {{ getReportFileName(row) || '-' }}
            </template>
          </el-table-column>

          <el-table-column label="大小" width="100">
            <template #default="{ row }">
              {{ formatFileSize(row.completionReport?.fileSize) }}
            </template>
          </el-table-column>

          <el-table-column label="上传时间" width="165">
            <template #default="{ row }">
              {{ formatDate(row.completionReport?.uploadedAt) }}
            </template>
          </el-table-column>

          <el-table-column label="操作" width="300" fixed="right">
            <template #default="{ row }">
              <div class="action-buttons">
                <el-button
                  type="primary"
                  text
                  size="small"
                  :loading="uploadingEnrollmentId === row._id"
                  @click="triggerUpload(row)"
                >
                  {{ hasReport(row) ? '替换 PDF' : '上传 PDF' }}
                </el-button>
                <el-button
                  type="info"
                  text
                  size="small"
                  :disabled="!hasReport(row)"
                  @click="previewReport(row)"
                >
                  预览
                </el-button>
                <el-button
                  type="success"
                  text
                  size="small"
                  :disabled="!hasReport(row)"
                  @click="copyReportLink(row)"
                >
                  复制链接
                </el-button>
                <el-button
                  type="danger"
                  text
                  size="small"
                  :disabled="!hasReport(row)"
                  :loading="clearingEnrollmentId === row._id"
                  @click="clearReport(row)"
                >
                  清空
                </el-button>
              </div>
            </template>
          </el-table-column>
        </el-table>

        <div class="pagination">
          <el-pagination
            v-model:current-page="pagination.page"
            v-model:page-size="pagination.limit"
            :page-sizes="[10, 20, 50, 100]"
            :total="pagination.total"
            layout="total, sizes, prev, pager, next, jumper"
            @change="loadReports"
          />
        </div>
      </el-card>

      <input
        ref="fileInputRef"
        class="hidden-file-input"
        type="file"
        accept="application/pdf,.pdf"
        @change="handleFileSelected"
      />
    </div>
  </AdminLayout>
</template>

<script setup lang="ts">
// @ts-nocheck
import { onMounted, ref } from 'vue';
import AdminLayout from '../components/AdminLayout.vue';
import { completionReportApi, periodApi, uploadApi } from '../services/api';
import { ElMessage, ElMessageBox } from 'element-plus';
import {
  getAvatarColorByUserId,
  getLastTextChar,
  getUserAvatarUrl
} from '../utils/avatar';

type ReportRow = {
  _id: string;
  name?: string;
  phone?: string;
  paymentStatus?: string;
  period?: any;
  periodId?: any;
  user?: any;
  userId?: any;
  hasReport?: boolean;
  completionReport?: {
    fileUrl?: string;
    fileName?: string;
    originalName?: string;
    fileSize?: number;
    mimeType?: string;
    uploadedAt?: string;
  };
};

const loading = ref(false);
const periodOptions = ref<any[]>([]);
const reports = ref<ReportRow[]>([]);
const fileInputRef = ref<HTMLInputElement | null>(null);
const selectedRow = ref<ReportRow | null>(null);
const uploadingEnrollmentId = ref('');
const clearingEnrollmentId = ref('');

const filters = ref({
  periodId: '',
  search: '',
  onlyMissing: false
});

const pagination = ref({
  page: 1,
  limit: 20,
  total: 0
});

onMounted(() => {
  loadPeriods();
  loadReports();
});

async function loadPeriods() {
  try {
    const response: any = await periodApi.getPeriods({ page: 1, limit: 200 });
    periodOptions.value = response.list || response.data || [];
  } catch (err) {
    console.error('加载期次失败', err);
    ElMessage.error('加载期次失败');
  }
}

async function loadReports() {
  loading.value = true;
  try {
    const params: any = {
      page: pagination.value.page,
      limit: pagination.value.limit
    };
    if (filters.value.periodId) params.periodId = filters.value.periodId;
    if (filters.value.search.trim()) params.search = filters.value.search.trim();
    if (filters.value.onlyMissing) {
      params.onlyMissing = true;
      params.hasReport = false;
    }

    const response: any = await completionReportApi.getReports(params);
    let list = response.list || response.data || [];
    if (filters.value.onlyMissing && !response.onlyMissingApplied) {
      list = list.filter((item: ReportRow) => !hasReport(item));
    }
    reports.value = list;
    pagination.value.total = response.total || response.totalCount || list.length || 0;
  } catch (err: any) {
    console.error('加载实录报告列表失败', err);
    ElMessage.error(err?.message || '加载实录报告列表失败');
  } finally {
    loading.value = false;
  }
}

function handleSearch() {
  pagination.value.page = 1;
  loadReports();
}

function resetFilters() {
  filters.value.periodId = '';
  filters.value.search = '';
  filters.value.onlyMissing = false;
  handleSearch();
}

async function triggerUpload(row: ReportRow) {
  if (hasReport(row)) {
    try {
      await ElMessageBox.confirm(
        '替换后小程序将展示新的 PDF，确定替换吗？',
        '替换实录报告',
        {
          confirmButtonText: '确定替换',
          cancelButtonText: '取消',
          type: 'warning'
        }
      );
    } catch (err) {
      return;
    }
  }

  selectedRow.value = row;
  if (fileInputRef.value) {
    fileInputRef.value.value = '';
    fileInputRef.value.click();
  }
}

async function handleFileSelected(event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  const row = selectedRow.value;
  if (!file || !row) return;

  if (!isPdfFile(file)) {
    ElMessage.error('只能上传 PDF 文件');
    input.value = '';
    return;
  }

  uploadingEnrollmentId.value = row._id;
  try {
    const uploadResult: any = await uploadApi.uploadFile(file);
    const reportPayload = buildReportPayload(uploadResult, file);
    await completionReportApi.bindReport(row._id, reportPayload);
    ElMessage.success('实录报告已上传');
    await loadReports();
  } catch (err: any) {
    console.error('上传实录报告失败', err);
    ElMessage.error(err?.message || '上传实录报告失败');
  } finally {
    uploadingEnrollmentId.value = '';
    selectedRow.value = null;
    input.value = '';
  }
}

function isPdfFile(file: File) {
  const fileName = file.name || '';
  return file.type === 'application/pdf' || fileName.toLowerCase().endsWith('.pdf');
}

function buildReportPayload(uploadResult: any, file: File) {
  const data = uploadResult?.data || uploadResult || {};
  const fileUrl = data.fileUrl || data.url || data.path || data.location;
  const fileName = data.fileName || data.filename || file.name;
  const originalName = data.originalName || data.originalname || file.name;
  const fileSize = data.fileSize || data.size || file.size;
  const mimeType = data.mimeType || data.mimetype || file.type || 'application/pdf';

  if (!fileUrl) {
    throw new Error('上传成功但未返回文件地址');
  }

  return {
    fileUrl,
    fileName,
    originalName,
    fileSize,
    mimeType
  };
}

function previewReport(row: ReportRow) {
  const url = getAbsoluteFileUrl(row.completionReport?.fileUrl);
  if (!url) {
    ElMessage.warning('没有可预览的报告链接');
    return;
  }
  window.open(url, '_blank', 'noopener,noreferrer');
}

async function copyReportLink(row: ReportRow) {
  const url = getAbsoluteFileUrl(row.completionReport?.fileUrl);
  if (!url) {
    ElMessage.warning('没有可复制的报告链接');
    return;
  }

  try {
    await navigator.clipboard.writeText(url);
    ElMessage.success('链接已复制');
  } catch (err) {
    ElMessage.error('复制失败，请手动复制');
  }
}

async function clearReport(row: ReportRow) {
  try {
    await ElMessageBox.confirm(
      '清空后用户将看不到该实录报告，确定清空吗？',
      '清空实录报告',
      {
        confirmButtonText: '确定清空',
        cancelButtonText: '取消',
        type: 'warning'
      }
    );
  } catch (err) {
    return;
  }

  clearingEnrollmentId.value = row._id;
  try {
    await completionReportApi.clearReport(row._id);
    ElMessage.success('实录报告已清空');
    await loadReports();
  } catch (err: any) {
    console.error('清空实录报告失败', err);
    ElMessage.error(err?.message || '清空实录报告失败');
  } finally {
    clearingEnrollmentId.value = '';
  }
}

function hasReport(row: ReportRow) {
  return Boolean(row.hasReport || row.completionReport?.fileUrl);
}

function getReportFileName(row: ReportRow) {
  return row.completionReport?.originalName || row.completionReport?.fileName || '';
}

function getPeriodName(row: ReportRow) {
  const period = row.period || row.periodId;
  return period?.name || period?.title || '-';
}

function getUser(row: ReportRow) {
  return row.user || row.userId || {};
}

function getUserNickname(row: ReportRow) {
  const user = getUser(row);
  return user?.nickname || user?.name || '';
}

function getUserAvatar(row: ReportRow) {
  return getUserAvatarUrl(getUser(row));
}

function getAvatarText(row: ReportRow) {
  return getLastTextChar(getUserNickname(row) || row.name || '', '用');
}

function getAvatarColor(row: ReportRow) {
  const user = getUser(row);
  return getAvatarColorByUserId(user?._id || user?.id || row._id);
}

function getPaymentTagType(status?: string) {
  const typeMap: Record<string, string> = {
    paid: 'success',
    pending: 'warning',
    refunded: 'info',
    cancelled: 'danger',
    free: 'success'
  };
  return typeMap[status || ''] || 'info';
}

function formatPaymentStatus(status?: string) {
  const labels: Record<string, string> = {
    paid: '已支付',
    pending: '待支付',
    refunded: '已退款',
    cancelled: '已取消',
    free: '免费'
  };
  return labels[status || ''] || status || '-';
}

function formatFileSize(size?: number) {
  if (!size) return '-';
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / 1024 / 1024).toFixed(1)} MB`;
}

function formatDate(date?: string) {
  if (!date) return '-';
  return new Date(date).toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  });
}

function getAbsoluteFileUrl(fileUrl?: string) {
  if (!fileUrl) return '';
  if (/^https?:\/\//i.test(fileUrl)) return fileUrl;
  const backendHost =
    import.meta.env.VITE_BACKEND_URL ||
    (import.meta.env.DEV ? 'http://localhost:3000' : 'https://wx.shubai01.com');
  return `${backendHost}${fileUrl.startsWith('/') ? '' : '/'}${fileUrl}`;
}
</script>

<style scoped>
.completion-reports-container {
  padding: 24px;
}

.filter-card {
  margin-bottom: 20px;
}

.filter-panel {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  width: 100%;
}

.member-cell {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
}

.member-info {
  min-width: 0;
}

.member-name {
  color: #303133;
  font-weight: 600;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.member-sub {
  margin-top: 2px;
  color: #909399;
  font-size: 12px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.action-buttons {
  display: flex;
  align-items: center;
  gap: 4px;
  flex-wrap: wrap;
}

.pagination {
  display: flex;
  justify-content: flex-end;
  margin-top: 20px;
}

.hidden-file-input {
  display: none;
}

@media (max-width: 768px) {
  .completion-reports-container {
    padding: 16px;
  }

  .filter-panel {
    align-items: stretch;
  }
}
</style>
