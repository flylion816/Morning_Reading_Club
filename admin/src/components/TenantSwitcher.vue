<template>
  <div v-if="isPlatformSuperAdmin" class="tenant-switcher">
    <el-select
      v-model="activeTenantId"
      placeholder="所有租户"
      clearable
      size="small"
      style="width: 180px"
      @change="handleTenantChange"
    >
      <el-option label="所有租户（跨租户视图）" :value="''" />
      <el-option
        v-for="t in tenants"
        :key="t._id"
        :label="t.name"
        :value="t._id"
      />
    </el-select>
  </div>
  <div v-else-if="currentTenant" class="tenant-display">
    {{ currentTenant.name }}
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { ElMessage } from 'element-plus';
import api from '../services/api';
import { useAuthStore } from '../stores/auth';

const authStore = useAuthStore();
const tenants = ref<any[]>([]);
const activeTenantId = ref<string>(localStorage.getItem('admin_active_tenant') || '');
const currentTenant = ref<any>(null);

const isPlatformSuperAdmin = computed(() =>
  ['platform_superadmin', 'superadmin'].includes(authStore.adminInfo?.role)
);

async function loadTenants() {
  if (isPlatformSuperAdmin.value) {
    const res = await api.get('/admin/tenants');
    tenants.value = res;
  } else {
    const res = await api.get('/admin/current-tenant');
    currentTenant.value = res;
  }
}

function handleTenantChange(value: string) {
  if (value) {
    localStorage.setItem('admin_active_tenant', value);
  } else {
    localStorage.removeItem('admin_active_tenant');
  }
  ElMessage.success('已切换租户视图，刷新页面查看数据');
  setTimeout(() => window.location.reload(), 500);
}

onMounted(loadTenants);
</script>

<style scoped>
.tenant-switcher,
.tenant-display {
  margin-right: 16px;
}
.tenant-display {
  color: #888;
  font-size: 13px;
}
</style>
