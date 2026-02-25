<template>
  <AdminLayout>
    <div class="database-view">
      <!-- 页面标题 -->
      <div class="header">
        <h1>🗄️ 数据库管理</h1>
        <p class="subtitle">MongoDB 与 MySQL 数据备份管理与恢复</p>
      </div>

      <!-- MongoDB 区域 -->
      <el-card class="mongodb-card">
        <template #header>
          <div class="card-header">
            <span class="card-title">📦 MongoDB</span>
            <el-button type="primary" size="small" :loading="syncing" @click="handleFullSync">
              ▶ 同步到 MySQL
            </el-button>
          </div>
        </template>

        <!-- 集合选择和统计信息 -->
        <div class="table-control">
          <div class="select-group">
            <label>选择集合：</label>
            <el-select
              v-model="selectedMongoTable"
              placeholder="选择要查看的集合"
              @change="loadMongodbTableData(1)"
            >
              <el-option
                v-for="table in mongoTables"
                :key="table"
                :label="`${table} (${mongoStats[table] || 0})`"
                :value="table"
              />
            </el-select>
          </div>
          <div class="stats-group">
            <span v-if="selectedMongoTable" class="stat">
              📊 总计: <strong>{{ mongoStats[selectedMongoTable] || 0 }}</strong> 条
            </span>
          </div>
        </div>

        <!-- 数据表格 -->
        <el-table
          v-if="selectedMongoTable && mongoData.length > 0"
          :data="mongoData"
          stripe
          style="width: 100%; margin-top: 20px"
          :default-sort="{ prop: '_id', order: 'ascending' }"
          max-height="400"
        >
          <el-table-column
            v-for="col in mongoColumns.filter(c => c !== '__v')"
            :key="col"
            :prop="col"
            :label="col"
            show-overflow-tooltip
            :width="col === 'raw_json' ? '400px' : 'auto'"
          >
            <template #default="{ row }">
              <span v-if="col === 'raw_json' || col === 'profile_image'">
                {{ truncateJson(JSON.stringify(row[col])) }}
              </span>
              <span v-else>{{ formatValue(row[col]) }}</span>
            </template>
          </el-table-column>
        </el-table>

        <div v-if="selectedMongoTable && mongoData.length === 0" class="empty-tip">暂无数据</div>

        <!-- 分页 -->
        <el-pagination
          v-if="selectedMongoTable && mongoTotal > 0"
          v-model:current-page="mongoPage"
          v-model:page-size="pageSize"
          :page-sizes="[10, 20, 50]"
          :total="mongoTotal"
          layout="total, sizes, prev, pager, next, jumper"
          style="margin-top: 20px; text-align: right"
          @change="loadMongodbTableData"
        />
      </el-card>

      <!-- MySQL 区域 -->
      <el-card class="mysql-card" style="margin-top: 30px">
        <template #header>
          <div class="card-header">
            <span class="card-title">🗂️ MySQL</span>
            <el-button type="success" size="small" :loading="recovering" @click="handleFullRecover">
              ↩ 从 MySQL 恢复
            </el-button>
          </div>
        </template>

        <!-- 表名选择和统计信息 -->
        <div class="table-control">
          <div class="select-group">
            <label>选择表：</label>
            <el-select
              v-model="selectedMysqlTable"
              placeholder="选择要查看的表"
              @change="loadMysqlTableData(1)"
            >
              <el-option
                v-for="table in mysqlTables"
                :key="table"
                :label="`${table} (${mysqlStats[table] || 0})`"
                :value="table"
              />
            </el-select>
          </div>
          <div class="stats-group">
            <span v-if="selectedMysqlTable" class="stat">
              📊 总计: <strong>{{ mysqlStats[selectedMysqlTable] || 0 }}</strong> 行
            </span>
          </div>
        </div>

        <!-- 数据表格 -->
        <el-table
          v-if="selectedMysqlTable && mysqlData.length > 0"
          :data="mysqlData"
          stripe
          style="width: 100%; margin-top: 20px"
          :default-sort="{ prop: 'id', order: 'ascending' }"
          max-height="400"
        >
          <el-table-column
            v-for="col in mysqlColumns.filter(c => c !== '__v')"
            :key="col"
            :label="col"
            show-overflow-tooltip
            :width="col === 'raw_json' ? '400px' : 'auto'"
          >
            <template #default="{ row }">
              <span v-if="col === 'raw_json'">
                {{ truncateJson(row[col]) }}
              </span>
              <span v-else>{{ formatValue(row[col]) }}</span>
            </template>
          </el-table-column>
        </el-table>

        <div v-if="selectedMysqlTable && mysqlData.length === 0" class="empty-tip">暂无数据</div>

        <!-- 分页 -->
        <el-pagination
          v-if="selectedMysqlTable && mysqlTotal > 0"
          v-model:current-page="mysqlPage"
          v-model:page-size="pageSize"
          :page-sizes="[10, 20, 50]"
          :total="mysqlTotal"
          layout="total, sizes, prev, pager, next, jumper"
          style="margin-top: 20px; text-align: right"
          @change="loadMysqlTableData"
        />
      </el-card>

      <!-- 备份对比区域 -->
      <el-card style="margin-top: 30px">
        <template #header>
          <div class="card-header">
            <span class="card-title">📊 备份对比</span>
            <el-button type="info" size="small" :loading="comparing" @click="compareBackup">
              🔄 对比数据
            </el-button>
          </div>
        </template>

        <el-table
          v-if="comparisonData.length > 0"
          :data="comparisonData"
          stripe
          style="width: 100%"
        >
          <el-table-column prop="table" label="集合/表名" width="150" />
          <el-table-column prop="mongodb" label="MongoDB 数量" width="120" align="center" />
          <el-table-column prop="mysql" label="MySQL 数量" width="120" align="center" />
          <el-table-column prop="matchPercentage" label="字段一致率" width="120" align="center">
            <template #default="{ row }">
              <el-tag :type="row.matchPercentage === 100 ? 'success' : (row.matchPercentage > 50 ? 'warning' : 'danger')">
                {{ row.matchPercentage }}%
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column prop="consistency" label="状态" width="140" align="center" show-overflow-tooltip />
          <el-table-column label="记录匹配" width="130" align="center">
            <template #default="{ row }">
              <span v-if="row.matchedRecords > 0 || row.mismatchedRecords > 0">
                {{ row.matchedRecords }}/{{ row.totalRecords }}
              </span>
              <span v-else>-</span>
            </template>
          </el-table-column>
          <el-table-column label="操作" width="150" align="center">
            <template #default="{ row }">
              <el-button type="primary" size="small" @click="handleViewFieldDetails(row.table)">
                查看字段详情
              </el-button>
            </template>
          </el-table-column>
        </el-table>

        <div v-if="comparisonData.length === 0" class="empty-tip">
          点击"对比数据"按钮查看数据一致性
        </div>
      </el-card>

      <!-- 字段详情对话框 -->
      <el-dialog
        v-model="fieldDetailsDialogVisible"
        :title="`${fieldDetailsTableName} - 字段级对比`"
        width="90%"
        max-height="80vh"
      >
        <div v-if="fieldDetailsLoading" class="loading-tip">
          <el-icon class="is-loading">
            <span>加载中...</span>
          </el-icon>
        </div>

        <el-table
          v-else-if="fieldDetailsData.length > 0"
          :data="fieldDetailsData"
          stripe
          style="width: 100%"
          max-height="600px"
        >
          <el-table-column prop="recordId" label="记录ID" width="200" show-overflow-tooltip />
          <el-table-column prop="field" label="字段名" width="150" show-overflow-tooltip />
          <el-table-column prop="mongoValue" label="MongoDB 值" width="200" show-overflow-tooltip>
            <template #default="{ row }">
              <span :title="row.mongoValue">{{ truncateValue(row.mongoValue) }}</span>
            </template>
          </el-table-column>
          <el-table-column prop="mysqlValue" label="MySQL 值" width="200" show-overflow-tooltip>
            <template #default="{ row }">
              <span :title="row.mysqlValue">{{ truncateValue(row.mysqlValue) }}</span>
            </template>
          </el-table-column>
          <el-table-column prop="status" label="状态" width="100" align="center">
            <template #default="{ row }">
              <el-tag :type="row.status === 'match' ? 'success' : 'warning'">
                {{ row.status === 'match' ? '✅ 一致' : '⚠️ 不一致' }}
              </el-tag>
            </template>
          </el-table-column>
        </el-table>

        <div v-else class="empty-tip">暂无字段对比数据</div>

        <!-- 字段对比统计 -->
        <div
          v-if="fieldDetailsSummary"
          style="margin-top: 20px; padding: 15px; background: #f5f7fa; border-radius: 4px"
        >
          <p><strong>对比统计：</strong></p>
          <p>总记录数: {{ fieldDetailsSummary.totalRecords }}</p>
          <p>总字段数: {{ fieldDetailsSummary.totalFields }}</p>
          <p>✅ 一致字段: {{ fieldDetailsSummary.matchedFields }}</p>
          <p>⚠️ 不一致字段: {{ fieldDetailsSummary.mismatchedFields }}</p>
          <p>一致率: {{ fieldDetailsSummary.matchPercentage }}%</p>
        </div>
      </el-dialog>
    </div>
  </AdminLayout>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import AdminLayout from '../components/AdminLayout.vue';
