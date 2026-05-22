<template>
  <AdminLayout>
    <div class="imprints-container">
      <!-- 活动类型管理 -->
      <el-card style="margin-bottom: 20px">
        <template #header>
          <div class="card-header">
            <span>活动类型管理</span>
            <el-button type="primary" size="small" @click="openTypeDialog(null)">+ 新建类型</el-button>
          </div>
        </template>
        <el-table :data="activityTypes" size="small" style="width: 100%">
          <el-table-column label="Emoji" width="70">
            <template #default="{ row }">{{ row.emoji }}</template>
          </el-table-column>
          <el-table-column label="标签名" prop="label" />
          <el-table-column label="Key" prop="key" width="120" />
          <el-table-column label="排序" width="120" align="center">
            <template #default="{ row, $index }">
              <el-button size="small" :disabled="$index === 0" @click="moveType($index, -1)">↑</el-button>
              <el-button size="small" :disabled="$index === activityTypes.length - 1" @click="moveType($index, 1)">↓</el-button>
            </template>
          </el-table-column>
          <el-table-column label="操作" width="140" align="center">
            <template #default="{ row }">
              <el-button size="small" @click="openTypeDialog(row)">编辑</el-button>
              <el-button size="small" type="danger" @click="handleDeleteType(row)">删除</el-button>
            </template>
          </el-table-column>
        </el-table>
      </el-card>

      <!-- 筛选栏 -->
      <el-card style="margin-bottom: 20px">
        <div class="filter-bar">
          <el-select
            v-model="filters.activityType"
            placeholder="活动类型"
            clearable
            style="width: 140px"
            @change="handleFilterChange"
          >
            <el-option label="全部类型" value="" />
            <el-option
              v-for="t in activityTypes"
              :key="t.key"
              :label="`${t.emoji} ${t.label}`"
              :value="t.key"
            />
          </el-select>

          <el-input
            v-model="filters.keyword"
            placeholder="搜索标题 / 作者"
            clearable
            style="width: 220px"
            @keyup.enter="handleFilterChange"
            @clear="handleFilterChange"
          >
            <template #prefix><el-icon><Search /></el-icon></template>
          </el-input>

          <el-button type="primary" @click="handleFilterChange">搜索</el-button>
          <el-button @click="resetFilters">重置</el-button>

          <span class="total-hint">共 {{ total }} 条印记</span>
        </div>
      </el-card>

      <!-- 印记列表 -->
      <el-card>
        <el-table
          v-loading="loading"
          :data="imprints"
          stripe
          style="width: 100%"
        >
          <!-- 封面 -->
          <el-table-column label="封面" width="80">
            <template #default="{ row }">
              <el-image
                v-if="row.mediaList && row.mediaList.length"
                :src="row.mediaList[0].url"
                fit="cover"
                style="width: 56px; height: 56px; border-radius: 6px"
                :preview-src-list="row.mediaList.map((m: any) => m.url)"
                preview-teleported
              />
              <div v-else class="no-cover">无图</div>
            </template>
          </el-table-column>

          <!-- 标题 + 描述 -->
          <el-table-column label="内容" min-width="220">
            <template #default="{ row }">
              <div class="cell-title">{{ row.title }}</div>
              <div v-if="row.description" class="cell-desc">{{ truncate(row.description, 40) }}</div>
            </template>
          </el-table-column>

          <!-- 活动类型 -->
          <el-table-column label="类型" width="110">
            <template #default="{ row }">
              <el-tag :color="typeColor(row.activityType)" effect="light" size="small">
                {{ typeLabel(row.activityType) }}
              </el-tag>
            </template>
          </el-table-column>

          <!-- 作者 -->
          <el-table-column label="发布者" width="120">
            <template #default="{ row }">
              <div class="cell-author">
                <el-avatar :src="row.author?.avatar" :size="24" style="flex-shrink:0">
                  {{ (row.author?.nickname || '?')[0] }}
                </el-avatar>
                <span>{{ row.author?.nickname || row.author?.name || '—' }}</span>
              </div>
            </template>
          </el-table-column>

          <!-- 在场人数 -->
          <el-table-column label="在场" width="70" align="center">
            <template #default="{ row }">
              {{ row.attendees?.length ?? 0 }}
            </template>
          </el-table-column>

          <!-- 共鸣 -->
          <el-table-column label="共鸣" width="90" align="center">
            <template #default="{ row }">
              <span class="reaction-counts">
                {{ totalReactions(row) }}
              </span>
            </template>
          </el-table-column>

          <!-- 图片数 -->
          <el-table-column label="图片" width="60" align="center">
            <template #default="{ row }">
              {{ row.mediaList?.length ?? 0 }}
            </template>
          </el-table-column>

          <!-- 发生时间 -->
          <el-table-column label="活动时间" width="120">
            <template #default="{ row }">
              {{ formatDate(row.happenedAt) }}
            </template>
          </el-table-column>

          <!-- 操作 -->
          <el-table-column label="操作" width="140" fixed="right">
            <template #default="{ row }">
              <el-button size="small" @click="openDetail(row)">查看</el-button>
              <el-button
                size="small"
                type="danger"
                @click="handleDelete(row)"
              >删除</el-button>
            </template>
          </el-table-column>
        </el-table>

        <div class="pagination-bar">
          <el-pagination
            v-model:current-page="currentPage"
            :page-size="pageSize"
            :total="total"
            layout="total, prev, pager, next"
            @current-change="loadImprints"
          />
        </div>
      </el-card>

      <!-- 活动类型编辑弹窗 -->
      <el-dialog
        v-model="typeDialogVisible"
        :title="editingType ? '编辑活动类型' : '新建活动类型'"
        width="400px"
      >
        <el-form :model="typeForm" label-width="70px">
          <el-form-item label="Emoji">
            <el-input v-model="typeForm.emoji" placeholder="如 📚" maxlength="10" />
          </el-form-item>
          <el-form-item label="标签名">
            <el-input v-model="typeForm.label" placeholder="如 读书会" maxlength="20" />
          </el-form-item>
          <el-form-item label="Key">
            <el-input v-model="typeForm.key" placeholder="如 reading（英文小写）" maxlength="30" :disabled="!!editingType" />
          </el-form-item>
        </el-form>
        <template #footer>
          <el-button @click="typeDialogVisible = false">取消</el-button>
          <el-button type="primary" :loading="typeSubmitting" @click="submitTypeForm">保存</el-button>
        </template>
      </el-dialog>

      <!-- 详情抽屉 -->
      <el-drawer
        v-model="drawerVisible"
        title="印记详情"
        size="520px"
        direction="rtl"
      >
        <div v-if="selected" class="detail-panel">
          <!-- 图片 -->
          <div v-if="selected.mediaList?.length" class="detail-images">
            <el-image
              v-for="(m, i) in selected.mediaList"
              :key="i"
              :src="m.url"
              fit="cover"
              class="detail-img"
              :preview-src-list="selected.mediaList.map((x: any) => x.url)"
              preview-teleported
            />
          </div>

          <el-descriptions :column="1" border size="small" style="margin-top:16px">
            <el-descriptions-item label="标题">{{ selected.title }}</el-descriptions-item>
            <el-descriptions-item label="活动类型">{{ typeLabel(selected.activityType) }}</el-descriptions-item>
            <el-descriptions-item label="活动时间">{{ formatDate(selected.happenedAt) }}</el-descriptions-item>
            <el-descriptions-item label="地点" v-if="selected.location">{{ selected.location }}</el-descriptions-item>
            <el-descriptions-item label="描述" v-if="selected.description">{{ selected.description }}</el-descriptions-item>
            <el-descriptions-item label="发布者">
              {{ selected.author?.nickname || selected.author?.name || '—' }}
            </el-descriptions-item>
            <el-descriptions-item label="在场人数">{{ selected.attendees?.length ?? 0 }}</el-descriptions-item>
            <el-descriptions-item label="共鸣数">{{ totalReactions(selected) }}</el-descriptions-item>
          </el-descriptions>

          <!-- 在场人列表 -->
          <div v-if="selected.attendees?.length" style="margin-top:16px">
            <div class="section-title">在场人</div>
            <div class="attendee-list">
              <el-tag
                v-for="(a, i) in selected.attendees"
                :key="i"
                size="small"
                style="margin: 4px"
              >
                {{ a.name || a.nickname || '匿名' }}
              </el-tag>
            </div>
          </div>

          <div style="margin-top:24px; text-align:right">
            <el-button
              type="danger"
              @click="handleDelete(selected); drawerVisible = false"
            >删除此印记</el-button>
          </div>
        </div>
      </el-drawer>
    </div>
  </AdminLayout>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted, computed } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { Search } from '@element-plus/icons-vue';
