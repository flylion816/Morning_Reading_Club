<template>
  <AdminLayout>
    <div class="audit-logs-container">
      <!-- 头部统计卡片 -->
      <div class="stats-grid">
        <el-card class="stat-card">
          <template #header>
            <div class="stat-header">
              <span class="stat-icon total">📊</span>
              <span>总操作数</span>
            </div>
          </template>
          <div class="stat-value">{{ stats?.total || 0 }}</div>
          <div class="stat-trend">今日: {{ stats?.today || 0 }}</div>
        </el-card>

        <el-card class="stat-card">
          <template #header>
            <div class="stat-header">
              <span class="stat-icon failed">❌</span>
              <span>失败操作</span>
            </div>
          </template>
          <div class="stat-value">{{ stats?.failed || 0 }}</div>
          <div class="stat-trend">{{ failureRate }}% 失败率</div>
        </el-card>

        <el-card class="stat-card">
          <template #header>
            <div class="stat-header">
              <span class="stat-icon actions">🔄</span>
              <span>主要操作类型</span>
            </div>
          </template>
          <div class="stat-value-list">
            <div v-for="(count, type) in topActions" :key="type" class="stat-item">
              <span>{{ type }}</span>
              <span class="count">{{ count }}</span>
            </div>
          </div>
        </el-card>

        <el-card class="stat-card">
          <template #header>
            <div class="stat-header">
              <span class="stat-icon admins">👤</span>
              <span>活跃管理员</span>
            </div>
          </template>
          <div class="stat-value-list">
            <div
              v-for="admin in (stats?.topAdmins || []).slice(0, 3)"
              :key="admin._id"
              class="stat-item"
            >
              <span>{{ admin.name || admin.email || '未知' }}</span>
              <span class="count">{{ admin.count }}</span>
            </div>
          </div>
        </el-card>
      </div>

      <!-- 筛选面板 -->
      <el-card class="filter-card">
        <div class="filter-panel">
          <el-input
            v-model="filters.adminName"
            placeholder="管理员名称"
            clearable
            style="width: 150px"
          />

          <el-select
            v-model="filters.actionType"
            placeholder="操作类型"
            clearable
            style="width: 150px"
          >
            <el-option label="创建" value="CREATE" />
            <el-option label="更新" value="UPDATE" />
            <el-option label="删除" value="DELETE" />
            <el-option label="批准" value="APPROVE" />
            <el-option label="拒绝" value="REJECT" />
            <el-option label="批量更新" value="BATCH_UPDATE" />
            <el-option label="批量删除" value="BATCH_DELETE" />
          </el-select>

          <el-select
            v-model="filters.resourceType"
            placeholder="资源类型"
            clearable
            style="width: 150px"
          >
            <el-option label="报名" value="enrollment" />
            <el-option label="期次" value="period" />
            <el-option label="课节" value="section" />
            <el-option label="用户" value="user" />
            <el-option label="支付" value="payment" />
            <el-option label="管理员" value="admin" />
          </el-select>

          <el-select v-model="filters.status" placeholder="操作状态" clearable style="width: 120px">
            <el-option label="成功" value="success" />
            <el-option label="失败" value="failure" />
          </el-select>

          <el-date-picker
            v-model="dateRange"
            type="daterange"
            range-separator="至"
            start-placeholder="开始日期"
            end-placeholder="结束日期"
            style="width: 280px"
          />

          <el-button type="primary" @click="handleSearch">🔍 查询</el-button>
          <el-button @click="handleReset">↻ 重置</el-button>
          <el-button @click="handleExport">📥 导出</el-button>
        </div>
      </el-card>

      <!-- 日志表格 -->
      <el-card class="table-card">
        <template #header>
          <div class="card-header">
            <span>📋 审计日志列表</span>
            <el-pagination
              v-model:current-page="pagination.page"
              v-model:page-size="pagination.pageSize"
              :page-sizes="[10, 20, 50, 100]"
              :total="pagination.total"
              layout="total, sizes, prev, pager, next"
              @current-change="handlePageChange"
              @size-change="handlePageSizeChange"
            />
          </div>
        </template>

        <el-table v-loading="loading" :data="auditLogs" stripe style="width: 100%" max-height="600">
          <el-table-column prop="timestamp" label="时间" width="170" sortable>
            <template #default="{ row }">
              {{ formatTime(row.timestamp) }}
            </template>
          </el-table-column>

          <el-table-column label="管理员姓名" width="120">
            <template #default="{ row }">
              {{ getAdminName(row) }}
            </template>
          </el-table-column>

          <el-table-column label="管理员账号" width="180" show-overflow-tooltip>
            <template #default="{ row }">
              {{ getAdminAccount(row) }}
            </template>
          </el-table-column>

          <el-table-column label="操作类型" width="120">
            <template #default="{ row }">
              <el-tag :type="getActionTypeColor(row.actionType)">
                {{ row.actionType }}
              </el-tag>
            </template>
          </el-table-column>

          <el-table-column label="资源类型" width="100">
            <template #default="{ row }">
              <el-tag>{{ row.resourceType }}</el-tag>
            </template>
          </el-table-column>

          <el-table-column label="状态" width="80">
            <template #default="{ row }">
              <el-tag v-if="row.status === 'success'" type="success">✓ 成功</el-tag>
              <el-tag v-else type="danger">✗ 失败</el-tag>
            </template>
          </el-table-column>

          <el-table-column prop="ipAddress" label="IP地址" width="120" show-overflow-tooltip />

          <el-table-column label="操作" width="100" fixed="right">
            <template #default="{ row }">
              <el-button link type="primary" @click="handleShowDetails(row)"> 查看详情 </el-button>
            </template>
          </el-table-column>
        </el-table>
      </el-card>

      <!-- 详情弹窗 -->
      <el-dialog v-model="detailsVisible" title="审计日志详情" width="600px">
        <div v-if="selectedLog" class="log-details">
          <div class="detail-row">
            <span class="label">操作时间:</span>
            <span>{{ formatTime(selectedLog.timestamp) }}</span>
          </div>

          <div class="detail-row">
            <span class="label">管理员姓名:</span>
            <span>{{ getAdminName(selectedLog) }}</span>
          </div>

          <div class="detail-row">
            <span class="label">管理员账号:</span>
            <span>{{ getAdminAccount(selectedLog) }}</span>
          </div>

          <div class="detail-row">
            <span class="label">操作类型:</span>
            <el-tag :type="getActionTypeColor(selectedLog.actionType)">
              {{ selectedLog.actionType }}
            </el-tag>
          </div>

          <div class="detail-row">
            <span class="label">资源类型:</span>
            <el-tag>{{ selectedLog.resourceType }}</el-tag>
          </div>

          <div class="detail-row">
            <span class="label">资源ID:</span>
            <code>{{ selectedLog.resourceId || '无' }}</code>
          </div>

          <div class="detail-row">
            <span class="label">操作说明:</span>
            <span>{{ selectedLog.details?.description || '无' }}</span>
          </div>

          <div class="detail-row">
            <span class="label">操作状态:</span>
            <el-tag v-if="selectedLog.status === 'success'" type="success">✓ 成功</el-tag>
            <el-tag v-else type="danger">✗ 失败</el-tag>
          </div>

          <div v-if="selectedLog.errorMessage" class="detail-row error">
            <span class="label">错误信息:</span>
            <span>{{ selectedLog.errorMessage }}</span>
          </div>

          <div v-if="selectedLog.details?.batchCount" class="detail-row">
            <span class="label">批量数量:</span>
            <span>{{ selectedLog.details.batchCount }}</span>
          </div>

          <div v-if="selectedLog.details?.reason" class="detail-row">
            <span class="label">原因:</span>
            <span>{{ selectedLog.details.reason }}</span>
          </div>

          <div class="detail-row">
            <span class="label">IP地址:</span>
            <span>{{ selectedLog.ipAddress || '无' }}</span>
          </div>

          <div v-if="selectedLog.details?.changes" class="detail-row">
            <span class="label">字段变更:</span>
            <div class="changes-list">
              <div
                v-for="(change, field) in selectedLog.details.changes"
                :key="field"
                class="change-item"
              >
                <span class="field-name">{{ field }}:</span>
                <span class="change-value">
                  {{ JSON.stringify(change.before) }} → {{ JSON.stringify(change.after) }}
                </span>
              </div>
            </div>
          </div>
        </div>
      </el-dialog>
    </div>
  </AdminLayout>