import { backupApi } from '../services/api';

// MongoDB 集合列表
const mongoTables = [
  'users',
  'admins',
  'periods',
  'sections',
  'checkins',
  'enrollments',
  'payments',
  'insights',
  'insight_requests',
  'comments',
  'notifications'
];

// MySQL 表列表
const mysqlTables = [
  'users',
  'admins',
  'periods',
  'sections',
  'checkins',
  'enrollments',
  'payments',
  'insights',
  'insight_likes',
  'insight_requests',
  'insight_request_audit_logs',
  'comments',
  'comment_replies',
  'notifications'
];

// MongoDB 状态
const selectedMongoTable = ref('');
const mongoStats = ref<Record<string, number>>({});
const mongoData = ref<any[]>([]);
const mongoColumns = ref<string[]>([]);
const mongoPage = ref(1);
const mongoTotal = ref(0);

// MySQL 状态
const selectedMysqlTable = ref('');
const mysqlStats = ref<Record<string, number>>({});
const mysqlData = ref<any[]>([]);
const mysqlColumns = ref<string[]>([]);
const mysqlPage = ref(1);
const mysqlTotal = ref(0);

// 对比状态
const comparisonData = ref<any[]>([]);

// 字段详情对话框状态
const fieldDetailsDialogVisible = ref(false);
const fieldDetailsTableName = ref('');
const fieldDetailsLoading = ref(false);
const fieldDetailsData = ref<any[]>([]);
const fieldDetailsSummary = ref<any>(null);

