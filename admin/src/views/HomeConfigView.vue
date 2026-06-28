<template>
  <AdminLayout>
    <div class="home-config-container">
      <el-card>
        <template #header>
          <div class="card-header">
            <span>首页板块顺序</span>
            <div class="header-actions">
              <el-button @click="resetDefault" :disabled="loading || saving">恢复默认</el-button>
              <el-button type="primary" :loading="saving" @click="saveConfig">保存</el-button>
            </div>
          </div>
        </template>

        <el-table
          v-loading="loading"
          :data="sections"
          row-key="key"
          size="large"
          class="section-table"
        >
          <el-table-column label="顺序" width="80" align="center">
            <template #default="{ $index }">
              <span class="order-number">{{ $index + 1 }}</span>
            </template>
          </el-table-column>
          <el-table-column label="板块" min-width="180">
            <template #default="{ row }">
              <div class="section-name">
                <span class="section-icon">{{ row.icon }}</span>
                <span>{{ row.label }}</span>
              </div>
            </template>
          </el-table-column>
          <el-table-column label="Key" prop="key" width="180" />
          <el-table-column label="操作" width="180" align="center">
            <template #default="{ $index }">
              <el-button
                size="small"
                :disabled="$index === 0 || loading || saving"
                @click="moveSection($index, -1)"
              >上移</el-button>
              <el-button
                size="small"
                :disabled="$index === sections.length - 1 || loading || saving"
                @click="moveSection($index, 1)"
              >下移</el-button>
            </template>
          </el-table-column>
        </el-table>
      </el-card>
    </div>
  </AdminLayout>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { ElMessage } from 'element-plus';
import AdminLayout from '../components/AdminLayout.vue';
import { homeConfigApi } from '../services/api';

const DEFAULT_SECTIONS = [
  'recentActivities',
  'todayTask',
  'zaichang',
  'myCheckins',
  'xiaofanInsights',
  'insightRequests'
];

const SECTION_META: Record<string, { label: string; icon: string }> = {
  recentActivities: { label: '近期活动', icon: '📆' },
  todayTask: { label: '今日任务', icon: '📋' },
  zaichang: { label: '凡人生活', icon: '🌿' },
  myCheckins: { label: '我的打卡', icon: '📝' },
  xiaofanInsights: { label: '小凡看见', icon: '✨' },
  insightRequests: { label: '请求看见', icon: '📬' }
};

type SectionItem = {
  key: string;
  label: string;
  icon: string;
};

const loading = ref(false);
const saving = ref(false);
const sections = ref<SectionItem[]>([]);

function normalizeOrder(order?: string[]) {
  const source = Array.isArray(order) ? order : [];
  const unique = [...new Set(source.filter((key) => DEFAULT_SECTIONS.includes(key)))];
  const missing = DEFAULT_SECTIONS.filter((key) => !unique.includes(key));
  return [...unique, ...missing];
}

function buildItems(order?: string[]) {
  return normalizeOrder(order).map((key) => ({
    key,
    label: SECTION_META[key].label,
    icon: SECTION_META[key].icon
  }));
}

async function loadConfig() {
  loading.value = true;
  try {
    const res: any = await homeConfigApi.getConfig();
    sections.value = buildItems(res?.sections);
  } catch (error: any) {
    sections.value = buildItems(DEFAULT_SECTIONS);
    ElMessage.error(error?.message || '加载首页配置失败');
  } finally {
    loading.value = false;
  }
}

function moveSection(index: number, direction: number) {
  const nextIndex = index + direction;
  if (nextIndex < 0 || nextIndex >= sections.value.length) return;
  const next = [...sections.value];
  const [item] = next.splice(index, 1);
  next.splice(nextIndex, 0, item);
  sections.value = next;
}

function resetDefault() {
  sections.value = buildItems(DEFAULT_SECTIONS);
}

async function saveConfig() {
  saving.value = true;
  try {
    await homeConfigApi.updateConfig(sections.value.map((item) => item.key));
    ElMessage.success('首页配置已保存');
    await loadConfig();
  } catch (error: any) {
    ElMessage.error(error?.message || '保存首页配置失败');
  } finally {
    saving.value = false;
  }
}

onMounted(loadConfig);
</script>

<style scoped>
.home-config-container {
  padding: 0;
}

.card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.section-table {
  width: 100%;
}

.order-number {
  display: inline-flex;
  width: 28px;
  height: 28px;
  align-items: center;
  justify-content: center;
  border-radius: 6px;
  background: #eef4ff;
  color: #3b6ed6;
  font-weight: 600;
}

.section-name {
  display: flex;
  align-items: center;
  gap: 10px;
  font-weight: 600;
  color: #333;
}

.section-icon {
  font-size: 20px;
  line-height: 1;
}
</style>
