import { createRouter, createWebHistory, createWebHashHistory } from 'vue-router';
import type { RouteRecordRaw } from 'vue-router';
import { useAuthStore } from '../stores/auth';
import logger from '../utils/logger';

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
    path: '/checkins',
    name: 'checkins',
    component: () => import('../views/CheckinsManagementView.vue'),
    meta: { requiresAuth: true }
  },
  {
    path: '/insights',
    name: 'insights',
    component: () => import('../views/InsightsManagementView.vue'),
    meta: { requiresAuth: true }
  },
  {
    path: '/insight-requests',
    name: 'insightRequests',
    component: () => import('../views/InsightRequestsManagementView.vue'),
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
  }
];

const router = createRouter({
  // 使用 hash mode 避免子路径(base: '/admin/')导致的路由问题
  history: createWebHashHistory(import.meta.env.BASE_URL),
  routes
});

// Global route guard for authentication
router.beforeEach((to, from, next) => {
  const authStore = useAuthStore();

  if (to.meta.requiresAuth && !authStore.isAuthenticated) {
    // 需要认证但未认证，重定向到登录
    if (to.name !== 'login') {
      next({ name: 'login' });
    } else {
      next();
    }
  } else if (to.name === 'login' && authStore.isAuthenticated) {
    // 已登录时访问登录页，重定向到首页
    next({ name: 'dashboard' });
  } else {
    next();
  }
});

export default router;
