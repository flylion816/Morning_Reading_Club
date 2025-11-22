import { createRouter, createWebHistory } from 'vue-router'
import type { RouteRecordRaw } from 'vue-router'
import { useAuthStore } from '../stores/auth'

const routes: RouteRecordRaw[] = [
  {
    path: '/login',
    name: 'login',
    component: () => import('../views/LoginView.vue'),
    meta: { requiresAuth: false }
  },
  {
    path: '/',
    name: 'dashboard',
    component: () => import('../views/DashboardView.vue'),
    meta: { requiresAuth: true }
  },
  {
    path: '/enrollments',
    name: 'enrollments',
    component: () => import('../views/EnrollmentsView.vue'),
    meta: { requiresAuth: true }
  },
  {
    path: '/payments',
    name: 'payments',
    component: () => import('../views/PaymentsView.vue'),
    meta: { requiresAuth: true }
  },
  {
    path: '/periods',
    name: 'periods',
    component: () => import('../views/PeriodsView.vue'),
    meta: { requiresAuth: true }
  },
  {
    path: '/users',
    name: 'users',
    component: () => import('../views/UsersView.vue'),
    meta: { requiresAuth: true }
  },
  {
    path: '/content',
    name: 'content',
    component: () => import('../views/ContentManagementView.vue'),
    meta: { requiresAuth: true }
  },
  {
    path: '/analytics',
    name: 'analytics',
    component: () => import('../views/AnalyticsView.vue'),
    meta: { requiresAuth: true }
  },
  {
    path: '/audit-logs',
    name: 'auditLogs',
    component: () => import('../views/AuditLogsView.vue'),
    meta: { requiresAuth: true }
  },
]

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes
})

// Global route guard for authentication
router.beforeEach((to, from, next) => {
  const authStore = useAuthStore()

  console.log('========== 路由守卫检查开始 ==========')
  console.log('[Router Guard] 导航到:', to.path)
  console.log('[Router Guard] 需要认证:', to.meta.requiresAuth)
  console.log('[Router Guard] authStore.adminToken:', authStore.adminToken ? '有值' : 'null')
  console.log('[Router Guard] authStore.isAuthenticated:', authStore.isAuthenticated)
  console.log('[Router Guard] localStorage.adminToken:', localStorage.getItem('adminToken') ? '有值' : 'null')

  if (to.meta.requiresAuth && !authStore.isAuthenticated) {
    // 重定向到登录页，但不能是已经在登录页的情况
    console.log('[Router Guard] ⚠️ 需要认证但未认证，重定向到登录页')
    if (to.path !== '/login') {
      console.log('[Router Guard] 执行: next("/login")')
      next('/login')
    } else {
      next()
    }
  } else if (to.path === '/login' && authStore.isAuthenticated) {
    // 已登录时访问登录页，重定向到首页
    console.log('[Router Guard] ✓ 已认证，重定向到首页')
    console.log('[Router Guard] 执行: next("/")')
    next('/')
  } else {
    console.log('[Router Guard] ✓ 通过路由守卫检查，允许导航')
    next()
  }
  console.log('========== 路由守卫检查结束 ==========')
})

export default router
