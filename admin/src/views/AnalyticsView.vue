<template>
  <AdminLayout>
    <div class="analytics-container">
      <div class="analytics-toolbar">
        <div class="header-actions">
          <el-date-picker
            v-model="dateRange"
            type="daterange"
            range-separator="至"
            start-placeholder="开始日期"
            end-placeholder="结束日期"
            @change="onDateRangeChange"
          />
          <el-button type="primary" @click="refreshData">🔄 刷新数据</el-button>
        </div>
      </div>

      <!-- 核心指标 -->
      <div class="metrics-grid">
        <el-card class="metric-card">
          <div class="metric-content">
            <div class="metric-info">
              <div class="metric-value">{{ analytics.totalUsers || 0 }}</div>
              <div class="metric-label">当前总用户数</div>
              <div class="metric-trend">
                <span class="trend neutral">全量当前口径</span>
              </div>
            </div>
            <div class="metric-icon">👥</div>
          </div>
        </el-card>

        <el-card class="metric-card">
          <div class="metric-content">
            <div class="metric-info">
              <div class="metric-value">
                {{ analytics.totalEnrollments || 0 }}
              </div>
              <div class="metric-label">总报名数</div>
              <div class="metric-trend">
                <span class="trend neutral">所有报名记录</span>
              </div>
            </div>
            <div class="metric-icon">📝</div>
          </div>
        </el-card>

        <el-card class="metric-card">
          <div class="metric-content">
            <div class="metric-info">
              <div class="metric-value">
                {{ analytics.paidEnrollments || 0 }}
              </div>
              <div class="metric-label">已支付报名</div>
              <div class="metric-trend">
                <span class="trend neutral">paymentStatus = paid</span>
              </div>
            </div>
            <div class="metric-icon">✅</div>
          </div>
        </el-card>

        <el-card class="metric-card">
          <div class="metric-content">
            <div class="metric-info">
              <div class="metric-value">
                ¥{{ formatNumber(analytics.totalRevenue || 0) }}
              </div>
              <div class="metric-label">总收入</div>
              <div class="metric-trend">
                <span class="trend neutral">已完成支付金额</span>
              </div>
            </div>
            <div class="metric-icon">💰</div>
          </div>
        </el-card>

        <el-card class="metric-card">
          <div class="metric-content">
            <div class="metric-info">
              <div class="metric-value">
                {{ (analytics.conversionRate || 0).toFixed(1) }}%
              </div>
              <div class="metric-label">报名支付转化率</div>
              <div class="metric-trend">
                <span
                  class="trend"
                  :class="(analytics.conversionRate || 0) > 50 ? 'up' : 'down'"
                >
                  {{ (analytics.conversionRate || 0) > 50 ? '良好' : '需改善' }}
                </span>
              </div>
            </div>
            <div class="metric-icon">📈</div>
          </div>
        </el-card>
      </div>

      <el-tabs
        v-model="activeTab"
        class="analytics-tabs"
        @tab-change="handleTabChange"
      >
        <el-tab-pane label="业务概览" name="overview">
          <!-- 图表区域 -->
          <div class="charts-grid">
            <!-- 报名趋势图 -->
            <el-card class="chart-card">
              <template #header>
                <div class="card-header">
                  <span>📅 报名趋势</span>
                </div>
              </template>
              <div ref="enrollmentChartRef" style="height: 300px"></div>
            </el-card>

            <!-- 支付方式分布 -->
            <el-card class="chart-card">
              <template #header>
                <div class="card-header">
                  <span>💳 支付方式分布</span>
                </div>
              </template>
              <div ref="paymentMethodChartRef" style="height: 300px"></div>
            </el-card>

            <!-- 期次热度排行 -->
            <el-card class="chart-card">
              <template #header>
                <div class="card-header">
                  <span>🔥 期次热度排行</span>
                </div>
              </template>
              <div ref="periodPopularityChartRef" style="height: 300px"></div>
            </el-card>

            <!-- 报名状态分布 -->
            <el-card class="chart-card">
              <template #header>
                <div class="card-header">
                  <span>📊 报名状态分布</span>
                </div>
              </template>
              <div ref="enrollmentStatusChartRef" style="height: 300px"></div>
            </el-card>
          </div>

          <!-- 数据表格 -->
          <el-card style="margin-top: 24px">
            <template #header>
              <div class="card-header">
                <span>📋 每日数据统计</span>
                <el-button type="primary" text @click="exportData">
                  📥 导出数据
                </el-button>
              </div>
            </template>

            <el-table
              :data="dailyStats"
              stripe
              style="width: 100%"
              max-height="600"
            >
              <el-table-column prop="date" label="日期" width="120" />
              <el-table-column
                prop="enrollmentCount"
                label="新增报名"
                width="100"
              />
              <el-table-column
                prop="paymentCount"
                label="支付笔数"
                width="100"
              />
              <el-table-column
                prop="paymentAmount"
                label="支付金额"
                width="120"
              >
                <template #default="{ row }">
                  ¥{{ formatNumber(row.paymentAmount || 0) }}
                </template>
              </el-table-column>
              <el-table-column
                prop="activeUsers"
                label="活跃用户"
                width="100"
              />
              <el-table-column prop="newUsers" label="新增用户" width="100" />
            </el-table>
          </el-card>
        </el-tab-pane>

        <el-tab-pane label="活跃度" name="activity">
          <div class="activity-summary-grid">
            <el-card class="metric-card">
              <div class="metric-value">
                {{ activitySummary.todayAppOpenUsers || 0 }}
              </div>
              <div class="metric-label">今日访问小程序人数</div>
            </el-card>
            <el-card class="metric-card">
              <div class="metric-value">
                {{ activitySummary.todayCheckinUsers || 0 }}
              </div>
              <div class="metric-label">今日打卡人数</div>
            </el-card>
            <el-card class="metric-card">
              <div class="metric-value">
                {{ activitySummary.todayInsightViewUsers || 0 }}
              </div>
              <div class="metric-label">今日小凡看见浏览人数</div>
            </el-card>
            <el-card class="metric-card">
              <div class="metric-value">
                {{ activitySummary.todayActiveUsers || 0 }}
              </div>
              <div class="metric-label">今日关键行为人数</div>
            </el-card>
          </div>

          <el-card class="chart-card activity-chart-card">
            <template #header>
              <div class="card-header">
                <span>📈 关键行为活跃人数趋势</span>
              </div>
            </template>
            <div ref="activityChartRef" style="height: 360px"></div>
          </el-card>

          <el-card style="margin-top: 24px">
            <template #header>
              <div class="card-header">
                <span>📋 每日关键行为明细</span>
              </div>
            </template>

            <el-table
              :data="activityDailyRows"
              stripe
              style="width: 100%"
              max-height="420"
            >
              <el-table-column prop="date" label="日期" width="120" />
              <el-table-column
                prop="activeUserCount"
                label="活跃用户"
                width="100"
              />
              <el-table-column prop="app_open" label="访问小程序" width="110" />
              <el-table-column
                prop="course_view"
                label="查看课程"
                width="100"
              />
              <el-table-column prop="checkin_submit" label="打卡" width="80" />
              <el-table-column prop="comment_create" label="评论" width="80" />
              <el-table-column prop="like_create" label="点赞" width="80" />
              <el-table-column
                prop="own_insight_view"
                label="看自己小凡"
                width="110"
              />
              <el-table-column
                prop="other_insight_view"
                label="看他人小凡"
                width="110"
              />
              <el-table-column prop="meeting_enter" label="去晨读" width="90" />
              <el-table-column
                prop="insight_request_approve"
                label="同意请求"
                width="100"
              />
            </el-table>
          </el-card>

          <el-card style="margin-top: 24px">
            <template #header>
              <div class="card-header">
                <span>👤 用户行为明细</span>
              </div>
            </template>

            <el-table
              :data="activityDetailRows"
              stripe
              style="width: 100%"
              max-height="520"
            >
              <el-table-column prop="date" label="日期" width="120" />
              <el-table-column prop="nickname" label="用户" width="140" />
              <el-table-column prop="phone" label="手机" width="140" />
              <el-table-column label="当天动作" min-width="360">
                <template #default="{ row }">
                  <el-tag
                    v-for="item in row.actions"
                    :key="item.action"
                    class="activity-tag"
                    size="small"
                  >
                    {{ item.label }} {{ item.count }}
                  </el-tag>
                </template>
              </el-table-column>
              <el-table-column prop="totalCount" label="动作次数" width="100" />
              <el-table-column label="最近动作时间" width="180">
                <template #default="{ row }">{{
                  formatDateTime(row.lastOccurredAt)
                }}</template>
              </el-table-column>
            </el-table>
          </el-card>
        </el-tab-pane>
      </el-tabs>
    </div>
  </AdminLayout>
