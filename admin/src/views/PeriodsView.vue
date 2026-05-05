<template>
  <AdminLayout>
    <div class="periods-container">
      <!-- 操作栏 -->
      <el-card style="margin-bottom: 20px">
        <div class="action-bar">
          <el-button type="primary" @click="handleCreatePeriod">
            <span style="margin-right: 4px">➕</span>新建期次
          </el-button>
          <el-button style="margin-left: 12px" @click="handleRefresh">
            <span style="margin-right: 4px">🔄</span>刷新
          </el-button>
          <el-button
            type="success"
            style="margin-left: 12px"
            :loading="syncingStatus"
            @click="handleSyncStatus"
          >
            <span style="margin-right: 4px">⏱️</span>更新期次状态
          </el-button>
        </div>
      </el-card>

      <!-- 期次列表 -->
      <el-card>
        <el-table
          v-loading="loading"
          :data="periods"
          stripe
          style="width: 100%"
          :default-sort="{ prop: 'endDate', order: 'descending' }"
        >
          <el-table-column prop="name" label="期次名称" width="100" />
          <el-table-column prop="title" label="标题" min-width="240" />
          <el-table-column label="时间范围" width="240">
            <template #default="{ row }">
              {{ formatDateRange(row.startDate, row.endDate) }}
            </template>
          </el-table-column>
          <el-table-column label="时长" width="80">
            <template #default="{ row }"> {{ row.totalDays }} 天 </template>
          </el-table-column>
          <el-table-column label="价格" width="100">
            <template #default="{ row }">
              <span v-if="row.price > 0">¥{{ (row.price / 100).toFixed(2) }}</span>
              <span v-else>免费</span>
            </template>
          </el-table-column>
          <el-table-column label="报名人数" width="100">
            <template #default="{ row }">
              {{ row.currentEnrollment }}
              <span v-if="row.maxEnrollment">/{{ row.maxEnrollment }}</span>
            </template>
          </el-table-column>
          <el-table-column label="状态" width="100">
            <template #default="{ row }">
              <el-tag :type="getStatusType(row.status)">
                {{ formatStatus(row.status) }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column label="发布状态" width="100">
            <template #default="{ row }">
              <el-switch
                v-model="row.isPublished"
                :loading="publishingId === row._id"
                @change="handlePublishChange(row)"
              />
            </template>
          </el-table-column>
          <el-table-column label="会议" width="80">
            <template #default="{ row }">
              <el-tag v-if="row.meetingId || row.meetingJoinUrl" type="success" size="small">已配置</el-tag>
              <span v-else style="color: #c0c4cc; font-size: 12px;">-</span>
            </template>
          </el-table-column>
          <el-table-column label="操作" width="260" fixed="right">
            <template #default="{ row }">
              <div class="action-buttons">
                <el-button type="primary" text size="small" @click="handleEditPeriod(row)">
                  编辑
                </el-button>
                <el-button type="warning" text size="small" @click="handleCopyPeriod(row)">
                  复制
                </el-button>
                <el-button type="danger" text size="small" @click="handleDeletePeriod(row)">
                  删除
                </el-button>
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
            @current-change="loadPeriods"
            @size-change="handlePageSizeChange"
          />
        </div>
      </el-card>

      <!-- 编辑/创建对话框 -->
      <el-dialog
        v-model="dialogVisible"
        :title="isEditMode ? '编辑期次' : '新建期次'"
        width="700px"
        @close="resetForm"
      >
        <el-form ref="formRef" :model="formData" :rules="formRules" label-width="120px">
          <el-form-item label="期次名称" prop="name">
            <el-input v-model="formData.name" placeholder="例：第一期" clearable />
          </el-form-item>

          <el-form-item label="副标题" prop="subtitle">
            <el-input v-model="formData.subtitle" placeholder="可选的副标题" clearable />
          </el-form-item>

          <el-form-item label="标题" prop="title">
            <el-input v-model="formData.title" placeholder="期次的完整标题" clearable />
          </el-form-item>

          <el-form-item label="描述" prop="description">
            <el-input
              v-model="formData.description"
              type="textarea"
              placeholder="期次的详细描述"
              :rows="3"
            />
          </el-form-item>

          <el-form-item label="起始日期" prop="startDate">
            <el-date-picker
              v-model="formData.startDate"
              type="date"
              placeholder="选择起始日期"
              style="width: 100%"
            />
          </el-form-item>

          <el-form-item label="结束日期" prop="endDate">
            <el-date-picker
              v-model="formData.endDate"
              type="date"
              placeholder="选择结束日期"
              style="width: 100%"
            />
          </el-form-item>

          <el-form-item label="课程天数" prop="totalDays">
            <el-input-number v-model="formData.totalDays" :min="1" :max="365" style="width: 100%" />
          </el-form-item>

          <el-form-item label="价格（分）" prop="price">
            <el-input-number v-model="formData.price" :min="0" style="width: 100%" />
          </el-form-item>

          <el-form-item label="原价（分）" prop="originalPrice">
            <el-input-number v-model="formData.originalPrice" :min="0" style="width: 100%" />
          </el-form-item>

          <el-form-item label="最大报名数" prop="maxEnrollment">
            <el-input-number
              v-model="formData.maxEnrollment"
              :min="0"
              placeholder="不限制则留空"
              style="width: 100%"
            />
          </el-form-item>

          <el-form-item label="排序" prop="sortOrder">
            <el-input-number v-model="formData.sortOrder" :min="0" style="width: 100%" />
          </el-form-item>

          <el-form-item label="图标" prop="icon">
            <el-input
              v-model="formData.icon"
              placeholder="输入 Emoji 或图标字符"
              style="width: 100%"
            />
          </el-form-item>

          <el-form-item label="覆盖颜色" prop="coverColor">
            <el-color-picker
              :model-value="formData.coverColor"
              @update:model-value="(val) => {
                console.log('🎨 [PeriodsView] 颜色选择器值更新:', {
                  传入的值: val,
                  旧值: formData.coverColor
                });
                formData.coverColor = val;
              }"
              format="hex"
              style="width: 100%"
              @change="(val) => {
                console.log('🎨 [PeriodsView] 颜色选择器 @change 事件:', {
                  事件发出的值: val,
                  当前formData: formData.coverColor
                });
              }"
            />
          </el-form-item>

          <el-form-item label="腾讯会议号" prop="meetingId">
            <el-input
              v-model="formData.meetingId"
              placeholder="例：416 7154 0953"
              clearable
            />
            <div style="font-size: 12px; color: #909399; margin-top: 4px;">
              手机端继续使用会议号跳转腾讯会议小程序
            </div>
          </el-form-item>

          <el-form-item label="邀请链接" prop="meetingJoinUrl">
            <el-input
              v-model="formData.meetingJoinUrl"
              type="textarea"
              :rows="3"
              placeholder="可直接粘贴腾讯会议邀请链接，或整段“会议邀请信息”"
            />
            <div style="font-size: 12px; color: #909399; margin-top: 4px;">
              桌面端会优先用这个链接唤起腾讯会议客户端。支持粘贴完整邀请文本，保存时会自动提取链接。
            </div>
          </el-form-item>
        </el-form>

        <template #footer>
          <el-button @click="dialogVisible = false">取消</el-button>
          <el-button type="primary" :loading="submitting" @click="handleSubmit">
            {{ isEditMode ? '更新' : '创建' }}
          </el-button>
        </template>
      </el-dialog>

      <!-- 复制对话框 -->
      <el-dialog
        v-model="copyDialogVisible"
        title="复制期次"
        width="700px"
        @close="resetCopyForm"
      >
        <el-alert type="info" :closable="false" style="margin-bottom: 20px">
          注意：保存后将同时复制该期次下的所有课程内容
        </el-alert>
        <el-form ref="copyFormRef" :model="copyFormData" :rules="formRules" label-width="120px">
          <el-form-item label="期次名称" prop="name">
            <el-input v-model="copyFormData.name" placeholder="例：第一期" clearable />
          </el-form-item>

          <el-form-item label="副标题" prop="subtitle">
            <el-input v-model="copyFormData.subtitle" placeholder="可选的副标题" clearable />
          </el-form-item>

          <el-form-item label="标题" prop="title">
            <el-input v-model="copyFormData.title" placeholder="期次的完整标题" clearable />
          </el-form-item>

          <el-form-item label="描述" prop="description">
            <el-input
              v-model="copyFormData.description"
              type="textarea"
              placeholder="期次的详细描述"
              :rows="3"
            />
          </el-form-item>

          <el-form-item label="起始日期" prop="startDate">
            <el-date-picker
              v-model="copyFormData.startDate"
              type="date"
              placeholder="选择起始日期"
              style="width: 100%"
            />
          </el-form-item>

          <el-form-item label="结束日期" prop="endDate">
            <el-date-picker
              v-model="copyFormData.endDate"
              type="date"
              placeholder="选择结束日期"
              style="width: 100%"
            />
          </el-form-item>

          <el-form-item label="课程天数" prop="totalDays">
            <el-input-number v-model="copyFormData.totalDays" :min="1" :max="365" style="width: 100%" />
          </el-form-item>

          <el-form-item label="价格（分）" prop="price">
            <el-input-number v-model="copyFormData.price" :min="0" style="width: 100%" />
          </el-form-item>

          <el-form-item label="原价（分）" prop="originalPrice">
            <el-input-number v-model="copyFormData.originalPrice" :min="0" style="width: 100%" />
          </el-form-item>

          <el-form-item label="最大报名数" prop="maxEnrollment">
            <el-input-number
              v-model="copyFormData.maxEnrollment"
              :min="0"
              placeholder="不限制则留空"
              style="width: 100%"
            />
          </el-form-item>

          <el-form-item label="排序" prop="sortOrder">
            <el-input-number v-model="copyFormData.sortOrder" :min="0" style="width: 100%" />
          </el-form-item>

          <el-form-item label="图标" prop="icon">
            <el-input
              v-model="copyFormData.icon"
              placeholder="输入 Emoji 或图标字符"
              style="width: 100%"
            />
          </el-form-item>

          <el-form-item label="覆盖颜色" prop="coverColor">
            <el-color-picker
              v-model="copyFormData.coverColor"
              format="hex"
              style="width: 100%"
            />
          </el-form-item>
        </el-form>

        <template #footer>
          <el-button @click="copyDialogVisible = false">取消</el-button>
          <el-button type="primary" :loading="copyLoading" @click="submitCopyPeriod">
            保存并复制
          </el-button>
        </template>
      </el-dialog>
    </div>
  </AdminLayout>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted, watch } from 'vue';
