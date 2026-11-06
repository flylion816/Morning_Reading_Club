import { describe, it, expect, beforeEach } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { useAuthStore } from '../../stores/auth';

// 直接加载真实路由配置，验证系统管理页面的角色守卫
describe('Router - 系统管理页面仅平台管理员可进入', () => {
  let router: any;
  let authStore: any;

  beforeEach(async () => {
    setActivePinia(createPinia());
    authStore = useAuthStore();
    authStore.adminToken = 'test-token';
    router = (await import('../index')).default;
    await router.push('/');
  });

  const platformPages = ['/database', '/tenants', '/account-management', '/subscription-debug'];

  it.each(platformPages)('租户管理员访问 %s 会回到仪表板', async (path) => {
    authStore.adminInfo = { role: 'tenant_admin' };
    await router.push(path);
    expect(router.currentRoute.value.name).toBe('dashboard');
  });

  it.each(platformPages)('平台管理员可以访问 %s', async (path) => {
    authStore.adminInfo = { role: 'platform_superadmin' };
    await router.push(path);
    expect(router.currentRoute.value.path).toBe(path);
  });

  it('租户管理员仍可访问普通业务页面', async () => {
    authStore.adminInfo = { role: 'operator' };
    await router.push('/users');
    expect(router.currentRoute.value.path).toBe('/users');
  });
});
