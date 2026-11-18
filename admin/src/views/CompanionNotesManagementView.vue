<template>
  <AdminLayout>
    <div class="companion-notes-container">
      <div class="page-heading">
        <div>
          <span class="eyebrow">内容管理</span>
          <h2>陪伴手札</h2>
          <p>上传、绑定课次、发布；书友的回响也在这里管理。</p>
        </div>
        <div class="heading-actions">
          <el-button :loading="loading" @click="loadNotes">刷新</el-button>
          <el-button type="primary" @click="openCreate">
            <el-icon><Upload /></el-icon>
            上传手札
          </el-button>
        </div>
      </div>

      <el-card class="filter-card" shadow="never">
        <div class="filter-bar">
          <el-select
            v-model="filters.periodId"
            clearable
            filterable
            placeholder="全部期次"
            style="width: 190px"
            @change="handlePeriodFilterChange"
          >
            <el-option label="全部期次" value="" />
            <el-option label="全营（未绑定期次）" value="general" />
            <el-option
              v-for="period in periods"
              :key="getId(period)"
              :label="period.name || period.title || '未命名期次'"
              :value="getId(period)"
            />
          </el-select>
          <el-select
            v-model="filters.sectionId"
            clearable
            filterable
            :disabled="!filters.periodId || filters.periodId === 'general'"
            placeholder="全部课次"
            style="width: 170px"
            @change="handleFilterChange"
          >
            <el-option label="全部课次" value="" />
            <el-option
              v-for="section in filterSections"
              :key="getId(section)"
              :label="sectionLabel(section)"
              :value="getId(section)"
            />
          </el-select>
          <el-select v-model="filters.status" clearable placeholder="全部状态" style="width: 120px" @change="handleFilterChange">
            <el-option label="全部状态" value="" />
            <el-option label="草稿" value="draft" />
            <el-option label="已发布" value="published" />
          </el-select>
          <el-input
            v-model="filters.q"
            clearable
            placeholder="搜标题或陪伴人"
            style="width: 220px"
            @keyup.enter="handleFilterChange"
            @clear="handleFilterChange"
          />
          <el-button @click="resetFilters">重置</el-button>
          <span class="total-hint">共 {{ total }} 篇</span>
        </div>
      </el-card>

      <el-card class="list-card" shadow="never">
        <template #header>
          <div class="list-header">
            <div>
              <strong>手札列表</strong>
              <span>拖动左侧手柄调整同一筛选范围内的顺序</span>
            </div>
            <el-pagination
              v-model:current-page="page"
              :page-size="pageSize"
              :total="total"
              layout="prev, pager, next"
              @current-change="handlePageChange"
            />
          </div>
        </template>

        <el-table v-loading="loading" :data="notes" stripe row-key="_id" empty-text="还没有陪伴手札">
          <el-table-column label="" width="48" align="center">
            <template #default="{ row }">
              <span
                class="drag-handle"
                draggable="true"
                title="拖动排序"
                @dragstart="handleDragStart(row)"
                @dragover.prevent
                @drop="handleDrop(row)"
              >
                ⋮⋮
              </span>
            </template>
          </el-table-column>
          <el-table-column label="封面" width="78">
            <template #default="{ row }">
              <div class="cover-thumb">
                <img v-if="row.coverUrl" :src="toAssetUrl(row.coverUrl)" :alt="row.title" />
                <span v-else>伴</span>
              </div>
            </template>
          </el-table-column>
          <el-table-column label="标题 / 陪伴人" min-width="230">
            <template #default="{ row }">
              <div class="title-cell">
                <strong>{{ row.title || '未命名手札' }}</strong>
                <span>{{ row.companionName || '未填写陪伴人' }} · {{ row.file?.pageCount || row.pageCount || '—' }} 页 · {{ formatBytes(row.file?.size || row.fileSize) }}</span>
              </div>
            </template>
          </el-table-column>
          <el-table-column label="绑定" min-width="210">
            <template #default="{ row }">
              <div class="binding-cell">
                <el-tag v-if="row.periodId" size="small" type="success">{{ periodName(row.periodId, row.periodName) }}</el-tag>
                <el-tag v-else size="small" type="info">不绑定 · 全营</el-tag>
                <el-tag v-for="section in row.sections || row.sectionIds || []" :key="getId(section)" size="small" effect="plain">
                  {{ typeof section === 'string' ? sectionName(section) : sectionLabel(section) }}
                </el-tag>
                <span v-if="(row.sectionIds || row.sections || []).length === 0" class="muted">未绑定课次</span>
              </div>
            </template>
          </el-table-column>
          <el-table-column label="状态" width="132">
            <template #default="{ row }">
              <div class="status-cell">
                <el-tag :type="statusMeta(row.status).type" size="small">{{ statusMeta(row.status).label }}</el-tag>
                <span v-if="row.file?.pagesReady === false || row.pagesReady === false" class="incomplete-mark">页图不完整</span>
              </div>
            </template>
          </el-table-column>
          <el-table-column label="读过 · 点亮 · 回响" width="155" align="center">
            <template #default="{ row }">
              <span class="stats-cell">{{ row.readerCount ?? 0 }} · {{ row.likeCount ?? 0 }} · {{ row.commentCount ?? 0 }}</span>
            </template>
          </el-table-column>
          <el-table-column label="操作" width="255" fixed="right">
            <template #default="{ row }">
              <div class="row-actions">
                <el-button text type="primary" size="small" @click="openEdit(row)">编辑</el-button>
                <el-button text size="small" @click="previewNote(row)">预览</el-button>
                <el-button text size="small" @click="openComments(row)">回响</el-button>
                <el-button v-if="row.status === 'published'" text type="warning" size="small" @click="unpublishNote(row)">下线</el-button>
                <el-button v-else text type="success" size="small" @click="publishNote(row)">发布</el-button>
                <el-button text type="danger" size="small" @click="deleteNote(row)">删除</el-button>
              </div>
            </template>
          </el-table-column>
        </el-table>
      </el-card>

      <el-drawer
        v-model="drawerVisible"
        :title="editingId ? '编辑陪伴手札' : '上传陪伴手札'"
        direction="rtl"
        size="min(620px, 100%)"
        :close-on-click-modal="false"
        class="companion-note-drawer"
        @closed="resetForm"
      >
        <el-form ref="formRef" :model="formData" label-position="top" class="note-form">
          <el-form-item label="PDF 文件" required>
            <input ref="pdfInputRef" class="visually-hidden" type="file" accept=".pdf,application/pdf" @change="handlePdfSelected" />
            <div v-if="selectedPdf" class="selected-file">
              <div class="file-icon">PDF</div>
              <div class="file-copy">
                <strong>{{ selectedPdf.name }}</strong>
                <span>
                  {{ formatBytes(selectedPdf.size) }} · 读出 {{ formData.pageCount || '—' }} 页
                  <template v-if="formData.pageCount">· 已用第 1 页做封面</template>
                </span>
              </div>
              <el-button link type="primary" @click="choosePdf">换文件</el-button>
            </div>
            <div v-else-if="formData.fileName" class="selected-file">
              <div class="file-icon">PDF</div>
              <div class="file-copy">
                <strong>{{ formData.fileName }}</strong>
                <span>{{ formatBytes(formData.fileSize) }} · {{ formData.pageCount || '—' }} 页</span>
              </div>
              <el-button link type="primary" @click="choosePdf">换文件</el-button>
            </div>
            <el-button v-else class="choose-file-button" @click="choosePdf">
              <el-icon><Upload /></el-icon>
              选择 PDF
            </el-button>
            <div class="form-hint">只收 PDF，最大 50 MB；超过 20 MB 会提醒你，书友在移动网络下要多等一会儿。</div>
            <el-alert v-if="pdfWarning" :title="pdfWarning" type="warning" :closable="false" class="inline-alert" />
            <el-progress v-if="sourceUploadProgress > 0 && sourceUploadProgress < 100" :percentage="sourceUploadProgress" :status="sourceUploadProgress === 100 ? 'success' : undefined" />
          </el-form-item>

          <el-form-item label="封面">
            <div class="cover-editor">
              <div class="cover-preview">
                <img v-if="coverPreviewUrl" :src="coverPreviewUrl" alt="手札封面预览" />
                <span v-else>封面</span>
              </div>
              <div>
                <input ref="coverInputRef" class="visually-hidden" type="file" accept="image/*" @change="handleCoverSelected" />
                <el-button link type="primary" @click="chooseCover">换一张</el-button>
                <div class="form-hint">默认使用 PDF 第 1 页，可上传一张新的封面图。</div>
              </div>
            </div>
          </el-form-item>

          <el-form-item label="标题" required>
            <el-input v-model="formData.title" maxlength="40" show-word-limit placeholder="例如：慢一点，看见对方" />
            <div class="form-hint">默认取文件名，并自动去掉日期后缀。</div>
          </el-form-item>

          <el-form-item label="陪伴书友" required>
            <el-select
              v-model="formData.companionUserIds"
              multiple
              clearable
              filterable
              remote
              :reserve-keyword="false"
              collapse-tags
              collapse-tags-tooltip
              :max-collapse-tags="3"
              :remote-method="searchCompanions"
              :loading="companionSearchLoading"
              :placeholder="formData.periodId ? '搜索本期书友昵称，可多选' : '先选绑定期次，再从这一期里挑书友'"
              :disabled="!formData.periodId"
              style="width: 100%"
              @change="handleCompanionUserChange"
              @visible-change="handleCompanionDropdownToggle"
            >
              <el-option v-for="user in companionOptions" :key="getId(user)" :label="companionOptionLabel(user)" :value="getId(user)">
                <div class="companion-option">
                  <span>{{ user.nickname || user.name || '未命名书友' }}</span>
                  <small v-if="user.enrollmentName && user.enrollmentName !== companionOptionLabel(user)">{{ user.enrollmentName }}</small>
                  <small v-else-if="user.enrolledAt">已报名</small>
                </div>
              </el-option>
            </el-select>
            <div class="form-hint">
              {{ formData.periodId
                ? '候选来自这一期的报名书友，可多选；选中的书友都会收到回响来信，回复自动带「陪伴人」标识。'
                : '这份手札还没有绑定期次：先在上面选期次，这里会自动列出那一期的书友。' }}
            </div>
            <el-input
              v-if="formData.companionUserIds.length"
              v-model="formData.companionName"
              maxlength="20"
              class="companion-name-input"
              placeholder="选填：默认用第一位书友的昵称"
            />
            <el-input
              v-else
              v-model="formData.companionName"
              maxlength="20"
              class="companion-name-input"
              placeholder="未选书友时必填：手札里显示的陪伴人名字"
            />
          </el-form-item>

          <el-form-item label="简介">
            <el-input v-model="formData.summary" type="textarea" :rows="3" maxlength="200" show-word-limit placeholder="一两句导语，让书友知道这份手札写了什么。" />
          </el-form-item>

          <el-form-item label="绑定期次">
            <el-select v-model="formData.periodId" clearable filterable placeholder="清空就是不绑定：全营可见" style="width: 100%" @change="handleFormPeriodChange">
              <el-option label="不绑定期次 · 全营" value="" />
              <el-option v-for="period in periods" :key="getId(period)" :label="period.name || period.title" :value="getId(period)" />
            </el-select>
            <div class="form-hint">不绑定期次的手札，对本租户任一期有效报名的书友开放。</div>
          </el-form-item>

          <el-form-item label="绑定课次">
            <el-checkbox-group v-model="formData.sectionIds" class="section-grid">
              <el-checkbox v-for="section in formSections" :key="getId(section)" :value="getId(section)">
                {{ sectionLabel(section) }}
                <small v-if="section.isPublished === false || section.status === 'draft'">未发布</small>
              </el-checkbox>
            </el-checkbox-group>
            <div v-if="formData.periodId && formSections.length === 0" class="form-hint">这个期次还没有课次可供绑定。</div>
            <div v-else class="form-hint">可多选。一篇手札可以挂在多节课；选了课次就必须绑定期次。</div>
          </el-form-item>

          <el-form-item v-if="formData.pageCount" label="页图上传">
            <div class="page-upload-panel">
              <div class="page-upload-header">
                <span>已上传 {{ uploadedPageCount }} / {{ formData.pageCount }} 页</span>
                <el-progress :percentage="pageUploadPercentage" :stroke-width="8" :show-text="false" />
              </div>
              <div v-for="pageState in pageStates" :key="pageState.pageNo" class="page-row">
                <span>第 {{ pageState.pageNo }} 页</span>
                <el-tag size="small" :type="pageStatusMeta(pageState.status).type">{{ pageStatusMeta(pageState.status).label }}</el-tag>
                <el-progress v-if="pageState.status === 'uploading'" :percentage="pageState.progress" :show-text="false" class="page-progress" />
                <span v-if="pageState.error" class="page-error">{{ pageState.error }}</span>
                <el-button v-if="pageState.status === 'error'" link type="primary" size="small" @click="retryPage(pageState.pageNo)">重试</el-button>
              </div>
            </div>
          </el-form-item>

          <el-form-item label="状态">
            <el-radio-group v-model="formData.status">
              <el-radio value="draft">草稿</el-radio>
              <el-radio value="published">发布</el-radio>
            </el-radio-group>
          </el-form-item>

          <el-alert
            title="手札里有书友的真实故事，只对有权限的报名书友开放。下载链接 10 分钟后失效，但挡不住截图，请不要放入比群聊更敏感的内容。"
            type="warning"
            :closable="false"
            class="privacy-alert"
          />
        </el-form>

        <template #footer>
          <div class="drawer-footer">
            <el-button @click="drawerVisible = false">取消</el-button>
            <el-button :loading="saving" @click="saveNote('draft')">存为草稿</el-button>
            <el-button type="primary" :loading="saving" @click="saveNote('published')">保存并发布</el-button>
          </div>
        </template>
      </el-drawer>

      <el-drawer v-model="commentsVisible" :title="commentsTitle" direction="rtl" size="min(560px, 100%)" class="comments-drawer">
        <div v-loading="commentsLoading" class="comments-content">
          <div class="comments-summary">
            <span>{{ comments.length }} 条回响</span>
            <span>精选 {{ pinnedCommentCount }} / 3</span>
          </div>
          <el-empty v-if="!commentsLoading && comments.length === 0" description="还没有回响" />
          <div v-for="comment in comments" v-else :key="getId(comment)" class="comment-card" :class="{ hidden: comment.hidden }">
            <div class="comment-avatar">{{ comment.user?.nickname?.slice(0, 1) || comment.nickname?.slice(0, 1) || '书' }}</div>
            <div class="comment-body">
              <div class="comment-meta">
                <strong>{{ comment.user?.nickname || comment.nickname || '某书友' }}</strong>
                <el-tag v-if="comment.isPinned" size="small" type="warning">精选</el-tag>
                <el-tag v-if="comment.hidden" size="small" type="info">已隐藏</el-tag>
                <span>{{ formatTime(comment.createdAt) }}</span>
              </div>
              <p>{{ comment.content || '（空）' }}</p>
              <div class="comment-actions">
                <el-button v-if="!comment.hidden" text size="small" @click="togglePinned(comment)">
                  {{ comment.isPinned ? '取消精选' : '设为精选' }}
                </el-button>
                <el-button text size="small" @click="toggleHidden(comment)">
                  {{ comment.hidden ? '恢复' : '隐藏' }}
                </el-button>
                <el-button text type="danger" size="small" @click="deleteComment(comment)">删除</el-button>
              </div>
              <div v-if="comment.replies?.length" class="replies-list">
                <div v-for="reply in comment.replies" :key="getId(reply)" class="reply-row">
                  <div><strong>{{ reply.user?.nickname || reply.nickname || '书友' }}</strong>：{{ reply.content }}</div>
                  <el-button text type="danger" size="small" @click="deleteReply(comment, reply)">删除</el-button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </el-drawer>
    </div>
  </AdminLayout>
