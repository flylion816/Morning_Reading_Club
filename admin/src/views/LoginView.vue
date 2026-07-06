<template>
  <div class="login-page">
    <div class="login-left">
      <div class="ambient-book" aria-hidden="true">
        <span></span>
        <span></span>
      </div>

      <div class="login-brand">
        <div class="brand-kicker">Morning reading admin</div>
        <h1>高效能人士的七个习惯</h1>
        <p>管理后台</p>
        <div class="brand-tagline">
          把报名、营期、打卡和内容放在一个安静的工作台里。
        </div>
      </div>

      <div class="login-features">
        <div class="feature-item">
          <el-icon class="feature-icon"><DataBoard /></el-icon>
          <span class="feature-text">直观的数据管理</span>
        </div>
        <div class="feature-item">
          <el-icon class="feature-icon"><Reading /></el-icon>
          <span class="feature-text">完整的学习跟踪</span>
        </div>
        <div class="feature-item">
          <el-icon class="feature-icon"><TrendCharts /></el-icon>
          <span class="feature-text">清楚的运营分析</span>
        </div>
      </div>
    </div>

    <div class="login-right">
      <div class="login-form-wrapper">
        <div class="login-header">
          <span class="login-eyebrow">管理员登录</span>
          <h2>回到运营台</h2>
          <p>输入账号后继续处理今日运营事项。</p>
        </div>

        <el-form
          ref="formRef"
          :model="form"
          :rules="rules"
          class="login-form"
          @submit.prevent="handleLogin"
        >
          <el-form-item prop="email">
            <el-input
              v-model="form.email"
              placeholder="邮箱地址"
              type="email"
              prefix-icon="Message"
              clearable
              size="large"
            />
          </el-form-item>

          <el-form-item prop="password">
            <el-input
              v-model="form.password"
              placeholder="密码"
              type="password"
              prefix-icon="Lock"
              show-password
              size="large"
              @keyup.enter="handleLogin"
            />
          </el-form-item>

          <el-form-item>
            <el-button
              type="primary"
              class="login-btn"
              :loading="authStore.loading"
              size="large"
              @click="handleLogin"
            >
              {{ authStore.loading ? '登录中...' : '登录' }}
            </el-button>
          </el-form-item>
        </el-form>

        <el-alert
          v-if="authStore.error"
          :title="authStore.error"
          type="error"
          :closable="true"
          class="login-error"
          @close="authStore.clearError"
        />

        <div v-if="isDev" class="login-tips">
          <p><span class="tip-label">演示账号：</span><code>admin@morningreading.com</code></p>
          <p><span class="tip-label">演示密码：</span><code>admin123456</code></p>
        </div>
      </div>

      <div class="login-footer">
        <p>&copy; 2026 高效能人士的七个习惯</p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '../stores/auth';
import { ElMessage, type FormInstance } from 'element-plus';
import { DataBoard, Reading, TrendCharts } from '@element-plus/icons-vue';

const router = useRouter();
const authStore = useAuthStore();
const formRef = ref<FormInstance>();

const isDev = import.meta.env.DEV;

const form = reactive({
  email: isDev ? 'admin@morningreading.com' : '',
  password: ''
});

const rules = {
  email: [
    { required: true, message: '请输入邮箱地址', trigger: 'blur' },
    { type: 'email', message: '请输入正确的邮箱地址', trigger: 'blur' }
  ],
  password: [
    { required: true, message: '请输入密码', trigger: 'blur' },
    { min: 6, message: '密码长度不能少于6位', trigger: 'blur' }
  ]
};

const handleLogin = async () => {
  if (!formRef.value) return;

  await formRef.value.validate(async valid => {
    if (!valid) return;

    const success = await authStore.login(form.email, form.password);

    if (success) {
      ElMessage.success('登录成功');
      await new Promise(resolve => setTimeout(resolve, 100));
      await router.push({ name: 'dashboard' });
    }
  });
};
</script>