// 操作状态
const syncing = ref(false);
const recovering = ref(false);
const comparing = ref(false);
const pageSize = ref(20);

// 加载 MongoDB 统计信息
async function loadMongodbStats() {
  try {
    const response = await backupApi.getMongodbStats();
    if (response && typeof response === 'object') {
      mongoStats.value = response;
    }
  } catch (error) {
    ElMessage.error('加载 MongoDB 统计失败');
  }
}

// 加载 MySQL 统计信息
async function loadMysqlStats() {
  try {
    const response = await backupApi.getMysqlStats();
    if (response && typeof response === 'object') {
      mysqlStats.value = response;
    }
  } catch (error) {
    ElMessage.error('加载 MySQL 统计失败');
  }
}

// 加载 MongoDB 表数据
async function loadMongodbTableData(page?: number) {
  if (!selectedMongoTable.value) return;

  try {
    if (page) mongoPage.value = page;

    const response = await backupApi.getMongodbTableData(
      selectedMongoTable.value,
      mongoPage.value,
      pageSize.value
    );

    if (response && Array.isArray(response.data)) {
      mongoData.value = response.data || [];
      mongoTotal.value = response.total || 0;

      // 动态生成列
      if (mongoData.value.length > 0) {
        mongoColumns.value = Object.keys(mongoData.value[0]);
      }
    }
  } catch (error) {
    ElMessage.error('加载 MongoDB 表数据失败');
  }
}