</template>

<script setup lang="ts">
import { ref, computed, defineExpose } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import AdminLayout from '../components/AdminLayout.vue';
import * as auditApi from '../api/audit';
import type { AuditLog, AuditStatistics } from '../api/audit';

const loading = ref(false);
const auditLogs = ref<AuditLog[]>([]);
const stats = ref<AuditStatistics>({
  total: 0,
  today: 0,
  failed: 0,
  actionTypeStats: {},
  resourceTypeStats: {},
  topAdmins: []
});

const pagination = ref({
  page: 1,
  pageSize: 20,
  total: 0
});

const filters = ref({
  adminName: '',
  actionType: '',
  resourceType: '',
  status: ''
});

const dateRange = ref<[Date, Date] | null>(null);

const detailsVisible = ref(false);
const selectedLog = ref<AuditLog | null>(null);

// 计算失败率
const failureRate = computed(() => {
  if (!stats.value || stats.value.total === 0) return 0;
  return Math.round((stats.value.failed / stats.value.total) * 100);
});

// 计算前3个操作类型
const topActions = computed(() => {
  if (!stats.value?.actionTypeStats) return {};
  const sorted = Object.entries(stats.value.actionTypeStats)
    .sort(([, a], [, b]) => (b as number) - (a as number))
    .slice(0, 3);
  return Object.fromEntries(sorted);
});