</template>

<script setup lang="ts">
import { ref, onMounted, nextTick } from 'vue';
import { ElMessage } from 'element-plus';
import * as echarts from 'echarts';
import AdminLayout from '@/components/AdminLayout.vue';
import { analyticsApi, statsApi } from '../services/api';

// 数据
const activeTab = ref('overview');
const dateRange = ref<[Date, Date] | null>(null);
const analytics = ref({
  totalUsers: 0,
  totalEnrollments: 0,
  paidEnrollments: 0,
  totalRevenue: 0,
  conversionRate: 0,
  userTrend: 0,
  enrollmentTrend: 0,
  revenueTrend: 0
});
const dailyStats = ref([]);
const activitySummary = ref({
  totalActiveUsers: 0,
  todayAppOpenUsers: 0,
  todayCheckinUsers: 0,
  todayInsightViewUsers: 0,
  todayActiveUsers: 0
});
const activityDailyRows = ref<any[]>([]);
const activityDetailRows = ref<any[]>([]);

// 图表引用
const enrollmentChartRef = ref();
const paymentMethodChartRef = ref();
const periodPopularityChartRef = ref();
const enrollmentStatusChartRef = ref();
const activityChartRef = ref();

// 图表实例
let enrollmentChart: echarts.ECharts | null = null;
let paymentMethodChart: echarts.ECharts | null = null;
let periodPopularityChart: echarts.ECharts | null = null;
let enrollmentStatusChart: echarts.ECharts | null = null;
let activityChart: echarts.ECharts | null = null;