</template>

<script setup lang="ts">
// @ts-nocheck
import { computed, onMounted, reactive, ref, shallowRef } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { Upload } from '@element-plus/icons-vue';
import pdfjsModuleUrl from 'pdfjs-dist/build/pdf.mjs?url';
import AdminLayout from '../components/AdminLayout.vue';
import { companionNotesApi, enrollmentApi, periodApi } from '../services/api';

const MAX_PDF_SIZE = 50 * 1024 * 1024;
const LARGE_PDF_SIZE = 20 * 1024 * 1024;
const MAX_PAGE_COUNT = 120;
const pageSize = 20;

const loading = ref(false);
const saving = ref(false);
const total = ref(0);
const page = ref(1);
const notes = ref<any[]>([]);
const periods = ref<any[]>([]);
const filterSections = ref<any[]>([]);
const formSections = ref<any[]>([]);
const filters = reactive({ periodId: '', sectionId: '', status: '', q: '' });

const drawerVisible = ref(false);
const editingId = ref('');
const formRef = ref();
const pdfInputRef = ref<HTMLInputElement | null>(null);
const coverInputRef = ref<HTMLInputElement | null>(null);
const selectedPdf = ref<File | null>(null);
const pdfDocument = shallowRef<any>(null);
const coverFile = ref<Blob | null>(null);
const coverPreviewUrl = ref('');
const pdfWarning = ref('');
const loadingPdf = ref(false);
const sourceUploadProgress = ref(0);
const pageStates = ref<any[]>([]);
const sourceDirty = ref(false);
const companionOptions = ref<any[]>([]);
const companionSearchLoading = ref(false);
const commentsVisible = ref(false);
const commentsLoading = ref(false);
const comments = ref<any[]>([]);
const commentsNote = ref<any | null>(null);
const draggedNote = ref<any | null>(null);
let pdfJsPromise: Promise<any> | null = null;
let companionSearchTimer: ReturnType<typeof setTimeout> | null = null;