import AdminLayout from '../components/AdminLayout.vue';
import { periodApi } from '../services/api';
import { ElMessage, ElMessageBox, type FormInstance } from 'element-plus';
import type { ListResponse, Period } from '../types/api';

const loading = ref(false);
const submitting = ref(false);
const syncingStatus = ref(false);
const publishingId = ref<string | null>(null);
const periods = ref<Period[]>([]);
const dialogVisible = ref(false);
const isEditMode = ref(false);
const currentEditId = ref<string | null>(null);
const formRef = ref<FormInstance>();
const copyDialogVisible = ref(false);
const copySourceId = ref<string | null>(null);
const copyFormRef = ref<FormInstance>();
const copyLoading = ref(false);

const pagination = ref({
  page: 1,
  pageSize: 20,
  total: 0
});

const formData = reactive({
  name: '',
  subtitle: '',
  title: '',
  description: '',
  icon: '📚',
  coverColor: '#4a90e2', // 改为单色而非渐变（颜色选择器支持单色）
  startDate: null,
  endDate: null,
  totalDays: 23,
  price: 9900, // 99 元默认价格
  originalPrice: 0,
  maxEnrollment: null,
  sortOrder: 0,
  meetingId: '',
  meetingJoinUrl: ''
});

const copyFormData = reactive({
  name: '',
  subtitle: '',
  title: '',
  description: '',
  icon: '📚',
  coverColor: '#4a90e2',
  startDate: null,
  endDate: null,
  totalDays: 23,
  price: 9900,
  originalPrice: 0,
  maxEnrollment: null,
  sortOrder: 0
});