// 格式化数字（金额单位：分 -> 元）
const formatNumber = (value: number) => {
  // 金额以分为单位，需要除以100转换为元
  const yuan = value / 100;
  if (yuan >= 10000) {
    return (yuan / 10000).toFixed(1) + '万';
  }
  return yuan.toFixed(2);
};

// 日期范围变化
const onDateRangeChange = () => {
  loadAnalytics();
  loadActivityAnalytics();
};

// 刷新数据
const refreshData = async () => {
  await Promise.all([loadAnalytics(), loadActivityAnalytics()]);
  ElMessage.success('数据已刷新');
};

// 导出数据
const exportData = () => {
  const headers = [
    '日期',
    '新增报名',
    '支付笔数',
    '支付金额',
    '活跃用户',
    '新增用户'
  ];
  const rows = dailyStats.value.map((stat: any) => [
    stat.date,
    stat.enrollmentCount,
    stat.paymentCount,
    stat.paymentAmount,
    stat.activeUsers,
    stat.newUsers
  ]);

  const csv = [headers, ...rows].map((row) => row.join(',')).join('\n');

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);

  link.setAttribute('href', url);
  link.setAttribute('download', 'analytics_' + new Date().getTime() + '.csv');
  link.style.visibility = 'hidden';

  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  ElMessage.success('数据已导出');
};

