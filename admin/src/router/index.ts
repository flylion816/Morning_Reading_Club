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

  if (to.meta.requiresAuth && !authStore.isAuthenticated) {
    // 重定向到登录页，但不能是已经在登录页的情况
    if (to.path !== '/login') {
      next('/login')
    } else {
      next()
    }
  } else if (to.path === '/login' && authStore.isAuthenticated) {
    // 已登录时访问登录页，重定向到首页
    next('/')
  } else {
    next()
  }
})

export default router
