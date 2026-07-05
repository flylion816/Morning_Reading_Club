import { defineStore } from 'pinia';
import { ref, computed } from 'vue';

export const useTenantStore = defineStore('tenant', () => {
  const tenants = ref<any[]>([]);
  const activeTenantId = ref<string>(localStorage.getItem('admin_active_tenant') || '');

  function getTenantDisplayName(tenant: any) {
    return tenant?.branding?.brandName || tenant?.name || '管理后台';
  }

  const activeTenant = computed(() =>
    tenants.value.find(t => t._id === activeTenantId.value) || null
  );

  const displayName = computed(() => {
    if (activeTenant.value) return getTenantDisplayName(activeTenant.value);
    return '管理后台';
  });

  function setTenants(list: any[]) {
    tenants.value = list;
  }

  function setActiveTenant(id: string) {
    activeTenantId.value = id;
    if (id) {
      localStorage.setItem('admin_active_tenant', id);
    } else {
      localStorage.removeItem('admin_active_tenant');
    }
  }

  return { tenants, activeTenantId, activeTenant, displayName, getTenantDisplayName, setTenants, setActiveTenant };
});
