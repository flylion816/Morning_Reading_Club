<template>
  <el-container class="admin-layout">
    <el-aside class="admin-sidebar">
      <div class="sidebar-header">
        <div class="brand-mark">
          <img src="/logo.png" class="sidebar-logo" alt="晨读营管理后台" />
        </div>
        <div class="brand-copy">
          <h2>{{ tenantStore.displayName }}</h2>
          <p>晨读营运营台</p>
        </div>
      </div>

      <el-menu
        ref="sidebarMenuRef"
        :default-active="activeMenu"
        class="sidebar-menu"
        @scroll.passive="persistSidebarScroll"
        @select="handleMenuSelect"
      >
        <el-menu-item-group
          v-for="group in visibleMenuGroups"
          :key="group.title"
          :title="group.title"
        >
          <el-menu-item
            v-for="item in group.items"
            :key="item.index"
            :index="item.index"
          >
            <el-icon class="nav-icon">
              <component :is="item.icon" />
            </el-icon>
            <span>{{ item.label }}</span>
          </el-menu-item>
        </el-menu-item-group>
      </el-menu>

      <div class="sidebar-footer">
        <el-button
          type="danger"
          text
          class="logout-button"
          @click="handleLogout"
        >
          <el-icon><SwitchButton /></el-icon>
          <span>退出登录</span>
        </el-button>
      </div>
    </el-aside>

    <el-container class="admin-main">
      <el-header class="admin-header">
        <div class="header-content">
          <div class="header-title">
            <h3>{{ pageTitle }}</h3>
            <p v-if="pageSubtitle">{{ pageSubtitle }}</p>
          </div>
          <div class="header-right">
            <TenantSwitcher />
            <div class="header-user">
              <button class="profile-entry" type="button" @click="goToProfile">
                <el-avatar
                  :src="authStore.adminInfo?.avatar"
                  shape="square"
                  :size="36"
                  :fallback="true"
                  class="profile-avatar"
                >
                  <el-icon><UserFilled /></el-icon>
                </el-avatar>
                <span class="user-name">{{ authStore.adminInfo?.name || '管理员' }}</span>
              </button>
            </div>
          </div>
        </div>
      </el-header>

      <el-main class="admin-content">
        <slot />
      </el-main>
    </el-container>

    <!-- 数据库访问二次验证对话框 -->
    <el-dialog
      v-model="dbAccessVisible"
      title="数据库管理 - 二次验证"
      width="400px"
      :close-on-click-modal="false"
      :close-on-press-escape="false"
    >
      <div class="db-access-form">
        <div class="warning-text">
          <el-icon><Warning /></el-icon>
          <span>数据库管理涉及敏感数据，请输入验证密码。</span>
        </div>
        <el-input
          v-model="dbAccessPassword"
          type="password"
          placeholder="输入验证密码"
          show-password
          clearable
          @keyup.enter="confirmDbAccess"
        />
        <div v-if="dbAccessError" class="error-text">{{ dbAccessError }}</div>
      </div>
      <template #footer>
        <el-button @click="dbAccessVisible = false">取消</el-button>
        <el-button
          type="primary"
          :loading="dbAccessVerifying"
          @click="confirmDbAccess"
        >
          验证
        </el-button>
      </template>
    </el-dialog>
  </el-container>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { useAuthStore } from '../stores/auth';
import { useTenantStore } from '../stores/tenant';
import { authApi } from '../services/api';
import { ElMessage, ElMessageBox } from 'element-plus';
import TenantSwitcher from './TenantSwitcher.vue';
import {
  Bell,
  Calendar,
  Checked,
  Collection,
  Connection,
  CreditCard,
  DataAnalysis,
  DataBoard,
  Document,
  EditPen,
  Finished,
  HomeFilled,
  Location,
  Management,
  OfficeBuilding,
  Reading,
  Search,
  SwitchButton,
  Tickets,
  TrendCharts,
  User,
  UserFilled,
  View,
  Warning
} from '@element-plus/icons-vue';

const router = useRouter();
const route = useRoute();
const authStore = useAuthStore();
const tenantStore = useTenantStore();
const sidebarMenuRef = ref<HTMLElement | { $el?: HTMLElement } | null>(null);
const SIDEBAR_SCROLL_KEY = 'admin_sidebar_scroll_top';

const activeMenu = computed(() => route.path);

const isPlatformSuperAdmin = computed(() =>
  ['platform_superadmin', 'superadmin'].includes(authStore.adminInfo?.role)
);

