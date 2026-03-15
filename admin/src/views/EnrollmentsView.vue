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
          <el-button type="primary" style="margin-left: 10px" @click="handleSearch">
            搜索
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
import { ref, onMounted, computed } from 'vue';
import AdminLayout from '../components/AdminLayout.vue';
import { enrollmentApi } from '../services/api';
import { ElMessage, ElMessageBox } from 'element-plus';
import type { ListResponse, Enrollment } from '../types/api';

const loading = ref(false);

const filters = ref({
  search: '',
  paymentStatus: ''
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
});

async function loadEnrollments() {
  loading.value = true;
  try {
    const params = {
      page: pagination.value.page,
      limit: pagination.value.limit,
      paymentStatus: filters.value.paymentStatus
    };

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

.pagination {
  display: flex;
  justify-content: flex-end;
  margin-top: 20px;
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
