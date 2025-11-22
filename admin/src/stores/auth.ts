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
    console.log('[Auth Store] initToken() 执行，localStorage中的token:', token ? '有值' : '无值')
    if (token) {
      adminToken.value = token
      console.log('[Auth Store] token已恢复，isAuthenticated:', !!adminToken.value)
    }
  }

  const isAuthenticated = computed(() => {
    const result = !!adminToken.value
    console.log('[Auth Store] isAuthenticated computed, result:', result)
    return result
  })

  async function login(email: string, password: string) {
    console.log('[Auth Store] login() 开始，email:', email)
    loading.value = true
    error.value = null

    try {
      const response = await authApi.login(email, password)
      console.log('========== 登录API返回数据开始 ==========')
      console.log('[Auth Store] 登录API返回:', response)
      console.log('[Auth Store] response.token:', response.token ? '有值' : '无值')
      if (response.token) {
        console.log('[Auth Store] token值:', response.token.substring(0, 50) + '...')
      }

      adminToken.value = response.token
      console.log('[Auth Store] token已设置到 adminToken.value')
      console.log('[Auth Store] 现在 adminToken.value:', adminToken.value ? '有值' : '无值')

      localStorage.setItem('adminToken', response.token)
      console.log('[Auth Store] localStorage已保存')
      console.log('[Auth Store] 验证 localStorage:', localStorage.getItem('adminToken') ? '确实有值' : '无值')

      adminInfo.value = response.admin
      console.log('[Auth Store] adminInfo已设置')
      console.log('========== 登录API返回数据结束 ==========')

      return true
    } catch (err: any) {
      console.error('[Auth Store] 登录失败:', err)
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