const dbAccessVisible = ref(false);
const dbAccessPassword = ref('');
const dbAccessError = ref('');
const dbAccessVerifying = ref(false);
const pendingRoute = ref<string | null>(null);

const menuGroups = [
  {
    title: '数据看板',
    items: [
      { index: '/', label: '仪表板', icon: DataBoard },
      { index: '/analytics', label: '数据分析', icon: TrendCharts }
    ]
  },
  {
    title: '业务管理',
    items: [
      { index: '/enrollments', label: '报名管理', icon: EditPen },
      { index: '/users', label: '用户管理', icon: User },
      { index: '/payments', label: '支付记录', icon: CreditCard },
      { index: '/periods', label: '期次管理', icon: Calendar },
      { index: '/content', label: '内容管理', icon: Reading }
    ]
  },
  {
    title: '内容管理',
    items: [
      { index: '/checkins', label: '每日打卡', icon: Location },
      { index: '/insights', label: '小凡看见', icon: View },
      { index: '/insight-requests', label: '查看申请', icon: Document },
      { index: '/completion-reports', label: '实录报告', icon: Collection },
      { index: '/imprints', label: '在场管理', icon: Finished },
      { index: '/activities', label: '活动管理', icon: Checked },
      { index: '/coupons', label: '优惠券管理', icon: Tickets },
      { index: '/home-config', label: '首页配置', icon: HomeFilled },
      { index: '/audit-logs', label: '审计日志', icon: Search }
    ]
  },
  {
    title: '系统管理',
    platformOnly: true,
    items: [
      { index: '/tenants', label: '租户管理', icon: OfficeBuilding },
      { index: '/account-management', label: '账号管理', icon: Management },
      { index: '/subscription-debug', label: '订阅消息排查', icon: Bell },
      { index: '/database', label: '数据库管理', icon: Connection }
    ]
  }
];

const visibleMenuGroups = computed(() =>
  menuGroups.filter((group) => !group.platformOnly || isPlatformSuperAdmin.value)
);

const pageTitle = computed(() => {
  const titles: Record<string, string> = {
    '/': '仪表板：现在要做什么',
    '/analytics': '数据分析：过去发生了什么、为什么',
    '/enrollments': '报名管理',
    '/payments': '支付记录',
    '/periods': '期次管理',
    '/users': '用户管理',
    '/content': '内容管理',
    '/insights': '小凡看见',
    '/imprints': '在场管理',
    '/activities': '活动管理',
    '/coupons': '优惠券管理',
    '/home-config': '首页配置',
    '/insight-requests': '查看申请',
    '/completion-reports': '实录报告',
    '/subscription-debug': '订阅消息排查',
    '/audit-logs': '审计日志',
    '/database': '数据库管理',
    '/account-management': '账号管理',
    '/tenants': '租户管理',
    '/profile': '个人账号设置'
  };
  return titles[route.path] || '管理后台';
});

const pageSubtitle = computed(() => {
  const subtitles: Record<string, string> = {
    '/': '查看当前业务状态、待处理事项和最近动态。',
    '/analytics': '按时间范围查看趋势、转化、收入结构和用户活跃度。',
    '/account-management': '管理后台登录账号、角色权限和启停状态。',
    '/profile': '修改当前登录账号的姓名和头像。'
  };
  return subtitles[route.path] || '';
});

const getSidebarMenuElement = () => {
  const target = sidebarMenuRef.value as any;
  return (target?.$el || target) as HTMLElement | null;
};

const persistSidebarScroll = () => {
  const element = getSidebarMenuElement();
  if (!element) return;
  sessionStorage.setItem(SIDEBAR_SCROLL_KEY, String(element.scrollTop));
};

const scrollActiveMenuIntoView = async () => {
  await nextTick();
  const element = getSidebarMenuElement();
  const activeItem = element?.querySelector('.el-menu-item.is-active') as HTMLElement | null;
  activeItem?.scrollIntoView({ block: 'nearest' });
};

const restoreSidebarScroll = async () => {
  await nextTick();
  const element = getSidebarMenuElement();
  if (!element) return;

  const savedTop = Number(sessionStorage.getItem(SIDEBAR_SCROLL_KEY) || 0);
  if (Number.isFinite(savedTop) && savedTop > 0) {
    element.scrollTop = savedTop;
  }
  await scrollActiveMenuIntoView();
};