import AdminLayout from '../components/AdminLayout.vue';
import { imprintApi, imprintActivityTypeApi } from '../services/api';

// --- 活动类型管理 ---
const activityTypes = ref<any[]>([]);

const typeDialogVisible = ref(false);
const editingType = ref<any>(null);
const typeSubmitting = ref(false);
const typeForm = reactive({ key: '', label: '', emoji: '' });

const typeMap = computed(() => {
  const m: Record<string, string> = {};
  activityTypes.value.forEach(t => { m[t.key] = `${t.emoji} ${t.label}`; });
  return m;
});

async function loadActivityTypes() {
  try {
    const res = await imprintActivityTypeApi.getTypes();
    activityTypes.value = Array.isArray(res) ? res : (res.list || res.data || []);
  } catch {
    ElMessage.error('加载活动类型失败');
  }
}

function openTypeDialog(row: any) {
  editingType.value = row;
  if (row) {
    typeForm.key = row.key;
    typeForm.label = row.label;
    typeForm.emoji = row.emoji;
  } else {
    typeForm.key = '';
    typeForm.label = '';
    typeForm.emoji = '';
  }
  typeDialogVisible.value = true;
}

async function submitTypeForm() {
  if (!typeForm.emoji.trim() || !typeForm.label.trim() || !typeForm.key.trim()) {
    ElMessage.warning('请填写完整信息');
    return;
  }
  typeSubmitting.value = true;
  try {
    if (editingType.value) {
      await imprintActivityTypeApi.updateType(editingType.value._id, {
        label: typeForm.label.trim(),
        emoji: typeForm.emoji.trim()
      });
    } else {
      await imprintActivityTypeApi.createType({
        key: typeForm.key.trim(),
        label: typeForm.label.trim(),
        emoji: typeForm.emoji.trim(),
        sortOrder: activityTypes.value.length
      });
    }
    ElMessage.success('保存成功');
    typeDialogVisible.value = false;
    await loadActivityTypes();
  } catch (e: any) {
    ElMessage.error(e?.message || '保存失败');
  } finally {
    typeSubmitting.value = false;
  }
}

