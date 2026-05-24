<template>
  <AdminLayout>
    <div class="activities-container">
      <!-- 操作栏 -->
      <el-card style="margin-bottom: 20px">
        <div class="action-bar">
          <el-button type="primary" @click="handleCreate">
            <span style="margin-right: 4px">➕</span>创建活动
          </el-button>
          <el-button style="margin-left: 12px" @click="loadActivities">
            <span style="margin-right: 4px">🔄</span>刷新
          </el-button>
        </div>
      </el-card>

      <!-- 活动列表 -->
      <el-card>
        <el-table v-loading="loading" :data="activities" stripe style="width: 100%">
          <el-table-column prop="title" label="标题" min-width="200" />
          <el-table-column label="类型" width="100">
            <template #default="{ row }">
              {{ formatType(row.type) }}
            </template>
          </el-table-column>
          <el-table-column label="开始时间" width="180">
            <template #default="{ row }">
              {{ formatDatetime(row.startTime) }}
            </template>
          </el-table-column>
          <el-table-column label="状态" width="100">
            <template #default="{ row }">
              <el-tag :type="getStatusTagType(row.status)">
                {{ formatStatus(row.status) }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column label="报名人数" width="100">
            <template #default="{ row }">
              {{ row.registrationCount ?? 0 }}
              <span v-if="row.maxParticipants > 0">/{{ row.maxParticipants }}</span>
            </template>
          </el-table-column>
          <el-table-column label="操作" width="220" fixed="right">
            <template #default="{ row }">
              <div class="action-buttons">
                <el-button type="primary" text size="small" @click="handleEdit(row)">编辑</el-button>
                <el-button type="success" text size="small" @click="handleViewRegistrations(row)">查看报名</el-button>
                <el-button type="danger" text size="small" @click="handleDelete(row)">删除</el-button>
              </div>
            </template>
          </el-table-column>
        </el-table>

        <!-- 分页 -->
        <div class="pagination">
          <el-pagination
            v-model:current-page="pagination.page"
            v-model:page-size="pagination.pageSize"
            :page-sizes="[10, 20, 50]"
            :total="pagination.total"
            layout="total, sizes, prev, pager, next, jumper"
            @current-change="loadActivities"
            @size-change="handlePageSizeChange"
          />
        </div>
      </el-card>

      <!-- 创建/编辑弹窗 -->
      <el-dialog
        v-model="dialogVisible"
        :title="isEditMode ? '编辑活动' : '创建活动'"
        width="720px"
        @close="resetForm"
      >
        <el-form ref="formRef" :model="formData" :rules="formRules" label-width="130px">
          <el-form-item label="标题" prop="title">
            <el-input v-model="formData.title" placeholder="活动标题" clearable />
          </el-form-item>

          <el-form-item label="类型" prop="type">
            <el-select v-model="formData.type" placeholder="选择活动类型" style="width: 100%">
              <el-option label="见证会" value="witness" />
              <el-option label="聊天局" value="chat" />
              <el-option label="其他" value="other" />
            </el-select>
          </el-form-item>

          <el-form-item label="海报图" prop="posterUrl">
            <div style="display: flex; gap: 8px; align-items: flex-start; width: 100%;">
              <el-input
                v-model="formData.posterUrl"
                placeholder="海报图片地址"
                clearable
                style="flex: 1"
              />
              <el-upload
                :show-file-list="false"
                :before-upload="() => false"
                accept="image/*"
                @change="handlePosterUpload"
              >
                <el-button :loading="posterUploading" type="default">
                  {{ posterUploading ? '上传中...' : '上传图片' }}
                </el-button>
              </el-upload>
            </div>
            <div v-if="formData.posterUrl" style="margin-top: 8px;">
              <img :src="formData.posterUrl" style="max-width: 200px; max-height: 120px; border-radius: 4px; border: 1px solid #e4e7ed;" />
            </div>
          </el-form-item>

          <el-form-item label="开始时间" prop="startTime">
            <el-date-picker
              v-model="formData.startTime"
              type="datetime"
              placeholder="选择开始时间"
              style="width: 100%"
            />
          </el-form-item>

          <el-form-item label="结束时间" prop="endTime">
            <el-date-picker
              v-model="formData.endTime"
              type="datetime"
              placeholder="选择结束时间"
              style="width: 100%"
            />
          </el-form-item>

          <el-form-item label="描述" prop="description">
            <RichTextEditor v-model="formData.description" placeholder="活动描述" height="200px" />
          </el-form-item>

          <el-form-item label="腾讯会议号" prop="meetingId">
            <el-input v-model="formData.meetingId" placeholder="例：416 7154 0953" clearable />
          </el-form-item>

          <el-form-item label="腾讯会议邀请链接" prop="meetingJoinUrl">
            <el-input v-model="formData.meetingJoinUrl" placeholder="腾讯会议邀请链接" clearable />
          </el-form-item>

          <el-form-item label="人数上限" prop="maxParticipants">
            <el-input-number
              v-model="formData.maxParticipants"
              :min="0"
              style="width: 100%"
              placeholder="0 表示不限"
            />
            <div style="font-size: 12px; color: #909399; margin-top: 4px">0 表示不限人数</div>
          </el-form-item>

          <el-form-item label="首页弹窗" prop="showPopup">
            <el-switch v-model="formData.showPopup" active-text="开启" inactive-text="关闭" />
          </el-form-item>

          <template v-if="formData.showPopup">
            <el-form-item label="弹窗开始时间" prop="popupStartTime">
              <el-date-picker
                v-model="formData.popupStartTime"
                type="datetime"
                placeholder="弹窗展示开始时间"
                style="width: 100%"
              />
            </el-form-item>

            <el-form-item label="弹窗结束时间" prop="popupEndTime">
              <el-date-picker
                v-model="formData.popupEndTime"
                type="datetime"
                placeholder="弹窗展示结束时间"
                style="width: 100%"
              />
            </el-form-item>
          </template>

          <el-form-item label="状态" prop="status">
            <el-radio-group v-model="formData.status">
              <el-radio value="draft">草稿</el-radio>
              <el-radio value="published">发布</el-radio>
            </el-radio-group>
          </el-form-item>
        </el-form>

        <template #footer>
          <el-button @click="dialogVisible = false">取消</el-button>
          <el-button type="primary" :loading="submitting" @click="handleSubmit">
            {{ isEditMode ? '更新' : '创建' }}
          </el-button>
        </template>
      </el-dialog>

      <!-- 报名名单弹窗 -->
      <el-dialog v-model="registrationsVisible" title="报名名单" width="600px">
        <el-table v-loading="registrationsLoading" :data="registrations" stripe style="width: 100%">
          <el-table-column label="头像" width="70">
            <template #default="{ row }">
              <el-avatar :src="row.user?.avatar" :size="36">
                <span style="font-size: 18px">👤</span>
              </el-avatar>
            </template>
          </el-table-column>
          <el-table-column label="昵称" prop="user.nickname" min-width="120" />
          <el-table-column label="报名时间" width="180">
            <template #default="{ row }">
              {{ formatDatetime(row.createdAt) }}
            </template>
          </el-table-column>
        </el-table>
        <template #footer>
          <el-button @click="registrationsVisible = false">关闭</el-button>
        </template>
      </el-dialog>
    </div>
  </AdminLayout>
</template>

<script setup lang="ts">
// @ts-nocheck
import { ref, reactive, onMounted } from 'vue';
import axios from 'axios';
import AdminLayout from '../components/AdminLayout.vue';
import RichTextEditor from '../components/RichTextEditor.vue';
import { ElMessage, ElMessageBox, type FormInstance } from 'element-plus';
import { uploadApi } from '../services/api';

const BASE_URL = '/api/v1/admin/community-activities';

const loading = ref(false);
const submitting = ref(false);
const activities = ref([]);
const dialogVisible = ref(false);
const isEditMode = ref(false);
const currentEditId = ref<string | null>(null);
const formRef = ref<FormInstance>();

const registrationsVisible = ref(false);
const registrationsLoading = ref(false);
const registrations = ref([]);
const posterUploading = ref(false);

const pagination = ref({ page: 1, pageSize: 20, total: 0 });

const formData = reactive({
  title: '',
  type: 'witness',
  posterUrl: '',
  startTime: null,
  endTime: null,
  description: '',
  meetingId: '',
  meetingJoinUrl: '',
  maxParticipants: 0,
  showPopup: false,
  popupStartTime: null,
  popupEndTime: null,
  status: 'draft'
});

const formRules = {
  title: [{ required: true, message: '标题不能为空', trigger: 'blur' }],
  type: [{ required: true, message: '请选择活动类型', trigger: 'change' }],
  startTime: [{ required: true, message: '请选择开始时间', trigger: 'change' }]
};

onMounted(() => {
  loadActivities();
});

async function loadActivities() {
  loading.value = true;
  try {
    const res = await axios.get(BASE_URL, {
      params: { page: pagination.value.page, pageSize: pagination.value.pageSize },
      headers: { Authorization: `Bearer ${localStorage.getItem('adminToken')}` }
    });
    const data = res.data?.data ?? res.data;
    activities.value = data?.list ?? data?.data ?? (Array.isArray(data) ? data : []);
    pagination.value.total = data?.total ?? data?.pagination?.total ?? 0;
  } catch (err: any) {
    ElMessage.error(err?.response?.data?.message || '加载活动列表失败');
  } finally {
    loading.value = false;
  }
}

function handlePageSizeChange() {
  pagination.value.page = 1;
  loadActivities();
}

function handleCreate() {
  if (!localStorage.getItem('admin_active_tenant')) {
    ElMessage.warning('请先在右上角选择租户后再创建活动');
    return;
  }
  isEditMode.value = false;
  currentEditId.value = null;
  resetForm();
  dialogVisible.value = true;
}

function handleEdit(row: any) {
  isEditMode.value = true;
  currentEditId.value = row._id;
  Object.assign(formData, {
    title: row.title ?? '',
    type: row.type ?? 'witness',
    posterUrl: row.posterUrl ?? '',
    startTime: row.startTime ? new Date(row.startTime) : null,
    endTime: row.endTime ? new Date(row.endTime) : null,
    description: row.description ?? '',
    meetingId: row.meetingId ?? '',
    meetingJoinUrl: row.meetingJoinUrl ?? '',
    maxParticipants: row.maxParticipants ?? 0,
    showPopup: row.showPopup ?? false,
    popupStartTime: row.popupStartTime ? new Date(row.popupStartTime) : null,
    popupEndTime: row.popupEndTime ? new Date(row.popupEndTime) : null,
    status: row.status ?? 'draft'
  });
  dialogVisible.value = true;
}

async function handleSubmit() {
  if (!formRef.value) return;
  await formRef.value.validate(async (valid) => {
    if (!valid) return;
    submitting.value = true;
    try {
      const payload = {
        ...formData,
        startTime: formData.startTime ? new Date(formData.startTime).toISOString() : null,
        endTime: formData.endTime ? new Date(formData.endTime).toISOString() : null,
        popupStartTime: formData.popupStartTime ? new Date(formData.popupStartTime).toISOString() : null,
        popupEndTime: formData.popupEndTime ? new Date(formData.popupEndTime).toISOString() : null
      };
      const headers = { Authorization: `Bearer ${localStorage.getItem('adminToken')}` };
      if (isEditMode.value && currentEditId.value) {
        await axios.put(`${BASE_URL}/${currentEditId.value}`, payload, { headers });
        ElMessage.success('活动更新成功');
      } else {
        await axios.post(BASE_URL, payload, { headers });
        ElMessage.success('活动创建成功');
      }
      dialogVisible.value = false;
      await loadActivities();
    } catch (err: any) {
      ElMessage.error(err?.response?.data?.message || '操作失败');
    } finally {
      submitting.value = false;
    }
  });
}

function handleDelete(row: any) {
  ElMessageBox.confirm('删除后无法恢复，确定要删除该活动吗？', '警告', {
    confirmButtonText: '确定',
    cancelButtonText: '取消',
    type: 'warning'
  }).then(async () => {
    try {
      await axios.delete(`${BASE_URL}/${row._id}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('adminToken')}` }
      });
      ElMessage.success('活动删除成功');
      await loadActivities();
    } catch (err: any) {
      ElMessage.error(err?.response?.data?.message || '删除失败');
    }
  }).catch(() => {});
}

