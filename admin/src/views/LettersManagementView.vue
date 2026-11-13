<template>
  <AdminLayout>
    <div class="letters-container">
      <el-card class="filter-card">
        <div class="filter-bar">
          <el-select v-model="filters.periodId" placeholder="全部期次" clearable filterable style="width: 220px" @change="handleFilterChange">
            <el-option v-for="p in periodOptions" :key="p._id || p.id" :label="p.name || p.title" :value="p._id || p.id" />
          </el-select>
          <el-select v-model="filters.status" placeholder="全部状态" clearable style="width: 140px" @change="handleFilterChange">
            <el-option v-for="s in statusOptions" :key="s.value" :label="s.label" :value="s.value" />
          </el-select>
          <el-button @click="resetFilters">重置</el-button>
          <span class="total-hint">共 {{ total }} 封</span>
        </div>
        <p class="privacy-hint">这些信是书友写给结营那天的自己的，只在需要处理问题时查看，不要截图外传。</p>
      </el-card>

      <el-card>
        <el-table v-loading="loading" :data="letters" stripe style="width: 100%" empty-text="还没有信">
          <el-table-column label="书友" min-width="150">
            <template #default="{ row }">
              <div class="user-cell">
                <UserAvatar :user="row.user" :size="28" />
                <span>{{ row.user?.nickname || '已注销' }}</span>
              </div>
            </template>
          </el-table-column>
          <el-table-column label="期次" min-width="140">
            <template #default="{ row }">{{ row.period?.name || '—' }}</template>
          </el-table-column>
          <el-table-column label="状态" width="100">
            <template #default="{ row }">
              <el-tag :type="statusMeta(row.status).type" size="small">{{ statusMeta(row.status).label }}</el-tag>
            </template>
          </el-table-column>
          <el-table-column label="邮戳" width="70" align="center">
            <template #default="{ row }"><span class="stamp">{{ stampLabel(row.stamp) }}</span></template>
          </el-table-column>
          <el-table-column label="内容" min-width="260">
            <template #default="{ row }">
              <span class="content-preview">{{ row.content || '（空）' }}</span>
            </template>
          </el-table-column>
          <el-table-column label="寄出 / 送达" width="170">
            <template #default="{ row }">
              <div class="time-cell">
                <span>寄出 {{ formatTime(row.sealedAt) }}</span>
                <span>送达 {{ row.deliveredAt ? formatTime(row.deliveredAt) : (row.deliverAt ? '预计 ' + formatDay(row.deliverAt) : '—') }}</span>
              </div>
            </template>
          </el-table-column>
          <el-table-column label="操作" width="140" align="center" fixed="right">
            <template #default="{ row }">
              <el-button size="small" @click="openDetail(row)">查看</el-button>
              <el-button size="small" type="danger" @click="handleDelete(row)">删除</el-button>
            </template>
          </el-table-column>
        </el-table>
        <div class="pager">
          <el-pagination
            v-model:current-page="page"
            :page-size="pageSize"
            :total="total"
            layout="prev, pager, next"
            @current-change="loadLetters"
          />
        </div>
      </el-card>

      <el-dialog v-model="detailVisible" title="慢递信" width="560px">
        <template v-if="current">
          <div class="detail-meta">
            <span>{{ current.user?.nickname || '已注销' }}</span>
            <span>· {{ current.period?.name || '' }}</span>
            <el-tag :type="statusMeta(current.status).type" size="small">{{ statusMeta(current.status).label }}</el-tag>
          </div>
          <div class="letter-paper">
            <p class="letter-to">写给结营那天的我：</p>
            <p class="letter-body">{{ current.content || '（空）' }}</p>
            <p class="letter-sign">写于 {{ formatTime(current.writtenAt) }}</p>
          </div>
          <div v-if="current.reply" class="letter-reply">
            <p class="letter-reply-label">回信（{{ formatTime(current.repliedAt) }}）</p>
            <p>{{ current.reply }}</p>
          </div>
          <ul class="detail-times">
            <li>寄出：{{ formatTime(current.sealedAt) }}</li>
            <li>送达：{{ current.deliveredAt ? formatTime(current.deliveredAt) : (current.deliverAt ? '预计 ' + formatTime(current.deliverAt) : '—') }}</li>
            <li>拆开：{{ formatTime(current.openedAt) }}</li>
          </ul>
        </template>
        <template #footer>
          <el-button type="danger" plain @click="current && handleDelete(current)">删除这封信</el-button>
          <el-button type="primary" @click="detailVisible = false">关闭</el-button>
        </template>
      </el-dialog>
    </div>
  </AdminLayout>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import AdminLayout from '../components/AdminLayout.vue';
import UserAvatar from '../components/UserAvatar.vue';
import { letterApi, periodApi } from '../services/api';

interface LetterRow {
  id: string;
  user: { id: string; nickname: string; avatarUrl: string } | null;
  period: { id: string; name: string } | null;
  status: 'draft' | 'sealed' | 'delivered' | 'opened';
  stamp: string;
  content: string;
  reply: string;
  writtenAt?: string | null;
  sealedAt?: string | null;
  deliveredAt?: string | null;
  openedAt?: string | null;
  repliedAt?: string | null;
  deliverAt?: string | null;
}

