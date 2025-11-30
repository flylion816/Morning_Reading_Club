<template>
  <AdminLayout>
    <div class="users-container">
      <!-- 筛选面板 -->
      <el-card style="margin-bottom: 20px">
        <template #header>
          <span class="card-title">用户管理</span>
        </template>

        <div class="filter-panel">
          <el-input
            v-model="filters.search"
            placeholder="搜索用户名或邮箱..."
            clearable
            style="width: 220px"
            @keyup.enter="handleSearch"
          >
            <template #prefix>
              <span style="margin-right: 4px">🔍</span>
            </template>
          </el-input>

          <el-button
            type="primary"
            style="margin-left: auto"
            @click="handleSearch"
          >
            搜索
          </el-button>
        </div>
      </el-card>

      <!-- 用户列表 -->
      <el-card>
        <el-table
          :data="users"
          stripe
          style="width: 100%"
          :default-sort="{ prop: 'createdAt', order: 'descending' }"
          v-loading="loading"
        >
          <el-table-column label="头像" width="60">
            <template #default="{ row }">
              <div class="avatar-wrapper">
                <el-avatar
                  v-if="row.avatar"
                  :src="row.avatar"
                  :size="40"
                  shape="circle"
                />
                <div v-else class="avatar-placeholder" :style="{ background: getAvatarColor(row._id) }">
                  {{ row.nickname?.charAt(0)?.toUpperCase() || 'U' }}
                </div>
              </div>
            </template>
          </el-table-column>

          <el-table-column prop="_id" label="用户ID" width="200">
            <template #default="{ row }">
              <span style="font-family: monospace; font-size: 12px">{{ row._id }}</span>
            </template>
          </el-table-column>

          <el-table-column prop="nickname" label="用户名" width="120" />
          <el-table-column prop="email" label="邮箱" min-width="180" />
          <el-table-column prop="phone" label="电话" width="140" />

          <el-table-column label="状态" width="100">
            <template #default="{ row }">
              <el-tag :type="row.isActive ? 'success' : 'danger'">
                {{ row.isActive ? '正常' : '已禁用' }}
              </el-tag>
            </template>
          </el-table-column>

          <el-table-column label="注册时间" width="180">
            <template #default="{ row }">
              {{ formatDate(row.createdAt) }}
            </template>
          </el-table-column>

          <el-table-column label="操作" width="260" fixed="right">
            <template #default="{ row }">
              <div class="action-buttons">
                <el-button
                  :type="row.isActive ? 'danger' : 'success'"
                  text
                  size="small"
                  @click="handleToggleUserStatus(row)"
                >
                  {{ row.isActive ? '禁用' : '启用' }}
                </el-button>
                <el-button
                  type="primary"
                  text
                  size="small"
                  @click="viewUserDetails(row)"
                >
                  详情
                </el-button>
                <el-button
                  type="danger"
                  text
                  size="small"
                  @click="handleDeleteUser(row)"
                >
                  删除
                </el-button>
              </div>
            </template>
          </el-table-column>
        </el-table>

        <!-- 分页 -->
        <div class="pagination">
          <el-pagination
            v-model:current-page="pagination.page"
            v-model:page-size="pagination.pageSize"
            :page-sizes="[10, 20, 50, 100]"
            :total="pagination.total"
            layout="total, sizes, prev, pager, next, jumper"
            @current-page-change="loadUsers"
            @page-size-change="loadUsers"
          />
        </div>
      </el-card>

      <!-- 用户详情对话框 -->
      <el-dialog
        v-model="detailsDialog.visible"
        title="用户详情"
        width="600px"
      >
        <el-descriptions
          v-if="selectedUser"
          :column="1"
          border
        >
          <el-descriptions-item label="头像">
            <div class="avatar-wrapper">
              <el-avatar
                v-if="selectedUser.avatar"
                :src="selectedUser.avatar"
                :size="60"
                shape="circle"
              />
              <div v-else class="avatar-placeholder" :style="{ background: getAvatarColor(selectedUser._id), width: '60px', height: '60px', fontSize: '24px' }">
                {{ selectedUser.nickname?.charAt(0)?.toUpperCase() || 'U' }}
              </div>
            </div>
          </el-descriptions-item>
          <el-descriptions-item label="用户ID">
            <span style="font-family: monospace; font-size: 12px">{{ selectedUser._id }}</span>
          </el-descriptions-item>
          <el-descriptions-item label="用户名">
            {{ selectedUser.nickname }}
          </el-descriptions-item>
          <el-descriptions-item label="邮箱">
            {{ selectedUser.email }}
          </el-descriptions-item>
          <el-descriptions-item label="电话">
            {{ selectedUser.phone || '-' }}
          </el-descriptions-item>
          <el-descriptions-item label="状态">
            <el-tag :type="selectedUser.isActive ? 'success' : 'danger'">
              {{ selectedUser.isActive ? '正常' : '已禁用' }}
            </el-tag>
          </el-descriptions-item>
          <el-descriptions-item label="注册时间">
            {{ formatDate(selectedUser.createdAt) }}
          </el-descriptions-item>
          <el-descriptions-item label="最后登录">
            {{ selectedUser.lastLoginAt ? formatDate(selectedUser.lastLoginAt) : '-' }}
          </el-descriptions-item>
        </el-descriptions>
      </el-dialog>
    </div>
  </AdminLayout>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import AdminLayout from '../components/AdminLayout.vue'
