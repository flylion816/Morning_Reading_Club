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
  --admin-primary: #5b7f4a;
  --admin-primary-dark: #46643a;
  --admin-primary-deep: #263a2d;
  --admin-primary-light: #789a65;
  --admin-primary-soft: #edf4e9;
  --admin-primary-tint: #d9e5d3;
  --admin-primary-shadow: rgba(91, 127, 74, 0.24);
  --admin-ink: #1f2a24;
  --admin-ink-soft: #546158;
  --admin-ink-muted: #7c887e;
  --el-color-primary: #5b7f4a;
  --el-color-primary-light-3: #789a65;
  --el-color-primary-light-5: #9bb48d;
  --el-color-primary-light-7: #c4d5bc;
  --el-color-primary-light-8: #d9e5d3;
  --el-color-primary-light-9: #edf4e9;
  --el-color-primary-dark-2: #46643a;
  min-height: 100dvh;
  position: relative;
  display: grid;
  grid-template-columns: minmax(320px, 560px) minmax(320px, 500px);
  align-content: center;
  justify-content: center;
  gap: 0;
  padding: clamp(22px, 4vw, 58px);
  background:
    radial-gradient(circle at 18% 16%, rgba(213, 198, 138, 0.22), transparent 26rem),
    radial-gradient(circle at 88% 82%, rgba(91, 127, 74, 0.12), transparent 24rem),
    linear-gradient(135deg, #eee7d8 0%, #dcd3bf 100%);
  overflow: hidden;
}

.login-page::before {
  content: "";
  position: absolute;
  inset: 0;
  pointer-events: none;
  opacity: 0.32;
  background-image:
    linear-gradient(rgba(77, 62, 38, 0.06) 1px, transparent 1px),
    linear-gradient(90deg, rgba(77, 62, 38, 0.04) 1px, transparent 1px);
  background-size: 26px 26px;
}

.login-page::after {
  content: "";
  position: absolute;
  top: clamp(22px, 4vw, 58px);
  bottom: clamp(22px, 4vw, 58px);
  left: 50%;
  width: 28px;
  transform: translateX(-50%);
  pointer-events: none;
  z-index: 4;
  background:
    linear-gradient(90deg, rgba(75, 55, 28, 0.2), rgba(255, 255, 255, 0.12) 44%, rgba(75, 55, 28, 0.18)),
    linear-gradient(180deg, transparent, rgba(75, 55, 28, 0.15), transparent);
  filter: blur(0.2px);
}

