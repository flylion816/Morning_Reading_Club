<template>
  <AdminLayout>
    <div class="checkins-management-container">
      <!-- 统计卡片 -->
      <div class="stats-cards">
        <el-card class="stat-card">
          <template #header>
            <div class="stat-header">打卡总数</div>
          </template>
          <div class="stat-value">{{ stats.totalCount }}</div>
          <div class="stat-label">条记录</div>
        </el-card>

        <el-card class="stat-card">
          <template #header>
            <div class="stat-header">今日打卡</div>
          </template>
          <div class="stat-value">{{ stats.todayCount }}</div>
          <div class="stat-label">次打卡</div>
        </el-card>

        <el-card class="stat-card">
          <template #header>
            <div class="stat-header">打卡用户</div>
          </template>
          <div class="stat-value">{{ stats.uniqueUserCount }}</div>
          <div class="stat-label">个用户</div>
        </el-card>

        <el-card class="stat-card">
          <template #header>
            <div class="stat-header">总积分</div>
          </template>
          <div class="stat-value">{{ stats.totalPoints }}</div>
          <div class="stat-label">分</div>
        </el-card>
      </div>

      <!-- 搜索和筛选 -->
      <el-card style="margin-bottom: 20px">
        <template #header>
          <div class="card-header">
            <span class="card-title">搜索和筛选</span>
          </div>
        </template>

        <el-form :model="filters" layout="inline">
          <el-form-item label="用户昵称">
            <el-input
              v-model="filters.search"
              placeholder="搜索用户昵称或ID"
              clearable
              @input="handleSearch"
            />
          </el-form-item>

          <el-form-item label="期次">
            <el-select
              v-model="filters.periodId"
              placeholder="选择期次"
              clearable
              @change="loadCheckins"
            >
              <el-option
                v-for="period in periods"
                :key="period._id"
                :label="period.name"
                :value="period._id"
              />
            </el-select>
          </el-form-item>

          <el-form-item label="开始日期">
            <el-date-picker
              v-model="filters.dateFrom"
              type="date"
              placeholder="选择开始日期"
              @change="loadCheckins"
            />
          </el-form-item>

          <el-form-item label="结束日期">
            <el-date-picker
              v-model="filters.dateTo"
              type="date"
              placeholder="选择结束日期"
              @change="loadCheckins"
            />
          </el-form-item>

          <el-form-item>
            <el-button type="primary" @click="loadCheckins">查询</el-button>
            <el-button @click="resetFilters">重置</el-button>
          </el-form-item>
        </el-form>
      </el-card>

      <!-- 打卡列表 -->
      <el-card>
        <template #header>
          <div class="card-header">
            <span>打卡记录列表 (共 {{ total }} 条)</span>
            <el-pagination
              :current-page="currentPage"
              :page-size="pageSize"
              :total="total"
              @current-change="currentPage = $event; loadCheckins()"
              style="margin-left: auto"
            />
          </div>
        </template>

        <el-table :data="checkins" stripe style="width: 100%" v-loading="loading">
          <!-- 用户 -->
          <el-table-column label="用户" width="150">
            <template #default="{ row }">
              <div class="user-cell">
                <div v-if="row.userId && typeof row.userId === 'object'" class="user-info">
                  <div class="user-name">{{ row.userId.nickname }}</div>
                  <div class="user-id">{{ row.userId.openid }}</div>
                </div>
                <div v-else>未知用户</div>
              </div>
            </template>
          </el-table-column>

          <!-- 期次 -->
          <el-table-column label="期次" width="150">
            <template #default="{ row }">
              {{ (row.periodId && typeof row.periodId === 'object') ? (row.periodId.name || '-') : '-' }}
            </template>
          </el-table-column>

          <!-- 课程 -->
          <el-table-column label="课程" width="150">
            <template #default="{ row }">
              <div v-if="row.sectionId && typeof row.sectionId === 'object'">
                Day {{ row.sectionId.day }} - {{ row.sectionId.title }}
              </div>
              <div v-else>-</div>
            </template>
          </el-table-column>

          <!-- 打卡时间 -->
          <el-table-column label="打卡时间" width="160">
            <template #default="{ row }">
              {{ formatDate(row.checkinDate) }}
            </template>
          </el-table-column>

          <!-- 阅读时间 -->
          <el-table-column label="阅读时间(分)" width="120">
            <template #default="{ row }">
              {{ row.readingTime || '-' }}
            </template>
          </el-table-column>

          <!-- 完成度 -->
          <el-table-column label="完成度" width="100">
            <template #default="{ row }">
              <el-progress
                :percentage="row.completionRate || 0"
                :color="getProgressColor"
                :text-inside="true"
                :stroke-width="20"
              />
            </template>
          </el-table-column>

          <!-- 心情 -->
          <el-table-column label="心情" width="80">
            <template #default="{ row }">
              <el-tag v-if="row.mood" :type="getMoodColor(row.mood)">
                {{ getMoodLabel(row.mood) }}
              </el-tag>
              <span v-else>-</span>
            </template>
          </el-table-column>

          <!-- 积分 -->
          <el-table-column label="积分" width="80">
            <template #default="{ row }">
              <el-tag type="success">{{ row.points || 0 }}</el-tag>
            </template>
          </el-table-column>

          <!-- 日记 -->
          <el-table-column label="日记" width="80">
            <template #default="{ row }">
              <el-tag v-if="row.note && row.note.trim()" type="info">有内容</el-tag>
              <span v-else style="color: #999">无</span>
            </template>
          </el-table-column>

          <!-- 操作 -->
          <el-table-column label="操作" width="150" fixed="right">
            <template #default="{ row }">
              <div class="action-buttons">
                <el-button type="primary" size="small" @click="handleViewDetail(row)">详情</el-button>
                <el-button type="danger" size="small" @click="handleDeleteCheckin(row)">删除</el-button>
              </div>
            </template>
          </el-table-column>
        </el-table>
      </el-card>

      <!-- 详情弹窗 -->
      <el-dialog
        v-model="detailDialogVisible"
        title="打卡详情"
        width="700px"
      >
        <div v-if="selectedCheckin" class="checkin-detail">
          <el-descriptions :column="1" border>
            <el-descriptions-item label="用户">
              <div v-if="selectedCheckin.userId && typeof selectedCheckin.userId === 'object'">
                <div>{{ selectedCheckin.userId.nickname }}</div>
                <div style="font-size: 12px; color: #999">{{ selectedCheckin.userId.openid }}</div>
              </div>
            </el-descriptions-item>

            <el-descriptions-item label="期次">
              {{ (selectedCheckin.periodId && typeof selectedCheckin.periodId === 'object') ? selectedCheckin.periodId.name : '-' }}
            </el-descriptions-item>

            <el-descriptions-item label="课程">
              <div v-if="selectedCheckin.sectionId && typeof selectedCheckin.sectionId === 'object'">
                Day {{ selectedCheckin.sectionId.day }} - {{ selectedCheckin.sectionId.title }}
              </div>
            </el-descriptions-item>

            <el-descriptions-item label="打卡时间">
              {{ formatDate(selectedCheckin.checkinDate) }}
            </el-descriptions-item>

            <el-descriptions-item label="阅读时间">
              {{ selectedCheckin.readingTime }} 分钟
            </el-descriptions-item>

            <el-descriptions-item label="完成度">
              {{ selectedCheckin.completionRate }}%
            </el-descriptions-item>

            <el-descriptions-item label="心情">
              <el-tag v-if="selectedCheckin.mood" :type="getMoodColor(selectedCheckin.mood)">
                {{ getMoodLabel(selectedCheckin.mood) }}
              </el-tag>
            </el-descriptions-item>

            <el-descriptions-item label="积分">
              {{ selectedCheckin.points }}
            </el-descriptions-item>

            <el-descriptions-item label="公开状态">
              <el-tag :type="selectedCheckin.isPublic ? 'success' : 'info'">
                {{ selectedCheckin.isPublic ? '公开' : '私密' }}
              </el-tag>
            </el-descriptions-item>

            <el-descriptions-item label="精选状态">
              <el-tag :type="selectedCheckin.isFeatured ? 'success' : 'info'">
                {{ selectedCheckin.isFeatured ? '已精选' : '未精选' }}
              </el-tag>
            </el-descriptions-item>

            <el-descriptions-item label="获赞数">
              {{ selectedCheckin.likeCount || 0 }}
            </el-descriptions-item>

            <el-descriptions-item label="日记内容" v-if="selectedCheckin.note">
              <div class="note-content">
                {{ selectedCheckin.note }}
              </div>
            </el-descriptions-item>
          </el-descriptions>
        </div>
      </el-dialog>
    </div>
  </AdminLayout>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import AdminLayout from '../components/AdminLayout.vue'