const statusOptions = [
  { value: 'draft', label: '草稿', type: 'info' },
  { value: 'sealed', label: '在路上', type: 'warning' },
  { value: 'delivered', label: '已送达', type: 'success' },
  { value: 'opened', label: '已拆开', type: '' }
];
const STAMPS: Record<string, string> = { dawn: '晨', leaf: '叶', book: '书' };

const letters = ref<LetterRow[]>([]);
const periodOptions = ref<any[]>([]);
const filters = ref<{ periodId: string; status: string }>({ periodId: '', status: '' });
const loading = ref(false);
const page = ref(1);
const pageSize = 20;
const total = ref(0);
const detailVisible = ref(false);
const current = ref<LetterRow | null>(null);

function statusMeta(status: string) {
  const found = statusOptions.find(s => s.value === status);
  return { label: found?.label || status, type: (found?.type || 'info') as any };
}

function stampLabel(stamp: string) {
  return STAMPS[stamp] || '晨';
}

function formatTime(value?: string | null) {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getMonth() + 1}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function formatDay(value?: string | null) {
  if (!value) return '—';
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? '—' : `${d.getMonth() + 1}月${d.getDate()}日`;
}

async function loadPeriods() {
  try {
    const response: any = await periodApi.getPeriods({ page: 1, limit: 200 });
    periodOptions.value = response.list || response.data || response || [];
  } catch (err) {
    console.error('加载期次失败', err);
  }
}

async function loadLetters() {
  loading.value = true;
  try {
    const params: any = { page: page.value, pageSize };
    if (filters.value.periodId) params.periodId = filters.value.periodId;
    if (filters.value.status) params.status = filters.value.status;
    const res: any = await letterApi.getLetters(params);
    letters.value = res.list || [];
    total.value = res.total || 0;
  } catch (err) {
    console.error('加载慢递信失败', err);
    ElMessage.error('慢递信没加载出来，稍后再试');
  } finally {
    loading.value = false;
  }
}

function handleFilterChange() {
  page.value = 1;
  loadLetters();
}

function resetFilters() {
  filters.value = { periodId: '', status: '' };
  handleFilterChange();
}

function openDetail(row: LetterRow) {
  current.value = row;
  detailVisible.value = true;
}

async function handleDelete(row: LetterRow) {
  const who = row.user?.nickname || '这位书友';
  try {
    await ElMessageBox.confirm(
      `删除后这封信无法恢复，${who}那边会回到“还没写信”。信箱还开着（开营前 3 天到开营后第 7 天）的话，可以重新写一封；信箱关了就不能再写了。`,
      '删除这封慢递信',
      { confirmButtonText: '删除', cancelButtonText: '取消', type: 'warning' }
    );
  } catch {
    return;
  }
  try {
    await letterApi.deleteLetter(row.id);
    ElMessage.success('已删除');
    detailVisible.value = false;
    if (letters.value.length === 1 && page.value > 1) page.value -= 1;
    loadLetters();
  } catch (err) {
    console.error('删除慢递信失败', err);
    ElMessage.error('没删掉，再试一次');
  }
}

onMounted(() => {
  loadPeriods();
  loadLetters();
});
</script>

<style scoped lang="scss">
.letters-container { padding: 20px; }
.filter-card { margin-bottom: 20px; }
.filter-bar { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
.total-hint { margin-left: auto; color: #909399; font-size: 13px; }
.privacy-hint { margin: 12px 0 0; color: #a0835c; font-size: 12px; }
.user-cell { display: flex; align-items: center; gap: 8px; }
.stamp {
  display: inline-block;
  width: 24px;
  height: 24px;
  line-height: 22px;
  border: 1px solid #c4873a;
  border-radius: 6px;
  color: #8a4b12;
  font-family: 'Songti SC', serif;
  text-align: center;
}
.content-preview {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  white-space: pre-wrap;
  color: #5c5348;
}
.time-cell { display: flex; flex-direction: column; font-size: 12px; color: #606266; }
.pager { display: flex; justify-content: flex-end; margin-top: 16px; }
.detail-meta { display: flex; align-items: center; gap: 8px; margin-bottom: 12px; color: #606266; }
.letter-paper {
  padding: 18px 22px;
  border: 1px solid rgba(184, 71, 47, 0.2);
  border-radius: 8px;
  background: #fffdf8 repeating-linear-gradient(180deg, transparent 0 31px, rgba(184, 71, 47, 0.14) 31px 32px);
  font-family: 'Songti SC', serif;
  line-height: 32px;
}
.letter-to { margin: 0; color: #8a4b12; }
.letter-body { margin: 0; white-space: pre-wrap; color: #2b2622; }
.letter-sign { margin: 0; text-align: right; color: #8a4b12; font-size: 13px; }
.letter-reply { margin-top: 12px; padding: 10px 14px; border-radius: 8px; background: #fdf0dc; color: #5c5348; }
.letter-reply p { margin: 0; white-space: pre-wrap; }
.letter-reply-label { color: #8a4b12; font-size: 12px; margin-bottom: 4px !important; }
.detail-times { margin: 12px 0 0; padding-left: 18px; color: #909399; font-size: 12px; line-height: 1.8; }
</style>