const handleMenuSelect = (index: string) => {
  persistSidebarScroll();
  // 数据库管理需要二次验证
  if (index === '/database') {
    pendingRoute.value = index;
    dbAccessVisible.value = true;
    dbAccessPassword.value = '';
    dbAccessError.value = '';
    return;
  }
  router.push(index);
};

const confirmDbAccess = async () => {
  dbAccessError.value = '';
  dbAccessVerifying.value = true;

  try {
    await authApi.verifyDbAccess(dbAccessPassword.value);
    ElMessage.success('验证成功');
    dbAccessVisible.value = false;
    dbAccessPassword.value = '';
    if (pendingRoute.value) {
      persistSidebarScroll();
      router.push(pendingRoute.value);
    }
  } catch (error: any) {
    dbAccessError.value = error?.response?.data?.message || '密码错误，请重试';
  } finally {
    dbAccessVerifying.value = false;
  }
};

const handleLogout = () => {
  ElMessageBox.confirm('确定要退出登录吗？', '提示', {
    confirmButtonText: '确定',
    cancelButtonText: '取消',
    type: 'warning'
  })
    .then(async () => {
      await authStore.logout();
      ElMessage.success('已退出登录');
      router.push('/login');
    })
    .catch(() => {
      // 取消退出
    });
};

const goToProfile = () => {
  router.push('/profile');
};

onMounted(() => {
  tenantStore.applyActiveTenantTheme();
  restoreSidebarScroll();
});

onBeforeUnmount(() => {
  persistSidebarScroll();
});

watch(
  () => route.path,
  () => {
    restoreSidebarScroll();
  }
);
</script>

<style scoped>
.admin-layout {
  height: 100dvh;
  display: flex;
  color: var(--admin-ink);
  background:
    radial-gradient(circle at top left, var(--admin-primary-alpha-08), transparent 34rem),
    var(--admin-page);
}

.admin-sidebar {
  width: 252px;
  background:
    radial-gradient(circle at 26px 28px, rgba(255, 255, 255, 0.13), transparent 7rem),
    linear-gradient(180deg, var(--admin-sidebar) 0%, var(--admin-sidebar-deep) 100%);
  display: flex;
  flex-direction: column;
  box-shadow: 12px 0 34px rgba(31, 42, 36, 0.16);
  position: relative;
  z-index: 2;
}

.sidebar-header {
  padding: 24px 18px 20px;
  color: white;
  border-bottom: 1px solid rgba(255, 255, 255, 0.09);
  display: flex;
  align-items: center;
  gap: 12px;
}

.brand-mark {
  width: 42px;
  height: 42px;
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.08);
  display: grid;
  place-items: center;
  box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.12);
}

.sidebar-logo {
  width: 32px;
  height: 32px;
  border-radius: 9px;
  object-fit: cover;
}

.brand-copy {
  min-width: 0;
}

.sidebar-header h2 {
  margin: 0;
  color: #f6f3e9;
  font-size: 18px;
  font-weight: 600;
  line-height: 1.25;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.brand-copy p {
  margin: 3px 0 0;
  color: rgba(246, 243, 233, 0.58);
  font-size: 12px;
  font-weight: 500;
}

.sidebar-menu {
  flex: 1;
  background: transparent;
  border-right: none;
  padding: 12px 10px;
  overflow-y: auto;
}

.sidebar-menu::-webkit-scrollbar {
  width: 4px;
}

.sidebar-menu::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.16);
  border-radius: 999px;
}

.sidebar-menu :deep(.el-menu-item) {
  color: rgba(246, 243, 233, 0.72);
  background-color: transparent;
  height: 40px;
  line-height: 40px;
  margin: 2px 0;
  padding: 0 12px !important;
  border-radius: 10px;
  font-size: 14px;
  font-weight: 500;
  transition:
    color 0.18s ease,
    background-color 0.18s ease,
    transform 0.18s ease;
}

.nav-icon {
  width: 18px;
  margin-right: 10px;
  color: rgba(246, 243, 233, 0.58);
  transition: color 0.18s ease;
}

.sidebar-menu :deep(.el-menu-item:hover) {
  color: #fffaf0;
  background-color: rgba(255, 255, 255, 0.08) !important;
  transform: translateX(2px);
}

.sidebar-menu :deep(.el-menu-item:hover .nav-icon) {
  color: #fffaf0;
}