async function handleViewRegistrations(row: any) {
  registrationsVisible.value = true;
  registrationsLoading.value = true;
  registrations.value = [];
  try {
    const res = await axios.get(`${BASE_URL}/${row._id}/registrations`, {
      headers: { Authorization: `Bearer ${localStorage.getItem('adminToken')}` }
    });
    const data = res.data?.data ?? res.data;
    registrations.value = Array.isArray(data) ? data : (data?.list ?? []);
  } catch (err: any) {
    ElMessage.error(err?.response?.data?.message || '加载报名名单失败');
  } finally {
    registrationsLoading.value = false;
  }
}

async function handlePosterUpload(uploadFile: any) {
  const file: File = uploadFile.raw;
  if (!file) return;
  posterUploading.value = true;
  try {
    const res = await uploadApi.uploadFile(file) as any;
    const url = res?.url || res?.data?.url;
    if (url) {
      const backendHost = import.meta.env.VITE_BACKEND_URL ||
        (import.meta.env.DEV ? 'http://localhost:3000' : 'https://wx.shubai01.com');
      formData.posterUrl = url.startsWith('http') ? url : `${backendHost}${url}`;
      ElMessage.success('图片上传成功');
    } else {
      ElMessage.error('上传失败：未获取到图片地址');
    }
  } catch (e: any) {
    ElMessage.error('图片上传失败');
  } finally {
    posterUploading.value = false;
  }
}

