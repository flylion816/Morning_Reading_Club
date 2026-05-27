<template>
  <AdminLayout>
    <div class="coupons-container">
      <!-- 操作栏 -->
      <el-card style="margin-bottom: 20px">
        <div class="action-bar">
          <el-button type="primary" @click="handleCreate">
            <span style="margin-right: 4px">➕</span>创建优惠券
          </el-button>
          <el-button style="margin-left: 12px" @click="loadCoupons">
            <span style="margin-right: 4px">🔄</span>刷新
          </el-button>
          <div class="filter-bar">
            <el-select
              v-model="filterActivityId"
              placeholder="筛选活动"
              clearable
              style="width: 200px; margin-left: 12px"
              @change="handleFilterChange"
            >
              <el-option label="全部活动" value="" />
              <el-option
                v-for="act in activityOptions"
                :key="act._id"
                :label="act.title"
                :value="act._id"
              />
            </el-select>
            <el-select
              v-model="filterStatus"
              placeholder="筛选状态"
              clearable
              style="width: 140px; margin-left: 12px"
              @change="handleFilterChange"
            >
              <el-option label="全部状态" value="" />
              <el-option label="可用" value="active" />
              <el-option label="已使用" value="used" />
              <el-option label="已过期" value="expired" />
            </el-select>
          </div>
        </div>
      </el-card>

      <!-- 优惠券列表 -->
      <el-card>
        <el-table v-loading="loading" :data="coupons" stripe style="width: 100%">
          <el-table-column prop="name" label="券名" min-width="160" />
          <el-table-column label="适用活动" min-width="160">
            <template #default="{ row }">
              <span v-if="row.activityId">
                {{ getActivityTitle(row.activityId) }}
              </span>
              <el-tag v-else type="info" size="small">全部付费活动</el-tag>
            </template>
          </el-table-column>
          <el-table-column label="折扣" width="140">
            <template #default="{ row }">
              <span v-if="row.discountType === 'fixed'">
                减¥{{ (row.discountValue / 100).toFixed(2) }}
              </span>
              <span v-else>
                {{ row.discountValue / 10 }}折
              </span>
            </template>
          </el-table-column>
          <el-table-column label="有效期" width="220">
            <template #default="{ row }">
              {{ formatDate(row.validFrom) }} ~ {{ formatDate(row.validUntil) }}
            </template>
          </el-table-column>
          <el-table-column label="发放用户" min-width="120">
            <template #default="{ row }">
              {{ getUserName(row.userId) }}
            </template>
          </el-table-column>
          <el-table-column label="状态" width="100">
            <template #default="{ row }">
              <el-tag :type="getStatusTagType(row.status)" size="small">
                {{ formatStatus(row.status) }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column label="操作" width="200" fixed="right">
            <template #default="{ row }">
              <div class="action-buttons">
                <el-button
                  type="primary"
                  text
                  size="small"
                  :disabled="row.status !== 'active'"
                  @click="handleEdit(row)"
                >编辑</el-button>
                <el-button
                  type="success"
                  text
                  size="small"
                  @click="handleCopy(row)"
                >复制</el-button>
                <el-button
                  type="danger"
                  text
                  size="small"
                  :disabled="row.status !== 'active'"
                  @click="handleDelete(row)"
                >删除</el-button>
              </div>
            </template>
          </el-table-column>
        </el-table>

        <!-- 分页 -->
        <div class="pagination">
          <el-pagination
            v-model:current-page="pagination.page"
            v-model:page-size="pagination.pageSize"
            :page-sizes="[10, 20, 50]"
            :total="pagination.total"
            layout="total, sizes, prev, pager, next, jumper"
            @current-change="loadCoupons"
            @size-change="handlePageSizeChange"
          />
        </div>
      </el-card>

      <!-- 创建/编辑弹窗 -->
      <el-dialog
        v-model="dialogVisible"
        :title="isEditMode ? '编辑优惠券' : '创建优惠券'"
        width="600px"
        @close="resetForm"
      >
        <el-form ref="formRef" :model="formData" :rules="formRules" label-width="110px">
          <el-form-item label="券名" prop="name">
            <el-input v-model="formData.name" placeholder="优惠券名称" clearable />
          </el-form-item>

          <el-form-item label="适用活动" prop="activityId">
            <el-select
              v-model="formData.activityId"
              placeholder="选择活动（不选则适用全部付费活动）"
              clearable
              style="width: 100%"
            >
              <el-option label="全部付费活动" :value="null" />
              <el-option
                v-for="act in activityOptions"
                :key="act._id"
                :label="act.title"
                :value="act._id"
              />
            </el-select>
          </el-form-item>

          <el-form-item label="折扣类型" prop="discountType">
            <el-radio-group v-model="formData.discountType">
              <el-radio value="fixed">固定减免</el-radio>
              <el-radio value="percent">折扣</el-radio>
            </el-radio-group>
          </el-form-item>

          <el-form-item label="折扣值" prop="discountValueInput">
            <template v-if="formData.discountType === 'fixed'">
              <el-input-number
                v-model="formData.discountValueInput"
                :min="0"
                :precision="2"
                :step="1"
                style="width: 200px"
              />
              <span style="margin-left: 8px; color: #909399;">元（减免金额）</span>
            </template>
            <template v-else>
              <el-input-number
                v-model="formData.discountValueInput"
                :min="1"
                :max="99"
                :precision="0"
                :step="5"
                style="width: 200px"
              />
              <span style="margin-left: 8px; color: #909399;">（如输入 80 = 8折）</span>
            </template>
          </el-form-item>

          <el-form-item label="有效期" prop="validRange">
            <el-date-picker
              v-model="formData.validRange"
              type="daterange"
              range-separator="~"
              start-placeholder="开始日期"
              end-placeholder="结束日期"
              style="width: 100%"
              value-format="YYYY-MM-DD"
            />
          </el-form-item>

          <el-form-item label="发放用户" prop="userIds">
            <el-select
              ref="userSelectRef"
              v-model="formData.userIds"
              multiple
              filterable
              remote
              reserve-keyword
              placeholder="搜索用户昵称"
              :remote-method="handleUserSearch"
              :loading="usersLoading"
              style="width: 100%"
              @change="handleUserSelectChange"
            >
              <el-option
                v-for="user in userOptions"
                :key="user._id"
                :label="user.nickname || user._id"
                :value="user._id"
              >
                <div class="user-option">
                  <el-avatar :src="user.avatarUrl" :size="28" class="user-option-avatar">
                    {{ (user.nickname || '?').charAt(0) }}
                  </el-avatar>
                  <span class="user-option-name">{{ user.nickname || '未知' }}</span>
                  <span class="user-option-id">{{ user._id }}</span>
                </div>
              </el-option>
            </el-select>
          </el-form-item>
        </el-form>

        <template #footer>
          <el-button @click="dialogVisible = false">取消</el-button>
          <el-button type="primary" :loading="submitting" @click="handleSubmit">
            {{ isEditMode ? '更新' : '创建' }}
          </el-button>
        </template>
      </el-dialog>
    </div>
  </AdminLayout>
</template>

<script setup lang="ts">
// @ts-nocheck
import { ref, reactive, onMounted } from 'vue';
import AdminLayout from '../components/AdminLayout.vue';
import { ElMessage, ElMessageBox, type FormInstance } from 'element-plus';
import { activityCouponService } from '../services/activityCoupon.service';
import apiClient, { userApi } from '../services/api';

const loading = ref(false);
const submitting = ref(false);
const usersLoading = ref(false);
const coupons = ref([]);
const activityOptions = ref([]);
const userOptions = ref([]);
const dialogVisible = ref(false);
const isEditMode = ref(false);
const currentEditId = ref<string | null>(null);
const formRef = ref<FormInstance>();
const userSelectRef = ref<any>();

const filterActivityId = ref('');
const filterStatus = ref('');

const pagination = ref({ page: 1, pageSize: 20, total: 0 });

const formData = reactive({
  name: '',
  activityId: null as string | null,
  discountType: 'fixed' as 'fixed' | 'percent',
  discountValueInput: 0,
  validRange: null as [string, string] | null,
  userIds: [] as string[]
});

const formRules = {
  name: [{ required: true, message: '券名不能为空', trigger: 'blur' }],
  discountType: [{ required: true, message: '请选择折扣类型', trigger: 'change' }],
  discountValueInput: [{ required: true, message: '请输入折扣值', trigger: 'blur' }],
  validRange: [{ required: true, message: '请选择有效期', trigger: 'change' }],
  userIds: [{ required: true, type: 'array', min: 1, message: '请选择至少一个用户', trigger: 'change' }]
};

onMounted(() => {
  loadCoupons();
  loadActivityOptions();
});

async function loadCoupons() {
  loading.value = true;
  try {
    const params: Record<string, unknown> = {
      page: pagination.value.page,
      pageSize: pagination.value.pageSize
    };
    if (filterActivityId.value) params.activityId = filterActivityId.value;
    if (filterStatus.value) params.status = filterStatus.value;
    const data = await activityCouponService.getList(params);
    coupons.value = data?.list ?? (Array.isArray(data) ? data : []);
    pagination.value.total = data?.total ?? 0;
  } catch (err: any) {
    ElMessage.error(err?.message || '加载优惠券列表失败');
  } finally {
    loading.value = false;
  }
}

async function loadActivityOptions() {
  try {
    const data = await apiClient.get('admin/community-activities', { params: { pageSize: 200 } });
    activityOptions.value = data?.list ?? (Array.isArray(data) ? data : []);
  } catch {
    // 静默失败，下拉为空
  }
}

let userSearchTimer: ReturnType<typeof setTimeout> | null = null;
async function handleUserSearch(query: string) {
  if (!query.trim()) {
    userOptions.value = [];
    return;
  }
  if (userSearchTimer) clearTimeout(userSearchTimer);
  userSearchTimer = setTimeout(async () => {
    usersLoading.value = true;
    try {
      const res = await userApi.adminSearch(query.trim()) as any;
      userOptions.value = res?.list || [];
    } catch {
      userOptions.value = [];
    } finally {
      usersLoading.value = false;
    }
  }, 300);
}

function handleUserSelectChange() {
  // Clear the search input text after a user is selected
  if (userSelectRef.value) {
    userSelectRef.value.query = '';
    userSelectRef.value.inputValue = '';
  }
}

function handleFilterChange() {
  pagination.value.page = 1;
  loadCoupons();
}

function handlePageSizeChange() {
  pagination.value.page = 1;
  loadCoupons();
}

function handleCreate() {
  isEditMode.value = false;
  currentEditId.value = null;
  resetForm();
  dialogVisible.value = true;
}

function handleCopy(row: any) {
  isEditMode.value = false;
  currentEditId.value = null;
  resetForm();
  formData.name = row.name ?? '';
  formData.activityId = row.activityId
    ? (typeof row.activityId === 'object' ? row.activityId._id : row.activityId)
    : null;
  formData.discountType = row.discountType ?? 'fixed';
  formData.discountValueInput = row.discountType === 'fixed'
    ? (row.discountValue / 100)
    : row.discountValue;
  formData.validRange = row.validFrom && row.validUntil
    ? [row.validFrom.substring(0, 10), row.validUntil.substring(0, 10)]
    : null;
  formData.userIds = [];
  userOptions.value = [];
  dialogVisible.value = true;
}

function handleEdit(row: any) {
  isEditMode.value = true;
  currentEditId.value = row._id;
  formData.name = row.name ?? '';
  formData.activityId = row.activityId
    ? (typeof row.activityId === 'object' ? row.activityId._id : row.activityId)
    : null;
  formData.discountType = row.discountType ?? 'fixed';
  formData.discountValueInput = row.discountType === 'fixed'
    ? (row.discountValue / 100)
    : row.discountValue;
  formData.validRange = row.validFrom && row.validUntil
    ? [row.validFrom.substring(0, 10), row.validUntil.substring(0, 10)]
    : null;
  const uid = row.userId
    ? (typeof row.userId === 'object' ? row.userId._id : row.userId)
    : null;
  formData.userIds = uid ? [uid] : [];
  // 预填 userOptions 以便已选用户名称正常显示
  if (row.userId && typeof row.userId === 'object') {
    userOptions.value = [row.userId];
  } else if (uid) {
    userOptions.value = [{ _id: uid, nickname: uid }];
  }
  dialogVisible.value = true;
}

async function handleSubmit() {
  if (!formRef.value) return;
  await formRef.value.validate(async (valid) => {
    if (!valid) return;
    submitting.value = true;
    try {
      const discountValue = formData.discountType === 'fixed'
        ? Math.round(formData.discountValueInput * 100)
        : formData.discountValueInput;
      const payload: Record<string, unknown> = {
        name: formData.name,
        activityId: formData.activityId || undefined,
        discountType: formData.discountType,
        discountValue,
        validFrom: formData.validRange ? formData.validRange[0] : '',
        validUntil: formData.validRange ? formData.validRange[1] : '',
        userIds: formData.userIds
      };
      if (isEditMode.value && currentEditId.value) {
        await activityCouponService.update(currentEditId.value, payload);
        ElMessage.success('优惠券更新成功');
      } else {
        await activityCouponService.create(payload);
        ElMessage.success('优惠券创建成功');
      }
      dialogVisible.value = false;
      await loadCoupons();
    } catch (err: any) {
      ElMessage.error(err?.message || '操作失败');
    } finally {
      submitting.value = false;
    }
  });
}

function handleDelete(row: any) {
  ElMessageBox.confirm('删除后无法恢复，确定要删除该优惠券吗？', '警告', {
    confirmButtonText: '确定',
    cancelButtonText: '取消',
    type: 'warning'
  }).then(async () => {
    try {
      await activityCouponService.remove(row._id);
      ElMessage.success('优惠券删除成功');
      await loadCoupons();
    } catch (err: any) {
      ElMessage.error(err?.message || '删除失败');
    }
  }).catch(() => {});
}

function resetForm() {
  formData.name = '';
  formData.activityId = null;
  formData.discountType = 'fixed';
  formData.discountValueInput = 0;
  formData.validRange = null;
  formData.userIds = [];
  formRef.value?.clearValidate();
}

function getActivityTitle(activityId: any): string {
  if (!activityId) return '-';
  const id = typeof activityId === 'object' ? activityId._id : activityId;
  const found = activityOptions.value.find((a: any) => a._id === id);
  return found?.title || id;
}

function getUserName(userId: any): string {
  if (!userId) return '-';
  if (typeof userId === 'object') return userId.nickname || userId._id;
  const found = userOptions.value.find((u: any) => u._id === userId);
  return found?.nickname || userId;
}

function formatStatus(status: string): string {
  const map: Record<string, string> = { active: '可用', used: '已使用', expired: '已过期' };
  return map[status] || status;
}

function getStatusTagType(status: string): string {
  const map: Record<string, string> = { active: 'success', used: 'info', expired: 'danger' };
  return map[status] || 'info';
}

function formatDate(val: string): string {
  if (!val) return '-';
  return val.substring(0, 10);
}
</script>

<style scoped>
.coupons-container {
  padding: 24px;
}

.action-bar {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0;
}

.filter-bar {
  display: flex;
  align-items: center;
}

.pagination {
  display: flex;
  justify-content: flex-end;
  margin-top: 20px;
}

:deep(.el-table__row) {
  height: 60px;
}

.action-buttons {
  display: flex;
  gap: 8px;
  flex-wrap: nowrap;
  align-items: center;
}

.user-option {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 2px 0;
}

.user-option-avatar {
  flex-shrink: 0;
  background: #dbeafe;
  color: #3b82f6;
  font-size: 12px;
}

.user-option-name {
  font-weight: 500;
  color: #111827;
}

.user-option-id {
  font-size: 11px;
  color: #9ca3af;
  font-family: monospace;
  margin-left: auto;
}
</style>
