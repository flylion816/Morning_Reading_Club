<template>
  <el-container class="admin-layout">
    <el-aside class="admin-sidebar">
      <div class="sidebar-header">
        <h2>凡人共读</h2>
      </div>

      <el-menu
        :default-active="activeMenu"
        class="sidebar-menu"
        @select="handleMenuSelect"
      >
        <!-- 数据看板区块 -->
        <el-menu-item-group title="数据看板">
          <el-menu-item index="/">
            <span>📊 仪表板</span>
          </el-menu-item>
          <el-menu-item index="/analytics">
            <span>📈 数据分析</span>
          </el-menu-item>
        </el-menu-item-group>

        <!-- 业务管理区块 -->
        <el-menu-item-group title="业务管理">
          <el-menu-item index="/enrollments">
            <span>📝 报名管理</span>
          </el-menu-item>
          <el-menu-item index="/users">
            <span>👥 用户管理</span>
          </el-menu-item>
          <el-menu-item index="/payments">
            <span>💳 支付记录</span>
          </el-menu-item>
          <el-menu-item index="/periods">
            <span>📅 期次管理</span>
          </el-menu-item>
          <el-menu-item index="/content">
            <span>✍️ 内容管理</span>
          </el-menu-item>
        </el-menu-item-group>

        <!-- 内容管理区块 -->
        <el-menu-item-group title="内容管理">
          <el-menu-item index="/checkins">
            <span>📍 每日打卡</span>
          </el-menu-item>
          <el-menu-item index="/insights">
            <span>👀 小凡看见</span>
          </el-menu-item>
          <el-menu-item index="/insight-requests">
            <span>📋 查看申请</span>
          </el-menu-item>
          <el-menu-item index="/audit-logs">
            <span>🔍 审计日志</span>
          </el-menu-item>
        </el-menu-item-group>

        <!-- 系统管理区块 -->
        <el-menu-item-group title="系统管理">
          <el-menu-item index="/account-management" v-if="authStore.adminInfo?.role === 'superadmin'">
            <span>👤 账号管理</span>
          </el-menu-item>
          <el-menu-item index="/subscription-debug">
            <span>🔔 订阅消息排查</span>
          </el-menu-item>
          <el-menu-item index="/database">
            <span>🗄️ 数据库管理</span>
          </el-menu-item>
        </el-menu-item-group>
      </el-menu>

      <div class="sidebar-footer">
        <el-button
          type="danger"
          text
          style="width: 100%; justify-content: flex-start"
          @click="handleLogout"
        >
          <span>🚪 退出登录</span>
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
          <div class="header-user">
            <button class="profile-entry" type="button" @click="goToProfile">
              <el-avatar
                :src="authStore.adminInfo?.avatar"
                shape="circle"
                :size="36"
                :fallback="true"
              >
                <span style="font-size: 20px">👨‍💼</span>
              </el-avatar>
              <span class="user-name">{{ authStore.adminInfo?.name }}</span>
            </button>
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
        <p class="warning-text">
          ⚠️ 您正在访问敏感的数据库管理功能，请输入验证密码
        </p>
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
import { computed, ref } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { useAuthStore } from '../stores/auth';
import { authApi } from '../services/api';
import { ElMessage, ElMessageBox } from 'element-plus';

const router = useRouter();
const route = useRoute();
const authStore = useAuthStore();

const activeMenu = computed(() => route.path);

const dbAccessVisible = ref(false);
const dbAccessPassword = ref('');
const dbAccessError = ref('');
const dbAccessVerifying = ref(false);
const pendingRoute = ref<string | null>(null);

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
    '/insight-requests': '查看申请',
    '/subscription-debug': '订阅消息排查',
    '/audit-logs': '审计日志',
    '/database': '数据库管理',
    '/account-management': '账号管理',
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

const handleMenuSelect = (index: string) => {
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
</script>

<style scoped>
.admin-layout {
  height: 100vh;
  display: flex;
}

.admin-sidebar {
  width: 240px;
  background: linear-gradient(180deg, #2c3e50 0%, #34495e 100%);
  display: flex;
  flex-direction: column;
  box-shadow: 2px 0 8px rgba(0, 0, 0, 0.1);
}

.sidebar-header {
  padding: 24px 16px;
  color: white;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.sidebar-header h2 {
  margin: 0;
  font-size: 20px;
  font-weight: 600;
}

.sidebar-menu {
  flex: 1;
  background: transparent;
  border-right: none;
}

.sidebar-menu :deep(.el-menu-item) {
  color: rgba(255, 255, 255, 0.7);
  background-color: transparent;
  height: 48px;
  line-height: 48px;
}

.sidebar-menu :deep(.el-menu-item:hover) {
  color: white;
  background-color: rgba(255, 255, 255, 0.1) !important;
}

.sidebar-menu :deep(.el-menu-item.is-active) {
  background-color: #667eea !important;
  color: white;
  border-right: 4px solid #667eea;
}

/* Customize Element Plus menu item group title styling */
.sidebar-menu :deep(.el-menu-item-group__title) {
  color: rgba(255, 255, 255, 0.5) !important;
  font-size: 12px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  padding: 12px 16px 8px !important;
  background-color: transparent !important;
}

.sidebar-footer {
  padding: 16px;
  border-top: 1px solid rgba(255, 255, 255, 0.1);
}

.sidebar-footer :deep(.el-button) {
  padding-left: 0 !important;
  padding-right: 0 !important;
}

.admin-main {
  flex: 1;
  display: flex;
  flex-direction: column;
}

.admin-header {
  background: white;
  border-bottom: 1px solid #f0f0f0;
  padding: 0;
  height: 64px;
}

.header-content {
  height: 100%;
  padding: 0 24px;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.header-title h3 {
  margin: 0;
  font-size: 18px;
  color: #333;
  font-weight: 600;
}

.header-title p {
  margin: 4px 0 0;
  color: #777;
  font-size: 13px;
}

.header-user {
  display: flex;
  align-items: center;
  gap: 12px;
}

.profile-entry {
  display: inline-flex;
  align-items: center;
  gap: 12px;
  border: none;
  background: transparent;
  padding: 0;
  margin: 0;
  cursor: pointer;
  color: inherit;
  font: inherit;
}

.profile-entry:focus-visible {
  outline: 2px solid var(--el-color-primary);
  outline-offset: 2px;
  border-radius: 6px;
}

.user-name {
  color: #666;
  font-size: 14px;
}

.admin-content {
  flex: 1;
  background: #f5f7fa;
  overflow: auto;
}

/* 数据库访问验证样式 */
.db-access-form {
  padding: 16px 0;
}

.db-access-form .warning-text {
  margin: 0 0 16px 0;
  color: #f56c6c;
  font-size: 13px;
  line-height: 1.6;
  font-weight: 500;
}

.db-access-form :deep(.el-input) {
  margin-bottom: 12px;
}

.error-text {
  color: #f56c6c;
  font-size: 12px;
  margin-top: 8px;
  padding: 8px 8px;
  background: #fef0f0;
  border-radius: 4px;
  border-left: 3px solid #f56c6c;
}
</style>
