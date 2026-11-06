import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { authApi, setAdminAccessToken, setAdminMaintenanceProof } from '../services/api';
import logger from '../utils/logger';

export const useAuthStore = defineStore('auth', () => {
  const adminToken = ref<string | null>(null);
  const adminInfo = ref<any>(null);
  const loading = ref(false);
  const error = ref<string | null>(null);
  const initialized = ref(false);
  let initialization: Promise<boolean> | null = null;

  const isAuthenticated = computed(() => Boolean(adminToken.value));

  function clearLegacyStorage() {
    try {
      localStorage.removeItem('adminToken');
      localStorage.removeItem('adminInfo');
    } catch (_) {
      // Web Storage may be unavailable in private or embedded browsing contexts.
    }
  }

  function clearSession() {
    adminToken.value = null;
    adminInfo.value = null;
    setAdminAccessToken(null);
    setAdminMaintenanceProof(null);
    clearLegacyStorage();
  }

  async function initToken(): Promise<boolean> {
    if (initialized.value) return isAuthenticated.value;
    // Tests and the login action may already have installed a fresh in-memory session.
    if (adminToken.value) {
      initialized.value = true;
      setAdminAccessToken(adminToken.value);
      return true;
    }
    if (!initialization) {
      initialization = (async () => {
        try {
          // The refresh credential is HttpOnly; initialization validates it with the server.
          const session: any = await authApi.refresh();
          if (!session?.accessToken || !session?.admin) {
            clearSession();
            return false;
          }
          adminToken.value = session.accessToken;
          adminInfo.value = session.admin;
          setAdminAccessToken(session.accessToken);
          clearLegacyStorage();
          return true;
        } catch (err) {
          logger.warn('管理员会话恢复失败');
          clearSession();
          return false;
        } finally {
          initialized.value = true;
          initialization = null;
        }
      })();
    }
    return initialization;
  }

  async function login(email: string, password: string) {
    loading.value = true;
    error.value = null;
    initialized.value = true;
    setAdminAccessToken(null);
    setAdminMaintenanceProof(null);

    try {
      const response: any = await authApi.login(email, password);
      if (!response?.accessToken || !response?.admin) {
        throw new Error('登录响应缺少有效会话');
      }
      adminToken.value = response.accessToken;
      adminInfo.value = response.admin;
      setAdminAccessToken(response.accessToken);
      return true;
    } catch (err: any) {
      clearSession();
      error.value = err.message || '登录失败';
      return false;
    } finally {
      loading.value = false;
    }
  }

  async function logout(): Promise<boolean> {
    try {
      await authApi.logout();
      clearSession();
      initialized.value = true;
      return true;
    } catch (err) {
      logger.warn('管理员登出请求失败');
      return false;
    }
  }

  async function getProfile() {
    loading.value = true;
    error.value = null;
    try {
      const response = await authApi.getProfile();
      adminInfo.value = response;
      return response;
    } catch (err: any) {
      error.value = err.message || '获取用户信息失败';
      return null;
    } finally {
      loading.value = false;
    }
  }

  function clearError() {
    error.value = null;
  }

  return {
    adminToken,
    adminInfo,
    loading,
    error,
    initialized,
    isAuthenticated,
    initToken,
    login,
    logout,
    getProfile,
    clearError
  };
});