const formData = reactive(createEmptyForm());

const commentsTitle = computed(() => commentsNote.value ? `《${commentsNote.value.title || '陪伴手札'}》的回响` : '回响管理');
const pinnedCommentCount = computed(() => comments.value.filter(comment => comment.isPinned && !comment.hidden).length);
const uploadedPageCount = computed(() => pageStates.value.filter(item => item.status === 'uploaded').length);
const pageUploadPercentage = computed(() => formData.pageCount ? Math.round(uploadedPageCount.value / formData.pageCount * 100) : 0);

const queryParams = computed(() => {
  const params: any = { page: page.value, limit: pageSize };
  if (filters.periodId === 'general') params.scope = 'general';
  else if (filters.periodId) params.periodId = filters.periodId;
  if (filters.sectionId) params.sectionId = filters.sectionId;
  if (filters.status) params.status = filters.status;
  if (filters.q.trim()) params.q = filters.q.trim();
  return params;
});

function createEmptyForm() {
  return {
    fileToken: '',
    fileName: '',
    fileSize: 0,
    pageCount: 0,
    coverUrl: '',
    title: '',
    summary: '',
    companionName: '',
    companionUserIds: [] as string[],
    periodId: '',
    sectionIds: [],
    status: 'draft'
  };
}

function getId(item: any) {
  if (typeof item === 'string' || typeof item === 'number') return String(item);
  return String(item?._id || item?.id || item?.sectionId || item?.userId || '');
}

function extractList(response: any, keys = ['list', 'notes', 'comments']) {
  if (Array.isArray(response)) return response;
  for (const key of keys) if (Array.isArray(response?.[key])) return response[key];
  if (Array.isArray(response?.data)) return response.data;
  if (Array.isArray(response?.data?.list)) return response.data.list;
  return [];
}