// 初始化报名趋势图
const initEnrollmentChart = (data: any) => {
  if (!enrollmentChartRef.value) return;

  if (!enrollmentChart) {
    enrollmentChart = echarts.init(enrollmentChartRef.value);
  }

  const dates = data.map((item: any) => item.date || '');
  const counts = data.map((item: any) => item.enrollmentCount || 0);

  const option = {
    tooltip: { trigger: 'axis' },
    xAxis: { type: 'category', data: dates },
    yAxis: { type: 'value' },
    series: [
      {
        data: counts,
        type: 'line',
        smooth: true,
        itemStyle: { color: '#4a90e2' },
        areaStyle: { color: 'rgba(74, 144, 226, 0.2)' }
      }
    ]
  };

  enrollmentChart.setOption(option);
};

// 初始化支付方式图
const initPaymentMethodChart = (data: any) => {
  if (!paymentMethodChartRef.value) return;

  if (!paymentMethodChart) {
    paymentMethodChart = echarts.init(paymentMethodChartRef.value);
  }

  const methodLabels: Record<string, string> = {
    wechat: '微信支付',
    wechat_pay: '微信支付',
    alipay: '支付宝',
    mock: '测试支付'
  };
  const chartData = Object.entries(data || {}).map(([method, count]) => ({
    value: Number(count) || 0,
    name: methodLabels[method] || method || '未知方式'
  }));

  const option = {
    tooltip: { trigger: 'item' },
    legend: { orient: 'vertical', left: 'left' },
    series: [
      {
        name: '支付方式',
        type: 'pie',
        radius: '50%',
        data: chartData,
        emphasis: {
          itemStyle: {
            shadowBlur: 10,
            shadowOffsetX: 0,
            shadowColor: 'rgba(0, 0, 0, 0.5)'
          }
        }
      }
    ]
  };

  paymentMethodChart.setOption(option);
};

// 初始化期次热度图
const initPeriodPopularityChart = (data: any) => {
  if (!periodPopularityChartRef.value) return;

  if (!periodPopularityChart) {
    periodPopularityChart = echarts.init(periodPopularityChartRef.value);
  }

  const periods = data.map((item: any) => item.periodName || '');
  const enrollments = data.map((item: any) => item.enrollmentCount || 0);

  const option = {
    tooltip: { trigger: 'axis' },
    xAxis: { type: 'category', data: periods },
    yAxis: { type: 'value' },
    series: [
      {
        data: enrollments,
        type: 'bar',
        itemStyle: { color: '#7ed321' }
      }
    ]
  };

  periodPopularityChart.setOption(option);
};

// 初始化报名状态图
const initEnrollmentStatusChart = (data: any) => {
  if (!enrollmentStatusChartRef.value) return;

  if (!enrollmentStatusChart) {
    enrollmentStatusChart = echarts.init(enrollmentStatusChartRef.value);
  }

  const option = {
    tooltip: { trigger: 'item' },
    legend: { orient: 'vertical', left: 'left' },
    series: [
      {
        name: '报名状态',
        type: 'pie',
        radius: '50%',
        data: [
          { value: data.pending || 0, name: '待审批' },
          { value: data.approved || 0, name: '已批准' },
          { value: data.rejected || 0, name: '已拒绝' }
        ],
        emphasis: {
          itemStyle: {
            shadowBlur: 10,
            shadowOffsetX: 0,
            shadowColor: 'rgba(0, 0, 0, 0.5)'
          }
        }
      }
    ]
  };

  enrollmentStatusChart.setOption(option);
};

