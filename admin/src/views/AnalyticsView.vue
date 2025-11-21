<template>
  <AdminLayout>
    <div class="analytics-container">
      <!-- 日期筛选 -->
      <el-card style="margin-bottom: 20px">
        <div class="filter-bar">
          <el-date-picker
            v-model="dateRange"
            type="daterange"
            range-separator="至"
            start-placeholder="开始日期"
            end-placeholder="结束日期"
            style="width: 300px"
            @change="loadAnalytics"
          />
          <el-button type="primary" @click="loadAnalytics" style="margin-left: 12px">
            查询
          </el-button>
        </div>
      </el-card>

      <!-- 关键指标卡片 -->
      <div class="stats-grid">
        <el-card class="stat-card">
          <div class="stat-content">
            <div class="stat-number">{{ analytics.totalEnrollments }}</div>
            <div class="stat-label">总报名数</div>
          </div>
        </el-card>

        <el-card class="stat-card">
          <div class="stat-content">
            <div class="stat-number">{{ analytics.totalRevenue }}</div>
            <div class="stat-label">总收入（元）</div>
          </div>
        </el-card>

        <el-card class="stat-card">
          <div class="stat-content">
            <div class="stat-number">{{ analytics.avgCompletionRate }}</div>
            <div class="stat-label">平均完成率（%）</div>
          </div>
        </el-card>

        <el-card class="stat-card">
          <div class="stat-content">
            <div class="stat-number">{{ analytics.activeUsers }}</div>
            <div class="stat-label">活跃用户</div>
          </div>
        </el-card>
      </div>

      <!-- 期次统计表格 -->
      <el-card style="margin-top: 24px">
        <template #header>
          <span class="card-title">期次统计</span>
        </template>

        <el-table :data="periodStats" stripe style="width: 100%">
          <el-table-column prop="name" label="期次名称" width="150" />
          <el-table-column label="报名人数" width="100">
            <template #default="{ row }">
              {{ row.enrollmentCount }}
            </template>
          </el-table-column>
          <el-table-column label="完成人数" width="100">
            <template #default="{ row }">
              {{ row.completionCount }}
            </template>
          </el-table-column>
          <el-table-column label="完成率" width="100">
            <template #default="{ row }">
              <el-progress
                :percentage="row.completionRate"
                :color="getProgressColor(row.completionRate)"
              />
            </template>
          </el-table-column>
          <el-table-column label="总收入" width="120">
            <template #default="{ row }">
              ¥{{ (row.totalRevenue / 100).toFixed(2) }}
            </template>
          </el-table-column>
          <el-table-column label="日均打卡" width="100">
            <template #default="{ row }">
              {{ row.avgDailyCheckins.toFixed(1) }}
            </template>
          </el-table-column>
        </el-table>
      </el-card>

      <!-- 用户行为统计 -->
      <el-card style="margin-top: 24px">
        <template #header>
          <span class="card-title">用户行为统计</span>
        </template>

        <div class="behavior-stats">
          <div class="behavior-item">
            <h4>打卡分布</h4>
            <div class="stat-row">
              <span>日均打卡数</span>
              <strong>{{ analytics.avgDailyCheckins }}</strong>
            </div>
            <div class="stat-row">
              <span>总打卡数</span>
              <strong>{{ analytics.totalCheckins }}</strong>
            </div>
          </div>

          <div class="behavior-item">
            <h4>用户活跃度</h4>
            <div class="stat-row">
              <span>本周新增</span>
              <strong>{{ analytics.newUsersThisWeek }}</strong>
            </div>
            <div class="stat-row">
              <span>本周活跃</span>
              <strong>{{ analytics.activeUsersThisWeek }}</strong>
            </div>
          </div>

          <div class="behavior-item">
            <h4>支付统计</h4>
            <div class="stat-row">
              <span>成功支付</span>
              <strong>{{ analytics.successfulPayments }}</strong>
            </div>
            <div class="stat-row">
              <span>失败支付</span>
              <strong>{{ analytics.failedPayments }}</strong>
            </div>
          </div>
        </div>
      </el-card>

      <!-- 趋势统计 -->
      <el-card style="margin-top: 24px">
        <template #header>
          <span class="card-title">最近7天趋势</span>
        </template>

        <div class="trend-chart">
          <div class="trend-day" v-for="(day, index) in trendData" :key="index">
            <div class="trend-bar-container">
              <div
                class="trend-bar"
                :style="{ height: day.enrollments * 2 + 'px' }"
                :title="`报名: ${day.enrollments}`"
              ></div>
              <div
                class="trend-bar secondary"
                :style="{ height: day.checkins * 2 + 'px' }"
                :title="`打卡: ${day.checkins}`"
              ></div>
            </div>
            <div class="trend-label">{{ day.date }}</div>
          </div>
        </div>

        <div class="trend-legend">
          <span><span class="legend-color primary"></span> 报名</span>
          <span><span class="legend-color secondary"></span> 打卡</span>
        </div>
      </el-card>
    </div>
  </AdminLayout>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import AdminLayout from '../components/AdminLayout.vue'
