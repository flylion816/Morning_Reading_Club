<template>
  <AdminLayout>
    <div class="joy-notes-container">
      <el-card class="filter-card">
        <div class="filter-bar">
          <el-input
            v-model="filters.userSearch"
            placeholder="书友昵称"
            clearable
            style="width: 160px"
            @change="handleFilterChange"
            @clear="handleFilterChange"
          />
          <el-select v-model="filters.kind" placeholder="全部类型" clearable style="width: 130px" @change="handleFilterChange">
            <el-option label="🌸 随手记" value="joy" />
            <el-option label="🌿 觉察日记" value="awareness" />
          </el-select>
          <el-select v-model="filters.periodId" placeholder="全部期次" clearable filterable style="width: 200px" @change="handleFilterChange">
            <el-option v-for="p in periodOptions" :key="p._id || p.id" :label="p.name || p.title" :value="p._id || p.id" />
          </el-select>
          <el-date-picker
            v-model="dateRange"
            type="daterange"
            range-separator="至"
            start-placeholder="开始日期"
            end-placeholder="结束日期"
            value-format="YYYY-MM-DD"
            style="width: 260px"
            @change="handleFilterChange"
          />
          <el-input
            v-model="filters.q"
            placeholder="搜内容关键词"
            clearable
            style="width: 180px"
            @change="handleFilterChange"
            @clear="handleFilterChange"
          />
          <el-button @click="resetFilters">重置</el-button>
          <span class="total-hint">共 {{ total }} 条</span>
        </div>
        <p class="privacy-hint">这里是书友写给自己的随手记和觉察日记，只在需要处理问题时查看，不要截图外传。</p>
      </el-card>

      <el-card>
        <template #header>
          <div class="card-header">
            <span>觉察日记列表 (共 {{ total }} 条)</span>
            <el-pagination
              :current-page="page"
              :page-size="pageSize"
              :total="total"
              style="margin-left: auto"
              @current-change="handlePageChange"
            />
          </div>
        </template>

        <el-table v-loading="loading" :data="notes" stripe style="width: 100%" empty-text="还没有记录">
          <el-table-column label="书友" min-width="130">
            <template #default="{ row }">
              <div class="user-cell">
                <UserAvatar :user="row.user" :size="28" />
                <span>{{ row.user?.nickname || '已注销' }}</span>
              </div>
            </template>
          </el-table-column>
          <el-table-column label="类型" width="100">
            <template #default="{ row }">
              <el-tag :type="row.kind === 'awareness' ? 'success' : 'warning'" size="small">
                {{ row.kind === 'awareness' ? '觉察日记' : '随手记' }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column label="期次 / 课程" min-width="170">
            <template #default="{ row }">
              <div class="period-cell">
                <span>{{ row.periodName || '—' }}</span>
                <span v-if="row.sectionTitle" class="section-title">
                  {{ row.day ? `第${row.day}天 · ` : '' }}{{ row.sectionTitle }}
                </span>
              </div>
            </template>
          </el-table-column>
          <el-table-column label="内容" min-width="280">
            <template #default="{ row }">
              <div class="content-preview">
                <span v-if="row.title" class="note-title">{{ row.title }}</span>
                <span>{{ truncateText(row.content, 80) }}</span>
              </div>
            </template>
          </el-table-column>
          <el-table-column label="回访" width="90" align="center">
            <template #default="{ row }">
              <el-tag v-if="row.kind === 'awareness' && row.awareness?.revisit?.enabled" :type="revisitMeta(row.awareness.revisit.status).type" size="small">
                {{ revisitMeta(row.awareness.revisit.status).label }}
              </el-tag>
              <span v-else class="muted">—</span>
            </template>
          </el-table-column>
          <el-table-column label="时间" width="110">
            <template #default="{ row }">{{ formatTime(row.createdAt) }}</template>
          </el-table-column>
          <el-table-column label="操作" width="140" align="center" fixed="right">
            <template #default="{ row }">
              <el-button size="small" @click="openDetail(row)">查看</el-button>
              <el-button size="small" type="danger" @click="handleDelete(row)">删除</el-button>
            </template>
          </el-table-column>
        </el-table>
      </el-card>

      <!-- 详情弹窗 -->
      <el-dialog v-model="detailVisible" :title="current?.kind === 'awareness' ? '觉察日记' : '随手记'" width="600px">
        <template v-if="current">
          <div class="detail-meta">
            <UserAvatar :user="current.user" :size="24" />
            <span>{{ current.user?.nickname || '已注销' }}</span>
            <span v-if="current.periodName">· {{ current.periodName }}</span>
            <span v-if="current.sectionTitle">· {{ current.day ? `第${current.day}天 ` : '' }}{{ current.sectionTitle }}</span>
            <span class="muted">写于 {{ formatTime(current.createdAt) }}</span>
          </div>

          <!-- 觉察日记：看感问择 + 后来 -->
          <template v-if="current.kind === 'awareness' && current.awareness">
            <div v-if="current.title" class="detail-title">{{ current.title }}</div>
            <div class="awareness-block">
              <div class="awareness-label">看 · 事实</div>
              <p class="awareness-text">{{ current.awareness.facts || '（空）' }}</p>
            </div>
            <div class="awareness-block">
              <div class="awareness-label">感 · 感受</div>
              <div class="feeling-tags">
                <el-tag v-for="f in current.awareness.feelings" :key="f" size="small" effect="plain">{{ f }}</el-tag>
                <el-tag v-for="b in current.awareness.bodyAreas" :key="b" size="small" type="info" effect="plain">{{ b }}</el-tag>
              </div>
              <p v-if="current.awareness.feelingNote" class="awareness-text">{{ current.awareness.feelingNote }}</p>
            </div>
            <div v-for="(ask, i) in current.awareness.asks" :key="i" class="awareness-block">
              <div class="awareness-label">问 · {{ ask.question || `第${ask.level}问` }}</div>
              <p class="awareness-text">{{ ask.answer || '（空）' }}</p>
            </div>
            <div class="awareness-block">
              <div class="awareness-label">择 · 选择</div>
              <p class="awareness-text">{{ current.awareness.choice || '（空）' }}</p>
            </div>
            <div v-if="current.awareness.followUps?.length" class="awareness-block">
              <div class="awareness-label">后来</div>
              <p v-for="(fu, i) in current.awareness.followUps" :key="i" class="awareness-text">
                <span class="muted">{{ formatTime(fu.createdAt) }}：</span>{{ fu.content }}
              </p>
            </div>
            <div v-if="current.awareness.revisit?.enabled" class="awareness-block">
              <div class="awareness-label">回访</div>
              <p class="awareness-text">
                <el-tag :type="revisitMeta(current.awareness.revisit.status).type" size="small">
                  {{ revisitMeta(current.awareness.revisit.status).label }}
                </el-tag>
                <span v-if="current.awareness.revisit.dueAt" class="muted"> · 约定 {{ formatTime(current.awareness.revisit.dueAt) }}</span>
              </p>
            </div>
          </template>

          <!-- 随手记 -->
          <template v-else>
            <div v-if="current.title" class="detail-title">{{ current.title }}</div>
            <p class="joy-content">{{ current.content || '（空）' }}</p>
          </template>
        </template>
        <template #footer>
          <el-button type="danger" plain @click="current && handleDelete(current)">删除这条记录</el-button>
          <el-button type="primary" @click="detailVisible = false">关闭</el-button>
        </template>
      </el-dialog>
    </div>
  </AdminLayout>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import AdminLayout from '../components/AdminLayout.vue';
import UserAvatar from '../components/UserAvatar.vue';
import { joyNoteApi, periodApi } from '../services/api';

interface AwarenessAsk {
  level: number;
  question: string;
  answer: string;
}

interface AwarenessData {
  facts: string;
  feelings: string[];
  bodyAreas: string[];
  feelingNote: string;
  asks: AwarenessAsk[];
  choice: string;
  followUps: { content: string; createdAt: string }[];
  revisit: { enabled: boolean; status: string; dueAt: string | null };
}

interface NoteRow {
  id: string;
  _id: string;
  kind: 'joy' | 'awareness';
  title: string;
  content: string;
  awareness: AwarenessData | null;
  user: { id: string; nickname: string; avatarUrl: string } | null;
  periodName: string;
  sectionTitle: string;
  day: number | null;
  createdAt: string;
}

const notes = ref<NoteRow[]>([]);
const periodOptions = ref<any[]>([]);
const filters = ref<{ userSearch: string; kind: string; periodId: string; q: string }>({
  userSearch: '',
  kind: '',
  periodId: '',
  q: ''
});
const dateRange = ref<[string, string] | null>(null);
const loading = ref(false);
const page = ref(1);
const pageSize = 20;
const total = ref(0);
const detailVisible = ref(false);
const current = ref<NoteRow | null>(null);

const REVISIT_STATUS: Record<string, { label: string; type: string }> = {
  pending: { label: '待回访', type: 'warning' },
  delivering: { label: '投递中', type: 'warning' },
  delivered: { label: '已送达', type: 'success' },
  answered: { label: '已写后来', type: 'success' },
  skipped: { label: '先不写', type: 'info' },
  none: { label: '不回访', type: 'info' }
};

function revisitMeta(status: string) {
  return REVISIT_STATUS[status] || { label: status, type: 'info' };
}

function truncateText(text: string, max: number) {
  if (!text) return '（空）';
  return text.length > max ? `${text.slice(0, max)}…` : text;
}

function formatTime(value?: string | null) {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getMonth() + 1}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

const queryParams = computed(() => {
  const params: any = { page: page.value, limit: pageSize };
  if (filters.value.userSearch) params.userSearch = filters.value.userSearch;
  if (filters.value.kind) params.kind = filters.value.kind;
  if (filters.value.periodId) params.periodId = filters.value.periodId;
  if (filters.value.q) params.q = filters.value.q;
  if (dateRange.value?.[0]) params.dateFrom = dateRange.value[0];
  if (dateRange.value?.[1]) params.dateTo = dateRange.value[1];
  return params;
});

async function loadPeriods() {
  try {
    const response: any = await periodApi.getPeriods({ page: 1, limit: 200 });
    periodOptions.value = response.list || response.data || response || [];
  } catch (err) {
    console.error('加载期次失败', err);
  }
}

async function loadNotes() {
  loading.value = true;
  try {
    const res: any = await joyNoteApi.getNotes(queryParams.value);
    notes.value = res.list || [];
    total.value = res.total || 0;
  } catch (err) {
    console.error('加载随手记失败', err);
    ElMessage.error('记录没加载出来，稍后再试');
  } finally {
    loading.value = false;
  }
}

function handleFilterChange() {
  page.value = 1;
  loadNotes();
}

function handlePageChange(next: number) {
  page.value = next;
  loadNotes();
}

function resetFilters() {
  filters.value = { userSearch: '', kind: '', periodId: '', q: '' };
  dateRange.value = null;
  handleFilterChange();
}

function openDetail(row: NoteRow) {
  current.value = row;
  detailVisible.value = true;
}

async function handleDelete(row: NoteRow) {
  try {
    await ElMessageBox.confirm(
      `确定删除 ${row.user?.nickname || '这位书友'} 的这条${row.kind === 'awareness' ? '觉察日记' : '随手记'}吗？删除后书友那边也会消失。`,
      '删除记录',
      { confirmButtonText: '删除', cancelButtonText: '取消', type: 'warning' }
    );
  } catch {
    return;
  }
  try {
    await joyNoteApi.deleteNote(row.id || row._id);
    ElMessage.success('已删除');
    detailVisible.value = false;
    loadNotes();
  } catch (err) {
    console.error('删除失败', err);
    ElMessage.error('没删掉，稍后再试');
  }
}

onMounted(() => {
  loadPeriods();
  loadNotes();
});
</script>

<style scoped>
.joy-notes-container {
  padding: 4px;
}

.filter-card {
  margin-bottom: 16px;
}

.filter-bar {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

.total-hint {
  color: #909399;
  font-size: 13px;
  margin-left: auto;
}

.privacy-hint {
  margin: 10px 0 0;
  font-size: 12px;
  color: #b45309;
}

.user-cell {
  display: flex;
  align-items: center;
  gap: 8px;
}

.period-cell {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.section-title {
  font-size: 12px;
  color: #909399;
}

.content-preview {
  display: flex;
  flex-direction: column;
  gap: 2px;
  line-height: 1.5;
  color: #606266;
}

.note-title {
  font-weight: 600;
  color: #303133;
}

.muted {
  color: #909399;
  font-size: 12px;
}

.card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.detail-meta {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 16px;
  flex-wrap: wrap;
}

.detail-title {
  font-size: 16px;
  font-weight: 600;
  margin-bottom: 12px;
  color: #303133;
}

.joy-content {
  line-height: 1.8;
  color: #303133;
  white-space: pre-wrap;
  margin: 0;
}

.awareness-block {
  margin-bottom: 14px;
}

.awareness-label {
  font-size: 13px;
  font-weight: 600;
  color: #16a34a;
  margin-bottom: 4px;
}

.awareness-text {
  margin: 0;
  line-height: 1.7;
  color: #303133;
  white-space: pre-wrap;
}

.feeling-tags {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
  margin-bottom: 4px;
}
</style>
