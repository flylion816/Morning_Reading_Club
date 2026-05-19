<template>
  <AdminLayout>
    <div class="tenant-management">
      <!-- 统计卡片 -->
      <el-row :gutter="20" class="summary-cards" v-loading="loadingSummary">
        <el-col :span="8">
          <el-card shadow="hover" class="stat-card">
            <div class="stat-content">
              <div class="stat-label">总租户数</div>
              <div class="stat-value">{{ summary.total }}</div>
            </div>
          </el-card>
        </el-col>
        <el-col :span="8">
          <el-card shadow="hover" class="stat-card">
            <div class="stat-content">
              <div class="stat-label">启用中</div>
              <div class="stat-value active">{{ summary.active }}</div>
            </div>
          </el-card>
        </el-col>
        <el-col :span="8">
          <el-card shadow="hover" class="stat-card">
            <div class="stat-content">
              <div class="stat-label">已停用</div>
              <div class="stat-value inactive">{{ summary.inactive }}</div>
            </div>
          </el-card>
        </el-col>
      </el-row>

      <!-- 操作栏 -->
      <div class="filter-actions-bar">
        <div class="filters">
          <el-input
            v-model="filter.keyword"
            placeholder="搜索名称/slug"
            clearable
            style="width: 220px"
            @clear="loadTenants"
            @keyup.enter="loadTenants"
          >
            <template #prefix><el-icon><Search /></el-icon></template>
          </el-input>
          <el-select v-model="filter.status" placeholder="状态" clearable style="width: 120px" @change="loadTenants">
            <el-option label="全部" value="" />
            <el-option label="启用" value="active" />
            <el-option label="停用" value="inactive" />
          </el-select>
          <el-button type="primary" @click="loadTenants">搜索</el-button>
        </div>
        <div class="actions">
          <el-button type="success" @click="openCreateDialog">
            <el-icon><Plus /></el-icon> 新建租户
          </el-button>
        </div>
      </div>

      <!-- 数据表格 -->
      <el-table :data="tenants" v-loading="loading" border style="width: 100%" class="tenant-table">
        <el-table-column label="租户名称" min-width="180">
          <template #default="{ row }">
            <div class="tenant-info">
              <div class="tenant-name">{{ row.name }}</div>
              <div class="tenant-slug">slug: {{ row.slug }}</div>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="租户ID" min-width="220">
          <template #default="{ row }">
            <span class="tenant-id">{{ row._id }}</span>
          </template>
        </el-table-column>
        <el-table-column label="微信 AppId" min-width="200">
          <template #default="{ row }">
            <div v-for="appId in row.wxAppIds" :key="appId" class="appid-tag">
              <el-tag size="small" type="info">{{ appId }}</el-tag>
            </div>
            <span v-if="!row.wxAppIds?.length" class="empty-text">未配置</span>
          </template>
        </el-table-column>
        <el-table-column label="状态" width="100" align="center">
          <template #default="{ row }">
            <el-tag :type="row.status === 'active' ? 'success' : 'danger'" size="small">
              {{ row.status === 'active' ? '启用' : '停用' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="描述" min-width="180">
          <template #default="{ row }">
            <span class="description-text">{{ row.description || '—' }}</span>
          </template>
        </el-table-column>
        <el-table-column label="创建时间" width="160" align="center">
          <template #default="{ row }">{{ formatDate(row.createdAt) }}</template>
        </el-table-column>
        <el-table-column label="操作" width="160" align="center" fixed="right">
          <template #default="{ row }">
            <el-button size="small" @click="openEditDialog(row)">编辑</el-button>
            <el-button
              size="small"
              :type="row.status === 'active' ? 'warning' : 'success'"
              @click="toggleStatus(row)"
            >
              {{ row.status === 'active' ? '停用' : '启用' }}
            </el-button>
          </template>
        </el-table-column>
      </el-table>

      <!-- 分页 -->
      <div class="pagination-bar">
        <el-pagination
          v-model:current-page="pagination.page"
          v-model:page-size="pagination.pageSize"
          :total="pagination.total"
          :page-sizes="[10, 20, 50]"
          layout="total, sizes, prev, pager, next"
          @size-change="loadTenants"
          @current-change="loadTenants"
        />
      </div>
    </div>

    <!-- 新建/编辑对话框 -->
    <el-dialog
      v-model="dialogVisible"
      :title="editingTenant ? '编辑租户' : '新建租户'"
      width="560px"
      :close-on-click-modal="false"
    >
      <el-form :model="form" :rules="rules" ref="formRef" label-width="110px">
        <el-form-item label="租户名称" prop="name">
          <el-input v-model="form.name" placeholder="如：凡人共读" maxlength="50" show-word-limit />
        </el-form-item>
        <el-form-item label="Slug" prop="slug">
          <el-input v-model="form.slug" placeholder="如：fanren（小写字母/数字/下划线）" maxlength="32" :disabled="!!editingTenant" />
          <div class="form-tip">创建后不可修改，用于 URL 和日志标识</div>
        </el-form-item>
        <el-form-item label="微信 AppId" prop="wxAppIds">
          <div class="appid-list">
            <div v-for="(appId, idx) in form.wxAppIds" :key="idx" class="appid-row">
              <el-input v-model="form.wxAppIds[idx]" placeholder="wx..." style="flex: 1" />
              <el-button type="danger" text @click="removeAppId(idx)">删除</el-button>
            </div>
            <el-button size="small" @click="addAppId">+ 添加 AppId</el-button>
          </div>
        </el-form-item>
        <el-form-item label="微信登录 Secret" prop="wechatLoginSecret">
          <el-input v-model="form.wechatLoginSecret" type="password" show-password placeholder="微信小程序 AppSecret" />
        </el-form-item>
        <el-form-item label="描述">
          <el-input v-model="form.description" type="textarea" :rows="2" maxlength="500" show-word-limit placeholder="可选" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="submitting" @click="submitForm">
          {{ editingTenant ? '保存' : '创建' }}
        </el-button>
      </template>
    </el-dialog>
  </AdminLayout>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Search, Plus } from '@element-plus/icons-vue'
import AdminLayout from '../components/AdminLayout.vue'
import { tenantApi } from '../services/api'

interface Tenant {
  _id: string
  slug: string
  name: string
  description: string
  wxAppIds: string[]
  status: 'active' | 'inactive'
  createdAt: string
}

const loading = ref(false)
const loadingSummary = ref(false)
const submitting = ref(false)
const dialogVisible = ref(false)
const editingTenant = ref<Tenant | null>(null)
const formRef = ref()
const tenants = ref<Tenant[]>([])

const summary = reactive({ total: 0, active: 0, inactive: 0 })
const filter = reactive({ keyword: '', status: '' })
const pagination = reactive({ page: 1, pageSize: 10, total: 0 })

const form = reactive({
  name: '',
  slug: '',
  wxAppIds: [''] as string[],
  wechatLoginSecret: '',
  description: ''
})

const rules = {
  name: [{ required: true, message: '请输入租户名称', trigger: 'blur' }],
  slug: [
    { required: true, message: '请输入 slug', trigger: 'blur' },
    { pattern: /^[a-z][a-z0-9_-]*$/, message: '只允许小写字母、数字、下划线、连字符', trigger: 'blur' }
  ]
}

async function loadTenants() {
  loading.value = true
  try {
    const params: any = { page: pagination.page, pageSize: pagination.pageSize }
    if (filter.keyword) params.keyword = filter.keyword
    if (filter.status) params.status = filter.status
    const res = await tenantApi.getTenants(params)
    tenants.value = res.data.data?.tenants || res.data.tenants || []
    pagination.total = res.data.data?.total || res.data.total || 0
  } catch (e: any) {
    ElMessage.error(e?.response?.data?.message || '加载租户列表失败')
  } finally {
    loading.value = false
  }
}

async function loadSummary() {
  loadingSummary.value = true
  try {
    const res = await tenantApi.getSummary()
    Object.assign(summary, res.data.data || res.data)
  } catch {
    // 汇总失败不阻断主流程
  } finally {
    loadingSummary.value = false
  }
}

function openCreateDialog() {
  editingTenant.value = null
  Object.assign(form, { name: '', slug: '', wxAppIds: [''], wechatLoginSecret: '', description: '' })
  dialogVisible.value = true
}

function openEditDialog(tenant: Tenant) {
  editingTenant.value = tenant
  Object.assign(form, {
    name: tenant.name,
    slug: tenant.slug,
    wxAppIds: tenant.wxAppIds?.length ? [...tenant.wxAppIds] : [''],
    wechatLoginSecret: '',
    description: tenant.description || ''
  })
  dialogVisible.value = true
}

function addAppId() {
  form.wxAppIds.push('')
}

function removeAppId(idx: number) {
  form.wxAppIds.splice(idx, 1)
  if (form.wxAppIds.length === 0) form.wxAppIds.push('')
}

async function submitForm() {
  await formRef.value?.validate()
  submitting.value = true
  try {
    const payload: any = {
      name: form.name,
      wxAppIds: form.wxAppIds.filter(Boolean),
      description: form.description
    }
    if (!editingTenant.value) payload.slug = form.slug
    if (form.wechatLoginSecret) payload.wechatLoginSecret = form.wechatLoginSecret

    if (editingTenant.value) {
      await tenantApi.updateTenant(editingTenant.value._id, payload)
      ElMessage.success('租户已更新')
    } else {
      await tenantApi.createTenant(payload)
      ElMessage.success('租户已创建')
    }
    dialogVisible.value = false
    loadTenants()
    loadSummary()
  } catch (e: any) {
    ElMessage.error(e?.response?.data?.message || '操作失败')
  } finally {
    submitting.value = false
  }
}

async function toggleStatus(tenant: Tenant) {
  const action = tenant.status === 'active' ? '停用' : '启用'
  await ElMessageBox.confirm(`确定要${action}租户「${tenant.name}」吗？`, '确认', {
    confirmButtonText: '确定',
    cancelButtonText: '取消',
    type: 'warning'
  })
  try {
    await tenantApi.updateStatus(tenant._id, tenant.status === 'active' ? 'inactive' : 'active')
    ElMessage.success(`已${action}`)
    loadTenants()
    loadSummary()
  } catch (e: any) {
    ElMessage.error(e?.response?.data?.message || '操作失败')
  }
}

function formatDate(dateStr: string) {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleDateString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit' })
}

onMounted(() => {
  loadTenants()
  loadSummary()
})
</script>

<style scoped>
.tenant-management {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.summary-cards { margin-bottom: 4px; }

.stat-card { text-align: center; }

.stat-content { padding: 8px 0; }

.stat-label {
  font-size: 13px;
  color: #909399;
  margin-bottom: 8px;
}

.stat-value {
  font-size: 28px;
  font-weight: 700;
  color: #303133;
}

.stat-value.active { color: #67c23a; }
.stat-value.inactive { color: #f56c6c; }

.filter-actions-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
}

.filters {
  display: flex;
  gap: 10px;
  align-items: center;
  flex-wrap: wrap;
}

.tenant-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.tenant-name {
  font-weight: 600;
  color: #303133;
}

.tenant-slug {
  font-size: 12px;
  color: #909399;
}

.tenant-id {
  font-size: 12px;
  color: #606266;
  font-family: monospace;
}

.appid-tag { margin-bottom: 4px; }

.empty-text {
  color: #c0c4cc;
  font-size: 13px;
}

.description-text {
  font-size: 13px;
  color: #606266;
}

.pagination-bar {
  display: flex;
  justify-content: flex-end;
}

.appid-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  width: 100%;
}

.appid-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.form-tip {
  font-size: 12px;
  color: #909399;
  margin-top: 4px;
}
</style>
