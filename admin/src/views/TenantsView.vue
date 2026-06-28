<template>
  <AdminLayout>
    <div class="tenants-container">
      <!-- 操作栏 -->
      <el-card style="margin-bottom: 20px">
        <div class="action-bar">
          <el-button type="primary" @click="handleCreate">
            <span style="margin-right: 4px">➕</span>新建租户
          </el-button>
          <el-button style="margin-left: 12px" @click="loadTenants">
            <span style="margin-right: 4px">🔄</span>刷新
          </el-button>
        </div>
      </el-card>

      <!-- 租户列表 -->
      <el-card>
        <el-table
          v-loading="loading"
          :data="tenants"
          stripe
          style="width: 100%"
        >
          <el-table-column prop="name" label="名称" width="180" />
          <el-table-column prop="slug" label="Slug" width="140" />
          <el-table-column label="租户 ID" width="220">
            <template #default="{ row }">
              <span style="font-family: monospace; font-size: 12px; color: #888">{{ row._id }}</span>
            </template>
          </el-table-column>
          <el-table-column label="状态" width="90">
            <template #default="{ row }">
              <el-tag :type="getStatusType(row.status)">
                {{ formatStatus(row.status) }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column label="小程序数" width="90">
            <template #default="{ row }">
              {{ row.wxAppIds ? row.wxAppIds.length : 0 }}
            </template>
          </el-table-column>
          <el-table-column label="创建时间" width="160">
            <template #default="{ row }">
              {{ formatDate(row.createdAt) }}
            </template>
          </el-table-column>
          <el-table-column label="操作" width="160" fixed="right">
            <template #default="{ row }">
              <el-button type="primary" text size="small" @click="handleEdit(row)">
                编辑
              </el-button>
              <el-button
                :type="row.status === 'active' ? 'warning' : 'success'"
                text
                size="small"
                @click="handleToggleStatus(row)"
              >
                {{ row.status === 'active' ? '暂停' : '恢复' }}
              </el-button>
            </template>
          </el-table-column>
        </el-table>
      </el-card>

      <!-- 新建/编辑弹窗 -->
      <el-dialog
        v-model="dialogVisible"
        :title="isEditing ? '编辑租户' : '新建租户'"
        width="700px"
        :close-on-click-modal="false"
      >
        <el-form
          ref="formRef"
          :model="formData"
          :rules="formRules"
          label-width="120px"
        >
          <!-- 基本信息 -->
          <el-divider content-position="left">基本信息</el-divider>
          <el-form-item label="Slug" prop="slug">
            <el-input
              v-model="formData.slug"
              :disabled="isEditing"
              placeholder="唯一标识，如 fanren"
            />
          </el-form-item>
          <el-form-item label="名称" prop="name">
            <el-input v-model="formData.name" placeholder="显示名称" />
          </el-form-item>
          <el-form-item label="描述">
            <el-input
              v-model="formData.description"
              type="textarea"
              :rows="2"
              placeholder="租户描述（可选）"
            />
          </el-form-item>
          <el-form-item label="状态">
            <el-select v-model="formData.status" style="width: 100%">
              <el-option label="活跃" value="active" />
              <el-option label="暂停" value="suspended" />
              <el-option label="归档" value="archived" />
            </el-select>
          </el-form-item>

          <!-- 小程序配置 -->
          <el-divider content-position="left">小程序配置</el-divider>
          <el-form-item label="AppId 列表">
            <div style="width: 100%">
              <div style="margin-bottom: 8px" v-if="formData.wxAppIds.length">
                <el-tag
                  v-for="(id, index) in formData.wxAppIds"
                  :key="index"
                  closable
                  style="margin-right: 8px; margin-bottom: 4px"
                  @close="formData.wxAppIds.splice(index, 1)"
                >
                  {{ id }}
                </el-tag>
              </div>
              <div style="display: flex; gap: 8px">
                <el-input
                  v-model="newWxAppId"
                  placeholder="输入 appId 后回车或点击添加"
                  @keyup.enter="addWxAppId"
                />
                <el-button @click="addWxAppId">添加</el-button>
              </div>
            </div>
          </el-form-item>
          <el-form-item label="登录 AppId">
            <el-input
              v-model="formData.wechatLogin.appId"
              placeholder="微信登录 appId"
            />
          </el-form-item>
          <el-form-item label="登录 Secret">
            <el-input
              v-model="formData.wechatLogin.appSecret"
              type="password"
              show-password
              placeholder="留空则不修改"
            />
          </el-form-item>
          <el-form-item label="云环境 ID">
            <el-input
              v-model="formData.cloudEnv"
              placeholder="CloudBase 环境 ID，可选"
            />
          </el-form-item>
          <el-form-item label="API 覆盖地址">
            <el-input
              v-model="formData.apiBaseUrl"
              placeholder="留空则按小程序环境配置"
            />
          </el-form-item>

          <!-- 微信支付配置 -->
          <el-divider content-position="left">微信支付配置（可选）</el-divider>
          <el-form-item label="支付 AppId">
            <el-input
              v-model="formData.wechatPay.appId"
              placeholder="微信支付 appId"
            />
          </el-form-item>
          <el-form-item label="商户号">
            <el-input
              v-model="formData.wechatPay.mchId"
              placeholder="微信支付商户号"
            />
          </el-form-item>
          <el-form-item label="支付密钥">
            <el-input
              v-model="formData.wechatPay.apiKey"
              type="password"
              show-password
              placeholder="留空则不修改"
            />
          </el-form-item>

          <!-- 品牌定制 -->
          <el-divider content-position="left">品牌定制</el-divider>
          <el-form-item label="品牌名">
            <el-input
              v-model="formData.branding.brandName"
              placeholder="如 凡人共读"
            />
          </el-form-item>
          <el-form-item label="主色调">
            <el-color-picker v-model="formData.branding.primaryColor" />
          </el-form-item>
          <el-form-item label="Logo URL">
            <el-input
              v-model="formData.branding.logo"
              placeholder="留空则使用 /assets/tenants/<slug>/logo.png"
            />
          </el-form-item>
          <el-form-item label="分享图 URL">
            <el-input
              v-model="formData.branding.shareCover"
              placeholder="留空则使用默认分享图，可填 /assets/tenants/<slug>/share-cover.jpg"
            />
          </el-form-item>
          <el-form-item label="导航栏颜色">
            <el-color-picker v-model="formData.branding.navBarBgColor" />
          </el-form-item>
          <el-form-item label="导航栏文字">
            <el-select v-model="formData.branding.navBarTextStyle" style="width: 100%">
              <el-option label="白色" value="white" />
              <el-option label="黑色" value="black" />
            </el-select>
          </el-form-item>
          <el-form-item label="Tab 默认色">
            <el-color-picker v-model="formData.branding.tabBarColor" />
          </el-form-item>
          <el-form-item label="Tab 选中色">
            <el-color-picker v-model="formData.branding.tabBarSelectedColor" />
          </el-form-item>
          <el-form-item label="Tab 背景色">
            <el-color-picker v-model="formData.branding.tabBarBackgroundColor" />
          </el-form-item>
          <el-form-item label="主体名称">
            <el-input
              v-model="formData.legalEntity"
              placeholder="协议页主体名称，留空则用品牌团队"
            />
          </el-form-item>
          <el-form-item label="联系邮箱">
            <el-input
              v-model="formData.contactEmail"
              placeholder="support@example.com，可选"
            />
          </el-form-item>

          <!-- 订阅消息 -->
          <el-divider content-position="left">订阅消息模板</el-divider>
          <el-form-item label="模板 JSON">
            <el-input
              v-model="formData.subscribeTemplatesText"
              type="textarea"
              :rows="8"
              placeholder='{"enrollment_result":"模板ID"}'
            />
          </el-form-item>
        </el-form>

        <template #footer>
          <el-button @click="dialogVisible = false">取消</el-button>
          <el-button type="primary" :loading="saving" @click="handleSave">
            {{ isEditing ? '保存' : '创建' }}
          </el-button>
        </template>
      </el-dialog>
    </div>
  </AdminLayout>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue';
import AdminLayout from '../components/AdminLayout.vue';
import api from '../services/api';
import { ElMessage, ElMessageBox } from 'element-plus';

const loading = ref(false);
const saving = ref(false);
const tenants = ref<any[]>([]);
const dialogVisible = ref(false);
const isEditing = ref(false);
const editingId = ref('');
const formRef = ref();
const newWxAppId = ref('');

const formData = reactive({
  slug: '',
  name: '',
  description: '',
  status: 'active',
  wxAppIds: [] as string[],
  cloudEnv: '',
  legalEntity: '',
  contactEmail: '',
  apiBaseUrl: '',
  subscribeTemplatesText: '',
  wechatLogin: { appId: '', appSecret: '' },
  wechatPay: { appId: '', mchId: '', apiKey: '' },
  branding: {
    brandName: '',
    primaryColor: '#4a90e2',
    logo: '',
    shareCover: '',
    navBarBgColor: '#4a90e2',
    navBarTextStyle: 'white',
    tabBarColor: '#999999',
    tabBarSelectedColor: '#4a90e2',
    tabBarBackgroundColor: '#ffffff'
  }
});

const formRules = {
  slug: [{ required: true, message: '请输入 Slug', trigger: 'blur' }],
  name: [{ required: true, message: '请输入名称', trigger: 'blur' }]
};

async function loadTenants() {
  loading.value = true;
  try {
    const res = await api.get('/admin/tenants');
    tenants.value = (res as any)?.list || (res as any)?.data || res || [];
  } catch (error) {
    ElMessage.error('加载租户列表失败');
  } finally {
    loading.value = false;
  }
}

function resetForm() {
  formData.slug = '';
  formData.name = '';
  formData.description = '';
  formData.status = 'active';
  formData.wxAppIds = [];
  formData.cloudEnv = '';
  formData.legalEntity = '';
  formData.contactEmail = '';
  formData.apiBaseUrl = '';
  formData.subscribeTemplatesText = '';
  formData.wechatLogin = { appId: '', appSecret: '' };
  formData.wechatPay = { appId: '', mchId: '', apiKey: '' };
  formData.branding = {
    brandName: '',
    primaryColor: '#4a90e2',
    logo: '',
    shareCover: '',
    navBarBgColor: '#4a90e2',
    navBarTextStyle: 'white',
    tabBarColor: '#999999',
    tabBarSelectedColor: '#4a90e2',
    tabBarBackgroundColor: '#ffffff'
  };
  newWxAppId.value = '';
}

function handleCreate() {
  isEditing.value = false;
  editingId.value = '';
  resetForm();
  dialogVisible.value = true;
}

function handleEdit(row: any) {
  isEditing.value = true;
  editingId.value = row._id;
  formData.slug = row.slug;
  formData.name = row.name;
  formData.description = row.description || '';
  formData.status = row.status || 'active';
  formData.wxAppIds = [...(row.wxAppIds || [])];
  formData.cloudEnv = row.cloudEnv || '';
  formData.legalEntity = row.legalEntity || '';
  formData.contactEmail = row.contactEmail || '';
  formData.apiBaseUrl = row.apiBaseUrl || '';
  formData.subscribeTemplatesText = JSON.stringify(row.subscribeTemplates || {}, null, 2);
  formData.wechatLogin = {
    appId: row.wechatLogin?.appId || '',
    appSecret: ''
  };
  formData.wechatPay = {
    appId: row.wechatPay?.appId || '',
    mchId: row.wechatPay?.mchId || '',
    apiKey: ''
  };
  formData.branding = {
    brandName: row.branding?.brandName || '',
    primaryColor: row.branding?.primaryColor || '#4a90e2',
    logo: row.branding?.logo || '',
    shareCover: row.branding?.shareCover || '',
    navBarBgColor: row.branding?.navBarBgColor || row.branding?.primaryColor || '#4a90e2',
    navBarTextStyle: row.branding?.navBarTextStyle || 'white',
    tabBarColor: row.branding?.tabBarColor || '#999999',
    tabBarSelectedColor: row.branding?.tabBarSelectedColor || row.branding?.primaryColor || '#4a90e2',
    tabBarBackgroundColor: row.branding?.tabBarBackgroundColor || '#ffffff'
  };
  dialogVisible.value = true;
}

function addWxAppId() {
  const id = newWxAppId.value.trim();
  if (id && !formData.wxAppIds.includes(id)) {
    formData.wxAppIds.push(id);
    newWxAppId.value = '';
  }
}

async function handleSave() {
  try {
    await formRef.value?.validate();
  } catch {
    return;
  }

  let subscribeTemplates = {};
  try {
    subscribeTemplates = formData.subscribeTemplatesText.trim()
      ? JSON.parse(formData.subscribeTemplatesText)
      : {};
  } catch {
    ElMessage.error('订阅消息模板 JSON 格式错误');
    return;
  }

  saving.value = true;
  try {
    const payload: any = {
      name: formData.name,
      description: formData.description,
      status: formData.status,
      wxAppIds: formData.wxAppIds,
      cloudEnv: formData.cloudEnv,
      legalEntity: formData.legalEntity,
      contactEmail: formData.contactEmail,
      apiBaseUrl: formData.apiBaseUrl,
      subscribeTemplates,
      wechatLogin: { ...formData.wechatLogin },
      wechatPay: { ...formData.wechatPay },
      branding: { ...formData.branding }
    };

    if (isEditing.value) {
      // Secret 字段空值语义：空字符串 = 不修改
      if (!payload.wechatLogin.appSecret) delete payload.wechatLogin.appSecret;
      if (!payload.wechatPay.apiKey) delete payload.wechatPay.apiKey;
      await api.put(`/admin/tenants/${editingId.value}`, payload);
      ElMessage.success('更新成功');
    } else {
      payload.slug = formData.slug;
      await api.post('/admin/tenants', payload);
      ElMessage.success('创建成功');
    }

    dialogVisible.value = false;
    loadTenants();
  } catch (error: any) {
    ElMessage.error(error?.message || '操作失败');
  } finally {
    saving.value = false;
  }
}

async function handleToggleStatus(row: any) {
  const newStatus = row.status === 'active' ? 'suspended' : 'active';
  const label = newStatus === 'active' ? '恢复' : '暂停';
  try {
    await ElMessageBox.confirm(`确定要${label}租户 "${row.name}" 吗？`, '确认', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning'
    });
    await api.put(`/admin/tenants/${row._id}`, { status: newStatus });
    ElMessage.success(`${label}成功`);
    loadTenants();
  } catch {
    // cancelled
  }
}

function getStatusType(status: string) {
  const map: Record<string, string> = {
    active: 'success',
    suspended: 'warning',
    archived: 'info'
  };
  return map[status] || 'info';
}

function formatStatus(status: string) {
  const map: Record<string, string> = {
    active: '活跃',
    suspended: '暂停',
    archived: '归档'
  };
  return map[status] || status;
}

function formatDate(dateStr: string) {
  if (!dateStr) return '-';
  return new Date(dateStr).toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  });
}

onMounted(loadTenants);
</script>

<style scoped>
.tenants-container {
  padding: 0;
}
.action-bar {
  display: flex;
  align-items: center;
}
</style>
