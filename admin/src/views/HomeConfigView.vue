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
          <el-table-column label="状态" width="110" align="center">
            <template #default="{ row }">
              <el-tag :type="row.hidden ? 'info' : 'success'" effect="light">
                {{ row.hidden ? '已隐藏' : '显示中' }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column label="操作" width="250" align="center">
            <template #default="{ row, $index }">
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
              <el-button
                size="small"
                :type="row.hidden ? 'primary' : 'warning'"
                plain
                :disabled="loading || saving"
                @click="toggleSection(row.key)"
              >{{ row.hidden ? '显示' : '隐藏' }}</el-button>
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
  hidden: boolean;
};

const loading = ref(false);
const saving = ref(false);
const sections = ref<SectionItem[]>([]);

function normalizeOrder(order?: string[]) {
  const source = Array.isArray(order) ? order : [];
  const unique = [
    ...new Set(
      source
        .map((item: any) => (typeof item === 'string' ? item : item?.key))
        .filter((key) => DEFAULT_SECTIONS.includes(key))
    )
  ];
  const missing = DEFAULT_SECTIONS.filter((key) => !unique.includes(key));
  return [...unique, ...missing];
}

function getHiddenSections(config?: any) {
  const hiddenFromItems = Array.isArray(config?.items)
    ? config.items
        .filter((item: any) => item?.hidden === true)
        .map((item: any) => item.key)
    : [];
  const hiddenFromSections = Array.isArray(config?.sections)
    ? config.sections
        .filter((item: any) => item && typeof item === 'object' && item.hidden === true)
        .map((item: any) => item.key)
    : [];
  const hiddenFromList = Array.isArray(config?.hiddenSections)
    ? config.hiddenSections
    : [];
  return new Set(
    [...hiddenFromItems, ...hiddenFromSections, ...hiddenFromList].filter((key) =>
      DEFAULT_SECTIONS.includes(key)
    )
  );
}

function buildItems(order?: any[], hiddenSections = new Set<string>()) {
  return normalizeOrder(order).map((key) => {
    const meta = SECTION_META[key] || { label: key, icon: '📌' };
    return {
      key,
      label: meta.label,
      icon: meta.icon,
      hidden: hiddenSections.has(key)
    };
  });
}

async function loadConfig() {
  loading.value = true;
  try {
    const res: any = await homeConfigApi.getConfig();
    sections.value = buildItems(res?.sections, getHiddenSections(res));
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
  if (!item) return;
  next.splice(nextIndex, 0, item);
  sections.value = next;
}

async function toggleSection(key: string) {
  const target = sections.value.find((item) => item.key === key);
  if (!target) return;
  const nextHidden = !target.hidden;
  sections.value = sections.value.map((item) =>
    item.key === key ? { ...item, hidden: nextHidden } : item
  );

  try {
    await saveConfig({ silent: true });
    ElMessage.success(nextHidden ? '板块已隐藏' : '板块已显示');
  } catch {
    await loadConfig();
  }
}

function resetDefault() {
  sections.value = buildItems(DEFAULT_SECTIONS);
}

async function saveConfig(options: { silent?: boolean } = {}) {
  saving.value = true;
  try {
    await homeConfigApi.updateConfig(
      sections.value.map((item) => ({
        key: item.key,
        hidden: item.hidden
      }))
    );
    if (!options.silent) {
      ElMessage.success('首页配置已保存');
    }
    await loadConfig();
  } catch (error: any) {
    ElMessage.error(error?.message || '保存首页配置失败');
    throw error;
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
  background: var(--admin-primary-soft);
  color: var(--admin-primary-dark);
  font-weight: 600;
}

.section-name {
  display: flex;
  align-items: center;
  gap: 10px;
  font-weight: 600;
  color: var(--admin-ink);
}

.section-icon {
  font-size: 20px;
  line-height: 1;
}
</style>