.login-left {
  position: relative;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  justify-content: center;
  min-height: min(760px, calc(100dvh - 88px));
  padding: clamp(44px, 6vw, 78px);
  color: var(--admin-ink);
  background:
    radial-gradient(circle at 22% 20%, rgba(255, 255, 255, 0.82), transparent 17rem),
    linear-gradient(90deg, rgba(82, 58, 30, 0.05), transparent 11%),
    linear-gradient(135deg, #fffaf0 0%, #f6efdD 100%);
  border: 1px solid rgba(91, 74, 42, 0.14);
  border-right: 0;
  border-radius: 28px 0 0 28px;
  box-shadow:
    -18px 26px 56px rgba(54, 42, 26, 0.2),
    inset -18px 0 28px rgba(75, 55, 28, 0.08);
  z-index: 2;
}

.login-left::before,
.login-right::before {
  content: "";
  position: absolute;
  inset: 22px 28px;
  pointer-events: none;
  background:
    repeating-linear-gradient(
      180deg,
      transparent 0,
      transparent 31px,
      rgba(91, 74, 42, 0.07) 32px
    );
  opacity: 0.34;
}

.login-left::after {
  content: "";
  position: absolute;
  right: -1px;
  top: 0;
  bottom: 0;
  width: 36px;
  background: linear-gradient(90deg, transparent, rgba(65, 47, 25, 0.12));
  pointer-events: none;
}

.login-brand {
  position: relative;
  z-index: 1;
  max-width: 560px;
  margin-bottom: 54px;
}

.brand-kicker {
  margin-bottom: 18px;
  color: var(--admin-primary-dark);
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
  color: var(--admin-primary-deep);
  text-wrap: balance;
}

.login-brand p {
  margin: 18px 0 0;
  color: var(--admin-ink-soft);
  font-size: 18px;
  font-weight: 500;
}

.brand-tagline {
  max-width: 30em;
  margin-top: 18px;
  color: var(--admin-ink-muted);
  font-size: 14px;
  line-height: 1.8;
}

.ambient-book {
  position: absolute;
  right: clamp(24px, 5vw, 82px);
  bottom: clamp(28px, 6vw, 90px);
  width: 240px;
  height: 144px;
  opacity: 0.16;
  transform: rotate(-7deg);
}

.ambient-book span {
  position: absolute;
  inset: 0;
  border: 1px solid rgba(70, 100, 58, 0.42);
  border-radius: 16px 24px 24px 16px;
  transform-origin: left center;
}

.ambient-book span:last-child {
  transform: rotateY(24deg) translateX(24px);
  border-left-color: rgba(91, 127, 74, 0.7);
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
  background: rgba(255, 255, 255, 0.4);
  color: var(--admin-ink-soft);
  font-size: 14px;
  transition:
    transform 0.2s ease,
    background-color 0.2s ease;
}

.feature-item:hover {
  background: rgba(255, 255, 255, 0.66);
  transform: translateX(4px);
}

.feature-icon {
  color: var(--admin-primary);
  font-size: 18px;
}

.feature-text {
  font-weight: 500;
}

.login-right {
  position: relative;
  min-height: min(760px, calc(100dvh - 88px));
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: clamp(44px, 6vw, 78px) clamp(28px, 5vw, 64px);
  background:
    radial-gradient(circle at 82% 18%, rgba(213, 198, 138, 0.18), transparent 14rem),
    linear-gradient(270deg, rgba(82, 58, 30, 0.05), transparent 12%),
    linear-gradient(135deg, #fffdf7 0%, #f8f0df 100%);
  border: 1px solid rgba(91, 74, 42, 0.14);
  border-left: 0;
  border-radius: 0 28px 28px 0;
  box-shadow:
    18px 26px 56px rgba(54, 42, 26, 0.2),
    inset 18px 0 28px rgba(75, 55, 28, 0.08);
  z-index: 2;
}

.login-right::after {
  content: "";
  position: absolute;
  left: -1px;
  top: 0;
  bottom: 0;
  width: 36px;
  background: linear-gradient(270deg, transparent, rgba(65, 47, 25, 0.1));
  pointer-events: none;
}

.login-form-wrapper {
  position: relative;
  z-index: 1;
  width: 100%;
  max-width: 420px;
  padding: 12px 10px;
  border: 0;
  border-radius: 0;
  background: transparent;
  box-shadow: none;
  backdrop-filter: none;
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

.login-form :deep(.el-input__wrapper) {
  min-height: 46px;
  background: rgba(255, 255, 255, 0.74);
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
  position: relative;
  z-index: 1;
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
    grid-template-columns: minmax(0, 720px);
  }

  .login-page::after {
    display: none;
  }

  .login-left {
    min-height: 280px;
    justify-content: flex-start;
    padding: 40px 24px;
    border-radius: 24px 24px 0 0;
    border-right: 1px solid rgba(91, 74, 42, 0.14);
    border-bottom: 0;
  }

  .login-left::after,
  .login-right::after {
    display: none;
  }

  .login-brand {
    margin-bottom: 36px;
  }

  .login-brand h1 {
    font-size: 36px;
  }

  .login-right {
    padding: 40px 20px 20px;
    min-height: auto;
    border-radius: 0 0 24px 24px;
    border-left: 1px solid rgba(91, 74, 42, 0.14);
    border-top: 0;
  }

  .login-form-wrapper {
    padding: 20px 10px;
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