const formRules = {
  name: [{ required: true, message: '期次名称不能为空', trigger: 'blur' }],
  title: [{ required: true, message: '标题不能为空', trigger: 'blur' }],
  startDate: [{ required: true, message: '起始日期不能为空', trigger: 'change' }],
  endDate: [{ required: true, message: '结束日期不能为空', trigger: 'change' }],
  totalDays: [{ required: true, message: '课程天数不能为空', trigger: 'blur' }]
};

// 监听 formData.coverColor 的变化
watch(
  () => formData.coverColor,
  (newVal, oldVal) => {
    console.log('👁️ [PeriodsView] 监听到 formData.coverColor 变化:', {
      旧值_oldVal: oldVal,
      新值_newVal: newVal,
      timestamp: new Date().toLocaleTimeString()
    });
  }
);

onMounted(() => {
  loadPeriods();
});

async function loadPeriods() {
  loading.value = true;
  try {
    console.log('[PeriodsView] ============ 开始加载期次列表 ============');
    console.log('[PeriodsView] 分页参数:', {
      page: pagination.value.page,
      pageSize: pagination.value.pageSize
    });

    const response = (await periodApi.getPeriods({
      page: pagination.value.page,
      limit: pagination.value.pageSize
    })) as unknown as any;

    console.log('[PeriodsView] API 返回的数据:', response);
    console.log('[PeriodsView] response 的类型:', typeof response);

    // 拦截器返回格式：{list: [...], data: [...], pagination: {...}, total: ..., page: ..., limit: ..., totalPages: ...}
    // 支持多种访问方式
    const itemList = response?.list || response?.data || (Array.isArray(response) ? response : []);
    periods.value = itemList;

    // 获取分页信息
    if (response && typeof response === 'object') {
      pagination.value.total = response.total || response.pagination?.total || 0;
      console.log('[PeriodsView] 分页信息 - total:', pagination.value.total);
    } else {
      pagination.value.total = 0;
    }

    console.log('[PeriodsView] ✅ 已赋值 periods.value');
    console.log('[PeriodsView] periods.value 长度:', periods.value.length);
    console.log('[PeriodsView] periods.value[0]:', periods.value[0]);
    console.log('[PeriodsView] 分页总数:', pagination.value.total);
    console.log('[PeriodsView] ============ 加载完成 ============');
  } catch (err: any) {
    console.error('[PeriodsView] ❌ 加载失败，错误详情:', err);
    console.error('[PeriodsView] 错误消息:', err.message);
    console.error('[PeriodsView] 错误堆栈:', err.stack);
    ElMessage.error('加载期次列表失败');
  } finally {
    loading.value = false;
  }
}