function extractData(response: any) {
  return response?.data?.note || response?.note || response?.data || response;
}

function statusMeta(status: string) {
  return status === 'published'
    ? { label: '已发布', type: 'success' }
    : { label: '草稿', type: 'info' };
}

function pageStatusMeta(status: string) {
  const map: Record<string, any> = {
    pending: { label: '待上传', type: 'info' },
    uploading: { label: '上传中', type: 'warning' },
    uploaded: { label: '已上传', type: 'success' },
    error: { label: '失败', type: 'danger' }
  };
  return map[status] || map.pending;
}

function formatBytes(size: number | null | undefined) {
  if (!size || size < 0) return '—';
  if (size < 1024 * 1024) return `${Math.round(size / 1024)} KB`;
  return `${(size / 1024 / 1024).toFixed(1)} MB`;
}

function formatTime(value: string | null | undefined) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString('zh-CN', { hour12: false, month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
}

function toAssetUrl(value: string) {
  if (!value || value.startsWith('http') || value.startsWith('blob:') || value.startsWith('data:')) return value;
  const backendHost = import.meta.env.VITE_BACKEND_URL || (import.meta.env.DEV ? 'http://localhost:3000' : 'https://wx.shubai01.com');
  return `${backendHost}${value.startsWith('/') ? '' : '/'}${value}`;
}

function periodName(periodId: any, fallback?: string) {
  if (fallback) return fallback;
  const period = periods.value.find(item => getId(item) === String(periodId));
  return period?.name || period?.title || '已绑定期次';
}

function sectionName(sectionId: string) {
  const section = [...filterSections.value, ...formSections.value].find(item => getId(item) === String(sectionId));
  return section ? sectionLabel(section) : '已绑定课次';
}

function sectionLabel(section: any) {
  const day = section.day ?? section.order ?? section.sequence ?? section.index;
  const title = section.title || section.name || section.courseTitle || '未命名课次';
  return day === undefined || day === null ? title : `第 ${day} 课 · ${title}`;
}

async function loadPeriods() {
  try {
    const response = await periodApi.getPeriods({ page: 1, limit: 200 });
    periods.value = extractList(response, ['list', 'periods']);
  } catch (error) {
    console.error('加载期次失败', error);
    ElMessage.error('期次没加载出来，稍后再试');
  }
}

async function loadSections(periodId: string, target: typeof formSections | typeof filterSections) {
  if (!periodId || periodId === 'general') {
    target.value = [];
    return;
  }
  try {
    const response = await periodApi.getAllSections(periodId, { limit: 200 });
    target.value = extractList(response, ['list', 'sections']);
  } catch (error) {
    console.error('加载课次失败', error);
    target.value = [];
    ElMessage.error('课次没加载出来，稍后再试');
  }
}

async function loadNotes() {
  loading.value = true;
  try {
    const response = await companionNotesApi.getNotes(queryParams.value);
    notes.value = extractList(response);
    total.value = Number(response?.total || response?.pagination?.total || response?.data?.total || notes.value.length);
  } catch (error: any) {
    console.error('加载陪伴手札失败', error);
    ElMessage.error(error?.message || '手札没加载出来，稍后再试');
  } finally {
    loading.value = false;
  }
}

function handleFilterChange() {
  page.value = 1;
  loadNotes();
}

async function handlePeriodFilterChange(periodId: string) {
  filters.sectionId = '';
  await loadSections(periodId, filterSections);
  handleFilterChange();
}

function resetFilters() {
  filters.periodId = '';
  filters.sectionId = '';
  filters.status = '';
  filters.q = '';
  filterSections.value = [];
  handleFilterChange();
}

function handlePageChange(nextPage: number) {
  page.value = nextPage;
  loadNotes();
}

function choosePdf() {
  pdfInputRef.value?.click();
}

function chooseCover() {
  coverInputRef.value?.click();
}

async function loadPdfJs() {
  if (!pdfJsPromise) {
    pdfJsPromise = import(/* @vite-ignore */ pdfjsModuleUrl).then(pdfjs => {
      pdfjs.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).toString();
      return pdfjs;
    });
  }
  return pdfJsPromise;
}

async function validatePdfFile(file: File) {
  if (!file.name.toLowerCase().endsWith('.pdf')) throw new Error('请选择 PDF 文件');
  if (file.size > MAX_PDF_SIZE) throw new Error('PDF 不能超过 50 MB');
  const header = new TextDecoder().decode(await file.slice(0, 5).arrayBuffer());
  if (header !== '%PDF-') throw new Error('文件头不是有效的 PDF');
}

function titleFromFilename(filename: string) {
  return filename
    .replace(/\.pdf$/i, '')
    .replace(/[-_\s]*(?:20\d{2}[-_.])?\d{1,2}[-_.]\d{1,2}$/u, '')
    .trim();
}

async function handlePdfSelected(event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0];
  if (!file) return;
  try {
    await validatePdfFile(file);
    if (file.size > LARGE_PDF_SIZE) pdfWarning.value = '这个 PDF 超过 20 MB，书友在移动网络下要多等一会儿。';
    else pdfWarning.value = '';
    loadingPdf.value = true;
    const pdfjs = await loadPdfJs();
    const document = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise;
    if (document.numPages > MAX_PAGE_COUNT) throw new Error(`PDF 不能超过 ${MAX_PAGE_COUNT} 页`);
    selectedPdf.value = file;
    pdfDocument.value = document;
    formData.fileName = file.name;
    formData.fileSize = file.size;
    formData.pageCount = document.numPages;
    formData.fileToken = '';
    sourceDirty.value = true;
    if (!formData.title) formData.title = titleFromFilename(file.name);
    const firstPage = await renderPageBlob(1, 0.82);
    coverFile.value = firstPage;
    setCoverPreview(firstPage);
    pageStates.value = Array.from({ length: document.numPages }, (_, index) => ({ pageNo: index + 1, status: 'pending', progress: 0, error: '' }));
  } catch (error: any) {
    selectedPdf.value = null;
    pdfDocument.value = null;
    ElMessage.error(error?.message || 'PDF 读取失败');
  } finally {
    loadingPdf.value = false;
    if (pdfInputRef.value) pdfInputRef.value.value = '';
  }
}

