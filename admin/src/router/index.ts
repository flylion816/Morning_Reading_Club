import { createRouter, createWebHistory } from 'vue-router';
import type { RouteRecordRaw } from 'vue-router';
import { useAuthStore } from '../stores/auth';

const PLATFORM_ROLES = ['platform_superadmin', 'superadmin'];

const routes: RouteRecordRaw[] = [
  { path: '/course-templates', name: 'courseTemplates', component: () => import('../views/CourseTemplatesView.vue'), meta: { requiresAuth: true } },
  { path: '/enrollment-templates', name: 'enrollmentTemplates', component: () => import('../views/EnrollmentTemplatesView.vue'), meta: { requiresAuth: true } },
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
    path: '/completion-reports',
    name: 'completionReports',
    component: () => import('../views/CompletionReportsManagementView.vue'),
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
  {
    path: '/database',
    name: 'database',
    component: () => import('../views/DatabaseView.vue'),
    meta: { requiresAuth: true, platformOnly: true }
  },
  {
    path: '/subscription-debug',
    name: 'subscriptionDebug',
    component: () => import('../views/SubscriptionDebugView.vue'),
    meta: { requiresAuth: true, platformOnly: true }
  },
  {
    path: '/account-management',
    name: 'accountManagement',
    component: () => import('../views/AccountManagementView.vue'),
    meta: { requiresAuth: true, platformOnly: true }
  },
  {
    path: '/tenants',
    name: 'tenants',
    component: () => import('../views/TenantsView.vue'),
    meta: { requiresAuth: true, platformOnly: true }
  },
  {
    path: '/imprints',
    name: 'imprints',
    component: () => import('../views/ImprintsManagementView.vue'),
    meta: { requiresAuth: true }
  },
  {
    path: '/activities',
    name: 'activities',
    component: () => import('../views/ActivitiesManagementView.vue'),
    meta: { requiresAuth: true }
  },
  {
    path: '/coupons',
    name: 'coupons',
    component: () => import('../views/CouponsManagementView.vue'),
    meta: { requiresAuth: true }
  },
  {
    path: '/home-config',
    name: 'homeConfig',
    component: () => import('../views/HomeConfigView.vue'),
    meta: { requiresAuth: true }
  },
  {
    path: '/profile',
    name: 'profile',
    component: () => import('../views/ProfileView.vue'),
    meta: { requiresAuth: true }
  }
];

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes
});

// Restore the HttpOnly refresh-cookie session before evaluating protected routes.
router.beforeEach(async to => {
  const authStore = useAuthStore();
  await authStore.initToken();

  if (to.meta.requiresAuth && !authStore.isAuthenticated) {
    return { name: 'login' };
  }
  if (to.name === 'login' && authStore.isAuthenticated) return { name: 'dashboard' };
  // 系统管理页面只对平台管理员开放（后端同样会拦截，这里避免租户管理员打开后看到报错页）
  if (to.meta.platformOnly && !PLATFORM_ROLES.includes(authStore.adminInfo?.role)) {
    return { name: 'dashboard' };
  }
  return true;
});

export default router;