// 格式化时间
const formatTime = (timestamp: string | number): string => {
  const date = new Date(timestamp);
  return date.toLocaleString('zh-CN');
};

const getAdminName = (log: AuditLog | null | undefined): string => {
  if (!log) return '无';
  if (typeof log.adminId === 'object' && log.adminId?.name) {
    return log.adminId.name;
  }
  return log.adminName || '无';
};

const getAdminAccount = (log: AuditLog | null | undefined): string => {
  if (!log) return '无';
  if (typeof log.adminId === 'object' && log.adminId?.email) {
    return log.adminId.email;
  }
  if (typeof log.adminId === 'string') {
    return log.adminId;
  }
  return '无';
};

// 获取操作类型的颜色
const getActionTypeColor = (actionType: string): string => {
  const colorMap: Record<string, string> = {
    CREATE: 'success',
    UPDATE: 'primary',
    DELETE: 'danger',
    APPROVE: 'success',
    REJECT: 'warning',
    BATCH_UPDATE: 'primary',
    BATCH_DELETE: 'danger',
    LOGIN: 'info',
    LOGOUT: 'info'
  };
  return colorMap[actionType] || 'info';
};

// 加载数据
const loadLogs = async () => {
  loading.value = true;
  try {
    const params: any = {
      page: pagination.value.page,
      pageSize: pagination.value.pageSize
    };

    if (filters.value.adminName) params.adminName = filters.value.adminName;
    if (filters.value.actionType) params.actionType = filters.value.actionType;
    if (filters.value.resourceType) params.resourceType = filters.value.resourceType;
    if (filters.value.status) params.status = filters.value.status;
    if (dateRange.value) {
      params.startDate = dateRange.value[0].toISOString();
      params.endDate = dateRange.value[1].toISOString();
    }

    const result = await auditApi.getAuditLogs(params);
    // result 是 AuditLogsResponse，包含 data、total、page、pageSize、pages
    auditLogs.value = result.data || [];
    pagination.value.total = result.total || 0;
  } catch (error) {
    ElMessage.error('加载审计日志失败');
    console.error(error);
  } finally {
    loading.value = false;
  }
};