.sidebar-menu :deep(.el-menu-item.is-active) {
  color: #fffaf0;
  background: rgba(255, 255, 255, 0.13) !important;
  box-shadow: inset 3px 0 0 var(--admin-primary-light);
}

.sidebar-menu :deep(.el-menu-item.is-active .nav-icon) {
  color: var(--admin-primary-light);
}

.sidebar-menu :deep(.el-menu-item-group__title) {
  color: rgba(246, 243, 233, 0.42) !important;
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.08em;
  padding: 16px 12px 7px !important;
  background-color: transparent !important;
}

.sidebar-footer {
  padding: 14px 16px 18px;
  border-top: 1px solid rgba(255, 255, 255, 0.09);
}

.logout-button {
  width: 100%;
  justify-content: flex-start;
  color: rgba(246, 243, 233, 0.72) !important;
  padding: 9px 10px !important;
  border-radius: 10px !important;
}

.logout-button:hover {
  color: #fffaf0 !important;
  background: rgba(185, 76, 67, 0.16) !important;
}

.admin-main {
  flex: 1;
  display: flex;
  flex-direction: column;
}

.admin-header {
  background: rgba(255, 255, 255, 0.83);
  border-bottom: 1px solid var(--admin-border);
  padding: 0;
  height: 72px;
  backdrop-filter: blur(18px);
  position: sticky;
  top: 0;
  z-index: 1;
}

.header-content {
  height: 100%;
  padding: 0 28px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 24px;
}

.header-title h3 {
  margin: 0;
  color: var(--admin-ink);
  font-size: 20px;
  font-weight: 600;
  line-height: 1.25;
}

.header-title p {
  margin: 4px 0 0;
  color: var(--admin-ink-muted);
  font-size: 13px;
  line-height: 1.4;
}

.header-right {
  display: flex;
  align-items: center;
  gap: 12px;
}

.header-user {
  display: flex;
  align-items: center;
  gap: 12px;
}

.profile-entry {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  border: 1px solid transparent;
  background: rgba(255, 255, 255, 0.54);
  padding: 4px 9px 4px 4px;
  margin: 0;
  border-radius: 12px;
  color: var(--admin-ink-soft);
  transition:
    background-color 0.18s ease,
    border-color 0.18s ease,
    transform 0.18s ease;
}

.profile-entry:hover {
  background: #fff;
  border-color: var(--admin-border);
  transform: translateY(-1px);
}

.profile-entry:focus-visible {
  outline: 2px solid var(--admin-primary-alpha-40);
  outline-offset: 2px;
}

.profile-avatar {
  border-radius: 10px !important;
  background: var(--admin-primary-soft) !important;
  color: var(--admin-primary-dark) !important;
}

.user-name {
  color: var(--admin-ink-soft);
  font-size: 14px;
  font-weight: 500;
}

.admin-content {
  flex: 1;
  background:
    linear-gradient(rgba(255, 255, 255, 0.32) 1px, transparent 1px),
    linear-gradient(90deg, rgba(255, 255, 255, 0.28) 1px, transparent 1px),
    var(--admin-page);
  background-size: 42px 42px;
  overflow: auto;
  padding: 0;
}

.db-access-form {
  padding: 16px 0;
}

.db-access-form .warning-text {
  margin: 0 0 16px;
  color: var(--admin-danger);
  font-size: 13px;
  line-height: 1.6;
  font-weight: 500;
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 12px;
  background: rgba(185, 76, 67, 0.08);
  border: 1px solid rgba(185, 76, 67, 0.14);
  border-radius: 10px;
}

.db-access-form :deep(.el-input) {
  margin-bottom: 12px;
}

.error-text {
  color: var(--admin-danger);
  font-size: 12px;
  margin-top: 8px;
  padding: 8px 10px;
  background: rgba(185, 76, 67, 0.08);
  border-radius: 8px;
  border-left: 3px solid var(--admin-danger);
}

@media (max-width: 1180px) {
  .admin-sidebar {
    width: 228px;
  }

  .header-content {
    padding: 0 20px;
  }
}

@media (max-width: 860px) {
  .admin-layout {
    display: block;
    height: auto;
    min-height: 100dvh;
  }

  .admin-sidebar {
    width: 100%;
    min-height: auto;
  }

  .sidebar-menu {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    max-height: 360px;
  }

  .admin-header {
    height: auto;
  }

  .header-content {
    align-items: flex-start;
    flex-direction: column;
    padding: 16px;
  }
}
</style>