function resetForm() {
  formData.title = '';
  formData.type = 'witness';
  formData.posterUrl = '';
  formData.startTime = null;
  formData.endTime = null;
  formData.description = '';
  formData.meetingId = '';
  formData.meetingJoinUrl = '';
  formData.maxParticipants = 0;
  formData.showPopup = false;
  formData.popupStartTime = null;
  formData.popupEndTime = null;
  formData.status = 'draft';
  formRef.value?.clearValidate();
}

function formatType(type: string): string {
  const map: Record<string, string> = { witness: '见证会', chat: '聊天局', other: '其他' };
  return map[type] || type;
}

function formatStatus(status: string): string {
  const map: Record<string, string> = { draft: '草稿', published: '已发布', cancelled: '已取消' };
  return map[status] || status;
}

function getStatusTagType(status: string): string {
  const map: Record<string, string> = { draft: 'info', published: 'success', cancelled: 'danger' };
  return map[status] || 'info';
}

function formatDatetime(val: string | null): string {
  if (!val) return '-';
  return new Date(val).toLocaleString('zh-CN', { hour12: false });
}
</script>

<style scoped>
.activities-container {
  padding: 24px;
}

.action-bar {
  display: flex;
  align-items: center;
}

.pagination {
  display: flex;
  justify-content: flex-end;
  margin-top: 20px;
}

:deep(.el-table__row) {
  height: 60px;
}

.action-buttons {
  display: flex;
  gap: 8px;
  flex-wrap: nowrap;
  align-items: center;
}
</style>