async function renderPageBlob(pageNo: number, quality = 0.8) {
  if (!pdfDocument.value) throw new Error('请先选择 PDF');
  const page = await pdfDocument.value.getPage(pageNo);
  const baseViewport = page.getViewport({ scale: 1 });
  const viewport = page.getViewport({ scale: 1080 / baseViewport.width });
  const canvas = document.createElement('canvas');
  canvas.width = Math.ceil(viewport.width);
  canvas.height = Math.ceil(viewport.height);
  await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;
  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(value => value ? resolve(value) : reject(new Error('页面渲染失败')), 'image/jpeg', quality);
  });
  canvas.width = 1;
  canvas.height = 1;
  return blob;
}

function setCoverPreview(blob: Blob | string) {
  if (coverPreviewUrl.value.startsWith('blob:')) URL.revokeObjectURL(coverPreviewUrl.value);
  coverPreviewUrl.value = typeof blob === 'string' ? toAssetUrl(blob) : URL.createObjectURL(blob);
}

async function handleCoverSelected(event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0];
  if (!file) return;
  try {
    const blob = await imageToJpeg(file);
    coverFile.value = blob;
    setCoverPreview(blob);
    sourceDirty.value = true;
  } catch (error: any) {
    ElMessage.error(error?.message || '封面处理失败');
  } finally {
    if (coverInputRef.value) coverInputRef.value.value = '';
  }
}

async function imageToJpeg(file: File) {
  const url = URL.createObjectURL(file);
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const element = new Image();
      element.onload = () => resolve(element);
      element.onerror = () => reject(new Error('封面图片读取失败'));
      element.src = url;
    });
    const scale = Math.min(1, 1080 / image.width);
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(image.width * scale));
    canvas.height = Math.max(1, Math.round(image.height * scale));
    canvas.getContext('2d')?.drawImage(image, 0, 0, canvas.width, canvas.height);
    return await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(value => value ? resolve(value) : reject(new Error('封面转换失败')), 'image/jpeg', 0.82);
    });
  } finally {
    URL.revokeObjectURL(url);
  }
}

function normalizeFileToken(response: any) {
  return response?.fileToken || response?.fileId || response?.data?.fileToken || response?.data?.fileId || '';
}

function normalizeCoverUrl(response: any) {
  return response?.coverUrl || response?.data?.coverUrl || response?.cover?.url || response?.data?.cover?.url || '';
}

async function ensureFileUploaded() {
  if (!selectedPdf.value) {
    if (sourceDirty.value) throw new Error('更换封面后请重新选择 PDF 一起上传');
    if (editingId.value) return '';
    if (!formData.fileToken) throw new Error('请先选择 PDF 文件');
    return formData.fileToken;
  }
  if (formData.fileToken && !sourceDirty.value) return formData.fileToken;
  sourceUploadProgress.value = 1;
  const response = await companionNotesApi.uploadFile(selectedPdf.value, coverFile.value, (loaded, totalBytes) => {
    sourceUploadProgress.value = totalBytes ? Math.round(loaded / totalBytes * 100) : 0;
  });
  const fileToken = normalizeFileToken(response);
  if (!fileToken) throw new Error('上传成功但没有拿到文件标识');
  formData.fileToken = fileToken;
  formData.coverUrl = normalizeCoverUrl(response) || formData.coverUrl;
  sourceDirty.value = false;
  sourceUploadProgress.value = 100;
  return fileToken;
}

async function uploadPage(pageState: any, fileToken = formData.fileToken) {
  if (!fileToken) throw new Error('请先上传 PDF');
  if (!pdfDocument.value) throw new Error('当前没有可渲染的 PDF，请重新选择文件');
  pageState.status = 'uploading';
  pageState.progress = 1;
  pageState.error = '';
  try {
    const blob = await renderPageBlob(pageState.pageNo);
    await companionNotesApi.uploadPage(fileToken, pageState.pageNo, blob, (loaded, totalBytes) => {
      pageState.progress = totalBytes ? Math.round(loaded / totalBytes * 100) : 0;
    });
    pageState.status = 'uploaded';
    pageState.progress = 100;
  } catch (error: any) {
    pageState.status = 'error';
    pageState.error = error?.message || '上传失败';
  }
}

async function uploadPages(fileToken: string) {
  if (!selectedPdf.value || !pdfDocument.value || !pageStates.value.length) return;
  for (const pageState of pageStates.value) {
    if (pageState.status === 'uploaded') continue;
    await uploadPage(pageState, fileToken);
  }
  if (pageStates.value.some(item => item.status === 'error')) {
    ElMessage.warning('部分页图上传失败，可以在列表中逐页重试；当前手札仍可保存。');
  }
}

async function retryPage(pageNo: number) {
  const pageState = pageStates.value.find(item => item.pageNo === pageNo);
  if (!pageState) return;
  try {
    if (!formData.fileToken) await ensureFileUploaded();
    await uploadPage(pageState);
    if (pageState.status === 'uploaded') ElMessage.success(`第 ${pageNo} 页已上传`);
  } catch (error: any) {
    pageState.status = 'error';
    pageState.error = error?.message || '上传失败';
    ElMessage.error(pageState.error);
  }
}

function validateSectionLinkage(periodId: string, sectionIds: string[], availableSections: any[]) {
  if (sectionIds.length > 0 && !periodId) return '选了课次就必须先选择期次';
  const availableIds = new Set(availableSections.map(section => getId(section)));
  if (periodId && sectionIds.some(id => !availableIds.has(String(id)))) return '所选课次不属于当前期次，请重新选择';
  return '';
}

function validateForm() {
  if (!formData.title.trim()) return '标题不能为空';
  // 选了陪伴书友就不必手填名字（保存时默认取第一位书友的昵称）；两者都没有才拦截
  if (!formData.companionUserIds.length && !formData.companionName.trim()) return '请选择陪伴书友，或填写陪伴人名字';
  const linkageError = validateSectionLinkage(formData.periodId, formData.sectionIds, formSections.value);
  if (linkageError) return linkageError;
  if (!editingId.value && !selectedPdf.value && !formData.fileToken) return '请先选择 PDF 文件';
  return '';
}

async function saveNote(status: 'draft' | 'published') {
  const validationError = validateForm();
  if (validationError) {
    ElMessage.warning(validationError);
    return;
  }
  saving.value = true;
  try {
    const fileToken = await ensureFileUploaded();
    await uploadPages(fileToken);
    const payload = {
      title: formData.title.trim(),
      summary: formData.summary.trim(),
      companionName: formData.companionName.trim(),
      companionUserIds: [...formData.companionUserIds],
      periodId: formData.periodId || null,
      sectionIds: [...formData.sectionIds],
      ...(fileToken ? { fileToken } : {}),
      ...(selectedPdf.value ? { pageCount: formData.pageCount, coverUrl: formData.coverUrl || null } : {}),
      status: 'draft'
    };
    let response: any;
    if (editingId.value) response = await companionNotesApi.updateNote(editingId.value, payload);
    else response = await companionNotesApi.createNote(payload);
    const note = extractData(response);
    const noteId = editingId.value || getId(note);
    if (status === 'published') {
      if (!noteId) throw new Error('手札保存成功但没有拿到手札标识');
      await companionNotesApi.publishNote(noteId);
    } else if (editingId.value && formData.status === 'published') {
      await companionNotesApi.unpublishNote(noteId);
    }
    ElMessage.success(status === 'published' ? '手札已保存并发布' : '手札草稿已保存');
    drawerVisible.value = false;
    await loadNotes();
  } catch (error: any) {
    ElMessage.error(error?.message || '手札保存失败');
  } finally {
    saving.value = false;
  }
}