import { ElMessage } from 'element-plus'

const dateRange = ref<[Date, Date] | null>(null)

const analytics = ref({
  totalEnrollments: 128,
  totalRevenue: 12672,
  avgCompletionRate: 87,
  activeUsers: 94,
  avgDailyCheckins: 23,
  totalCheckins: 1024,
  newUsersThisWeek: 12,
  activeUsersThisWeek: 78,
  successfulPayments: 125,
  failedPayments: 3
})

const periodStats = ref([
  {
    name: '第一期 - 智慧之光',
    enrollmentCount: 32,
    completionCount: 28,
    completionRate: 87.5,
    totalRevenue: 316800,
    avgDailyCheckins: 26.5
  },
  {
    name: '第二期 - 勇敢的心',
    enrollmentCount: 28,
    completionCount: 24,
    completionRate: 85.7,
    totalRevenue: 277200,
    avgDailyCheckins: 24.2
  },
  {
    name: '第三期 - 能量之泉',
    enrollmentCount: 35,
    completionCount: 29,
    completionRate: 82.8,
    totalRevenue: 346500,
    avgDailyCheckins: 25.1
  },
  {
    name: '第四期 - 心流之境',
    enrollmentCount: 33,
    completionCount: 28,
    completionRate: 84.8,
    totalRevenue: 326700,
    avgDailyCheckins: 23.8
  }
])

const trendData = ref([
  { date: '11-15', enrollments: 8, checkins: 18 },
  { date: '11-16', enrollments: 6, checkins: 22 },
  { date: '11-17', enrollments: 12, checkins: 26 },
  { date: '11-18', enrollments: 10, checkins: 24 },
  { date: '11-19', enrollments: 14, checkins: 28 },
  { date: '11-20', enrollments: 11, checkins: 25 },
  { date: '11-21', enrollments: 19, checkins: 23 }
])

onMounted(() => {
  const today = new Date()
  const sevenDaysAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000)
  dateRange.value = [sevenDaysAgo, today]
})

function loadAnalytics() {
  ElMessage.success('数据已刷新')
  // 实际应用中这里应该调用 API 获取真实数据
}

function getProgressColor(percentage: number): string {
  if (percentage >= 85) return '#67c23a'
  if (percentage >= 70) return '#e6a23c'
  return '#f56c6c'
}
</script>

<style scoped>
.analytics-container {
  padding: 24px;
}

.filter-bar {
  display: flex;
  align-items: center;
  gap: 12px;
}

.card-title {
  font-size: 16px;
  font-weight: 600;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 20px;
  margin-bottom: 24px;
}

.stat-card {
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.08);
  transition: all 0.3s;
}

.stat-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 4px 24px rgba(0, 0, 0, 0.12);
}

.stat-content {
  text-align: center;
  padding: 20px;
}

.stat-number {
  font-size: 32px;
  font-weight: 600;
  color: #333;
  margin-bottom: 8px;
}

.stat-label {
  font-size: 14px;
  color: #999;
}

.behavior-stats {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 24px;
  padding: 20px 0;
}

.behavior-item h4 {
  margin: 0 0 16px;
  font-size: 16px;
  font-weight: 600;
}

.stat-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 0;
  border-bottom: 1px solid #f0f0f0;
}

.stat-row:last-child {
  border-bottom: none;
}

.stat-row span {
  color: #666;
  font-size: 14px;
}

.stat-row strong {
  font-size: 18px;
  color: #333;
}

.trend-chart {
  display: flex;
  align-items: flex-end;
  justify-content: space-around;
  height: 250px;
  padding: 20px;
  background: #f9f9f9;
  border-radius: 4px;
  gap: 12px;
}

.trend-day {
  display: flex;
  flex-direction: column;
  align-items: center;
  flex: 1;
}

.trend-bar-container {
  display: flex;
  align-items: flex-end;
  gap: 4px;
  height: 180px;
  margin-bottom: 8px;
}

.trend-bar {
  flex: 1;
  background: linear-gradient(180deg, #4a90e2 0%, #357abd 100%);
  border-radius: 4px 4px 0 0;
  min-height: 4px;
}

.trend-bar.secondary {
  background: linear-gradient(180deg, #67c23a 0%, #55a320 100%);
}

.trend-label {
  font-size: 12px;
  color: #999;
  white-space: nowrap;
}

.trend-legend {
  display: flex;
  justify-content: center;
  gap: 24px;
  margin-top: 20px;
  font-size: 14px;
}

.legend-color {
  display: inline-block;
  width: 12px;
  height: 12px;
  border-radius: 2px;
  margin-right: 6px;
}

.legend-color.primary {
  background: linear-gradient(135deg, #4a90e2 0%, #357abd 100%);
}

.legend-color.secondary {
  background: linear-gradient(135deg, #67c23a 0%, #55a320 100%);
}
</style>
