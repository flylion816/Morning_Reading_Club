import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { authApi } from '../services/api'

export const useAuthStore = defineStore('auth', () => {
  const adminToken = ref<string | null>(null)
  const adminInfo = ref<any>(null)
  const loading = ref(false)
  const error = ref<string | null>(null)

  // 初始化时从 localStorage 恢复 token
  function initToken() {
    const token = localStorage.getItem('adminToken')
    if (token) {
      adminToken.value = token
    }
  }

  const isAuthenticated = computed(() => !!adminToken.value)

  async function login(email: string, password: string) {
    loading.value = true
    error.value = null

    try {
      const response = await authApi.login(email, password)
      adminToken.value = response.token
      localStorage.setItem('adminToken', response.token)
      adminInfo.value = response.admin

      return true
    } catch (err: any) {
      error.value = err.message || '登录失败'
      return false
    } finally {
      loading.value = false
    }
  }

  async function logout() {
    try {
      await authApi.logout()
    } catch (err) {
      console.error('登出失败:', err)
    } finally {
      adminToken.value = null
      adminInfo.value = null
      localStorage.removeItem('adminToken')
    }
  }

  async function getProfile() {
    loading.value = true
    error.value = null

    try {
      const response = await authApi.getProfile()
      adminInfo.value = response
      return response
    } catch (err: any) {
      error.value = err.message || '获取用户信息失败'
      return null
    } finally {
      loading.value = false
    }
  }

  function clearError() {
    error.value = null
  }

  return {
    adminToken,
    adminInfo,
    loading,
    error,
    isAuthenticated,
    initToken,
    login,
    logout,
    getProfile,
    clearError
  }
})