function mapNoteToForm(note: any) {
  const file = note.file || {};
  Object.assign(formData, {
    fileToken: note.fileToken || file.fileToken || file.fileId || file.token || '',
    fileName: file.originalName || note.fileName || '',
    fileSize: file.size || note.fileSize || 0,
    pageCount: file.pageCount || note.pageCount || 0,
    coverUrl: note.coverUrl || '',
    title: note.title || '',
    summary: note.summary || '',
    companionName: note.companionName || '',
    companionUserIds: (Array.isArray(note.companionUserIds) && note.companionUserIds.length
      ? note.companionUserIds
      : [getId(note.companionUserId || note.companionUser)].filter(Boolean)
    ).map(id => (typeof id === 'string' ? id : getId(id))),
    periodId: getId(note.periodId || note.period) || '',
    sectionIds: (note.sectionIds || note.sections || []).map(section => typeof section === 'string' ? section : getId(section)),
    status: note.status || 'draft'
  });
  if (formData.coverUrl) setCoverPreview(formData.coverUrl);
  pageStates.value = Array.from({ length: formData.pageCount || 0 }, (_, index) => ({
    pageNo: index + 1,
    status: file.pagesReady === true || note.pagesReady === true ? 'uploaded' : 'pending',
    progress: file.pagesReady ? 100 : 0,
    error: ''
  }));
}

function openCreate() {
  if (!localStorage.getItem('admin_active_tenant')) {
    ElMessage.warning('请先在右上角选择租户后再上传手札');
    return;
  }
  editingId.value = '';
  resetForm();
  drawerVisible.value = true;
  // 和编辑页一致：默认选中第一个期次，陪伴书友立即可搜可选
  if (!formData.periodId && periods.value.length) {
    const first = periods.value[0];
    formData.periodId = getId(first);
    loadSections(formData.periodId, formSections);
    loadPeriodCompanions('');
  }
}

async function openEdit(row: any) {
  editingId.value = getId(row);
  resetForm();
  drawerVisible.value = true;
  try {
    const response = await companionNotesApi.getNote(editingId.value);
    mapNoteToForm(extractData(response) || row);
  } catch (error: any) {
    mapNoteToForm(row);
    ElMessage.warning(error?.message || '详情没加载出来，已使用列表数据');
  }
  await loadSections(formData.periodId, formSections);
  // 编辑时把已绑定的陪伴书友放进候选，选中项才能正常回显
  if (formData.companionUserIds.length) {
    companionOptions.value = formData.companionUserIds.map(id => ({
      _id: id,
      nickname: id === formData.companionUserIds[0] && formData.companionName ? formData.companionName : '已绑定的书友',
      avatarUrl: '',
      enrollmentName: '',
      enrolledAt: ''
    }));
    if (formData.periodId) loadPeriodCompanions('');
  } else if (formData.periodId) {
    loadPeriodCompanions('');
  }
}

function handleFormPeriodChange(periodId: string) {
  formData.sectionIds = [];
  loadSections(periodId, formSections);
  // 陪伴书友跟着期次走：换期就清掉已选的人，并预载新一期的候选
  formData.companionUserIds = [];
  companionOptions.value = [];
  if (periodId) loadPeriodCompanions('');
}

function handleDragStart(row: any) {
  draggedNote.value = row;
}

async function handleDrop(target: any) {
  if (!draggedNote.value || draggedNote.value === target) return;
  const fromIndex = notes.value.indexOf(draggedNote.value);
  const toIndex = notes.value.indexOf(target);
  if (fromIndex < 0 || toIndex < 0) return;
  const [moved] = notes.value.splice(fromIndex, 1);
  notes.value.splice(toIndex, 0, moved);
  draggedNote.value = null;
  try {
    await companionNotesApi.sortNotes(notes.value.map((item, index) => ({ id: getId(item), sortOrder: index })));
    ElMessage.success('排序已保存');
  } catch (error: any) {
    ElMessage.error(error?.message || '排序保存失败');
    await loadNotes();
  }
}

async function previewNote(row: any) {
  try {
    const response = await companionNotesApi.previewNote(getId(row));
    const url = typeof response === 'string'
      ? response
      : response?.url || response?.previewUrl || response?.data?.url || response?.data?.previewUrl;
    if (!url) throw new Error('没有拿到预览链接');
    window.open(toAssetUrl(url), '_blank', 'noopener,noreferrer');
  } catch (error: any) {
    ElMessage.error(error?.message || '预览链接没拿到');
  }
}

async function publishNote(row: any) {
  try {
    await ElMessageBox.confirm('发布后本期有权限的书友就能看到这篇手札，确定发布吗？', '发布手札', { type: 'info' });
    await companionNotesApi.publishNote(getId(row));
    ElMessage.success('手札已发布');
    await loadNotes();
  } catch (error: any) {
    if (error !== 'cancel' && error !== 'close') ElMessage.error(error?.message || '发布失败');
  }
}

async function unpublishNote(row: any) {
  try {
    await ElMessageBox.confirm('下线后书友将马上看不到这篇手札，确定下线吗？', '下线手札', { type: 'warning' });
    await companionNotesApi.unpublishNote(getId(row));
    ElMessage.success('手札已下线');
    await loadNotes();
  } catch (error: any) {
    if (error !== 'cancel' && error !== 'close') ElMessage.error(error?.message || '下线失败');
  }
}

async function deleteNote(row: any) {
  try {
    await ElMessageBox.confirm('删除是软删除，确定删除这篇手札吗？', '删除手札', { type: 'warning', confirmButtonText: '删除' });
    await companionNotesApi.deleteNote(getId(row));
    ElMessage.success('手札已删除');
    await loadNotes();
  } catch (error: any) {
    if (error !== 'cancel' && error !== 'close') ElMessage.error(error?.message || '删除失败');
  }
}