import api from '../services/api'

interface Checkin {
  _id: string
  userId: any
  periodId: any
  sectionId: any
  checkinDate: string
  readingTime: number
  completionRate: number
  note: string
  images: string[]
  mood: string
  points: number
  isPublic: boolean
  isFeatured: boolean
  likeCount: number
  createdAt: string
  updatedAt: string
}

interface Period {
  _id: string
  name: string
  title: string
}

// State
const checkins = ref<Checkin[]>([])
const periods = ref<Period[]>([])
const stats = ref({
  totalCount: 0,
  todayCount: 0,
  uniqueUserCount: 0,
  totalPoints: 0
})

const loading = ref(false)
const currentPage = ref(1)
const pageSize = ref(20)
const total = ref(0)

const detailDialogVisible = ref(false)
const selectedCheckin = ref<Checkin | null>(null)

const filters = ref({
  search: '',
  periodId: '',
  dateFrom: null as any,
  dateTo: null as any
})

// Methods
const formatDate = (date: string) => {
  return new Date(date).toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  })
}

const getMoodColor = (mood: string) => {
  const colors: Record<string, string> = {
    happy: 'success',
    calm: 'info',
    thoughtful: 'warning',
    inspired: 'success',
    other: 'info'
  }
  return colors[mood] || 'info'
}