// 加载 MySQL 表数据
async function loadMysqlTableData(page?: number) {
  if (!selectedMysqlTable.value) return;

  try {
    if (page) mysqlPage.value = page;

    const response = await backupApi.getMysqlTableData(
      selectedMysqlTable.value,
      mysqlPage.value,
      pageSize.value
    );

    if (response && Array.isArray(response.data)) {
      mysqlData.value = response.data || [];
      mysqlTotal.value = response.total || 0;

      // 动态生成列
      if (mysqlData.value.length > 0) {
        mysqlColumns.value = Object.keys(mysqlData.value[0]);
      }
    }
  } catch (error) {
    ElMessage.error('加载 MySQL 表数据失败');
  }
}

// 对比备份数据
async function compareBackup() {
  comparing.value = true;
  try {
    const response = await backupApi.compareBackup();

    if (response?.comparison) {
      const comparison = response.comparison;
      comparisonData.value = Object.entries(comparison).map(([table, data]: any) => ({
        table,
        mongodb: data.mongodb,
        mysql: data.mysql,
        difference: data.difference,
        matchPercentage: data.matchPercentage || 0,
        consistency: data.consistency || '❓ 未知',
        totalRecords: data.totalRecords || 0,
        matchedRecords: data.matchedRecords || 0,
        mismatchedRecords: data.mismatchedRecords || 0
      }));

      ElMessage.success('数据对比完成');
    }
  } catch (error) {
    ElMessage.error('数据对比失败');
  } finally {
    comparing.value = false;
  }
}

// 查看字段详情
async function handleViewFieldDetails(tableName: string) {
  fieldDetailsTableName.value = tableName;
  fieldDetailsDialogVisible.value = true;
  fieldDetailsLoading.value = true;
  fieldDetailsData.value = [];
  fieldDetailsSummary.value = null;

  try {
    const response = await backupApi.compareFieldsDetail(tableName);

    if (response?.details && Array.isArray(response.details)) {
      // 转换数据为表格格式
      const tableData: any[] = [];
      let totalMatchedFields = 0;
      let totalFields = 0;

      response.details.forEach((record: any) => {
        // 遍历 fields 对象（而不是数组）
        if (record.fields && typeof record.fields === 'object') {
          Object.entries(record.fields).forEach(([fieldName, fieldData]: any) => {
            tableData.push({
              recordId: record.id || 'N/A',
              field: fieldName,
              mongoValue:
                fieldData.mongodb !== undefined ? JSON.stringify(fieldData.mongodb) : 'null',
              mysqlValue: fieldData.mysql !== undefined ? JSON.stringify(fieldData.mysql) : 'null',
              status: fieldData.matches ? 'match' : 'mismatch'
            });
            totalFields++;
            if (fieldData.matches) {
              totalMatchedFields++;
            }
          });
        }
      });

      fieldDetailsData.value = tableData;

      // 计算统计信息
      fieldDetailsSummary.value = {
        totalRecords: response.totalRecords || 0,
        totalFields: totalFields,
        matchedFields: totalMatchedFields,
        mismatchedFields: totalFields - totalMatchedFields,
        matchPercentage: totalFields > 0 ? Math.round((totalMatchedFields / totalFields) * 100) : 0
      };

      ElMessage.success('字段对比完成');
    }
  } catch (error) {
    console.error('字段对比错误:', error);
    ElMessage.error('获取字段对比数据失败');
  } finally {
    fieldDetailsLoading.value = false;
  }
}

// 全量同步
async function handleFullSync() {
  try {
    await ElMessageBox.confirm(
      '此操作将从 MongoDB 同步所有数据到 MySQL，覆盖现有 MySQL 数据。是否继续？',
      '警告',
      {
        confirmButtonText: '继续同步',
        cancelButtonText: '取消',
        type: 'warning'
      }
    );

    syncing.value = true;
    const response = await backupApi.fullSync();

    if (response?.syncResults && response?.totalSynced) {
      const syncResults = response.syncResults;
      const totalSynced = response.totalSynced;

      const resultMessage = Object.entries(syncResults)
        .map(([table, count]) => `${table}: ${count} 条`)
        .join('\n');

      await ElMessageBox.alert(
        `同步完成！\n\n${resultMessage}\n\n总计: ${totalSynced} 条数据`,
        '同步结果',
        { confirmButtonText: '确定' }
      );

      // 刷新统计数据和表数据
      await Promise.all([loadMongodbStats(), loadMysqlStats()]);

      // 自动刷新当前选中的 MySQL 表数据
      if (selectedMysqlTable.value) {
        await loadMysqlTableData(1);
      }
    }
  } catch (error: any) {
    if (error.message !== 'cancel') {
      ElMessage.error('同步失败');
    }
  } finally {
    syncing.value = false;
  }
}