async function searchCompanions(query: string) {
  if (companionSearchTimer) clearTimeout(companionSearchTimer);
  if (!formData.periodId) {
    companionOptions.value = [];
    return;
  }
  if (!query.trim()) {
    // 空搜索时也先给这一期的前几个书友，点开就能选（和其他地方选人一致）
    loadPeriodCompanions('');
    return;
  }
  companionSearchTimer = setTimeout(() => {
    loadPeriodCompanions(query.trim());
  }, 250);
}

// 候选只来自当前绑定期的报名书友（按昵称过滤），和其他管理页选人一个体验
async function loadPeriodCompanions(query: string) {
  companionSearchLoading.value = true;
  try {
    const response = await enrollmentApi.getEnrollments({
      periodId: formData.periodId,
      status: 'active',
      limit: 200
    });
    const seen = new Set<string>();
    const list = extractList(response, ['list', 'enrollments'])
      .filter(item => {
        const id = getId(item.userId);
        return id && !seen.has(id) && seen.add(id);
      })
      .filter(item => {
        if (!query) return true;
        const nickname = String(item.userId?.nickname || '').toLowerCase();
        const enrollmentName = String(item.name || '').toLowerCase();
        const q = query.toLowerCase();
        return nickname.includes(q) || enrollmentName.includes(q);
      })
      .slice(0, 50);
    companionOptions.value = list.map(item => ({
      _id: getId(item.userId),
      nickname: item.userId?.nickname || item.name || '未命名书友',
      avatarUrl: item.userId?.avatarUrl || '',
      enrollmentName: item.name || '',
      enrolledAt: item.enrolledAt || ''
    }));
  } catch {
    companionOptions.value = [];
  } finally {
    companionSearchLoading.value = false;
  }
}

function companionOptionLabel(user: any) {
  return user?.nickname || user?.name || '未命名书友';
}

// 选中书友后：显示名默认跟随第一位书友的昵称，管理员仍可手动改
function handleCompanionUserChange(ids: string[]) {
  const first = Array.isArray(ids) ? ids[0] : '';
  if (!first) return;
  const user = companionOptions.value.find(item => getId(item) === first);
  const nickname = user?.nickname || user?.name || '';
  if (nickname) formData.companionName = String(nickname).slice(0, 20);
}

// 选中一项后清掉输入框里的搜索词，下次点开重新从整期候选开始
function handleCompanionDropdownToggle(visible: boolean) {
  if (visible && formData.periodId) loadPeriodCompanions('');
}

async function openComments(row: any) {
  commentsNote.value = row;
  commentsVisible.value = true;
  commentsLoading.value = true;
  comments.value = [];
  try {
    const response = await companionNotesApi.getComments(getId(row), { limit: 200 });
    comments.value = extractList(response);
  } catch (error: any) {
    ElMessage.error(error?.message || '回响没加载出来');
  } finally {
    commentsLoading.value = false;
  }
}

async function togglePinned(comment: any) {
  if (!comment.isPinned && pinnedCommentCount.value >= 3) {
    ElMessage.warning('每篇手札最多精选 3 条回响');
    return;
  }
  try {
    await companionNotesApi.updateComment(getId(comment), { isPinned: !comment.isPinned });
    comment.isPinned = !comment.isPinned;
  } catch (error: any) {
    ElMessage.error(error?.message || '精选状态保存失败');
  }
}

async function toggleHidden(comment: any) {
  try {
    await companionNotesApi.updateComment(getId(comment), { hidden: !comment.hidden });
    comment.hidden = !comment.hidden;
  } catch (error: any) {
    ElMessage.error(error?.message || '隐藏状态保存失败');
  }
}

async function deleteComment(comment: any) {
  try {
    await ElMessageBox.confirm('删除后这条回响和它的回复都无法在小程序中看到，确定删除吗？', '删除回响', { type: 'warning', confirmButtonText: '删除' });
    await companionNotesApi.deleteComment(getId(comment));
    comments.value = comments.value.filter(item => getId(item) !== getId(comment));
    ElMessage.success('回响已删除');
  } catch (error: any) {
    if (error !== 'cancel' && error !== 'close') ElMessage.error(error?.message || '删除失败');
  }
}

async function deleteReply(comment: any, reply: any) {
  try {
    await ElMessageBox.confirm('确定删除这条回复吗？', '删除回复', { type: 'warning', confirmButtonText: '删除' });
    await companionNotesApi.deleteReply(getId(comment), getId(reply));
    comment.replies = comment.replies.filter(item => getId(item) !== getId(reply));
    ElMessage.success('回复已删除');
  } catch (error: any) {
    if (error !== 'cancel' && error !== 'close') ElMessage.error(error?.message || '删除失败');
  }
}

function resetForm() {
  if (coverPreviewUrl.value.startsWith('blob:')) URL.revokeObjectURL(coverPreviewUrl.value);
  Object.assign(formData, createEmptyForm());
  selectedPdf.value = null;
  pdfDocument.value = null;
  coverFile.value = null;
  coverPreviewUrl.value = '';
  pdfWarning.value = '';
  sourceUploadProgress.value = 0;
  pageStates.value = [];
  sourceDirty.value = false;
  formSections.value = [];
  companionOptions.value = [];
}

onMounted(() => {
  loadPeriods();
  loadNotes();
});
</script>

