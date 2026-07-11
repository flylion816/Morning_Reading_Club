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
              <div v-if="row.mediaList && row.mediaList.length">
                <video
                  v-if="row.mediaList[0].type === 'video'"
                  :src="row.mediaList[0].url"
                  style="width:56px;height:56px;border-radius:6px;object-fit:cover;display:block"
                  muted
                  preload="metadata"
                />
                <el-image
                  v-else
                  :src="row.mediaList[0].url"
                  fit="cover"
                  style="width: 56px; height: 56px; border-radius: 6px"
                  :preview-src-list="row.mediaList.map((m: any) => m.url)"
                  preview-teleported
                />
              </div>
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
          <el-table-column label="类型" width="160">
            <template #default="{ row }">
              <div class="type-tags">
                <el-tag
                  v-for="type in normalizedActivityTypes(row)"
                  :key="type"
                  :color="typeColor(type)"
                  effect="light"
                  size="small"
                >
                  {{ typeLabel(type) }}
                </el-tag>
              </div>
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
              <el-button size="small" @click="openDetail(row)">编辑</el-button>
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

      <!-- 详情/编辑抽屉 -->
      <el-drawer
        v-model="drawerVisible"
        title="编辑印记"
        size="560px"
        direction="rtl"
        @close="onDrawerClose"
      >
        <div v-if="editForm" class="detail-panel">
          <!-- 媒体列表 -->
          <div class="edit-section-label">图片 / 视频</div>
          <div class="edit-media-grid">
            <div
              v-for="(m, i) in editForm.mediaList"
              :key="i"
              class="edit-media-item"
            >
              <video
                v-if="m.type === 'video'"
                :src="m.url"
                class="edit-media-img"
                muted
                preload="metadata"
              />
              <el-image
                v-else
                :src="m.url"
                fit="cover"
                class="edit-media-img"
                :preview-src-list="editForm.mediaList.filter((x: any) => x.type !== 'video').map((x: any) => x.url)"
                preview-teleported
              />
              <el-button
                class="edit-media-remove"
                type="danger"
                size="small"
                circle
                @click="removeMedia(i)"
              >×</el-button>
            </div>
            <!-- 上传按钮 -->
            <label v-if="editForm.mediaList.length < 9 && !editForm.mediaList.some((m: any) => m.type === 'video')" class="edit-media-add">
              <input type="file" accept="image/*,video/*" style="display:none" @change="onUploadFile" :disabled="uploading" />
              <span v-if="uploading" class="add-icon">⏳</span>
              <span v-else class="add-icon">+</span>
              <span class="add-text">{{ uploading ? '上传中' : '添加' }}</span>
            </label>
          </div>

          <!-- 文字字段 -->
          <el-form :model="editForm" label-width="70px" style="margin-top:20px">
            <el-form-item label="标题">
              <el-input v-model="editForm.title" maxlength="100" show-word-limit />
            </el-form-item>
            <el-form-item label="活动类型">
              <el-select v-model="editForm.activityTypes" multiple style="width:100%">
                <el-option
                  v-for="t in activityTypes"
                  :key="t.key"
                  :label="`${t.emoji} ${t.label}`"
                  :value="t.key"
                />
              </el-select>
            </el-form-item>
            <el-form-item label="地点">
              <el-input v-model="editForm.location" maxlength="100" />
            </el-form-item>
            <el-form-item label="描述">
              <el-input v-model="editForm.description" type="textarea" :rows="3" maxlength="500" show-word-limit />
            </el-form-item>
          </el-form>

          <div style="margin-top:24px; display:flex; justify-content:space-between; align-items:center">
            <el-button
              type="danger"
              plain
              @click="handleDelete(editForm); drawerVisible = false"
            >删除此印记</el-button>
            <div style="display:flex; gap:8px">
              <el-button @click="drawerVisible = false">取消</el-button>
              <el-button type="primary" :loading="editSaving" @click="saveEdit">保存</el-button>
            </div>
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
const editForm = ref<any>(null);
const editSaving = ref(false);
const uploading = ref(false);

function openDetail(row: any) {
  const activityTypes = normalizedActivityTypes(row);
  editForm.value = {
    _id: row._id,
    title: row.title || '',
    description: row.description || '',
    activityType: activityTypes[0] || '',
    activityTypes,
    location: row.location || '',
    mediaList: (row.mediaList || []).map((m: any) => ({ ...m }))
  };
  drawerVisible.value = true;
}

function onDrawerClose() {
  editForm.value = null;
}

function removeMedia(index: number) {
  editForm.value.mediaList.splice(index, 1);
}

async function onUploadFile(e: Event) {
  const input = e.target as HTMLInputElement;
  const file = input.files?.[0];
  if (!file) return;
  input.value = '';
  uploading.value = true;
  try {
    const res = await imprintApi.uploadMedia(file);
    const item = res.data || res;
    editForm.value.mediaList.push({ type: item.type || 'image', url: item.url });
  } catch {
    ElMessage.error('上传失败');
  } finally {
    uploading.value = false;
  }
}

async function saveEdit() {
  if (!editForm.value.title.trim()) return ElMessage.warning('标题不能为空');
  if (!editForm.value.activityTypes.length) return ElMessage.warning('请选择活动类型');
  editSaving.value = true;
  try {
    await imprintApi.updateImprint(editForm.value._id, {
      title: editForm.value.title.trim(),
      description: editForm.value.description.trim(),
      activityType: editForm.value.activityTypes[0],
      activityTypes: editForm.value.activityTypes,
      location: editForm.value.location.trim(),
      mediaList: editForm.value.mediaList
    });
    ElMessage.success('保存成功');
    drawerVisible.value = false;
    loadImprints();
  } catch (e: any) {
    ElMessage.error(e?.message || '保存失败');
  } finally {
    editSaving.value = false;
  }
}

function typeLabel(t: string) {
  return typeMap.value[t] || t || '—';
}

function typeColor(_t: string) {
  return '#f5f5f5';
}

function normalizedActivityTypes(row: any): string[] {
  const raw = Array.isArray(row.activityTypes) && row.activityTypes.length > 0
    ? row.activityTypes
    : [row.activityType];
  return Array.from(new Set(raw.filter((type: any) => typeof type === 'string' && type.trim())));
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
  color: var(--admin-ink);
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

.type-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
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

.edit-section-label {
  font-size: 13px;
  font-weight: 600;
  color: #555;
  margin-bottom: 10px;
}

.edit-media-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.edit-media-item {
  position: relative;
  width: 90px;
  height: 90px;
  border-radius: 6px;
  overflow: visible;
}

.edit-media-img {
  width: 90px;
  height: 90px;
  border-radius: 6px;
  object-fit: cover;
  display: block;
}

.edit-media-remove {
  position: absolute;
  top: -8px;
  right: -8px;
  width: 22px !important;
  height: 22px !important;
  min-height: unset !important;
  font-size: 14px !important;
  padding: 0 !important;
  z-index: 1;
}

.edit-media-add {
  width: 90px;
  height: 90px;
  border-radius: 6px;
  border: 2px dashed #ccc;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4px;
  cursor: pointer;
  background: #fafafa;
}

.edit-media-add .add-icon {
  font-size: 28px;
  color: #ccc;
  line-height: 1;
}

.edit-media-add .add-text {
  font-size: 11px;
  color: #aaa;
}

.attendee-list {
  display: flex;
  flex-wrap: wrap;
}
</style>