const initActivityChart = (rows: any[]) => {
  if (!activityChartRef.value) return;

  if (!activityChart) {
    activityChart = echarts.init(activityChartRef.value);
  }

  const dates = rows.map((item) => item.date);
  const seriesConfig = [
    { key: 'app_open', name: '访问小程序' },
    { key: 'checkin_submit', name: '打卡' },
    { key: 'own_insight_view', name: '看自己小凡' },
    { key: 'other_insight_view', name: '看他人小凡' },
    { key: 'course_view', name: '查看课程' },
    { key: 'meeting_enter', name: '去晨读' }
  ];

  activityChart.setOption({
    tooltip: { trigger: 'axis' },
    legend: { top: 0 },
    grid: { top: 48, left: 36, right: 24, bottom: 28, containLabel: true },
    xAxis: { type: 'category', data: dates },
    yAxis: { type: 'value', minInterval: 1 },
    series: seriesConfig.map((item) => ({
      name: item.name,
      type: 'line',
      smooth: true,
      data: rows.map((row) => row[item.key] || 0)
    }))
  });
};

const getDateParams = () => {
  if (!dateRange.value) return {};

  return {
    startDate: dateRange.value[0].toISOString(),
    endDate: dateRange.value[1].toISOString()
  };
};

const loadActivityAnalytics = async () => {
  try {
    const data = await analyticsApi.getActivityAnalytics(getDateParams());
    activitySummary.value = data.summary || activitySummary.value;
    activityDailyRows.value = data.daily || [];
    activityDetailRows.value = data.details || [];

    await nextTick();
    initActivityChart(activityDailyRows.value);
  } catch (error) {
    console.error('Failed to load activity analytics:', error);
    ElMessage.error('加载活跃度数据失败');
  }
};

const formatDateTime = (dateString: string) => {
  if (!dateString) return '-';
  return new Date(dateString).toLocaleString('zh-CN');
};

const handleTabChange = async () => {
  await nextTick();
  if (activeTab.value === 'activity') {
    initActivityChart(activityDailyRows.value);
    activityChart?.resize();
    return;
  }

  enrollmentChart?.resize();
  paymentMethodChart?.resize();
  periodPopularityChart?.resize();
  enrollmentStatusChart?.resize();
};

// 加载分析数据
const loadAnalytics = async () => {
  try {
    const [dashboardStats, enrollmentStats, paymentStats] = await Promise.all([
      statsApi.getDashboardStats(),
      statsApi.getEnrollmentStats(),
      statsApi.getPaymentStats()
    ]);
    const totalUsers = dashboardStats.totalUsers || 0;
    const totalEnrollments = dashboardStats.totalEnrollments || 0;
    const paidEnrollments = dashboardStats.paidEnrollments || 0;
    const conversionRate =
      totalEnrollments > 0
        ? Number(((paidEnrollments / totalEnrollments) * 100).toFixed(1))
        : 0;

    // 构建分析数据
    analytics.value = {
      totalUsers,
      totalEnrollments,
      paidEnrollments,
      totalRevenue: dashboardStats.totalPaymentAmount || 0,
      conversionRate,
      userTrend: dashboardStats.userTrend || 0,
      enrollmentTrend: dashboardStats.enrollmentTrend || 0,
      revenueTrend: dashboardStats.revenueTrend || 0
    };

    const dailyStatsMap = new Map<string, any>();
    (enrollmentStats.enrollmentTrend || []).forEach((item: any) => {
      dailyStatsMap.set(item.date, {
        date: item.date,
        enrollmentCount: item.enrollmentCount || 0,
        paymentCount: 0,
        paymentAmount: 0,
        activeUsers: 0,
        newUsers: 0
      });
    });
    (paymentStats.paymentTrend || []).forEach((item: any) => {
      const date = item._id || item.date;
      const row = dailyStatsMap.get(date) || {
        date,
        enrollmentCount: 0,
        paymentCount: 0,
        paymentAmount: 0,
        activeUsers: 0,
        newUsers: 0
      };
      row.paymentCount = item.count || 0;
      row.paymentAmount = item.totalAmount || 0;
      dailyStatsMap.set(date, row);
    });
    const dailyStatsData = Array.from(dailyStatsMap.values()).sort((a, b) =>
      a.date.localeCompare(b.date)
    );
    dailyStats.value = dailyStatsData;

    // 初始化图表
    await nextTick();
    initEnrollmentChart(dailyStatsData);

    const paymentMethodStats = (paymentStats.paymentMethodStats || []).reduce(
      (acc: Record<string, number>, item: any) => {
        acc[item.method || 'unknown'] = item.count || 0;
        return acc;
      },
      {}
    );
    initPaymentMethodChart(paymentMethodStats);

    const periodPopularityData = (enrollmentStats.periodStats || []).map(
      (item: any) => ({
        periodName: item.periodName,
        enrollmentCount: item.total || 0
      })
    );
    initPeriodPopularityChart(periodPopularityData);

    const enrollmentStatusData = (enrollmentStats.statusStats || []).reduce(
      (acc: Record<string, number>, item: any) => {
        acc[item.status || 'unknown'] = item.count || 0;
        return acc;
      },
      {}
    );
    initEnrollmentStatusChart(enrollmentStatusData);
  } catch (error) {
    console.error('Failed to load analytics:', error);
    ElMessage.error('加载分析数据失败');
    // 如果API调用失败，显示默认的空数据而不是mock数据
    analytics.value = {
      totalUsers: 0,
      totalEnrollments: 0,
      paidEnrollments: 0,
      totalRevenue: 0,
      conversionRate: 0,
      userTrend: 0,
      enrollmentTrend: 0,
      revenueTrend: 0
    };
  }
};