function handlePageSizeChange() {
  pagination.value.page = 1;
  loadPeriods();
}

function handleCreatePeriod() {
  isEditMode.value = false;
  currentEditId.value = null;
  resetForm();
  dialogVisible.value = true;
}

function handleEditPeriod(row: Period) {
  console.log('📝 [PeriodsView] 开始编辑期次:');
  console.log('[PeriodsView] 从列表中取出的数据:', {
    id: row._id,
    name: row.name,
    coverColor: row.coverColor,
    icon: row.icon
  });

  isEditMode.value = true;
  currentEditId.value = row._id;
  Object.assign(formData, {
    name: row.name,
    subtitle: row.subtitle,
    title: row.title,
    description: row.description,
    icon: row.icon,
    coverColor: row.coverColor,
    startDate: row.startDate ? new Date(row.startDate) : null,
    endDate: row.endDate ? new Date(row.endDate) : null,
    totalDays: row.totalDays,
    price: row.price,
    originalPrice: row.originalPrice,
    maxEnrollment: row.maxEnrollment,
    sortOrder: row.sortOrder,
    meetingId: row.meetingId || '',
    meetingJoinUrl: row.meetingJoinUrl || ''
  });

  console.log('[PeriodsView] 表单已初始化，当前 formData.coverColor:', formData.coverColor);
  dialogVisible.value = true;
}

