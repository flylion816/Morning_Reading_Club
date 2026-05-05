<template>
  <AdminLayout>
    <div class="profile-page">
      <el-card class="profile-card" shadow="never">
        <template #header>
          <div class="card-header">
            <div>
              <div class="card-title">个人账号设置</div>
              <div class="card-subtitle">修改头像和姓名，保存后会同步到后台右上角和审计记录。</div>
            </div>
          </div>
        </template>

        <el-row :gutter="24" class="profile-body">
          <el-col :xs="24" :md="8" class="avatar-panel">
            <div class="avatar-preview">
              <el-avatar :src="form.avatar" :size="120" class="profile-avatar">
                {{ avatarFallback }}
              </el-avatar>
              <div class="avatar-meta">
                <div class="avatar-name">{{ form.name || '未设置姓名' }}</div>
                <div class="avatar-email">{{ authStore.adminInfo?.email }}</div>
                <el-tag :type="roleTagType" class="role-tag">
                  {{ roleLabel }}
                </el-tag>
              </div>
            </div>
          </el-col>

          <el-col :xs="24" :md="16">
            <el-form
              ref="formRef"
              :model="form"
              :rules="rules"
              label-width="110px"
              class="profile-form"
            >
              <el-form-item label="姓名" prop="name">
                <el-input v-model="form.name" placeholder="请输入姓名" maxlength="50" show-word-limit />
              </el-form-item>

              <el-form-item label="邮箱">
                <el-input :model-value="authStore.adminInfo?.email" disabled />
              </el-form-item>

              <el-form-item label="角色">
                <el-input :model-value="roleLabel" disabled />
              </el-form-item>

              <el-form-item label="头像URL">
                <el-input
                  v-model="form.avatar"
                  placeholder="请输入头像URL，可留空使用默认头像"
                  clearable
                />
              </el-form-item>

              <el-form-item label="预览说明">
                <div class="hint-text">
                  如果头像地址有效，会立即在右上角和列表中显示；如果留空，则使用默认头像图标。
                </div>
              </el-form-item>

              <el-form-item>
                <el-button type="primary" :loading="saving" @click="saveProfile">
                  保存修改
                </el-button>
                <el-button @click="resetForm">重置</el-button>
              </el-form-item>
            </el-form>
          </el-col>
        </el-row>
      </el-card>
    </div>
  </AdminLayout>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue';
import { ElMessage } from 'element-plus';
import AdminLayout from '../components/AdminLayout.vue';
import { useAuthStore } from '../stores/auth';
import { authApi } from '../services/api';

const authStore = useAuthStore();
const formRef = ref<any>(null);
const saving = ref(false);

const form = reactive({
  name: '',
  avatar: ''
});

const rules = {
  name: [{ required: true, message: '请输入姓名', trigger: 'blur' }]
};

const roleLabel = computed(() => {
  const role = authStore.adminInfo?.role;
  const map: Record<string, string> = {
    superadmin: '超级管理员',
    admin: '管理员',
    operator: '操作员'
  };
  return map[role] || role || '未知';
});

const roleTagType = computed(() => {
  const role = authStore.adminInfo?.role;
  const map: Record<string, 'danger' | 'warning' | 'info'> = {
    superadmin: 'danger',
    admin: 'warning',
    operator: 'info'
  };
  return map[role] || 'info';
});

const avatarFallback = computed(() => {
  return form.name ? form.name.charAt(0) : 'U';
});

const syncForm = () => {
  form.name = authStore.adminInfo?.name || '';
  form.avatar = authStore.adminInfo?.avatar || '';
};

const resetForm = () => {
  syncForm();
  if (formRef.value) {
    formRef.value.clearValidate();
  }
};

const saveProfile = async () => {
  if (!formRef.value) return;

  await formRef.value.validate(async (valid: boolean) => {
    if (!valid) return;

    try {
      saving.value = true;
      const response: any = await authApi.updateProfile({
        name: form.name.trim(),
        avatar: form.avatar.trim() || null
      });

      authStore.adminInfo = {
        ...(authStore.adminInfo || {}),
        ...response
      };
      syncForm();
      ElMessage.success('个人资料已更新');
    } catch (error: any) {
      ElMessage.error(error.message || '更新个人资料失败');
    } finally {
      saving.value = false;
    }
  });
};

onMounted(() => {
  syncForm();
});
</script>

<style scoped>
.profile-page {
  padding: 24px;
}

.profile-card {
  border: none;
  border-radius: 8px;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
}

.card-title {
  font-size: 18px;
  font-weight: 600;
  color: #1f2937;
}

.card-subtitle {
  margin-top: 6px;
  color: #6b7280;
  font-size: 13px;
}

.profile-body {
  align-items: flex-start;
}

.avatar-panel {
  display: flex;
  justify-content: center;
  margin-bottom: 24px;
}

.avatar-preview {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
  padding: 24px 16px;
  border: 1px solid #eef2f7;
  border-radius: 8px;
  background: #fafbfc;
  width: 100%;
}

.profile-avatar {
  background: #dbeafe;
  color: #3b82f6;
  font-size: 36px;
  font-weight: 600;
}

.avatar-meta {
  text-align: center;
}

.avatar-name {
  font-size: 18px;
  font-weight: 600;
  color: #111827;
}

.avatar-email {
  margin-top: 6px;
  color: #6b7280;
  font-size: 13px;
}

.role-tag {
  margin-top: 12px;
}

.profile-form {
  max-width: 680px;
}

.hint-text {
  color: #6b7280;
  font-size: 13px;
  line-height: 1.7;
}
</style>