<style scoped>
.companion-notes-container { padding: 4px; }
.page-heading { display: flex; align-items: flex-end; justify-content: space-between; gap: 20px; margin-bottom: 22px; }
.eyebrow { color: var(--admin-primary); font-size: 11px; letter-spacing: .1em; }
.page-heading h2 { margin: 6px 0 6px; color: var(--admin-ink); font-size: 27px; font-weight: 600; letter-spacing: -.5px; }
.page-heading p { margin: 0; color: var(--admin-ink-muted); font-size: 12px; }
.heading-actions { display: flex; gap: 8px; }
.filter-card { margin-bottom: 16px; }
.filter-bar { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
.total-hint { margin-left: auto; color: var(--admin-ink-muted); font-size: 12px; }
.list-card :deep(.el-card__body) { padding: 0; }
.list-header { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
.list-header > div { display: flex; align-items: baseline; gap: 10px; }
.list-header strong { font-size: 14px; }
.list-header span { color: var(--admin-ink-muted); font-size: 12px; }
.drag-handle { color: var(--admin-ink-muted); cursor: grab; font-size: 16px; letter-spacing: -4px; user-select: none; }
.drag-handle:active { cursor: grabbing; }
.cover-thumb { width: 38px; height: 54px; overflow: hidden; border: 1px solid var(--admin-border); border-radius: 4px; background: var(--admin-primary-soft); display: grid; place-items: center; color: var(--admin-primary-dark); font-family: serif; }
.cover-thumb img { width: 100%; height: 100%; object-fit: cover; }
.title-cell { display: flex; flex-direction: column; gap: 3px; min-width: 0; }
.title-cell strong { overflow: hidden; color: var(--admin-ink); font-size: 13px; text-overflow: ellipsis; white-space: nowrap; }
.title-cell span { color: var(--admin-ink-muted); font-size: 11px; }
.binding-cell { display: flex; flex-wrap: wrap; gap: 4px; align-items: center; }
.status-cell { display: flex; flex-direction: column; align-items: flex-start; gap: 4px; }
.incomplete-mark { color: var(--admin-warning); font-size: 11px; }
.stats-cell { color: var(--admin-ink-soft); font-family: var(--admin-font-number); font-size: 12px; white-space: nowrap; }
.row-actions { display: flex; align-items: center; gap: 0; white-space: nowrap; }
.row-actions .el-button + .el-button { margin-left: 0; }
.row-actions .el-button { padding-inline: 4px !important; }
.muted { color: var(--admin-ink-muted); font-size: 12px; }
.note-form { padding: 2px 2px 24px; }
.note-form :deep(.el-form-item) { margin-bottom: 18px; }
.note-form :deep(.el-form-item__label) { margin-bottom: 7px; color: var(--admin-ink-soft); font-size: 12px; font-weight: 600; }
.form-hint { margin-top: 5px; color: var(--admin-ink-muted); font-size: 11px; line-height: 1.55; }
.inline-alert { margin-top: 8px; }
.visually-hidden { position: absolute; width: 1px; height: 1px; padding: 0; overflow: hidden; clip: rect(0, 0, 0, 0); white-space: nowrap; border: 0; }
.selected-file { display: flex; align-items: center; gap: 10px; width: 100%; padding: 10px 11px; border: 1px solid rgba(91,127,74,.35); border-radius: 8px; background: var(--admin-primary-soft); }
.file-icon { width: 31px; height: 37px; border: 1px solid var(--admin-border-strong); border-radius: 4px; background: #fff; color: #c0563c; display: grid; place-items: center; font-size: 9px; font-weight: 700; flex: none; }
.file-copy { display: flex; flex: 1; min-width: 0; flex-direction: column; gap: 2px; }
.file-copy strong { overflow: hidden; color: var(--admin-ink); font-size: 12px; text-overflow: ellipsis; white-space: nowrap; }
.file-copy span { color: var(--admin-primary-dark); font-size: 11px; }
.choose-file-button { width: 100%; height: 78px; border: 1px dashed var(--admin-border-strong); }
.cover-editor { display: flex; align-items: flex-end; gap: 14px; }
.cover-preview { width: 78px; height: 116px; overflow: hidden; border: 1px solid var(--admin-border); border-radius: 5px; background: var(--admin-page); display: grid; place-items: center; color: var(--admin-ink-muted); font-size: 11px; }
.cover-preview img { width: 100%; height: 100%; object-fit: cover; }
.companion-name-input { margin-top: 8px; }
.companion-option { display: flex; align-items: center; justify-content: space-between; gap: 10px; }
.companion-option small { overflow: hidden; max-width: 150px; color: var(--admin-ink-muted); font-size: 10px; text-overflow: ellipsis; white-space: nowrap; }
.section-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 7px; width: 100%; }
.section-grid :deep(.el-checkbox) { min-width: 0; height: auto; margin-right: 0; padding: 7px 9px; border: 1px solid var(--admin-border); border-radius: 6px; background: var(--admin-surface-strong); }
.section-grid :deep(.el-checkbox.is-checked) { border-color: var(--admin-primary); background: var(--admin-primary-soft); }
.section-grid :deep(.el-checkbox__label) { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 12px; }
.section-grid small { margin-left: 4px; color: var(--admin-warning); font-size: 10px; }
.page-upload-panel { width: 100%; max-height: 260px; overflow: auto; padding: 10px; border: 1px solid var(--admin-border); border-radius: 8px; background: var(--admin-page); }
.page-upload-header { display: flex; align-items: center; gap: 10px; margin-bottom: 8px; color: var(--admin-ink-soft); font-size: 12px; }
.page-upload-header .el-progress { flex: 1; }
.page-row { display: flex; align-items: center; gap: 8px; min-height: 29px; border-top: 1px solid var(--admin-border); font-size: 11px; }
.page-row > span:first-child { width: 62px; color: var(--admin-ink-soft); }
.page-progress { width: 80px; }
.page-error { overflow: hidden; max-width: 160px; color: var(--admin-danger); text-overflow: ellipsis; white-space: nowrap; }
.privacy-alert { margin-top: 8px; }
.drawer-footer { display: flex; justify-content: flex-end; gap: 8px; }
.comments-content { min-height: 180px; }
.comments-summary { display: flex; justify-content: space-between; margin-bottom: 12px; color: var(--admin-ink-muted); font-size: 12px; }
.comment-card { display: flex; gap: 10px; padding: 12px 0; border-bottom: 1px solid var(--admin-border); }
.comment-card.hidden { opacity: .62; }
.comment-avatar { width: 30px; height: 30px; border-radius: 50%; background: var(--admin-primary-soft); color: var(--admin-primary-dark); display: grid; place-items: center; flex: none; font-size: 12px; }
.comment-body { flex: 1; min-width: 0; }
.comment-meta { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
.comment-meta strong { color: var(--admin-ink); font-size: 12px; }
.comment-meta span { margin-left: auto; color: var(--admin-ink-muted); font-size: 11px; }
.comment-body p { margin: 6px 0; color: var(--admin-ink-soft); font-size: 13px; line-height: 1.7; white-space: pre-wrap; }
.comment-actions { display: flex; gap: 2px; }
.replies-list { margin-top: 8px; padding: 7px 9px; border-radius: 6px; background: var(--admin-page); }
.reply-row { display: flex; align-items: center; justify-content: space-between; gap: 8px; padding: 5px 0; color: var(--admin-ink-soft); font-size: 11px; }
.reply-row + .reply-row { border-top: 1px solid var(--admin-border); }
.reply-row > div { min-width: 0; line-height: 1.5; }
@media (max-width: 760px) {
  .page-heading { align-items: flex-start; flex-direction: column; }
  .heading-actions { width: 100%; }
  .heading-actions .el-button { flex: 1; }
  .list-header { align-items: flex-start; flex-direction: column; }
  .list-header > div { align-items: flex-start; flex-direction: column; gap: 3px; }
  .section-grid { grid-template-columns: 1fr; }
}
</style>