async function handleSubmit() {
  if (!formRef.value) return;

  await formRef.value.validate(async valid => {
    if (!valid) return;

    submitting.value = true;
    try {
      console.log('🔍 [PeriodsView] 发送前的 formData 状态:', {
        coverColor: formData.coverColor,
        name: formData.name,
        icon: formData.icon
      });

      // 清洗会议号：提取纯数字（支持 "#腾讯会议：416-7154-0953" 等各种格式）
      let cleanMeetingId = formData.meetingId || '';
      if (cleanMeetingId) {
        cleanMeetingId = cleanMeetingId.replace(/[^\d]/g, ''); // 只保留数字
        if (!cleanMeetingId) cleanMeetingId = ''; // 如果没有数字，置空
      }

      const cleanMeetingJoinUrl = extractMeetingJoinUrl(formData.meetingJoinUrl);
      const fallbackMeetingId = extractMeetingId(formData.meetingJoinUrl);
      if (!cleanMeetingId && fallbackMeetingId) {
        cleanMeetingId = fallbackMeetingId;
      }

      const payload = {
        ...formData,
        meetingId: cleanMeetingId || null,
        meetingJoinUrl: cleanMeetingJoinUrl || null,
        startDate: formData.startDate ? new Date(formData.startDate).toISOString() : null,
        endDate: formData.endDate ? new Date(formData.endDate).toISOString() : null
      };

      console.log('📤 [PeriodsView] 发送的 payload:', {
        id: currentEditId.value,
        coverColor: payload.coverColor,
        name: payload.name,
        icon: payload.icon,
        formDataColor: formData.coverColor
      });

      if (isEditMode.value && currentEditId.value) {
        const updateResponse = await periodApi.updatePeriod(currentEditId.value, payload);
        console.log('✅ [PeriodsView] 更新响应数据:', {
          id: updateResponse?.data?._id || updateResponse?._id,
          name: updateResponse?.data?.name || updateResponse?.name,
          coverColor: updateResponse?.data?.coverColor || updateResponse?.coverColor,
          message: updateResponse?.message
        });
        ElMessage.success('期次更新成功');
      } else {
        const createResponse = await periodApi.createPeriod(payload);
        console.log('✅ [PeriodsView] 创建响应数据:', {
          id: createResponse?.data?._id || createResponse?._id,
          name: createResponse?.data?.name || createResponse?.name,
          coverColor: createResponse?.data?.coverColor || createResponse?.coverColor
        });
        ElMessage.success('期次创建成功');
      }

      console.log('🔄 [PeriodsView] 关闭对话框，重新加载列表...');
      dialogVisible.value = false;
      await loadPeriods();

      console.log('✅ [PeriodsView] 列表已重新加载，当前列表数据:');
      const updatedPeriodInList = periods.value.find(p => p._id === currentEditId.value);
      console.log('[PeriodsView] 更新的期次在列表中的数据:',
        updatedPeriodInList ?
          {
            name: updatedPeriodInList.name,
            coverColor: updatedPeriodInList.coverColor,
            color: updatedPeriodInList.color
          } :
          '未找到'
      );
      console.log('[PeriodsView] 完整的 periods.value[0]:', periods.value[0] ? {
        name: periods.value[0].name,
        coverColor: periods.value[0].coverColor,
        color: periods.value[0].color
      } : 'N/A');
    } catch (err: any) {
      console.error('❌ [PeriodsView] 操作失败:', err);
      ElMessage.error(err.message || '操作失败');
    } finally {
      submitting.value = false;
    }
  });
}

function handleCopyPeriod(row: Period) {
  copySourceId.value = row._id;
  Object.assign(copyFormData, {
    name: `${row.name} (复制)`,
    subtitle: row.subtitle,
    title: row.title,
    description: row.description,
    icon: row.icon,
    coverColor: row.coverColor,
    startDate: row.startDate ? new Date(row.startDate) : null,
    endDate: row.endDate ? new Date(row.endDate) : null,
    totalDays: row.totalDays,
    price: row.price,
    originalPrice: row.originalPrice,
    maxEnrollment: row.maxEnrollment,
    sortOrder: row.sortOrder
  });
  copyDialogVisible.value = true;
}

async function submitCopyPeriod() {
  if (!copyFormRef.value) return;

  await copyFormRef.value.validate(async valid => {
    if (!valid) return;

    copyLoading.value = true;
    try {
      const payload = {
        ...copyFormData,
        startDate: copyFormData.startDate ? new Date(copyFormData.startDate).toISOString() : null,
        endDate: copyFormData.endDate ? new Date(copyFormData.endDate).toISOString() : null
      };

      const response = await periodApi.copyPeriod(copySourceId.value!, payload);
      const copiedCount = response?.copiedSectionCount || 0;
      ElMessage.success(`期次复制成功，已复制 ${copiedCount} 节课程`);

      copyDialogVisible.value = false;
      await loadPeriods();
    } catch (err: any) {
      ElMessage.error(err.message || '复制失败');
    } finally {
      copyLoading.value = false;
    }
  });
}

