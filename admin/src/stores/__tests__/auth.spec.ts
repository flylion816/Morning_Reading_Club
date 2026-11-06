import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { useAuthStore } from '@/stores/auth';
import { authApi, setAdminAccessToken, setAdminMaintenanceProof } from '@/services/api';
import { createMockAdmin } from '@/tests/fixtures';
import { createMockLocalStorage } from '@/tests/helpers/mock-helpers';

describe('AuthStore - HttpOnly refresh session', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    global.localStorage = createMockLocalStorage() as any;
    setAdminAccessToken(null);
    setAdminMaintenanceProof(null);
  });

  afterEach(() => vi.restoreAllMocks());

  it('starts signed out without writing an access token to Web Storage', () => {
    const store = useAuthStore();
    expect(store.adminToken).toBeNull();
    expect(store.adminInfo).toBeNull();
    expect(store.isAuthenticated).toBe(false);
    expect(localStorage.getItem('adminToken')).toBeNull();
  });

  it('restores the session by refreshing through the HttpOnly cookie, ignoring an old localStorage token', async () => {
    localStorage.setItem('adminToken', 'stale-readable-token');
    const admin = createMockAdmin();
    vi.spyOn(authApi, 'refresh').mockResolvedValue({ accessToken: 'short-lived-access', admin });
    const store = useAuthStore();

    await expect(store.initToken()).resolves.toBe(true);
    expect(store.adminToken).toBe('short-lived-access');
    expect(store.adminInfo).toEqual(admin);
    expect(localStorage.getItem('adminToken')).toBeNull();
  });

  it('fails signed out when refresh-cookie validation fails', async () => {
    vi.spyOn(authApi, 'refresh').mockResolvedValue(null);
    const store = useAuthStore();
    localStorage.setItem('adminToken', 'stale-token');

    await expect(store.initToken()).resolves.toBe(false);
    expect(store.isAuthenticated).toBe(false);
    expect(localStorage.getItem('adminToken')).toBeNull();
  });

  it('keeps the access token in memory after login and stores no bearer token', async () => {
    const admin = createMockAdmin();
    vi.spyOn(authApi, 'login').mockResolvedValue({ accessToken: 'new-access', admin } as any);
    const store = useAuthStore();

    await expect(store.login('admin@example.com', 'test-only-password')).resolves.toBe(true);
    expect(store.adminToken).toBe('new-access');
    expect(store.adminInfo).toEqual(admin);
    expect(localStorage.getItem('adminToken')).toBeNull();
    expect(localStorage.getItem('adminInfo')).toBeNull();
  });

  it('rejects a malformed login response and remains signed out', async () => {
    vi.spyOn(authApi, 'login').mockResolvedValue({ token: 'legacy-token' } as any);
    const store = useAuthStore();
    await expect(store.login('admin@example.com', 'test-only-password')).resolves.toBe(false);
    expect(store.isAuthenticated).toBe(false);
    expect(store.error).toContain('有效会话');
  });

  it('revokes the server session and clears access and maintenance proofs on logout', async () => {
    const store = useAuthStore();
    const admin = createMockAdmin();
    store.adminToken = 'short-lived-access';
    store.adminInfo = admin;
    setAdminAccessToken('short-lived-access');
    setAdminMaintenanceProof('short-lived-maintenance-proof');
    const logout = vi.spyOn(authApi, 'logout').mockResolvedValue({} as any);

    await store.logout();
    expect(logout).toHaveBeenCalledOnce();
    expect(store.isAuthenticated).toBe(false);
    expect(store.adminInfo).toBeNull();
    expect(localStorage.getItem('adminToken')).toBeNull();
  });

  it('keeps the active client session if the server could not revoke it', async () => {
    const store = useAuthStore();
    store.adminToken = 'short-lived-access';
    store.adminInfo = createMockAdmin();
    vi.spyOn(authApi, 'logout').mockRejectedValue(new Error('offline'));

    await expect(store.logout()).resolves.toBe(false);
    expect(store.isAuthenticated).toBe(true);
    expect(store.adminInfo).not.toBeNull();
  });

  it('returns the verified current profile and updates the in-memory admin info', async () => {
    const store = useAuthStore();
    const admin = createMockAdmin();
    vi.spyOn(authApi, 'getProfile').mockResolvedValue(admin as any);
    await expect(store.getProfile()).resolves.toEqual(admin);
    expect(store.adminInfo).toEqual(admin);
    expect(store.loading).toBe(false);
  });
});