// 全量恢复
async function handleFullRecover() {
  try {
    await ElMessageBox.confirm(
      '此操作将从 MySQL 恢复所有数据到 MongoDB，覆盖现有 MongoDB 数据。是否继续？',
      '警告',
      {
        confirmButtonText: '继续恢复',
        cancelButtonText: '取消',
        type: 'warning'
      }
    );

    recovering.value = true;
    const response = await backupApi.recoverFull();

    if (response?.recoverResults && response?.totalRecovered) {
      const recoverResults = response.recoverResults;
      const totalRecovered = response.totalRecovered;

      const resultMessage = Object.entries(recoverResults)
        .map(([table, count]) => `${table}: ${count} 条`)
        .join('\n');

      await ElMessageBox.alert(
        `恢复完成！\n\n${resultMessage}\n\n总计: ${totalRecovered} 条数据`,
        '恢复结果',
        { confirmButtonText: '确定' }
      );

      // 刷新统计数据和表数据
      await Promise.all([loadMongodbStats(), loadMysqlStats()]);

      // 自动刷新当前选中的 MongoDB 和 MySQL 表数据
      if (selectedMongoTable.value) {
        await loadMongodbTableData(1);
      }
      if (selectedMysqlTable.value) {
        await loadMysqlTableData(1);
      }
    }
  } catch (error: any) {
    if (error.message !== 'cancel') {
      ElMessage.error('恢复失败');
    }
  } finally {
    recovering.value = false;
  }
}

// 截断 JSON 显示
function truncateJson(json: string): string {
  if (!json) return '';
  const str = typeof json === 'string' ? json : JSON.stringify(json);
  return str.length > 100 ? str.substring(0, 100) + '...' : str;
}

// 格式化值显示
function formatValue(value: any): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'object') return JSON.stringify(value).substring(0, 50);
  return String(value);
}

// 截断值显示（用于字段详情对话框）
function truncateValue(value: string): string {
  if (!value) return '';
  return value.length > 50 ? value.substring(0, 50) + '...' : value;
}

// 页面挂载
const initPage = async () => {
  await Promise.all([loadMongodbStats(), loadMysqlStats()]);

  // 默认选择第一个集合
  if (mongoTables.length > 0) {
    selectedMongoTable.value = mongoTables[0];
    await loadMongodbTableData(1);
  }

  // 默认选择第一个表
  if (mysqlTables.length > 0) {
    selectedMysqlTable.value = mysqlTables[0];
    await loadMysqlTableData(1);
  }
};

// 使用 defineExpose 和同步初始化
defineExpose({ initPage });

// 在组件加载时初始化
initPage().catch(error => {
  console.error('页面初始化失败:', error);
});
</script>

<style scoped>
.database-view {
  padding: 20px;
}

.header {
  margin-bottom: 30px;
}

.header h1 {
  font-size: 28px;
  margin-bottom: 10px;
}

.subtitle {
  color: #666;
  font-size: 14px;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  width: 100%;
}

.card-title {
  font-size: 18px;
  font-weight: bold;
}

.table-control {
  display: flex;
  gap: 30px;
  align-items: center;
  margin-bottom: 20px;
}

.select-group {
  display: flex;
  gap: 10px;
  align-items: center;
}

.select-group label {
  font-weight: bold;
  min-width: 80px;
}

.select-group :deep(.el-select) {
  width: 200px;
}

.stats-group {
  flex: 1;
}

.stat {
  font-size: 14px;
  color: #333;
}

.stat strong {
  font-size: 16px;
  color: #409eff;
}

.mongodb-card :deep(.el-card__header) {
  border-bottom: 2px solid #409eff;
}

.mysql-card :deep(.el-card__header) {
  border-bottom: 2px solid #67c23a;
}

.empty-tip {
  text-align: center;
  padding: 40px 20px;
  color: #999;
  font-size: 14px;
}

.loading-tip {
  text-align: center;
  padding: 40px 20px;
  color: #666;
  font-size: 14px;
}
</style>