const getMoodLabel = (mood: string) => {
  const labels: Record<string, string> = {
    happy: '😊 开心',
    calm: '😌 平静',
    thoughtful: '🤔 沉思',
    inspired: '✨ 灵感',
    other: '🤷 其他'
  }
  return labels[mood] || mood
}

const getProgressColor = (percentage: number) => {
  if (percentage >= 90) return '#85ce61'
  if (percentage >= 70) return '#e6a23c'
  return '#f56c6c'
}

const handleSearch = () => {
  currentPage.value = 1
  loadCheckins()
}

const resetFilters = () => {
  filters.value = {
    search: '',
    periodId: '',
    dateFrom: null,
    dateTo: null
  }
  currentPage.value = 1
  loadCheckins()
}

const loadCheckins = async () => {
  loading.value = true
  try {
    const params: Record<string, any> = {
      page: currentPage.value,
      limit: pageSize.value
    }

    if (filters.value.search) {
      params.search = filters.value.search
    }
    if (filters.value.periodId) {
      params.periodId = filters.value.periodId
    }
    if (filters.value.dateFrom) {
      params.dateFrom = new Date(filters.value.dateFrom).toISOString().split('T')[0]
    }
    if (filters.value.dateTo) {
      params.dateTo = new Date(filters.value.dateTo).toISOString().split('T')[0]
    }

    const res = await api.get('/admin/checkins', { params })
    checkins.value = res.list
    total.value = res.pagination.total
    stats.value = {
      totalCount: res.stats.totalCount,
      todayCount: res.stats.todayCount,
      uniqueUserCount: total.value // Use pagination total as user count is calculated differently
    }
  } catch (error) {
    ElMessage.error('加载打卡列表失败')
    console.error(error)
  } finally {
    loading.value = false
  }
}

const loadStats = async () => {
  try {
    const params: Record<string, any> = {}
    if (filters.value.periodId) {
      params.periodId = filters.value.periodId
    }
    if (filters.value.dateFrom) {
      params.dateFrom = new Date(filters.value.dateFrom).toISOString().split('T')[0]
    }
    if (filters.value.dateTo) {
      params.dateTo = new Date(filters.value.dateTo).toISOString().split('T')[0]
    }

    const res = await api.get('/admin/checkins/stats', { params })
    stats.value = res
  } catch (error) {
    console.error('加载统计数据失败:', error)
  }
}

const loadPeriods = async () => {
  try {
    const res = await api.get('/periods')
    periods.value = res.list
  } catch (error) {
    console.error('加载期次失败:', error)
  }
}

const handleViewDetail = (checkin: Checkin) => {
  selectedCheckin.value = checkin
  detailDialogVisible.value = true
}

const handleDeleteCheckin = (checkin: Checkin) => {
  ElMessageBox.confirm(
    `确定要删除 ${checkin.userId && typeof checkin.userId === 'object' ? checkin.userId.nickname : '该用户'} 的打卡记录吗？`,
    '删除确认',
    {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning'
    }
  )
    .then(async () => {
      try {
        await api.delete(`/admin/checkins/${checkin._id}`)
        ElMessage.success('打卡记录已删除')
        loadCheckins()
        loadStats()
      } catch (error) {
        ElMessage.error('删除失败')
        console.error(error)
      }
    })
    .catch(() => {
      // 取消删除
    })
}

// Lifecycle
onMounted(() => {
  loadPeriods()
  loadCheckins()
  loadStats()
})
</script>

<style scoped lang="scss">
.checkins-management-container {
  padding: 20px;

  .stats-cards {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: 20px;
    margin-bottom: 20px;

    .stat-card {
      text-align: center;

      .stat-header {
        color: #666;
        font-size: 14px;
      }

      .stat-value {
        font-size: 32px;
        font-weight: bold;
        color: #409eff;
        margin: 10px 0;
      }

      .stat-label {
        color: #999;
        font-size: 12px;
      }
    }
  }

  .card-header {
    display: flex;
    align-items: center;
    justify-content: space-between;

    .card-title {
      font-weight: bold;
      color: #333;
    }
  }

  .user-cell {
    .user-info {
      .user-name {
        font-weight: 500;
        color: #333;
      }

      .user-id {
        font-size: 12px;
        color: #999;
      }
    }
  }

  .action-buttons {
    display: flex;
    gap: 8px;
  }

  .checkin-detail {
    padding: 20px 0;

    .note-content {
      white-space: pre-wrap;
      word-break: break-word;
      line-height: 1.6;
      color: #333;
    }
  }
}
</style>
