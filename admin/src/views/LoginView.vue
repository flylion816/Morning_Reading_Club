<template>
  <div class="login-page">
    <!-- 左侧内容区域 -->
    <div class="login-left">
      <div class="login-brand">
        <h1>凡人共读</h1>
        <p>管理后台</p>
        <div class="brand-tagline">专业的晨读营学习管理平台</div>
      </div>

      <div class="login-features">
        <div class="feature-item">
          <span class="feature-icon">✨</span>
          <span class="feature-text">直观的数据管理</span>
        </div>
        <div class="feature-item">
          <span class="feature-icon">🎓</span>
          <span class="feature-text">完整的学习跟踪</span>
        </div>
        <div class="feature-item">
          <span class="feature-icon">📊</span>
          <span class="feature-text">详细的统计分析</span>
        </div>
      </div>
    </div>

    <!-- 右侧登录表单区域 -->
    <div class="login-right">
      <div class="login-form-wrapper">
        <div class="login-header">
          <h2>欢迎登录</h2>
          <p>输入您的凭证以访问管理面板</p>
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
          style="margin-bottom: 20px"
          @close="authStore.clearError"
        />

        <div v-if="isDev" class="login-tips">
          <p><span class="tip-label">演示账号：</span><code>admin@morningreading.com</code></p>
          <p><span class="tip-label">演示密码：</span><code>admin123456</code></p>
        </div>
      </div>

      <div class="login-footer">
        <p>&copy; 2025 凡人共读. All rights reserved.</p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '../stores/auth';
import { ElMessage, type FormInstance } from 'element-plus';

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
      // 登录成功后，等待一个 tick 确保 Pinia store 已完全更新
      // 然后使用 router.push 导航到 dashboard
      // 注：vite.config 中已移除 base 配置，所以 app 在根路径运行
      await new Promise(resolve => setTimeout(resolve, 100));
      await router.push({ name: 'dashboard' });
    } else {
      // 错误提示已由 el-alert 显示
    }
  });
};
</script>

<style scoped>
.login-page {
  min-height: 100vh;
  display: flex;
  background: #f5f7fa;
}

/* 左侧品牌区域 */
.login-left {
  flex: 1;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40px 20px;
  color: white;
}

.login-brand {
  text-align: center;
  margin-bottom: 60px;
}

.login-brand h1 {
  margin: 0;
  font-size: 48px;
  font-weight: 700;
  letter-spacing: 2px;
  margin-bottom: 8px;
}

.login-brand p {
  margin: 0;
  font-size: 18px;
  font-weight: 300;
  opacity: 0.9;
  margin-bottom: 16px;
}

.brand-tagline {
  font-size: 14px;
  opacity: 0.7;
  letter-spacing: 1px;
}

.login-features {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.feature-item {
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 16px;
  opacity: 0.95;
  transition: transform 0.3s;
}

.feature-item:hover {
  transform: translateX(8px);
}

.feature-icon {
  font-size: 24px;
}

.feature-text {
  font-weight: 500;
}

/* 右侧登录表单区域 */
.login-right {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40px 20px;
}

.login-form-wrapper {
  width: 100%;
  max-width: 420px;
  background: white;
  border-radius: 16px;
  padding: 48px 40px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
}

.login-header {
  text-align: center;
  margin-bottom: 32px;
}

.login-header h2 {
  margin: 0;
  font-size: 28px;
  color: #333;
  font-weight: 600;
  margin-bottom: 8px;
}

.login-header p {
  margin: 0;
  font-size: 14px;
  color: #999;
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
  font-size: 16px;
  font-weight: 500;
  height: 44px;
}

.login-tips {
  background: #f9f9f9;
  border-radius: 8px;
  padding: 16px;
  margin-top: 24px;
  border-left: 4px solid #667eea;
}

.login-tips p {
  margin: 8px 0;
  font-size: 13px;
  color: #666;
  display: flex;
  align-items: center;
}

.login-tips p:first-child {
  margin-top: 0;
}

.login-tips p:last-child {
  margin-bottom: 0;
}

.tip-label {
  font-weight: 600;
  color: #333;
  margin-right: 8px;
  min-width: 70px;
}

.login-tips code {
  background: #f0f0f0;
  padding: 2px 8px;
  border-radius: 4px;
  font-family: 'Courier New', monospace;
  color: #667eea;
  font-weight: 500;
}

.login-footer {
  text-align: center;
  margin-top: 32px;
  color: #999;
  font-size: 13px;
}

.login-footer p {
  margin: 0;
}

/* 响应式布局 */
@media (max-width: 1024px) {
  .login-page {
    flex-direction: column;
  }

  .login-left {
    padding: 30px 20px;
    min-height: 200px;
    justify-content: flex-start;
    padding-top: 40px;
  }

  .login-brand {
    margin-bottom: 40px;
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
}

@media (max-width: 768px) {
  .login-brand h1 {
    font-size: 32px;
  }

  .login-brand p {
    font-size: 16px;
  }

  .login-features {
    gap: 16px;
  }

  .login-form-wrapper {
    padding: 32px 20px;
    box-shadow: none;
    border: 1px solid #e8e8e8;
  }

  .login-header h2 {
    font-size: 24px;
  }
}
</style>