// 加载统计数据
const loadStatistics = async () => {
  try {
    const data = await auditApi.getAuditStatistics();
    if (data) {
      stats.value = data;
    }
  } catch (error) {
    console.error('加载统计数据失败:', error);
    // 保留默认值，不覆盖
  }
};

// 查询
const handleSearch = () => {
  pagination.value.page = 1;
  loadLogs();
};

// 重置
const handleReset = () => {
  filters.value = { adminName: '', actionType: '', resourceType: '', status: '' };
  dateRange.value = null;
  pagination.value.page = 1;
  loadLogs();
};

// 导出
const handleExport = async () => {
  try {
    await ElMessageBox.confirm('确认导出审计日志？此操作会导出所有筛选条件下的日志。', '提示', {
      confirmButtonText: '确认',
      cancelButtonText: '取消',
      type: 'warning'
    });

    loading.value = true;
    const params: any = {};
    if (filters.value.actionType) params.actionType = filters.value.actionType;
    if (filters.value.resourceType) params.resourceType = filters.value.resourceType;
    if (filters.value.status) params.status = filters.value.status;
    if (dateRange.value) {
      params.startDate = dateRange.value[0].toISOString();
      params.endDate = dateRange.value[1].toISOString();
    }

    const blob = await auditApi.exportAuditLogs(params);
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `audit-logs-${Date.now()}.csv`;
    link.click();
    window.URL.revokeObjectURL(url);

    ElMessage.success('导出成功');
  } catch (error: any) {
    if (error.message !== 'cancel') {
      ElMessage.error('导出失败');
    }
  } finally {
    loading.value = false;
  }
};

// 显示详情
const handleShowDetails = (log: AuditLog) => {
  selectedLog.value = log;
  detailsVisible.value = true;
};

// 页码变化
const handlePageChange = () => {
  loadLogs();
};

// 每页数量变化
const handlePageSizeChange = () => {
  pagination.value.page = 1;
  loadLogs();
};

// 页面初始化
const initPage = async () => {
  await Promise.all([loadStatistics(), loadLogs()]);
};

// 使用 defineExpose 和同步初始化
defineExpose({ initPage });

// 在组件加载时初始化
initPage().catch(error => {
  console.error('页面初始化失败:', error);
});
</script>

<style scoped>
.audit-logs-container {
  padding: 24px;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 16px;
  margin-bottom: 24px;
}

.stat-card {
  border-radius: 8px;
  transition: all 0.3s ease;
}

.stat-card:hover {
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.1);
}

.stat-header {
  display: flex;
  align-items: center;
  gap: 8px;
}

.stat-icon {
  font-size: 20px;
}

.stat-value {
  font-size: 32px;
  font-weight: 600;
  color: #303133;
  margin: 16px 0 8px 0;
}

.stat-trend {
  font-size: 12px;
  color: #909399;
}

.stat-value-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.stat-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 0;
}

.count {
  font-weight: 600;
  color: #4a90e2;
}

.filter-card {
  margin-bottom: 24px;
}

.filter-panel {
  display: flex;
  gap: 10px;
  align-items: center;
  flex-wrap: wrap;
}

.table-card {
  border-radius: 8px;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  width: 100%;
}

.log-details {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.detail-row {
  display: flex;
  gap: 12px;
  align-items: flex-start;
}

.detail-row.error {
  color: #f56c6c;
}

.label {
  font-weight: 600;
  color: #606266;
  min-width: 100px;
}

code {
  background: #f5f7fa;
  padding: 2px 6px;
  border-radius: 3px;
  color: #e83e8c;
  font-family: monospace;
  font-size: 12px;
}

.changes-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  width: 100%;
}

.change-item {
  display: flex;
  gap: 8px;
  background: #f5f7fa;
  padding: 8px;
  border-radius: 4px;
  font-size: 12px;
}

.field-name {
  font-weight: 600;
  color: #606266;
  min-width: 100px;
}

.change-value {
  flex: 1;
  word-break: break-all;
  color: #303133;
}
</style>