import { userApi } from '../services/api'
import { ElMessage, ElMessageBox } from 'element-plus'

const loading = ref(false)
const users = ref<any[]>([])
const selectedUser = ref<any>(null)

const filters = ref({
  search: ''
})

const pagination = ref({
  page: 1,
  pageSize: 20,
  total: 0
})

const detailsDialog = ref({
  visible: false
})

onMounted(() => {
  loadUsers()
})

async function loadUsers() {
  loading.value = true
  try {
    const params: any = {
      page: pagination.value.page,
      limit: pagination.value.pageSize
    }

    if (filters.value.search) {
      params.search = filters.value.search
    }

    const response = await userApi.getUsers(params)
    users.value = response.list || []
    pagination.value.total = response.pagination?.total || 0
  } catch (err) {
    ElMessage.error('加载用户列表失败')
  } finally {
    loading.value = false
  }
}

function handleSearch() {
  pagination.value.page = 1
  loadUsers()
}

async function handleToggleUserStatus(row: any) {
  const action = row.isActive ? '禁用' : '启用'
  const newStatus = row.isActive ? 'banned' : 'active'
  ElMessageBox.confirm(
    `确定要${action}该用户吗？`,
    '提示',
    {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning'
    }
  )
    .then(async () => {
      try {
        await userApi.updateUser(row._id, { status: newStatus })
        ElMessage.success(`用户已${action}`)
        await loadUsers()
      } catch (err: any) {
        ElMessage.error(err.message || '操作失败')
      }
    })
    .catch(() => {
      // 用户取消
    })
}

function viewUserDetails(row: any) {
  selectedUser.value = row
  detailsDialog.value.visible = true
}

async function handleDeleteUser(row: any) {
  try {
    await ElMessageBox.confirm(
      `确定要删除用户 ${row.nickname} 吗？此操作不可撤销`,
      '警告',
      {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning'
      }
    )

    await userApi.deleteUser(row._id)
    ElMessage.success('用户已删除')
    await loadUsers()
  } catch (err: any) {
    if (err !== 'cancel') {
      ElMessage.error(err.message || '删除失败')
    }
  }
}

function formatDate(dateString: string): string {
  if (!dateString) return '-'
  const date = new Date(dateString)
  return date.toLocaleDateString('zh-CN') + ' ' + date.toLocaleTimeString('zh-CN')
}

/**
 * 根据用户ID生成稳定的头像颜色
 * 使用哈希算法确保相同ID总是返回相同颜色
 */
function getAvatarColor(userId: string): string {
  const colors = ['#4a90e2', '#7ed321', '#f5a623', '#bd10e0', '#50e3c2', '#b8e986', '#ff6b6b', '#4ecdc4']
  if (!userId) return colors[0]

  let hash = 0
  for (let i = 0; i < userId.length; i++) {
    hash = ((hash << 5) - hash) + userId.charCodeAt(i)
  }
  return colors[Math.abs(hash) % colors.length]
}
</script>

<style scoped>
.users-container {
  padding: 24px;
}

.card-title {
  font-size: 16px;
  font-weight: 600;
}

.filter-panel {
  display: flex;
  align-items: center;
  gap: 16px;
}

.pagination {
  display: flex;
  justify-content: flex-end;
  margin-top: 20px;
}

.action-buttons {
  display: flex;
  gap: 8px;
  flex-wrap: nowrap;
  align-items: center;
}

.avatar-wrapper {
  display: flex;
  align-items: center;
  justify-content: center;
}

.avatar-placeholder {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  font-weight: bold;
  font-size: 18px;
  flex-shrink: 0;
}
</style>