function resetCopyForm() {
  copyFormData.name = '';
  copyFormData.subtitle = '';
  copyFormData.title = '';
  copyFormData.description = '';
  copyFormData.icon = '📚';
  copyFormData.coverColor = '#4a90e2';
  copyFormData.startDate = null;
  copyFormData.endDate = null;
  copyFormData.totalDays = 23;
  copyFormData.price = 9900;
  copyFormData.originalPrice = 0;
  copyFormData.maxEnrollment = null;
  copyFormData.sortOrder = 0;
  copyFormRef.value?.clearValidate();
}

function handleDeletePeriod(row: Period) {
  ElMessageBox.confirm('删除后无法恢复，确定要删除该期次吗？', '警告', {
    confirmButtonText: '确定',
    cancelButtonText: '取消',
    type: 'warning'
  })
    .then(async () => {
      try {
        await periodApi.deletePeriod(row._id);
        ElMessage.success('期次删除成功');
        await loadPeriods();
      } catch (err: any) {
        ElMessage.error(err.message || '删除失败');
      }
    })
    .catch(() => {
      // 用户取消
    });
}

async function handlePublishChange(row: Period) {
  publishingId.value = row._id;
  try {
    await periodApi.updatePeriod(row._id, { isPublished: row.isPublished });
    ElMessage.success(row.isPublished ? '期次已发布' : '期次已下线');
  } catch (err: any) {
    ElMessage.error(err.message || '操作失败');
    row.isPublished = !row.isPublished;
  } finally {
    publishingId.value = null;
  }
}

function handleRefresh() {
  loadPeriods();
  ElMessage.success('已刷新');
}

async function handleSyncStatus() {
  try {
    await ElMessageBox.confirm(
      '将根据每个期次的开始/结束日期，重新计算并写回 status 字段（未开始 / 进行中 / 已完成）。确定继续吗？',
      '更新期次状态',
      {
        confirmButtonText: '开始更新',
        cancelButtonText: '取消',
        type: 'info'
      }
    );

    syncingStatus.value = true;
    const result: any = await periodApi.syncAllPeriodsStatus();
    const updated = result?.updatedCount ?? 0;
    const total = result?.totalPeriods ?? 0;
    ElMessage.success(`同步完成：扫描 ${total} 个期次，更新 ${updated} 个状态`);
    loadPeriods();
  } catch (err: any) {
    if (err === 'cancel') return;
    ElMessage.error(err?.message || '同步失败');
    console.error(err);
  } finally {
    syncingStatus.value = false;
  }
}

function resetForm() {
  formData.name = '';
  formData.subtitle = '';
  formData.title = '';
  formData.description = '';
  formData.icon = '📚';
  formData.coverColor = '#4a90e2';
  formData.startDate = null;
  formData.endDate = null;
  formData.totalDays = 23;
  formData.price = 9900;
  formData.originalPrice = 0;
  formData.maxEnrollment = null;
  formData.sortOrder = 0;
  formData.meetingId = '';
  formData.meetingJoinUrl = '';
  formRef.value?.clearValidate();
}

function extractMeetingJoinUrl(rawValue: string | null | undefined): string {
  if (!rawValue) return '';

  const text = rawValue.trim();
  const match = text.match(/https:\/\/(?:meeting\.tencent\.com|wemeet\.qq\.com|voovmeeting\.com)\/[^\s)）]+/i);
  return match ? match[0] : '';
}

function extractMeetingId(rawValue: string | null | undefined): string {
  if (!rawValue) return '';

  const text = rawValue.replace(/[^\d]/g, '');
  return text || '';
}

function formatDateRange(startDate: string, endDate: string): string {
  if (!startDate || !endDate) return '-';
  const start = new Date(startDate).toLocaleDateString('zh-CN');
  const end = new Date(endDate).toLocaleDateString('zh-CN');
  return `${start} 至 ${end}`;
}

function formatStatus(status: string): string {
  const statusMap: Record<string, string> = {
    not_started: '未开始',
    ongoing: '进行中',
    completed: '已完成'
  };
  return statusMap[status] || status;
}

function getStatusType(status: string): string {
  const typeMap: Record<string, string> = {
    not_started: 'info',
    ongoing: 'success',
    completed: 'danger'
  };
  return typeMap[status] || 'info';
}
</script>

<style scoped>
.periods-container {
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

/* 统一表格行高 */
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