<style scoped>
.login-page {
  min-height: 100dvh;
  display: flex;
  background:
    radial-gradient(circle at 18% 20%, rgba(91, 127, 74, 0.14), transparent 24rem),
    linear-gradient(135deg, #f5f2e9 0%, #ebe7dc 100%);
}

.login-left {
  flex: 1;
  position: relative;
  overflow: hidden;
  background:
    radial-gradient(circle at 24% 22%, rgba(213, 198, 138, 0.28), transparent 16rem),
    linear-gradient(145deg, #203126 0%, #17241d 100%);
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  justify-content: center;
  padding: 72px clamp(40px, 7vw, 92px);
  color: #fffaf0;
}

.login-brand {
  position: relative;
  z-index: 1;
  max-width: 560px;
  margin-bottom: 54px;
}

.brand-kicker {
  margin-bottom: 18px;
  color: rgba(255, 250, 240, 0.56);
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

.login-brand h1 {
  margin: 0;
  max-width: 10em;
  font-size: clamp(40px, 5vw, 64px);
  font-weight: 600;
  line-height: 1.08;
  text-wrap: balance;
}

.login-brand p {
  margin: 18px 0 0;
  color: rgba(255, 250, 240, 0.82);
  font-size: 18px;
  font-weight: 500;
}

.brand-tagline {
  max-width: 30em;
  margin-top: 18px;
  color: rgba(255, 250, 240, 0.62);
  font-size: 14px;
  line-height: 1.8;
}

.ambient-book {
  position: absolute;
  right: clamp(28px, 7vw, 110px);
  bottom: clamp(42px, 8vw, 120px);
  width: 220px;
  height: 132px;
  opacity: 0.18;
  transform: rotate(-8deg);
}

.ambient-book span {
  position: absolute;
  inset: 0;
  border: 1px solid rgba(255, 250, 240, 0.42);
  border-radius: 16px 24px 24px 16px;
  transform-origin: left center;
}

.ambient-book span:last-child {
  transform: rotateY(24deg) translateX(24px);
  border-left-color: rgba(213, 198, 138, 0.8);
}

.login-features {
  position: relative;
  z-index: 1;
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.feature-item {
  display: flex;
  align-items: center;
  gap: 12px;
  width: fit-content;
  padding: 10px 12px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.05);
  color: rgba(255, 250, 240, 0.86);
  font-size: 14px;
  transition:
    transform 0.2s ease,
    background-color 0.2s ease;
}

.feature-item:hover {
  background: rgba(255, 255, 255, 0.08);
  transform: translateX(4px);
}

.feature-icon {
  color: #d5c68a;
  font-size: 18px;
}

.feature-text {
  font-weight: 500;
}

.login-right {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 44px 24px;
}

.login-form-wrapper {
  width: 100%;
  max-width: 420px;
  padding: 48px 40px;
  border: 1px solid rgba(63, 78, 64, 0.12);
  border-radius: 20px;
  background: rgba(255, 255, 255, 0.9);
  box-shadow: 0 24px 60px rgba(46, 57, 43, 0.12);
  backdrop-filter: blur(18px);
}

.login-header {
  margin-bottom: 32px;
  text-align: left;
}

.login-eyebrow {
  color: var(--admin-primary);
  font-size: 12px;
  font-weight: 600;
}

.login-header h2 {
  margin: 8px 0 0;
  color: var(--admin-ink);
  font-size: 30px;
  font-weight: 600;
  line-height: 1.2;
}

.login-header p {
  margin: 8px 0 0;
  color: var(--admin-ink-muted);
  font-size: 14px;
}

.login-form {
  margin-bottom: 24px;
}

.login-form :deep(.el-form-item) {
  margin-bottom: 20px;
}

.login-form :deep(.el-form-item__label) {
  display: none;
}

.login-btn {
  width: 100%;
  height: 44px;
  border-radius: 11px;
  font-size: 16px;
  font-weight: 600;
}

.login-error {
  margin-bottom: 20px;
  border-radius: 10px;
}

.login-tips {
  margin-top: 24px;
  padding: 16px;
  border-left: 4px solid var(--admin-primary);
  border-radius: 12px;
  background: rgba(237, 244, 233, 0.72);
}

.login-tips p {
  display: flex;
  align-items: center;
  margin: 8px 0;
  color: var(--admin-ink-soft);
  font-size: 13px;
}

.login-tips p:first-child {
  margin-top: 0;
}

.login-tips p:last-child {
  margin-bottom: 0;
}

.tip-label {
  min-width: 70px;
  margin-right: 8px;
  color: var(--admin-ink);
  font-weight: 600;
}

.login-tips code {
  padding: 2px 8px;
  border-radius: 6px;
  background: rgba(255, 255, 255, 0.68);
  color: var(--admin-primary-dark);
  font-family: var(--admin-font-number);
  font-weight: 500;
}

.login-footer {
  margin-top: 32px;
  color: var(--admin-ink-muted);
  font-size: 13px;
  text-align: center;
}

.login-footer p {
  margin: 0;
}

@media (max-width: 1024px) {
  .login-page {
    flex-direction: column;
  }

  .login-left {
    min-height: 280px;
    justify-content: flex-start;
    padding: 40px 24px;
  }

  .login-brand {
    margin-bottom: 36px;
  }

  .login-brand h1 {
    font-size: 36px;
  }

  .login-right {
    padding: 40px 20px 20px;
  }

  .login-form-wrapper {
    padding: 40px 30px;
  }

  .ambient-book {
    display: none;
  }
}

@media (max-width: 768px) {
  .login-brand h1 {
    font-size: 32px;
  }

  .login-brand p {
    font-size: 16px;
  }

  .login-features {
    gap: 12px;
  }

  .login-form-wrapper {
    padding: 32px 20px;
  }

  .login-header h2 {
    font-size: 24px;
  }
}
</style>
