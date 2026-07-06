<template>
  <AdminLayout>
    <div class="content-management-container">
      <!-- 期次选择 -->
      <el-card style="margin-bottom: 20px">
        <template #header>
          <div class="card-header">
            <span class="card-title">课程内容管理</span>
            <el-select
              v-model="selectedPeriodId"
              placeholder="选择期次"
              style="width: 200px"
              @change="loadSections"
            >
              <el-option
                v-for="period in periods"
                :key="period._id"
                :label="period.name"
                :value="period._id"
              />
            </el-select>
          </div>
        </template>
      </el-card>

      <!-- 课节列表 -->
      <el-card v-if="selectedPeriodId">
        <template #header>
          <div class="card-header">
            <span>{{ currentPeriod?.name }} - 课程列表</span>
            <el-button type="primary" @click="handleAddSection">+ 新增课节</el-button>
          </div>
        </template>

        <el-table :data="sections" stripe style="width: 100%; margin-bottom: 20px">
          <el-table-column prop="day" label="第几天" width="80" />
          <el-table-column prop="title" label="课程标题" min-width="200" />
          <el-table-column label="状态" width="100">
            <template #default="{ row }">
              <el-tag :type="row.isPublished ? 'success' : 'info'">
                {{ row.isPublished ? '已发布' : '草稿' }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column label="打卡数" width="80">
            <template #default="{ row }">
              {{ row.checkinCount || 0 }}
            </template>
          </el-table-column>
          <el-table-column label="操作" width="280" fixed="right">
            <template #default="{ row }">
              <div class="action-buttons">
                <el-button
                  type="primary"
                  size="small"
                  :loading="loadingSectionId === row._id"
                  @click="handleEditSection(row)"
                >
                  编辑
                </el-button>
                <el-button type="warning" size="small" @click="togglePublish(row)">
                  {{ row.isPublished ? '下架' : '发布' }}
                </el-button>
                <el-button type="danger" size="small" @click="handleDeleteSection(row)"
                  >删除</el-button
                >
              </div>
            </template>
          </el-table-column>
        </el-table>
      </el-card>

      <el-empty v-else description="请先选择一个期次" />

      <!-- 编辑课节弹窗 -->
      <el-dialog
        v-model="editDialogVisible"
        :title="isNewSection ? '新增课节' : '编辑课节'"
        width="900px"
        :close-on-click-modal="false"
        :close-on-press-escape="false"
        :before-close="handleDialogBeforeClose"
        @close="resetForm"
      >
        <el-form
          :model="editingSection"
          label-width="120px"
          style="max-height: 600px; overflow-y: auto"
        >
          <!-- 基本信息 -->
          <div class="form-section">
            <div class="section-title">基本信息</div>

            <el-form-item label="第几天">
              <el-input-number v-model="editingSection.day" :min="0" :max="30" />
            </el-form-item>

            <el-form-item label="课程标题">
              <el-input v-model="editingSection.title" placeholder="请输入课程标题" />
            </el-form-item>

            <el-form-item label="副标题">
              <el-input v-model="editingSection.subtitle" placeholder="可选" />
            </el-form-item>

            <el-form-item label="图标">
              <el-input v-model="editingSection.icon" placeholder="🎯" maxlength="10" />
            </el-form-item>
          </div>

          <!-- 5个学习模块 -->
          <div class="form-section">
            <div class="section-title">学习模块</div>

            <!-- 静一静 -->
            <el-form-item label="静一静">
              <el-input
                v-model="editingSection.meditation"
                type="textarea"
                placeholder="冥想或静思的内容"
                :rows="3"
                maxlength="500"
                show-word-limit
              />
            </el-form-item>

            <!-- 问一问 -->
            <el-form-item label="问一问">
              <el-input
                v-model="editingSection.question"
                type="textarea"
                placeholder="思考问题"
                :rows="3"
                maxlength="500"
                show-word-limit
              />
            </el-form-item>

            <!-- 学一学 -->
            <el-form-item label="学一学">
              <el-input
                v-model="editingSection.learn"
                type="textarea"
                placeholder="学习要点"
                :rows="3"
                maxlength="500"
                show-word-limit
              />
            </el-form-item>

            <!-- 读一读 -->
            <el-form-item label="正文格式">
              <div class="content-editor-mode">
                <el-button
                  size="small"
                  :type="contentEditorMode === 'markdown' ? 'primary' : 'default'"
                  @click="contentEditorMode = 'markdown'"
                >
                  Markdown
                </el-button>
                <el-button
                  size="small"
                  :type="contentEditorMode === 'richtext' ? 'primary' : 'default'"
                  @click="contentEditorMode = 'richtext'"
                >
                  富文本
                </el-button>
              </div>
              <div class="editor-mode-hint">
                Markdown 模式会原样保存语法，小程序正文自动按 Markdown 渲染；富文本模式继续兼容旧 HTML 内容。
              </div>
            </el-form-item>

            <el-form-item label="读一读">
              <el-input
                v-if="contentEditorMode === 'markdown'"
                v-model="editingSection.content"
                type="textarea"
                class="markdown-editor"
                placeholder="请输入 Markdown 正文，例如：# 标题 / - 列表 / **粗体**"
                :rows="16"
                show-word-limit
                maxlength="20000"
              />
              <RichTextEditor
                v-else
                v-model="editingSection.content"
                placeholder="主要课程内容（支持图片、链接、格式化）"
                height="400px"
              />
            </el-form-item>

            <!-- 看一看 -->
            <el-form-item label="看一看">
              <div class="look-image-upload-area">
                <el-button :loading="lookImageUploading" @click="triggerLookImageInput">
                  {{ lookImageUploading ? '上传中...' : '选择图片' }}
                </el-button>
                <input
                  ref="lookImageInputRef"
                  type="file"
                  accept="image/*"
                  style="display:none"
                  @change="handleLookImageChange"
                />
                <div v-if="editingSection.lookImage" class="look-image-preview">
                  <img :src="editingSection.lookImage" alt="看一看图片预览" />
                  <el-button type="danger" size="small" text @click="clearLookImage">× 删除</el-button>
                </div>
              </div>
            </el-form-item>

            <!-- 想一想 -->
            <el-form-item label="想一想">
              <el-input
                v-model="editingSection.reflection"
                type="textarea"
                placeholder="反思内容"
                :rows="3"
                maxlength="500"
                show-word-limit
              />
            </el-form-item>

            <!-- 记一记 -->
            <el-form-item label="记一记">
              <el-input
                v-model="editingSection.action"
                type="textarea"
                placeholder="行动建议或笔记"
                :rows="3"
                maxlength="500"
                show-word-limit
              />
            </el-form-item>

            <!-- 摘一摘 -->
            <el-form-item label="摘一摘">
              <el-input
                v-model="editingSection.extract"
                type="textarea"
                placeholder="重点摘要"
                :rows="3"
                maxlength="500"
                show-word-limit
              />
            </el-form-item>

            <!-- 说一说 -->
            <el-form-item label="说一说">
              <el-input
                v-model="editingSection.say"
                type="textarea"
                placeholder="讨论主题"
                :rows="3"
                maxlength="500"
                show-word-limit
              />
            </el-form-item>
          </div>

          <!-- 扩展信息 -->
          <div class="form-section">
            <div class="section-title">扩展信息</div>

            <el-form-item label="时长（分钟）">
              <el-input-number v-model="editingSection.duration" :min="0" :max="600" />
            </el-form-item>

            <div class="section-subtitle">结营视频</div>

            <el-form-item label="视频文件">
              <div class="closing-video-upload-area">
                <el-button
                  :loading="closingVideoUploading"
                  @click="triggerClosingVideoInput"
                >{{ closingVideoUploading ? '上传中...' : '选择视频文件' }}</el-button>
                <input
                  ref="closingVideoInputRef"
                  type="file"
                  accept="video/mp4,video/quicktime,video/webm,video/*"
                  style="display:none"
                  @change="handleClosingVideoChange"
                />
                <div v-if="editingSection.closingVideo?.url" class="closing-video-file-info">
                  <span class="closing-video-file-name">{{ closingVideoFileName }}</span>
                  <el-button
                    size="small"
                    :loading="closingVideoCoverRegenerating"
                    @click="handleRegenerateClosingVideoCover"
                  >{{ closingVideoCoverRegenerating ? '生成中...' : '重生成封面' }}</el-button>
                  <el-button type="danger" size="small" text @click="clearClosingVideo">× 删除</el-button>
                </div>
                <video
                  v-if="editingSection.closingVideo?.url"
                  class="closing-video-preview"
                  :src="editingSection.closingVideo.url"
                  :poster="editingSection.closingVideo.coverUrl || undefined"
                  controls
                />
                <div v-if="editingSection.closingVideo?.coverUrl" class="closing-video-cover">
                  <span>首帧封面</span>
                  <img :src="editingSection.closingVideo.coverUrl" alt="结营视频首帧封面" />
                </div>
                <div v-if="editingSection.closingVideo?.url" class="podcast-url-display">
                  {{ editingSection.closingVideo.url }}
                </div>
                <el-progress v-if="closingVideoUploading" :percentage="closingVideoUploadProgress" style="margin-top:8px" />
              </div>
            </el-form-item>

            <div class="section-subtitle">凡人播客</div>

            <el-form-item label="播客音频">
              <div class="podcast-upload-area">
                <el-button
                  :loading="podcastUploading"
                  @click="triggerPodcastFileInput"
                >{{ podcastUploading ? '上传中...' : '选择音频文件' }}</el-button>
                <input
                  ref="podcastFileInputRef"
                  type="file"
                  accept=".m4a,.mp3,.aac"
                  style="display:none"
                  @change="handlePodcastFileChange"
                />
                <div v-if="editingSection.podcastUrl" class="podcast-file-info">
                  <span class="podcast-file-name">{{ podcastFileName }}</span>
                  <el-button type="danger" size="small" text @click="clearPodcastUrl">× 删除</el-button>
                </div>
                <div v-if="editingSection.podcastUrl" class="podcast-url-display">
                  {{ editingSection.podcastUrl }}
                </div>
                <el-progress v-if="podcastUploading" :percentage="podcastUploadProgress" style="margin-top:8px" />
              </div>
            </el-form-item>

            <el-form-item label="播客时长（秒）">
              <el-input-number v-model="editingSection.podcastDuration" :min="0" :max="36000" placeholder="上传后自动填入" />
            </el-form-item>

            <el-form-item label="播客介绍">
              <el-input
                v-model="editingSection.podcastDescription"
                type="textarea"
                :rows="6"
                :maxlength="3000"
                show-word-limit
                placeholder="输入播客介绍文字（群里发的那段公告）"
              />
            </el-form-item>

            <el-form-item label="发布状态">
              <el-switch v-model="editingSection.isPublished" />
              <span style="margin-left: 10px; color: #666">
                {{ editingSection.isPublished ? '已发布' : '草稿' }}
              </span>
            </el-form-item>
          </div>
        </el-form>

        <template #footer>
          <el-button @click="requestCloseDialog">取消</el-button>
          <el-button type="primary" :loading="saving" @click="saveSection">保存</el-button>
        </template>
      </el-dialog>
    </div>
  </AdminLayout>
</template>

<script setup lang="ts">
// @ts-nocheck
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue';
import { onBeforeRouteLeave } from 'vue-router';
import AdminLayout from '../components/AdminLayout.vue';
import RichTextEditor from '../components/RichTextEditor.vue';
import { periodApi, uploadApi } from '../services/api';
import { ElMessage, ElMessageBox } from 'element-plus';
import type { ListResponse, Period, Section } from '../types/api';
import { useAuthStore } from '../stores/auth';

interface SectionForm {
  _id?: string;
  periodId?: string;
  day: number;
  title: string;
  subtitle: string;
  icon: string;
  meditation: string;
  question: string;
  content: string;
  lookImage?: string | null;
  reflection: string;
  action: string;
  learn: string;
  extract: string;
  say: string;
  duration: number;
  isPublished: boolean;
  podcastUrl?: string | null;
  podcastDescription?: string | null;
  podcastDuration?: number | null;
  closingVideo?: {
    url?: string | null;
    coverUrl?: string | null;
    originalName?: string | null;
    fileName?: string | null;
    mimeType?: string | null;
    size?: number | null;
    duration?: number | null;
    uploadedAt?: string | null;
  } | null;
}

type SectionFormSource = Partial<SectionForm> & {
  _id?: string;
  periodId?: string | Period;
};

const selectedPeriodId = ref<string | null>(null);
const authStore = useAuthStore();
const isPlatformAdmin = computed(() => {
  const role = authStore.adminInfo?.role;
  return role === 'superadmin' || role === 'platform_superadmin';
});
const periods = ref<Period[]>([]);
const currentPeriod = ref<Period | null>(null);
const sections = ref<Section[]>([]);
const saving = ref(false);
const loadingSectionId = ref<string | null>(null);
const contentEditorMode = ref<'markdown' | 'richtext'>('markdown');
const sectionSnapshot = ref('');

const podcastFileInputRef = ref<HTMLInputElement | null>(null);
const podcastUploading = ref(false);
const podcastUploadProgress = ref(0);
const podcastFileName = ref('');

const closingVideoInputRef = ref<HTMLInputElement | null>(null);
const closingVideoUploading = ref(false);
const closingVideoUploadProgress = ref(0);
const closingVideoFileName = ref('');
const closingVideoCoverRegenerating = ref(false);

const lookImageInputRef = ref<HTMLInputElement | null>(null);
const lookImageUploading = ref(false);

function triggerLookImageInput() {
  lookImageInputRef.value?.click();
}

async function handleLookImageChange(event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  if (!file) return;
  if (isPlatformAdmin.value && !localStorage.getItem('admin_active_tenant')) {
    ElMessage.warning('请先在顶部选择具体租户，再上传图片');
    input.value = '';
    return;
  }
  lookImageUploading.value = true;
  try {
    const res = await uploadApi.uploadFile(file);
    const url = (res as any)?.url || (res as any)?.data?.url || '';
    editingSection.value.lookImage = url || null;
    if (url) ElMessage.success('图片上传成功');
  } catch (err: any) {
    const msg = err?.response?.data?.message || err?.message || '';
    if (err?.response?.status === 403) {
      ElMessage.error('上传失败：请先在顶部选择具体租户');
    } else {
      ElMessage.error(`图片上传失败${msg ? '：' + msg : ''}`);
    }
  } finally {
    lookImageUploading.value = false;
    input.value = '';
  }
}

function clearLookImage() {
  editingSection.value.lookImage = null;
}


function triggerPodcastFileInput() {
  podcastFileInputRef.value?.click();
}

async function handlePodcastFileChange(event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  if (!file) return;
  if (isPlatformAdmin.value && !localStorage.getItem('admin_active_tenant')) {
    ElMessage.warning('请先在顶部选择具体租户，再上传音频');
    input.value = '';
    return;
  }
  podcastFileName.value = file.name;
  podcastUploading.value = true;
  podcastUploadProgress.value = 0;
  try {
    const res = await uploadApi.uploadFile(file);
    const url = (res as any)?.url || (res as any)?.data?.url || '';
    editingSection.value.podcastUrl = url;
    if (url) {
      const autoSeconds = (res as any)?.duration ? Math.round((res as any).duration) : null;
      if (autoSeconds) editingSection.value.podcastDuration = autoSeconds;
    }
    podcastUploadProgress.value = 100;
    ElMessage.success('音频上传成功');
  } catch (err: any) {
    const msg = err?.response?.data?.message || err?.message || '';
    if (err?.response?.status === 403) {
      ElMessage.error('上传失败：请先在顶部选择具体租户');
    } else {
      ElMessage.error(`音频上传失败${msg ? '：' + msg : ''}`);
    }
  } finally {
    podcastUploading.value = false;
    input.value = '';
  }
}

function clearPodcastUrl() {
  editingSection.value.podcastUrl = null;
  podcastFileName.value = '';
}

function triggerClosingVideoInput() {
  closingVideoInputRef.value?.click();
}

function isVideoFile(file: File) {
  return file.type.startsWith('video/') || /\.(mp4|mov|m4v|webm)$/i.test(file.name);
}

function formatUploadFileSize(size?: number | null) {
  const bytes = Number(size || 0);
  if (!bytes) return '';
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))}KB`;
  return `${(bytes / 1024 / 1024).toFixed(bytes >= 10 * 1024 * 1024 ? 0 : 1)}MB`;
}

function getVideoCoverCandidateTimes(duration = 0) {
  const safeDuration = Number.isFinite(duration) && duration > 0 ? duration : 0;
  const maxTime = safeDuration ? Math.max(0.1, safeDuration - 0.1) : 12;
  const preferredTimes = [0.1, 0.5, 1, 2, 3, 5, 8, 12];
  const proportionalTimes = safeDuration
    ? [safeDuration * 0.15, safeDuration * 0.3]
    : [];
  const times = [...preferredTimes, ...proportionalTimes]
    .map((time) => Math.min(time, maxTime))
    .filter((time) => time >= 0.05)
    .map((time) => Number(time.toFixed(2)));

  return Array.from(new Set(times));
}

function waitForVideoEvent(video: HTMLVideoElement, eventName: string, timeout = 5000) {
  return new Promise<void>((resolve, reject) => {
    let settled = false;
    const cleanup = () => {
      video.removeEventListener(eventName, handleEvent);
      video.removeEventListener('error', handleError);
      window.clearTimeout(timer);
    };
    const finish = (callback: () => void) => {
      if (settled) return;
      settled = true;
      cleanup();
      callback();
    };
    const handleEvent = () => finish(resolve);
    const handleError = () => finish(() => reject(new Error('video load error')));
    const timer = window.setTimeout(() => {
      finish(() => reject(new Error(`video ${eventName} timeout`)));
    }, timeout);

    video.addEventListener(eventName, handleEvent);
    video.addEventListener('error', handleError);
  });
}

async function seekVideoTo(video: HTMLVideoElement, time: number) {
  if (Math.abs(video.currentTime - time) < 0.05 && video.readyState >= 2) return;

  const seeked = waitForVideoEvent(video, 'seeked');
  video.currentTime = time;
  await seeked;

  if (video.readyState < 2) {
    await waitForVideoEvent(video, 'loadeddata', 3000).catch(() => undefined);
  }
}

function isFrameLikelyBlack(ctx: CanvasRenderingContext2D, width: number, height: number) {
  const imageData = ctx.getImageData(0, 0, width, height).data;
  let visiblePixels = 0;
  let lumaTotal = 0;
  const pixelCount = Math.max(1, width * height);

  for (let index = 0; index < imageData.length; index += 4) {
    const luma = imageData[index] * 0.2126 + imageData[index + 1] * 0.7152 + imageData[index + 2] * 0.0722;
    lumaTotal += luma;
    if (luma > 35) visiblePixels += 1;
  }

  const averageLuma = lumaTotal / pixelCount;
  const visiblePixelRatio = visiblePixels / pixelCount;

  return averageLuma < 18 && visiblePixelRatio < 0.04;
}

function createCoverFileFromVideo(video: HTMLVideoElement, fileName: string): Promise<File | null> {
  const canvas = document.createElement('canvas');
  canvas.width = video.videoWidth || 1280;
  canvas.height = video.videoHeight || 720;
  const ctx = canvas.getContext('2d');
  if (!ctx) return Promise.resolve(null);

  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

  return new Promise((resolve) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        resolve(null);
        return;
      }

      const baseName = fileName.replace(/\.[^.]+$/, '') || 'closing-video';
      resolve(new File([blob], `${baseName}-cover.jpg`, { type: 'image/jpeg' }));
    }, 'image/jpeg', 0.86);
  });
}

async function captureVideoCover(video: HTMLVideoElement, fileName: string, duration: number) {
  const analysisCanvas = document.createElement('canvas');
  analysisCanvas.width = 160;
  analysisCanvas.height = 90;
  const analysisCtx = analysisCanvas.getContext('2d');
  if (!analysisCtx) return null;

  let fallbackCoverFile: File | null = null;
  const candidateTimes = getVideoCoverCandidateTimes(duration);

  for (const time of candidateTimes) {
    await seekVideoTo(video, time);
    analysisCtx.drawImage(video, 0, 0, analysisCanvas.width, analysisCanvas.height);
    const coverFile = await createCoverFileFromVideo(video, fileName);
    if (!coverFile) continue;
    if (!fallbackCoverFile) fallbackCoverFile = coverFile;
    if (!isFrameLikelyBlack(analysisCtx, analysisCanvas.width, analysisCanvas.height)) {
      return coverFile;
    }
  }

  return fallbackCoverFile;
}

async function getVideoMetadataFromSource(src: string, fileName: string): Promise<{ duration: number; coverFile: File | null }> {
  const video = document.createElement('video');
  video.crossOrigin = 'anonymous';
  video.preload = 'auto';
  video.muted = true;
  video.playsInline = true;
  video.setAttribute('playsinline', 'true');
  video.src = src;

  const cleanup = () => {
    video.removeAttribute('src');
    video.load();
  };

  try {
    video.load();
    await waitForVideoEvent(video, 'loadedmetadata');
    const duration = Number.isFinite(video.duration) ? Math.round(video.duration) : 0;
    const coverFile = await captureVideoCover(video, fileName, video.duration);
    return { duration, coverFile };
  } catch {
    return { duration: 0, coverFile: null };
  } finally {
    cleanup();
  }
}

function getVideoMetadata(file: File): Promise<{ duration: number; coverFile: File | null }> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    getVideoMetadataFromSource(url, file.name)
      .then(resolve)
      .finally(() => URL.revokeObjectURL(url));
  });
}

function resolveClosingVideoSourceUrl(url?: string | null) {
  if (!url) return '';
  if (/^(https?:|blob:|data:)/i.test(url)) return url;
  const backendHost =
    import.meta.env.VITE_BACKEND_URL ||
    (import.meta.env.VITE_API_URL ? String(import.meta.env.VITE_API_URL).replace(/\/api\/v1\/?$/, '') : '') ||
    (import.meta.env.DEV ? 'http://localhost:3000' : '');
  if (backendHost && url.startsWith('/')) return `${backendHost}${url}`;
  return url;
}

function getUploadedFileUrl(response: any) {
  return response?.url || response?.data?.url || '';
}

async function handleClosingVideoChange(event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  if (!file) return;
  if (!isVideoFile(file)) {
    ElMessage.warning('仅支持视频文件');
    input.value = '';
    return;
  }
  if (isPlatformAdmin.value && !localStorage.getItem('admin_active_tenant')) {
    ElMessage.warning('请先在顶部选择具体租户，再上传视频');
    input.value = '';
    return;
  }

  closingVideoUploading.value = true;
  closingVideoUploadProgress.value = 0;
  closingVideoFileName.value = file.name;

  try {
    const metadataPromise = getVideoMetadata(file);
    const videoRes = await uploadApi.uploadClosingVideo(file);
    closingVideoUploadProgress.value = 60;

    const videoData = (videoRes as any)?.data || videoRes || {};
    const metadata = await metadataPromise;
    let coverUrl = '';
    if (metadata.coverFile) {
      try {
        const coverRes = await uploadApi.uploadFile(metadata.coverFile);
        coverUrl = getUploadedFileUrl(coverRes);
      } catch {
        ElMessage.warning('视频已上传，首帧封面生成失败，将使用默认分享封面');
      }
    }

    editingSection.value.closingVideo = {
      url: videoData.url || '',
      coverUrl: coverUrl || null,
      originalName: videoData.originalName || file.name,
      fileName: videoData.fileName || videoData.filename || '',
      mimeType: videoData.mimeType || videoData.mimetype || file.type,
      size: videoData.size || file.size,
      duration: metadata.duration || null,
      uploadedAt: videoData.uploadedAt || new Date().toISOString()
    };
    closingVideoUploadProgress.value = 100;
    ElMessage.success(`视频上传成功${formatUploadFileSize(file.size) ? '（' + formatUploadFileSize(file.size) + '）' : ''}`);
  } catch (err: any) {
    const msg = err?.response?.data?.message || err?.message || '';
    if (err?.response?.status === 403) {
      ElMessage.error('上传失败：请先在顶部选择具体租户');
    } else {
      ElMessage.error(`视频上传失败${msg ? '：' + msg : ''}`);
    }
  } finally {
    closingVideoUploading.value = false;
    input.value = '';
  }
}

function clearClosingVideo() {
  editingSection.value.closingVideo = null;
  closingVideoFileName.value = '';
}

async function handleRegenerateClosingVideoCover() {
  const closingVideo = editingSection.value.closingVideo;
  if (!closingVideo?.url) return;
  if (isPlatformAdmin.value && !localStorage.getItem('admin_active_tenant')) {
    ElMessage.warning('请先在顶部选择具体租户，再重生成封面');
    return;
  }

  closingVideoCoverRegenerating.value = true;
  try {
    const fileName =
      closingVideo.originalName ||
      closingVideo.fileName ||
      closingVideoFileName.value ||
      'closing-video.mp4';
    const metadata = await getVideoMetadataFromSource(resolveClosingVideoSourceUrl(closingVideo.url), fileName);
    if (!metadata.coverFile) {
      ElMessage.warning('封面生成失败，请重新上传视频后再试');
      return;
    }

    const coverRes = await uploadApi.uploadFile(metadata.coverFile);
    const coverUrl = getUploadedFileUrl(coverRes);
    if (!coverUrl) {
      ElMessage.warning('封面上传失败，请重新生成');
      return;
    }

    editingSection.value.closingVideo = {
      ...closingVideo,
      coverUrl,
      duration: metadata.duration || closingVideo.duration || null
    };
    ElMessage.success('封面已重新生成，请保存课节');
  } catch (err) {
    console.error('Failed to regenerate closing video cover:', err);
    ElMessage.error('封面生成失败');
  } finally {
    closingVideoCoverRegenerating.value = false;
  }
}

// 编辑弹窗
const editDialogVisible = ref(false);
const isNewSection = ref(false);
const editingSection = ref<SectionForm>(createEmptySectionDraft());

onMounted(() => {
  loadPeriods();
});

// 加载期次列表
async function loadPeriods() {
  try {
    const response = (await periodApi.getPeriods({
      limit: 100
    })) as unknown as any;

    // 拦截器返回兼容格式：{list: [...], data: [...], ...pagination}
    periods.value = response?.list || response?.data || [];

    // 默认选择最新的期次
    const [firstPeriod] = periods.value;
    if (firstPeriod?._id) {
      selectedPeriodId.value = firstPeriod._id;
      await loadSections();
    }
  } catch (err: any) {
    ElMessage.error('加载期次列表失败');
  }
}

// 加载课节列表
async function loadSections() {
  if (!selectedPeriodId.value) return;

  try {
    const [period, response] = (await Promise.all([
      periodApi.getPeriodDetail(selectedPeriodId.value),
      periodApi.getAllSections(selectedPeriodId.value, { limit: 100 })
    ])) as unknown as [Period, ListResponse<Section>];

    currentPeriod.value = period;
    sections.value = response.list || response || [];
  } catch (err: any) {
    console.error('Failed to load sections:', err);
    ElMessage.error('加载课节列表失败');
    sections.value = [];
  }
}

// 新增课节
async function handleAddSection() {
  isNewSection.value = true;
  contentEditorMode.value = 'markdown';
  editingSection.value = createEmptySectionDraft({
    periodId: selectedPeriodId.value || undefined,
    day: sections.value.length,
  });
  podcastFileName.value = '';
  closingVideoFileName.value = '';
  sectionSnapshot.value = '';
  editDialogVisible.value = true;
  // 等表单组件全部挂载（el-input-number 等会规范化值）后再拍快照
  await nextTick();
  await nextTick();
  captureSectionSnapshot();
}

// 编辑课节
async function handleEditSection(section: Section) {
  if (!section._id) return;

  isNewSection.value = false;
  loadingSectionId.value = section._id;

  try {
    const detail = (await periodApi.getSectionDetail(section._id)) as unknown as Section;
    contentEditorMode.value = detectContentEditorMode(detail.content);
    editingSection.value = normalizeSectionForm(detail);
    podcastFileName.value = detail.podcastUrl ? detail.podcastUrl.split('/').pop() || '' : '';
    closingVideoFileName.value =
      detail.closingVideo?.originalName ||
      detail.closingVideo?.fileName ||
      (detail.closingVideo?.url ? detail.closingVideo.url.split('/').pop() || '' : '');
    sectionSnapshot.value = '';
    editDialogVisible.value = true;
    // 等所有表单组件挂载并完成值规范化后再拍快照，避免误判为有改动
    await nextTick();
    await nextTick();
    captureSectionSnapshot();
  } catch (err) {
    console.error('Failed to load section detail:', err);
    ElMessage.error('加载课节详情失败');
  } finally {
    loadingSectionId.value = null;
  }
}

// 保存课节
async function saveSection() {
  if (!selectedPeriodId.value) {
    ElMessage.error('请先选择期次');
    return;
  }

  if (!editingSection.value.title) {
    ElMessage.warning('请输入课程标题');
    return;
  }

  saving.value = true;
  try {
    const payload = buildSectionPayload(editingSection.value);

    if (isNewSection.value) {
      await periodApi.createSection(selectedPeriodId.value, payload);
      ElMessage.success('课节创建成功，后续课节已自动顺延');
    } else {
      if (!editingSection.value._id) {
        throw new Error('missing section id');
      }

      await periodApi.updateSection(editingSection.value._id, payload);
      ElMessage.success('课节保存成功');
    }
    editDialogVisible.value = false;
    await loadSections();
  } catch (err) {
    console.error('Failed to save section:', err);
    ElMessage.error('保存失败');
  } finally {
    saving.value = false;
  }
}

// 发布/下架课节
async function togglePublish(section: any) {
  const newStatus = !section.isPublished;
  const action = newStatus ? '发布' : '下架';

  try {
    await ElMessageBox.confirm(`确定要${action}这个课节吗？`, '提示', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning'
    });

    await periodApi.updateSection(section._id, { isPublished: newStatus });
    ElMessage.success(`${action}成功`);
    await loadSections();
  } catch (err: any) {
    if (err.message !== 'cancel') {
      ElMessage.error(`${action}失败`);
    }
  }
}

// 删除课节
async function handleDeleteSection(section: any) {
  try {
    await ElMessageBox.confirm('确定要删除这个课节吗？此操作不可撤销。', '提示', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning'
    });

    await periodApi.deleteSection(section._id);
    ElMessage.success('删除成功，后续课节已自动前移');
    await loadSections();
  } catch (err: any) {
    if (err.message !== 'cancel') {
      ElMessage.error('删除失败');
    }
  }
}

// 重置表单
function resetForm() {
  contentEditorMode.value = 'markdown';
  editingSection.value = createEmptySectionDraft();
  podcastFileName.value = '';
  closingVideoFileName.value = '';
  sectionSnapshot.value = '';
}

function buildDirtySnapshot() {
  return JSON.stringify({
    ...buildSectionPayload(editingSection.value),
    contentEditorMode: contentEditorMode.value
  });
}

function captureSectionSnapshot() {
  sectionSnapshot.value = buildDirtySnapshot();
}

const isSectionDirty = computed(() => {
  // sectionSnapshot 为空时说明快照尚未就绪（等待组件挂载），不判断为脏
  return editDialogVisible.value && sectionSnapshot.value !== '' && sectionSnapshot.value !== buildDirtySnapshot();
});

async function confirmDiscardChanges() {
  if (!isSectionDirty.value) return true;

  try {
    await ElMessageBox.confirm('内容已修改但尚未保存，确定要关闭窗口吗？', '未保存内容', {
      confirmButtonText: '确定关闭',
      cancelButtonText: '继续编辑',
      type: 'warning'
    });
    return true;
  } catch {
    return false;
  }
}

async function requestCloseDialog() {
  const shouldClose = await confirmDiscardChanges();
  if (shouldClose) {
    editDialogVisible.value = false;
  }
}

async function handleDialogBeforeClose(done: () => void) {
  const shouldClose = await confirmDiscardChanges();
  if (shouldClose) {
    done();
  }
}

function createEmptySectionDraft(overrides: Partial<SectionForm> = {}): SectionForm {
  return {
    periodId: selectedPeriodId.value || undefined,
    day: 0,
    title: '',
    subtitle: '',
    icon: '📖',
    meditation: '',
    question: '',
    content: '',
    lookImage: null,
    reflection: '',
    action: '',
    learn: '',
    extract: '',
    say: '',
    duration: 0,
    isPublished: false,
    podcastUrl: null,
    podcastDescription: null,
    podcastDuration: null,
    closingVideo: null,
    ...overrides
  };
}

function normalizeSectionForm(section: SectionFormSource): SectionForm {
  const periodId =
    typeof section.periodId === 'string'
      ? section.periodId
      : section.periodId?._id || selectedPeriodId.value || undefined;

  return createEmptySectionDraft({
    _id: section._id,
    periodId,
    day: section.day,
    title: section.title,
    subtitle: section.subtitle,
    icon: section.icon,
    meditation: section.meditation,
    question: section.question,
    content: section.content,
    lookImage: section.lookImage ?? null,
    reflection: section.reflection,
    action: section.action,
    learn: section.learn,
    extract: section.extract,
    say: section.say,
    duration: section.duration,
    isPublished: section.isPublished,
    podcastUrl: section.podcastUrl ?? null,
    podcastDescription: section.podcastDescription ?? null,
    podcastDuration: section.podcastDuration ?? null,
    closingVideo: section.closingVideo ?? null
  });
}

function buildSectionPayload(section: SectionForm) {
  const normalized = normalizeSectionForm(section);

  return {
    periodId: normalized.periodId,
    day: normalized.day,
    title: normalized.title,
    subtitle: normalized.subtitle,
    icon: normalized.icon,
    meditation: normalized.meditation,
    question: normalized.question,
    content: normalized.content,
    lookImage: normalized.lookImage,
    reflection: normalized.reflection,
    action: normalized.action,
    learn: normalized.learn,
    extract: normalized.extract,
    say: normalized.say,
    duration: normalized.duration,
    isPublished: normalized.isPublished,
    podcastUrl: normalized.podcastUrl,
    podcastDescription: normalized.podcastDescription,
    podcastDuration: normalized.podcastDuration,
    closingVideo: normalized.closingVideo
  };
}

function detectContentEditorMode(content?: string) {
  return isLikelyHtml(content) ? 'richtext' : 'markdown';
}

function isLikelyHtml(content?: string) {
  return typeof content === 'string' && /<\/?[a-z][\s\S]*>/i.test(content);
}

onBeforeRouteLeave(async () => {
  if (!isSectionDirty.value) return true;
  return confirmDiscardChanges();
});

function handleBeforeUnload(event: BeforeUnloadEvent) {
  if (!isSectionDirty.value) return;
  event.preventDefault();
  event.returnValue = '';
}

onMounted(() => {
  window.addEventListener('beforeunload', handleBeforeUnload);
});

onBeforeUnmount(() => {
  window.removeEventListener('beforeunload', handleBeforeUnload);
});
</script>

<style scoped>
.content-management-container {
  padding: 24px;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  width: 100%;
}

.card-title {
  font-size: 16px;
  font-weight: 600;
}

.form-section {
  margin-bottom: 20px;
}

.section-title {
  font-size: 14px;
  font-weight: 600;
  color: #333;
  padding-bottom: 12px;
  border-bottom: 1px solid #ebeef5;
  margin-bottom: 16px;
}

.action-buttons {
  display: flex;
  gap: 8px;
  flex-wrap: nowrap;
  align-items: center;
}

.action-buttons :deep(.el-button) {
  flex-shrink: 0;
  white-space: nowrap;
  padding: 6px 12px;
  font-size: 12px;
}

.content-editor-mode {
  display: flex;
  gap: 8px;
}

.editor-mode-hint {
  margin-top: 8px;
  color: #667085;
  font-size: 12px;
  line-height: 1.6;
}

.markdown-editor :deep(.el-textarea__inner) {
  font-family:
    'SFMono-Regular',
    'JetBrains Mono',
    'Fira Code',
    'Menlo',
    monospace;
  line-height: 1.7;
}

.section-subtitle {
  font-size: 13px;
  font-weight: 600;
  color: #606266;
  margin: 16px 0 12px;
  padding-left: 8px;
  border-left: 3px solid var(--admin-primary);
}

.podcast-upload-area {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.podcast-file-info,
.closing-video-file-info {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  color: #606266;
}

.podcast-file-name,
.closing-video-file-name {
  max-width: 300px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.podcast-url-display {
  font-size: 12px;
  color: #909399;
  word-break: break-all;
  background: #f5f7fa;
  padding: 4px 8px;
  border-radius: 4px;
}

.look-image-upload-area {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.look-image-preview {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  margin-top: 4px;
}

.look-image-preview img {
  max-width: 240px;
  max-height: 200px;
  border-radius: 6px;
  object-fit: contain;
  border: 1px solid #e4e7ed;
}

.closing-video-upload-area {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.closing-video-preview {
  width: 360px;
  max-width: 100%;
  border-radius: 6px;
  background: #000;
}

.closing-video-cover {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  font-size: 12px;
  color: #606266;
}

.closing-video-cover img {
  width: 160px;
  max-height: 100px;
  border-radius: 6px;
  object-fit: cover;
  border: 1px solid #e4e7ed;
}
</style>