// 页面加载
onMounted(async () => {
  await Promise.all([loadAnalytics(), loadActivityAnalytics()]);

  // 窗口大小变化时重新绘制图表
  window.addEventListener('resize', () => {
    enrollmentChart?.resize();
    paymentMethodChart?.resize();
    periodPopularityChart?.resize();
    enrollmentStatusChart?.resize();
    activityChart?.resize();
  });
});
</script>

<style scoped>
.analytics-container {
  padding: 24px;
  background-color: #f5f7fa;
  min-height: 100vh;
}

.analytics-toolbar {
  display: flex;
  justify-content: flex-end;
  align-items: center;
  margin-bottom: 24px;
}

.header-actions {
  display: flex;
  gap: 12px;
  align-items: center;
}

/* 指标卡片网格 */
.metrics-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 16px;
  margin-bottom: 24px;
}

.metric-card {
  border: none;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
  overflow: hidden;
  background: white;
}

.metric-card :deep(.el-card__body) {
  padding: 20px;
}

.metric-content {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.metric-info {
  flex: 1;
}

.metric-value {
  font-size: 28px;
  font-weight: 700;
  color: #333;
  margin-bottom: 8px;
}

.metric-label {
  font-size: 14px;
  color: #666;
  margin-bottom: 8px;
}

.metric-trend {
  font-size: 12px;
}

.metric-trend .trend {
  padding: 2px 8px;
  border-radius: 4px;
  display: inline-block;
}

.metric-trend .trend.up {
  background-color: #f0f9ff;
  color: #22c55e;
}

.metric-trend .trend.down {
  background-color: #fef2f2;
  color: #ef4444;
}

.metric-trend .trend.neutral {
  background-color: #f4f4f5;
  color: #606266;
}

.metric-icon {
  font-size: 48px;
  opacity: 0.1;
  margin-left: 16px;
}

/* 图表网格 */
.charts-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(400px, 1fr));
  gap: 16px;
  margin-bottom: 24px;
}

.chart-card {
  border: none;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
  background: white;
}

.chart-card :deep(.el-card__body) {
  padding: 20px;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.analytics-tabs {
  margin-top: 8px;
}

.activity-summary-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 16px;
  margin-bottom: 24px;
}

.activity-chart-card {
  margin-bottom: 24px;
}

.activity-tag {
  margin: 2px 6px 2px 0;
}

/* 响应式 */
@media (max-width: 768px) {
  .header-actions {
    width: 100%;
    flex-direction: column;
  }

  .metrics-grid {
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  }

  .charts-grid {
    grid-template-columns: 1fr;
  }

  .activity-summary-grid {
    grid-template-columns: 1fr;
  }
}
</style>