async function handleDeleteType(row: any) {
  try {
    await ElMessageBox.confirm(`确定删除类型「${row.emoji} ${row.label}」？`, '删除确认', {
      type: 'warning', confirmButtonText: '删除', cancelButtonText: '取消', confirmButtonClass: 'el-button--danger'
    });
    await imprintActivityTypeApi.deleteType(row._id);
    ElMessage.success('已删除');
    await loadActivityTypes();
  } catch (e: any) {
    if (e !== 'cancel') ElMessage.error(e?.message || '删除失败');
  }
}

async function moveType(index: number, dir: number) {
  const arr = [...activityTypes.value];
  const target = index + dir;
  if (target < 0 || target >= arr.length) return;
  [arr[index], arr[target]] = [arr[target], arr[index]];
  activityTypes.value = arr;
  try {
    await imprintActivityTypeApi.reorderTypes(arr.map((t, i) => ({ id: t._id, sortOrder: i })));
  } catch {
    ElMessage.error('排序保存失败');
    await loadActivityTypes();
  }
}

// --- 印记列表 ---
const imprints = ref<any[]>([]);
const loading = ref(false);
const total = ref(0);
const currentPage = ref(1);
const pageSize = 15;

const filters = reactive({ activityType: '', keyword: '' });

const drawerVisible = ref(false);
const selected = ref<any>(null);

function typeLabel(t: string) {
  return typeMap.value[t] || t || '—';
}

function typeColor(_t: string) {
  return '#f5f5f5';
}

function totalReactions(row: any) {
  const c = row.reactionCounts;
  if (!c) return 0;
  return (c.gonming || 0) + (c.ran || 0) + (c.xiangqu || 0);
}

function truncate(str: string, len: number) {
  return str && str.length > len ? str.slice(0, len) + '…' : str;
}

function formatDate(d: string) {
  if (!d) return '—';
  const dt = new Date(d);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
}

async function loadImprints() {
  loading.value = true;
  try {
    const params: any = { page: currentPage.value, pageSize };
    if (filters.activityType) params.activityType = filters.activityType;
    if (filters.keyword) params.keyword = filters.keyword;
    const res = await imprintApi.getImprints(params);
    imprints.value = res.list || res.data || [];
    total.value = res.total ?? imprints.value.length;
  } catch {
    ElMessage.error('加载失败');
  } finally {
    loading.value = false;
  }
}

function handleFilterChange() {
  currentPage.value = 1;
  loadImprints();
}

function resetFilters() {
  filters.activityType = '';
  filters.keyword = '';
  handleFilterChange();
}

function openDetail(row: any) {
  selected.value = row;
  drawerVisible.value = true;
}

async function handleDelete(row: any) {
  try {
    await ElMessageBox.confirm(
      `确定删除印记「${row.title}」？此操作不可恢复。`,
      '删除确认',
      { type: 'warning', confirmButtonText: '删除', cancelButtonText: '取消', confirmButtonClass: 'el-button--danger' }
    );
    await imprintApi.deleteImprint(row._id);
    ElMessage.success('已删除');
    loadImprints();
  } catch (e: any) {
    if (e !== 'cancel') ElMessage.error(e?.message || '删除失败');
  }
}

onMounted(() => {
  loadActivityTypes();
  loadImprints();
});
</script>

<style scoped>
.card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.imprints-container {
  padding: 0;
}

.filter-bar {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}

.total-hint {
  margin-left: auto;
  color: #999;
  font-size: 13px;
}

.cell-title {
  font-weight: 500;
  font-size: 14px;
  color: #333;
}

.cell-desc {
  font-size: 12px;
  color: #999;
  margin-top: 2px;
}

.cell-author {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
}

.reaction-counts {
  font-size: 13px;
  color: #666;
}

.no-cover {
  width: 56px;
  height: 56px;
  border-radius: 6px;
  background: #f0f0f0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 11px;
  color: #bbb;
}

.pagination-bar {
  margin-top: 16px;
  display: flex;
  justify-content: flex-end;
}

.detail-images {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.detail-img {
  width: 100px;
  height: 100px;
  border-radius: 6px;
  cursor: pointer;
}

.section-title {
  font-size: 13px;
  font-weight: 600;
  color: #555;
  margin-bottom: 8px;
}

.attendee-list {
  display: flex;
  flex-wrap: wrap;
}
</style>
