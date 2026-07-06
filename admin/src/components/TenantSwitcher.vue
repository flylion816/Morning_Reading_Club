<template>
  <div v-if="isPlatformSuperAdmin" class="tenant-switcher">
    <span class="switcher-label">租户</span>
    <el-select
      v-model="activeTenantId"
      placeholder="所有租户"
      clearable
      size="small"
      class="tenant-select"
      @change="handleTenantChange"
    >
      <el-option label="所有租户（跨租户视图）" :value="''" />
      <el-option
        v-for="t in tenantStore.tenants"
        :key="t._id"
        :label="tenantStore.getTenantDisplayName(t)"
        :value="t._id"
      />
    </el-select>
  </div>
  <div v-else-if="currentTenant" class="tenant-display">
    <span class="switcher-label">租户</span>
    {{ tenantStore.getTenantDisplayName(currentTenant) }}
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
    tenantStore.applyActiveTenantTheme();
  } else {
    const res = await api.get('/admin/current-tenant');
    currentTenant.value = res;
    tenantStore.setCurrentTenant(res);
    if (res?._id) {
      tenantStore.setActiveTenant(res._id);
    }
  }
}

function handleTenantChange(value: string) {
  tenantStore.setActiveTenant(value);
  ElMessage.success(value ? '已切换租户视图' : '已切换到跨租户视图');
  window.dispatchEvent(new CustomEvent('admin:tenant-changed', { detail: { tenantId: value } }));
}

onMounted(loadTenants);
</script>

<style scoped>
.tenant-switcher,
.tenant-display {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  min-height: 36px;
  padding: 3px 4px 3px 10px;
  border: 1px solid var(--admin-border);
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.62);
}

.tenant-select {
  width: 176px;
}

.tenant-switcher :deep(.el-select__wrapper) {
  min-height: 28px;
  background: transparent;
  box-shadow: none !important;
}

.switcher-label {
  color: var(--admin-ink-muted);
  font-size: 12px;
  font-weight: 600;
}

.tenant-display {
  color: var(--admin-ink-soft);
  font-size: 13px;
  font-weight: 500;
  padding-right: 10px;
}
</style>
