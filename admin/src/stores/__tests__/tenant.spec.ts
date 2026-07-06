import { describe, it, expect, beforeEach } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { useTenantStore } from '../tenant';

describe('TenantStore - displayName', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    localStorage.clear();
    document.documentElement.removeAttribute('style');
  });

  it('没有选中租户时使用中性管理后台名称', () => {
    const store = useTenantStore();
    expect(store.displayName).toBe('管理后台');
  });

  it('选中租户后显示该租户品牌名', () => {
    const store = useTenantStore();
    store.setTenants([
      { _id: 'tenant-1', name: '凡人共读', branding: { brandName: '凡人共读' } },
      { _id: 'tenant-2', name: '若星生活家', branding: { brandName: '若星生活家' } }
    ]);
    store.setActiveTenant('tenant-2');

    expect(store.displayName).toBe('若星生活家');
    expect(store.getTenantDisplayName({ name: '若星生活家', branding: {} })).toBe('若星生活家');
  });

  it('选中租户后把品牌主色同步到后台主题变量', () => {
    const store = useTenantStore();
    store.setTenants([
      { _id: 'tenant-1', name: '凡人共读', branding: { brandName: '凡人共读', primaryColor: '#6b5bd7' } }
    ]);
    store.setActiveTenant('tenant-1');

    const rootStyle = getComputedStyle(document.documentElement);
    expect(rootStyle.getPropertyValue('--admin-primary').trim()).toBe('#6b5bd7');
    expect(rootStyle.getPropertyValue('--el-color-primary').trim()).toBe('#6b5bd7');
    expect(rootStyle.getPropertyValue('--admin-sidebar').trim()).not.toBe('');
  });
});
