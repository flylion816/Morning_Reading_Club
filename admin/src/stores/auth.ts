import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { authApi } from '../services/api'
import logger from '../utils/logger'

export const useAuthStore = defineStore('auth', () => {
  const adminToken = ref<string | null>(null)
  const adminInfo = ref<any>(null)
  const loading = ref(false)
  const error = ref<string | null>(null)

  // 初始化时从 localStorage 恢复 token
  function initToken() {
    const token = localStorage.getItem('adminToken')
    logger.debug('[Auth Store] initToken() 执行，localStorage中的token:', { value: token ? '有值' : '无值' })
    if (token) {
      adminToken.value = token
      logger.info('[Auth Store] token已恢复，isAuthenticated:', !!adminToken.value)
    }
  }

  const isAuthenticated = computed(() => {
    const result = !!adminToken.value
    logger.debug('[Auth Store] isAuthenticated computed, result:', result)
    return result
  })

  async function login(email: string, password: string) {
    logger.info('[Auth Store] login() 开始，email:', email)
    loading.value = true
    error.value = null

    try {
      const response = await authApi.login(email, password)
      logger.debug('========== 登录API返回数据开始 ==========')
      logger.debug('[Auth Store] 登录API返回:', response)
      logger.debug('[Auth Store] response.token:', { value: response.token ? '有值' : '无值' })
      if (response.token) {
        logger.debug('[Auth Store] token值:', response.token.substring(0, 50) + '...')
      }

      adminToken.value = response.token
      logger.debug('[Auth Store] token已设置到 adminToken.value')
      logger.debug('[Auth Store] 现在 adminToken.value:', { value: adminToken.value ? '有值' : '无值' })

      localStorage.setItem('adminToken', response.token)
      logger.debug('[Auth Store] localStorage已保存')
      logger.debug('[Auth Store] 验证 localStorage:', { value: localStorage.getItem('adminToken') ? '确实有值' : '无值' })

      adminInfo.value = response.admin
      logger.debug('[Auth Store] adminInfo已设置')
      logger.debug('========== 登录API返回数据结束 ==========')

      return true
    } catch (err: any) {
      logger.error('[Auth Store] 登录失败:', err)
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
      logger.error('登出失败:', err)
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
