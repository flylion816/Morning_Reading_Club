<template>
  <div class="account-management">
    <!-- Top Summary Cards -->
    <el-row :gutter="20" class="summary-cards" v-loading="loadingSummary">
      <el-col :span="6">
        <el-card shadow="hover" class="stat-card">
          <div class="stat-content">
            <div class="stat-label">总账号数</div>
            <div class="stat-value">{{ summary.total }}</div>
          </div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card shadow="hover" class="stat-card">
          <div class="stat-content">
            <div class="stat-label">启用状态</div>
            <div class="stat-value active">{{ summary.active }}</div>
          </div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card shadow="hover" class="stat-card">
          <div class="stat-content">
            <div class="stat-label">禁用状态</div>
            <div class="stat-value inactive">{{ summary.inactive }}</div>
          </div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card shadow="hover" class="stat-card">
          <div class="stat-content">
            <div class="stat-label">超级管理员</div>
            <div class="stat-value superadmin">{{ summary.superadmins }}</div>
          </div>
        </el-card>
      </el-col>
    </el-row>

    <!-- Filter and Actions -->
    <div class="filter-actions-bar">
      <div class="filters">
        <el-input 
          v-model="filter.keyword" 
          placeholder="搜索姓名/邮箱" 
          clearable 
          style="width: 200px" 
          @clear="loadAdmins" 
          @keyup.enter="loadAdmins" 
        >
          <template #prefix>
            <el-icon><Search /></el-icon>
          </template>
        </el-input>
        <el-select v-model="filter.role" placeholder="角色" clearable style="width: 150px" @change="loadAdmins">
          <el-option label="全部" value="" />
          <el-option label="超级管理员" value="superadmin" />
          <el-option label="管理员" value="admin" />
          <el-option label="操作员" value="operator" />
        </el-select>
        <el-select v-model="filter.status" placeholder="状态" clearable style="width: 120px" @change="loadAdmins">
          <el-option label="全部" value="" />
          <el-option label="启用" value="active" />
          <el-option label="禁用" value="inactive" />
        </el-select>
        <el-button type="primary" @click="loadAdmins">搜索</el-button>
      </div>
      <div class="actions">
        <el-button type="success" @click="openCreateDialog" v-if="isSuperadmin">
          <el-icon><Plus /></el-icon> 新建账号
        </el-button>
      </div>
    </div>

    <!-- Data Table -->
    <el-table :data="admins" v-loading="loading" border style="width: 100%" class="admin-table">
      <el-table-column label="账号信息" min-width="250">
        <template #default="{ row }">
          <div class="user-info">
            <el-avatar :src="row.avatar" :size="40" class="mr-3">{{ row.name?.charAt(0) || 'U' }}</el-avatar>
            <div class="user-details">
              <div class="user-name">{{ row.name }} <el-tag size="small" type="info" v-if="row._id === currentUserId">当前账号</el-tag></div>
              <div class="user-email">{{ row.email }}</div>
            </div>
          </div>
        </template>
      </el-table-column>
      <el-table-column prop="role" label="角色" width="120">
        <template #default="{ row }">
          <el-tag :type="getRoleType(row.role)">{{ getRoleName(row.role) }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column label="状态" width="100">
        <template #default="{ row }">
          <el-tag :type="row.status === 'active' ? 'success' : 'danger'">
            {{ row.status === 'active' ? '启用' : '禁用' }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column label="登录次数" prop="loginCount" width="100" align="center" />
      <el-table-column label="最后登录" width="180">
        <template #default="{ row }">
          <span class="time-text">{{ formatDate(row.lastLoginAt) || '从未登录' }}</span>
        </template>
      </el-table-column>
      <el-table-column label="创建时间" width="180">
        <template #default="{ row }">
          <span class="time-text">{{ formatDate(row.createdAt) }}</span>
        </template>
      </el-table-column>
      <el-table-column label="操作" width="280" fixed="right" v-if="isSuperadmin">
        <template #default="{ row }">
          <el-button type="primary" link size="small" @click="openEditDialog(row)">编辑</el-button>
          <el-button type="warning" link size="small" @click="openResetPasswordDialog(row)">重置密码</el-button>
          
          <el-popconfirm
            v-if="row._id !== currentUserId"
            :title="row.status === 'active' ? '确定禁用此账号吗？禁用后该账号将无法登录。' : '确定启用此账号吗？'"
            @confirm="toggleStatus(row)"
          >
            <template #reference>
              <el-button :type="row.status === 'active' ? 'danger' : 'success'" link size="small">
                {{ row.status === 'active' ? '禁用' : '启用' }}
              </el-button>
            </template>
          </el-popconfirm>

          <el-popconfirm
            v-if="row._id !== currentUserId"
            title="警告：删除为高危操作，建议优先考虑禁用。确定要永久删除吗？"
            confirm-button-text="确定删除"
            confirm-button-type="danger"
            @confirm="deleteAdmin(row)"
          >
            <template #reference>
              <el-button type="danger" link size="small">删除</el-button>
            </template>
          </el-popconfirm>
        </template>
      </el-table-column>
    </el-table>

    <!-- Pagination -->
    <div class="pagination-container">
      <el-pagination
        v-model:current-page="pagination.page"
        v-model:page-size="pagination.limit"
        :total="pagination.total"
        :page-sizes="[10, 20, 50, 100]"
        layout="total, sizes, prev, pager, next, jumper"
        @size-change="handleSizeChange"
        @current-change="handleCurrentChange"
      />
    </div>

    <!-- Create/Edit Dialog -->
    <el-dialog :title="dialogType === 'create' ? '新建账号' : '编辑账号'" v-model="dialogVisible" width="500px">
      <el-form :model="formData" :rules="formRules" ref="formRef" label-width="100px">
        <el-form-item label="姓名" prop="name">
          <el-input v-model="formData.name" placeholder="请输入姓名" />
        </el-form-item>
        <el-form-item label="邮箱" prop="email">
          <el-input v-model="formData.email" placeholder="请输入邮箱 (作为登录名)" :disabled="dialogType === 'edit'" />
        </el-form-item>
        <el-form-item label="初始密码" prop="password" v-if="dialogType === 'create'">
          <el-input v-model="formData.password" placeholder="请输入初始密码 (不少于6位)" show-password />
        </el-form-item>
        <el-form-item label="角色" prop="role">
          <el-select v-model="formData.role" style="width: 100%">
            <el-option label="超级管理员" value="superadmin" />
            <el-option label="管理员" value="admin" />
            <el-option label="操作员" value="operator" />
          </el-select>
        </el-form-item>
        <el-form-item label="状态" prop="status" v-if="dialogType === 'edit'">
          <el-radio-group v-model="formData.status" :disabled="formData._id === currentUserId">
            <el-radio label="active">启用</el-radio>
            <el-radio label="inactive">禁用</el-radio>
          </el-radio-group>
        </el-form-item>
        <el-form-item label="头像URL" prop="avatar">
          <el-input v-model="formData.avatar" placeholder="请输入头像URL (可选)" />
        </el-form-item>
      </el-form>
      <template #footer>
        <span class="dialog-footer">
          <el-button @click="dialogVisible = false">取消</el-button>
          <el-button type="primary" @click="submitForm" :loading="submitting">确定</el-button>
        </span>
      </template>
    </el-dialog>

    <!-- Reset Password Dialog -->
    <el-dialog title="重置密码" v-model="resetDialogVisible" width="400px">
      <el-form :model="resetData" :rules="resetRules" ref="resetFormRef" label-width="100px">
        <el-form-item label="账号">
          <div class="readonly-text">{{ currentResetAdmin?.name }} ({{ currentResetAdmin?.email }})</div>
        </el-form-item>
        <el-form-item label="新密码" prop="password">
          <el-input v-model="resetData.password" placeholder="请输入新密码 (不少于6位)" show-password />
        </el-form-item>
      </el-form>
      <template #footer>
        <span class="dialog-footer">
          <el-button @click="resetDialogVisible = false">取消</el-button>
          <el-button type="primary" @click="submitResetPassword" :loading="resetting">确定</el-button>
        </span>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted } from 'vue';
import { useAuthStore } from '../stores/auth';
import { accountApi } from '../services/api';
import { ElMessage } from 'element-plus';
import { Search, Plus } from '@element-plus/icons-vue';
import dayjs from 'dayjs';

const authStore = useAuthStore();

// State
const loading = ref(false);
const loadingSummary = ref(false);
const admins = ref<any[]>([]);
const isSuperadmin = computed(() => authStore.adminInfo?.role === 'superadmin');
const currentUserId = computed(() => authStore.adminInfo?._id || authStore.adminInfo?.id);

// Summary Stats
const summary = reactive({
  total: 0,
  active: 0,
  inactive: 0,
  superadmins: 0
});

// Filtering & Pagination
const filter = reactive({
  keyword: '',
  role: '',
  status: ''
});

const pagination = reactive({
  page: 1,
  limit: 20,
  total: 0
});

// Dialogs
const dialogVisible = ref(false);
const dialogType = ref<'create' | 'edit'>('create');
const submitting = ref(false);
const formRef = ref<any>(null);

const formData = reactive({
  _id: '',
  name: '',
  email: '',
  password: '',
  role: 'operator',
  status: 'active',
  avatar: ''
});

const formRules = {
  name: [{ required: true, message: '请输入姓名', trigger: 'blur' }],
  email: [
    { required: true, message: '请输入邮箱', trigger: 'blur' },
    { type: 'email', message: '请输入正确的邮箱格式', trigger: 'blur' }
  ],
  password: [
    { required: true, message: '请输入初始密码', trigger: 'blur' },
    { min: 6, message: '密码长度不能少于6位', trigger: 'blur' }
  ],
  role: [{ required: true, message: '请选择角色', trigger: 'change' }]
};

const resetDialogVisible = ref(false);
const resetting = ref(false);
const resetFormRef = ref<any>(null);
const currentResetAdmin = ref<any>(null);

const resetData = reactive({
  password: ''
});

const resetRules = {
  password: [
    { required: true, message: '请输入新密码', trigger: 'blur' },
    { min: 6, message: '密码长度不能少于6位', trigger: 'blur' }
  ]
};

// Lifecycle
onMounted(() => {
  if (!isSuperadmin.value) {
    ElMessage.warning('您没有权限访问此页面');
    return;
  }
  loadAdmins();
  loadAllForSummary();
});

// Load Data
const loadAdmins = async () => {
  try {
    loading.value = true;
    const params = {
      page: pagination.page,
      limit: pagination.limit,
      keyword: filter.keyword || undefined,
      role: filter.role || undefined,
      status: filter.status || undefined
    };

    const res: any = await accountApi.getAdmins(params);
    admins.value = res.list || [];
    pagination.total = res.total || 0;
  } catch (error: any) {
    ElMessage.error(error.message || '获取账号列表失败');
  } finally {
    loading.value = false;
  }
};

const loadAllForSummary = async () => {
  try {
    loadingSummary.value = true;
    // To get accurate summary, request without filters
    const res: any = await accountApi.getAdmins({ page: 1, limit: 1000 });
    const allAdmins = res.list || [];
    
    summary.total = allAdmins.length;
    summary.active = allAdmins.filter((a: any) => a.status === 'active').length;
    summary.inactive = allAdmins.filter((a: any) => a.status === 'inactive').length;
    summary.superadmins = allAdmins.filter((a: any) => a.role === 'superadmin').length;
  } catch (error) {
    console.error('Failed to load summary stats', error);
  } finally {
    loadingSummary.value = false;
  }
};

// Actions
const handleSizeChange = (val: number) => {
  pagination.limit = val;
  loadAdmins();
};

const handleCurrentChange = (val: number) => {
  pagination.page = val;
  loadAdmins();
};

const openCreateDialog = () => {
  dialogType.value = 'create';
  formData._id = '';
  formData.name = '';
  formData.email = '';
  formData.password = '';
  formData.role = 'operator';
  formData.status = 'active';
  formData.avatar = '';
  dialogVisible.value = true;
  if (formRef.value) formRef.value.clearValidate();
};

const openEditDialog = (row: any) => {
  dialogType.value = 'edit';
  formData._id = row._id || row.id;
  formData.name = row.name;
  formData.email = row.email;
  formData.password = ''; // Edit doesn't touch password
  formData.role = row.role;
  formData.status = row.status;
  formData.avatar = row.avatar || '';
  dialogVisible.value = true;
  if (formRef.value) formRef.value.clearValidate();
};

const submitForm = async () => {
  if (!formRef.value) return;
  await formRef.value.validate(async (valid: boolean) => {
    if (valid) {
      try {
        submitting.value = true;
        if (dialogType.value === 'create') {
          const payload = { ...formData };
          delete payload._id;
          await accountApi.createAdmin(payload);
          ElMessage.success('账号创建成功，请提醒该用户登录后修改密码');
        } else {
          const payload = {
            name: formData.name,
            role: formData.role,
            status: formData.status,
            avatar: formData.avatar
          };
          await accountApi.updateAdmin(formData._id, payload);
          ElMessage.success('账号信息更新成功');
        }
        dialogVisible.value = false;
        loadAdmins();
        loadAllForSummary();
      } catch (error: any) {
        ElMessage.error(error.message || (dialogType.value === 'create' ? '创建失败' : '更新失败'));
      } finally {
        submitting.value = false;
      }
    }
  });
};

const openResetPasswordDialog = (row: any) => {
  currentResetAdmin.value = row;
  resetData.password = '';
  resetDialogVisible.value = true;
  if (resetFormRef.value) resetFormRef.value.clearValidate();
};

const submitResetPassword = async () => {
  if (!resetFormRef.value || !currentResetAdmin.value) return;
  await resetFormRef.value.validate(async (valid: boolean) => {
    if (valid) {
      try {
        resetting.value = true;
        const id = currentResetAdmin.value._id || currentResetAdmin.value.id;
        await accountApi.resetPassword(id, resetData.password);
        ElMessage.success('密码重置成功');
        resetDialogVisible.value = false;
      } catch (error: any) {
        ElMessage.error(error.message || '重置密码失败');
      } finally {
        resetting.value = false;
      }
    }
  });
};

const toggleStatus = async (row: any) => {
  try {
    const id = row._id || row.id;
    const newStatus = row.status === 'active' ? 'inactive' : 'active';
    await accountApi.updateStatus(id, newStatus);
    ElMessage.success(`账号已${newStatus === 'active' ? '启用' : '禁用'}`);
    loadAdmins();
    loadAllForSummary();
  } catch (error: any) {
    ElMessage.error(error.message || '更新状态失败');
  }
};

const deleteAdmin = async (row: any) => {
  try {
    const id = row._id || row.id;
    await accountApi.deleteAdmin(id);
    ElMessage.success('账号已永久删除');
    
    // Adjust pagination if needed
    if (admins.value.length === 1 && pagination.page > 1) {
      pagination.page--;
    }
    
    loadAdmins();
    loadAllForSummary();
  } catch (error: any) {
    ElMessage.error(error.message || '删除失败');
  }
};

// Utils
const formatDate = (dateStr: string) => {
  if (!dateStr) return '';
  return dayjs(dateStr).format('YYYY-MM-DD HH:mm:ss');
};

const getRoleName = (role: string) => {
  const map: Record<string, string> = {
    superadmin: '超级管理员',
    admin: '管理员',
    operator: '操作员'
  };
  return map[role] || role;
};

const getRoleType = (role: string) => {
  const map: Record<string, 'danger' | 'warning' | 'info'> = {
    superadmin: 'danger',
    admin: 'warning',
    operator: 'info'
  };
  return map[role] || 'info';
};
</script>

<style scoped>
.account-management {
  padding: 24px;
}

.summary-cards {
  margin-bottom: 24px;
}

.stat-card {
  border-radius: 8px;
  border: none;
  box-shadow: 0 2px 12px 0 rgba(0, 0, 0, 0.05);
}

.stat-content {
  display: flex;
  flex-direction: column;
}

.stat-label {
  color: #909399;
  font-size: 14px;
  margin-bottom: 8px;
}

.stat-value {
  font-size: 28px;
  font-weight: bold;
  color: #303133;
}

.stat-value.active {
  color: #67c23a;
}

.stat-value.inactive {
  color: #f56c6c;
}

.stat-value.superadmin {
  color: #e6a23c;
}

.filter-actions-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
  background: white;
  padding: 16px;
  border-radius: 8px;
  box-shadow: 0 2px 12px 0 rgba(0, 0, 0, 0.05);
}

.filters {
  display: flex;
  gap: 12px;
}

.admin-table {
  border-radius: 8px;
  overflow: hidden;
  box-shadow: 0 2px 12px 0 rgba(0, 0, 0, 0.05);
  margin-bottom: 20px;
}

.user-info {
  display: flex;
  align-items: center;
}

.user-details {
  display: flex;
  flex-direction: column;
  margin-left: 12px;
}

.user-name {
  font-weight: 500;
  color: #303133;
  display: flex;
  align-items: center;
  gap: 8px;
}

.user-email {
  font-size: 13px;
  color: #909399;
  margin-top: 4px;
}

.time-text {
  font-size: 13px;
  color: #606266;
}

.pagination-container {
  display: flex;
  justify-content: flex-end;
  margin-top: 20px;
}

.readonly-text {
  font-weight: 500;
  color: #303133;
  line-height: 32px;
}
</style>
