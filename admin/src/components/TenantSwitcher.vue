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
        v-for="t in tenantStore.tenants"
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
import { useTenantStore } from '../stores/tenant';

const authStore = useAuthStore();
const tenantStore = useTenantStore();
const currentTenant = ref<any>(null);

const isPlatformSuperAdmin = computed(() =>
  ['platform_superadmin', 'superadmin'].includes(authStore.adminInfo?.role)
);

const activeTenantId = computed({
  get: () => tenantStore.activeTenantId,
  set: (val) => tenantStore.setActiveTenant(val)
});

async function loadTenants() {
  if (isPlatformSuperAdmin.value) {
    const res = await api.get('/admin/tenants');
    const list = (res as any)?.list || (res as any)?.data || res || [];
    tenantStore.setTenants(list);
  } else {
    const res = await api.get('/admin/current-tenant');
    currentTenant.value = res;
    if (res?._id) {
      tenantStore.setActiveTenant(res._id);
    }
  }
}

function handleTenantChange(value: string) {
  tenantStore.setActiveTenant(value);
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
