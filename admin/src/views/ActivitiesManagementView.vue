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
          <el-table-column label="标题" min-width="220">
            <template #default="{ row }">
              <div class="title-cell">
                <span>{{ row.title }}</span>
                <el-tag v-if="row.registrationForm?.enabled" size="small" type="warning">表单</el-tag>
              </div>
            </template>
          </el-table-column>
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
          <el-table-column label="价格" width="100">
            <template #default="{ row }">
              <span v-if="row.isPaid">¥{{ (row.price / 100).toFixed(2) }}</span>
              <el-tag v-else type="success" size="small">免费</el-tag>
            </template>
          </el-table-column>
          <el-table-column label="可见范围" width="100">
            <template #default="{ row }">
              <el-tag v-if="row.visibilityType === 'specific'" type="warning" size="small">指定用户</el-tag>
              <span v-else style="color: #909399; font-size: 12px;">全部</span>
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
              <el-option label="料理人生" value="cooking" />
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

          <el-form-item label="是否付费" prop="isPaid">
            <el-switch v-model="formData.isPaid" active-text="付费" inactive-text="免费" />
          </el-form-item>
          <el-form-item v-if="formData.isPaid" label="活动价格" prop="priceYuan">
            <el-input-number
              v-model="formData.priceYuan"
              :min="0"
              :precision="2"
              :step="1"
              style="width: 200px"
            />
            <span style="margin-left: 8px; color: #909399;">元</span>
          </el-form-item>

          <el-form-item label="报名表单">
            <div class="registration-form-panel">
              <div class="registration-form-head">
                <div>
                  <div class="form-section-title">收集报名信息</div>
                  <div class="form-section-desc">用户报名时按这里配置的字段填写，答案会保存在报名名单里。</div>
                </div>
                <el-switch
                  v-model="formData.registrationForm.enabled"
                  active-text="开启"
                  inactive-text="关闭"
                  @change="handleRegistrationFormToggle"
                />
              </div>

              <template v-if="formData.registrationForm.enabled">
                <div class="form-toolbar">
                  <el-button type="primary" size="small" @click="handleAddFormField">添加字段</el-button>
                  <el-button size="small" @click="formPreviewVisible = true">预览表单</el-button>
                </div>

                <div v-if="formData.registrationForm.fields.length === 0" class="empty-form-tip">
                  还没有字段，请先添加字段。
                </div>
                <div v-else class="field-list">
                  <div
                    v-for="(field, index) in sortedRegistrationFields"
                    :key="field.fieldId"
                    class="field-row"
                  >
                    <span class="field-order">{{ index + 1 }}</span>
                    <div class="field-main">
                      <div class="field-title-row">
                        <span class="field-label">{{ field.label }}</span>
                        <el-tag size="small">{{ formatFieldType(field.type) }}</el-tag>
                        <el-tag v-if="field.required" type="danger" size="small">必填</el-tag>
                      </div>
                      <div v-if="field.options?.length" class="field-options">
                        {{ field.options.map(option => option.label).join(' / ') }}
                      </div>
                    </div>
                    <div class="field-actions">
                      <el-button text size="small" :disabled="index === 0" @click="moveFormField(index, -1)">上移</el-button>
                      <el-button text size="small" :disabled="index === formData.registrationForm.fields.length - 1" @click="moveFormField(index, 1)">下移</el-button>
                      <el-button text type="primary" size="small" @click="handleEditFormField(field)">编辑</el-button>
                      <el-button text type="danger" size="small" @click="removeFormField(field.fieldId)">删除</el-button>
                    </div>
                  </div>
                </div>
              </template>
            </div>
          </el-form-item>

          <el-form-item label="可见范围" prop="visibilityType">
            <el-radio-group v-model="formData.visibilityType">
              <el-radio value="all">全部用户</el-radio>
              <el-radio value="specific">指定用户</el-radio>
            </el-radio-group>
            <div style="font-size: 12px; color: #909399; margin-top: 4px;">
              指定用户模式下，只有名单内的用户才能看到此活动
            </div>
          </el-form-item>

          <el-form-item v-if="formData.visibilityType === 'specific'" label="指定用户">
            <div style="width: 100%">
              <el-select
                :model-value="formData.visibleUserIds"
                multiple
                filterable
                remote
                reserve-keyword
                placeholder="搜索用户昵称或用户ID"
                :remote-method="handleUserSearch"
                :loading="userSearchLoading"
                style="width: 100%"
                @change="handleVisibleUserChange"
              >
                <el-option
                  v-for="user in userSearchResults"
                  :key="user._id"
                  :value="user._id"
                  :label="user.nickname"
                >
                  <div style="display: flex; align-items: center; gap: 8px;">
                    <img
                      v-if="user.avatarUrl"
                      :src="user.avatarUrl"
                      style="width: 24px; height: 24px; border-radius: 50%; object-fit: cover;"
                    />
                    <span v-else style="width: 24px; height: 24px; border-radius: 50%; background: #e4e7ed; display: inline-flex; align-items: center; justify-content: center; font-size: 12px;">👤</span>
                    <span>{{ user.nickname }}</span>
                    <span style="color: #909399; font-size: 11px;">{{ user._id }}</span>
                  </div>
                </el-option>
              </el-select>
              <el-table
                v-if="formData.visibleUsers.length > 0"
                :data="formData.visibleUsers"
                size="small"
                style="margin-top: 10px; width: 100%"
                border
              >
                <el-table-column label="头像" width="60">
                  <template #default="{ row }">
                    <img
                      v-if="row.avatarUrl"
                      :src="row.avatarUrl"
                      style="width: 32px; height: 32px; border-radius: 50%; object-fit: cover;"
                    />
                    <span v-else style="width: 32px; height: 32px; border-radius: 50%; background: #e4e7ed; display: inline-flex; align-items: center; justify-content: center; font-size: 14px;">👤</span>
                  </template>
                </el-table-column>
                <el-table-column prop="nickname" label="昵称" min-width="100" />
                <el-table-column prop="_id" label="用户ID" min-width="180">
                  <template #default="{ row }">
                    <span style="font-size: 11px; color: #909399; font-family: monospace;">{{ row._id }}</span>
                  </template>
                </el-table-column>
                <el-table-column label="操作" width="70">
                  <template #default="{ row }">
                    <el-button type="danger" text size="small" @click="removeVisibleUser(row._id)">移除</el-button>
                  </template>
                </el-table-column>
              </el-table>
            </div>
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

      <!-- 字段编辑弹窗 -->
      <el-dialog v-model="fieldDialogVisible" :title="editingFieldId ? '编辑字段' : '添加字段'" width="520px">
        <el-form label-width="90px">
          <el-form-item label="字段名称">
            <el-input v-model="fieldForm.label" maxlength="40" placeholder="例如：所在城市" show-word-limit />
          </el-form-item>
          <el-form-item label="字段类型">
            <el-select v-model="fieldForm.type" style="width: 100%" @change="handleFieldTypeChange">
              <el-option label="单行文本" value="text" />
              <el-option label="多行文本" value="textarea" />
              <el-option label="数字" value="number" />
              <el-option label="手机号" value="phone" />
              <el-option label="单选" value="single_select" />
              <el-option label="多选" value="multi_select" />
              <el-option label="日期" value="date" />
              <el-option label="是/否" value="boolean" />
            </el-select>
          </el-form-item>
          <el-form-item label="提示文案">
            <el-input v-model="fieldForm.placeholder" maxlength="80" placeholder="填写时显示的提示" show-word-limit />
          </el-form-item>
          <el-form-item label="设置">
            <div class="field-setting-row">
              <el-checkbox v-model="fieldForm.required">必填</el-checkbox>
            </div>
          </el-form-item>
          <el-form-item v-if="isSelectField(fieldForm.type)" label="选项">
            <div class="option-editor">
              <div v-for="(option, index) in fieldForm.options" :key="option.optionId" class="option-row">
                <el-input v-model="option.label" maxlength="40" placeholder="选项名称" />
                <el-button text :disabled="index === 0" @click="moveOption(index, -1)">上移</el-button>
                <el-button text :disabled="index === fieldForm.options.length - 1" @click="moveOption(index, 1)">下移</el-button>
                <el-button text type="danger" @click="removeOption(option.optionId)">删除</el-button>
              </div>
              <el-button size="small" @click="addOption">添加选项</el-button>
            </div>
          </el-form-item>
        </el-form>
        <template #footer>
          <el-button @click="fieldDialogVisible = false">取消</el-button>
          <el-button type="primary" @click="saveFormField">保存字段</el-button>
        </template>
      </el-dialog>

      <!-- 表单预览弹窗 -->
      <el-dialog v-model="formPreviewVisible" title="表单预览" width="520px">
        <div v-if="sortedRegistrationFields.length === 0" class="empty-form-tip">暂无字段</div>
        <div v-else class="form-preview-list">
          <div v-for="field in sortedRegistrationFields" :key="field.fieldId" class="preview-field">
            <div class="preview-label">
              {{ field.label }}
              <span v-if="field.required" class="required-mark">*</span>
            </div>
            <div class="preview-control">{{ getPreviewText(field) }}</div>
          </div>
        </div>
      </el-dialog>

      <!-- 报名名单弹窗 -->
      <el-dialog v-model="registrationsVisible" title="报名名单" width="960px">
        <el-tabs v-model="registrationsTab">
          <el-tab-pane label="名单" name="list">
            <el-table
              v-loading="registrationsLoading"
              :data="registrations"
              stripe
              style="width: 100%"
              @row-click="handleSelectRegistration"
            >
              <el-table-column label="头像" width="70">
                <template #default="{ row }">
                  <el-avatar :src="row.userId?.avatarUrl || row.userId?.avatar" :size="36">
                    <span style="font-size: 18px">👤</span>
                  </el-avatar>
                </template>
              </el-table-column>
              <el-table-column label="昵称" min-width="120">
                <template #default="{ row }">
                  {{ row.userId?.nickname || row.user?.nickname || '微信用户' }}
                </template>
              </el-table-column>
              <el-table-column label="报名信息" min-width="240">
                <template #default="{ row }">
                  <div v-if="row.formAnswers?.length" class="answer-chip-list">
                    <el-tag
                      v-for="answer in row.formAnswers.slice(0, 3)"
                      :key="answer.fieldId"
                      size="small"
                      type="info"
                    >
                      {{ answer.label }}：{{ answer.valueText || '-' }}
                    </el-tag>
                    <el-tag v-if="row.formAnswers.length > 3" size="small" type="info">
                      +{{ row.formAnswers.length - 3 }}
                    </el-tag>
                  </div>
                  <span v-else class="muted-text">未填写</span>
                </template>
              </el-table-column>
              <el-table-column label="支付" width="100">
                <template #default="{ row }">
                  {{ formatRegistrationPayment(row) }}
                </template>
              </el-table-column>
              <el-table-column label="报名时间" width="180">
                <template #default="{ row }">
                  {{ formatDatetime(row.registeredAt || row.createdAt) }}
                </template>
              </el-table-column>
            </el-table>

            <div v-if="selectedRegistration" class="registration-detail-panel">
              <div class="detail-title">报名详情：{{ selectedRegistration.userId?.nickname || '微信用户' }}</div>
              <div v-if="selectedRegistration.formAnswers?.length" class="detail-answer-list">
                <div v-for="answer in selectedRegistration.formAnswers" :key="answer.fieldId" class="detail-answer-row">
                  <span>{{ answer.label }}</span>
                  <strong>{{ answer.valueText || '-' }}</strong>
                </div>
              </div>
              <div v-else class="muted-text">未填写报名表单</div>
            </div>
          </el-tab-pane>
          <el-tab-pane label="统计" name="stats">
            <div v-if="formStats.length === 0" class="empty-form-tip">暂无统计数据</div>
            <div v-else class="stats-list">
              <div v-for="field in formStats" :key="field.fieldId" class="stats-card">
                <div class="stats-title">{{ field.label }}</div>
                <div v-for="option in field.options" :key="option.optionId" class="stats-row">
                  <span>{{ option.label }}</span>
                  <strong>{{ option.count }} 人</strong>
                </div>
              </div>
            </div>
          </el-tab-pane>
        </el-tabs>
        <template #footer>
          <el-button @click="registrationsVisible = false">关闭</el-button>
        </template>
      </el-dialog>
    </div>
  </AdminLayout>
</template>

<script setup lang="ts">
// @ts-nocheck
import { ref, reactive, computed, onMounted } from 'vue';
import AdminLayout from '../components/AdminLayout.vue';
import RichTextEditor from '../components/RichTextEditor.vue';
import { ElMessage, ElMessageBox, type FormInstance } from 'element-plus';
import apiClient, { uploadApi, userApi } from '../services/api';

const BASE_URL = 'admin/community-activities';

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
const registrationsTab = ref('list');
const formStats = ref<any[]>([]);
const selectedRegistration = ref<any | null>(null);
const posterUploading = ref(false);
const userSearchLoading = ref(false);
const userSearchResults = ref<any[]>([]);
const fieldDialogVisible = ref(false);
const formPreviewVisible = ref(false);
const editingFieldId = ref<string | null>(null);

const pagination = ref({ page: 1, pageSize: 20, total: 0 });

const fieldForm = reactive({
  fieldId: '',
  label: '',
  type: 'text',
  required: false,
  placeholder: '',
  includeInStats: false,
  options: [] as any[],
  sortOrder: 0
});

const formData = reactive({
  title: '',
  type: 'witness',
  posterUrl: '',
  startTime: null,
  endTime: null,
  description: '',
  meetingId: '',
  meetingJoinUrl: '',
  isPaid: false,
  priceYuan: 0,
  maxParticipants: 0,
  showPopup: false,
  popupStartTime: null,
  popupEndTime: null,
  status: 'draft',
  visibilityType: 'all',
  visibleUserIds: [] as string[],
  visibleUsers: [] as any[],
  registrationForm: {
    enabled: false,
    fields: [] as any[]
  }
});

const formRules = {
  title: [{ required: true, message: '标题不能为空', trigger: 'blur' }],
  type: [{ required: true, message: '请选择活动类型', trigger: 'change' }],
  startTime: [{ required: true, message: '请选择开始时间', trigger: 'change' }]
};

onMounted(() => {
  loadActivities();
});

const sortedRegistrationFields = computed(() => {
  return [...(formData.registrationForm.fields || [])].sort((a: any, b: any) => {
    return Number(a.sortOrder || 0) - Number(b.sortOrder || 0);
  });
});

function createLocalId(prefix: string) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function cloneRegistrationForm(form: any = {}) {
  const enabled = !!form.enabled;
  const fields = Array.isArray(form.fields) ? form.fields : [];
  return {
    enabled,
    fields: fields.map((field: any, index: number) => ({
      fieldId: field.fieldId || createLocalId('f'),
      label: field.label || '',
      type: field.type || 'text',
      required: !!field.required,
      placeholder: field.placeholder || '',
      includeInStats: canFieldTypeStats(field.type) ? !!field.includeInStats : false,
      options: Array.isArray(field.options)
        ? field.options.map((option: any) => ({
          optionId: option.optionId || createLocalId('o'),
          label: option.label || ''
        }))
        : [],
      sortOrder: Number.isFinite(Number(field.sortOrder)) ? Number(field.sortOrder) : index
    })).sort((a: any, b: any) => a.sortOrder - b.sortOrder).map((field: any, index: number) => ({
      ...field,
      sortOrder: index
    }))
  };
}

function buildRegistrationFormPayload() {
  const fields = sortedRegistrationFields.value.map((field: any, index: number) => ({
    fieldId: field.fieldId,
    label: String(field.label || '').trim(),
    type: field.type,
    required: !!field.required,
    placeholder: String(field.placeholder || '').trim(),
    includeInStats: canFieldTypeStats(field.type) ? !!field.includeInStats : false,
    options: isSelectField(field.type)
      ? (field.options || []).map((option: any) => ({
        optionId: option.optionId,
        label: String(option.label || '').trim()
      }))
      : [],
    sortOrder: index
  }));
  return {
    enabled: !!formData.registrationForm.enabled,
    fields: formData.registrationForm.enabled ? fields : []
  };
}

function validateRegistrationFormBeforeSubmit() {
  if (!formData.registrationForm.enabled) return true;
  const form = buildRegistrationFormPayload();
  if (form.fields.length === 0) {
    ElMessage.warning('请至少添加一个报名表单字段');
    return false;
  }
  const invalidField = form.fields.find((field: any) => !field.label);
  if (invalidField) {
    ElMessage.warning('报名表单字段名称不能为空');
    return false;
  }
  const invalidSelect = form.fields.find((field: any) => (
    isSelectField(field.type) &&
    (!field.options.length || field.options.some((option: any) => !option.label))
  ));
  if (invalidSelect) {
    ElMessage.warning('单选或多选字段需要填写完整选项');
    return false;
  }
  return true;
}

async function loadActivities() {
  loading.value = true;
  try {
    const data = await apiClient.get(BASE_URL, {
      params: { page: pagination.value.page, pageSize: pagination.value.pageSize }
    });
    activities.value = data?.list ?? (Array.isArray(data) ? data : []);
    pagination.value.total = data?.total ?? 0;
  } catch (err: any) {
    ElMessage.error(err?.message || '加载活动列表失败');
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
    status: row.status ?? 'draft',
    isPaid: row.isPaid || false,
    priceYuan: row.price ? row.price / 100 : 0,
    visibilityType: row.visibilityType || 'all',
    visibleUserIds: (row.visibleUsers || []).map((u: any) => u._id || u),
    visibleUsers: row.visibleUsers || [],
    registrationForm: cloneRegistrationForm(row.registrationForm)
  });
  dialogVisible.value = true;
}

async function handleSubmit() {
  if (!formRef.value) return;
  await formRef.value.validate(async (valid) => {
    if (!valid) return;
    if (!validateRegistrationFormBeforeSubmit()) return;
    submitting.value = true;
    try {
      const payload = {
        ...formData,
        startTime: formData.startTime ? new Date(formData.startTime).toISOString() : null,
        endTime: formData.endTime ? new Date(formData.endTime).toISOString() : null,
        popupStartTime: formData.popupStartTime ? new Date(formData.popupStartTime).toISOString() : null,
        popupEndTime: formData.popupEndTime ? new Date(formData.popupEndTime).toISOString() : null,
        isPaid: formData.isPaid,
        price: formData.isPaid ? Math.round(formData.priceYuan * 100) : 0,
        visibilityType: formData.visibilityType,
        visibleUserIds: formData.visibilityType === 'specific' ? formData.visibleUserIds : [],
        registrationForm: buildRegistrationFormPayload()
      };
      if (isEditMode.value && currentEditId.value) {
        await apiClient.put(`${BASE_URL}/${currentEditId.value}`, payload);
        ElMessage.success('活动更新成功');
      } else {
        await apiClient.post(BASE_URL, payload);
        ElMessage.success('活动创建成功');
      }
      dialogVisible.value = false;
      await loadActivities();
    } catch (err: any) {
      ElMessage.error(err?.message || '操作失败');
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
      await apiClient.delete(`${BASE_URL}/${row._id}`);
      ElMessage.success('活动删除成功');
      await loadActivities();
    } catch (err: any) {
      ElMessage.error(err?.message || '删除失败');
    }
  }).catch(() => {});
}

async function handleViewRegistrations(row: any) {
  registrationsVisible.value = true;
  registrationsLoading.value = true;
  registrations.value = [];
  formStats.value = [];
  selectedRegistration.value = null;
  registrationsTab.value = 'list';
  try {
    const data = await apiClient.get(`${BASE_URL}/${row._id}/registrations`);
    registrations.value = Array.isArray(data) ? data : (data?.list ?? []);
    formStats.value = data?.formStats || [];
  } catch (err: any) {
    ElMessage.error(err?.message || '加载报名名单失败');
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
  formData.isPaid = false;
  formData.priceYuan = 0;
  formData.maxParticipants = 0;
  formData.showPopup = false;
  formData.popupStartTime = null;
  formData.popupEndTime = null;
  formData.status = 'draft';
  formData.visibilityType = 'all';
  formData.visibleUserIds = [];
  formData.visibleUsers = [];
  formData.registrationForm = { enabled: false, fields: [] };
  userSearchResults.value = [];
  formRef.value?.clearValidate();
}

let userSearchTimer: ReturnType<typeof setTimeout> | null = null;
async function handleUserSearch(query: string) {
  if (!query.trim()) {
    userSearchResults.value = [];
    return;
  }
  if (userSearchTimer) clearTimeout(userSearchTimer);
  userSearchTimer = setTimeout(async () => {
    userSearchLoading.value = true;
    try {
      const res = await userApi.adminSearch(query.trim()) as any;
      userSearchResults.value = res?.list || [];
    } catch {
      userSearchResults.value = [];
    } finally {
      userSearchLoading.value = false;
    }
  }, 300);
}

function handleVisibleUserChange(selectedIds: string[]) {
  formData.visibleUserIds = selectedIds;
  formData.visibleUsers = selectedIds.map(id => {
    const found = userSearchResults.value.find((u: any) => u._id === id);
    return found || formData.visibleUsers.find((u: any) => u._id === id) || { _id: id };
  });
}

function removeVisibleUser(userId: string) {
  formData.visibleUserIds = formData.visibleUserIds.filter(id => id !== userId);
  formData.visibleUsers = formData.visibleUsers.filter((u: any) => u._id !== userId);
}

function isSelectField(type: string): boolean {
  return ['single_select', 'multi_select'].includes(type);
}

function canFieldTypeStats(type: string): boolean {
  return ['single_select', 'multi_select', 'boolean'].includes(type);
}

function formatFieldType(type: string): string {
  const map: Record<string, string> = {
    text: '单行文本',
    textarea: '多行文本',
    number: '数字',
    phone: '手机号',
    single_select: '单选',
    multi_select: '多选',
    date: '日期',
    boolean: '是/否'
  };
  return map[type] || type;
}

function handleRegistrationFormToggle(enabled: boolean) {
  if (enabled && formData.registrationForm.fields.length === 0) {
    handleAddFormField();
  }
}

function resetFieldForm(field?: any) {
  Object.assign(fieldForm, {
    fieldId: field?.fieldId || createLocalId('f'),
    label: field?.label || '',
    type: field?.type || 'text',
    required: !!field?.required,
    placeholder: field?.placeholder || '',
    includeInStats: canFieldTypeStats(field?.type || 'text') ? !!field?.includeInStats : false,
    options: Array.isArray(field?.options)
      ? field.options.map((option: any) => ({
        optionId: option.optionId || createLocalId('o'),
        label: option.label || ''
      }))
      : [],
    sortOrder: Number.isFinite(Number(field?.sortOrder)) ? Number(field.sortOrder) : formData.registrationForm.fields.length
  });
  if (isSelectField(fieldForm.type) && fieldForm.options.length === 0) {
    fieldForm.options = [
      { optionId: createLocalId('o'), label: '选项一' },
      { optionId: createLocalId('o'), label: '选项二' }
    ];
  }
}

function handleAddFormField() {
  editingFieldId.value = null;
  resetFieldForm();
  fieldDialogVisible.value = true;
}

function handleEditFormField(field: any) {
  editingFieldId.value = field.fieldId;
  resetFieldForm(field);
  fieldDialogVisible.value = true;
}

function handleFieldTypeChange(type: string) {
  if (isSelectField(type)) {
    if (fieldForm.options.length === 0) {
      fieldForm.options = [
        { optionId: createLocalId('o'), label: '选项一' },
        { optionId: createLocalId('o'), label: '选项二' }
      ];
    }
  } else {
    fieldForm.options = [];
  }
  if (!canFieldTypeStats(type)) {
    fieldForm.includeInStats = false;
  }
}

function addOption() {
  fieldForm.options.push({ optionId: createLocalId('o'), label: '' });
}

function removeOption(optionId: string) {
  fieldForm.options = fieldForm.options.filter((option: any) => option.optionId !== optionId);
}

function moveOption(index: number, direction: number) {
  const nextIndex = index + direction;
  if (nextIndex < 0 || nextIndex >= fieldForm.options.length) return;
  const options = [...fieldForm.options];
  [options[index], options[nextIndex]] = [options[nextIndex], options[index]];
  fieldForm.options = options;
}

function saveFormField() {
  const label = String(fieldForm.label || '').trim();
  if (!label) {
    ElMessage.warning('字段名称不能为空');
    return;
  }
  if (isSelectField(fieldForm.type)) {
    const validOptions = fieldForm.options
      .map((option: any) => ({ ...option, label: String(option.label || '').trim() }))
      .filter((option: any) => option.label);
    if (validOptions.length === 0) {
      ElMessage.warning('请至少填写一个选项');
      return;
    }
    fieldForm.options = validOptions;
  }
  const field = {
    fieldId: fieldForm.fieldId,
    label,
    type: fieldForm.type,
    required: !!fieldForm.required,
    placeholder: String(fieldForm.placeholder || '').trim(),
    includeInStats: canFieldTypeStats(fieldForm.type) ? !!fieldForm.includeInStats : false,
    options: isSelectField(fieldForm.type) ? [...fieldForm.options] : [],
    sortOrder: fieldForm.sortOrder
  };
  if (editingFieldId.value) {
    formData.registrationForm.fields = formData.registrationForm.fields.map((item: any) => (
      item.fieldId === editingFieldId.value ? field : item
    ));
  } else {
    formData.registrationForm.fields.push(field);
  }
  formData.registrationForm.fields = sortedRegistrationFields.value.map((item: any, index: number) => ({
    ...item,
    sortOrder: index
  }));
  fieldDialogVisible.value = false;
}

function removeFormField(fieldId: string) {
  formData.registrationForm.fields = formData.registrationForm.fields
    .filter((field: any) => field.fieldId !== fieldId)
    .map((field: any, index: number) => ({ ...field, sortOrder: index }));
}

function moveFormField(index: number, direction: number) {
  const fields = sortedRegistrationFields.value.slice();
  const nextIndex = index + direction;
  if (nextIndex < 0 || nextIndex >= fields.length) return;
  [fields[index], fields[nextIndex]] = [fields[nextIndex], fields[index]];
  formData.registrationForm.fields = fields.map((field: any, order: number) => ({
    ...field,
    sortOrder: order
  }));
}

function getPreviewText(field: any): string {
  if (field.placeholder) return field.placeholder;
  if (isSelectField(field.type) && field.options?.length) {
    return field.options.map((option: any) => option.label).join(' / ');
  }
  if (field.type === 'boolean') return '是 / 否';
  return `请输入${field.label}`;
}

function formatRegistrationPayment(row: any): string {
  const map: Record<string, string> = {
    free: '免费',
    pending: '待支付',
    paid: '已支付'
  };
  return map[row.paymentStatus] || row.paymentStatus || '-';
}

function handleSelectRegistration(row: any) {
  selectedRegistration.value = row;
}

function formatType(type: string): string {
  const map: Record<string, string> = { witness: '见证会', chat: '聊天局', cooking: '料理人生', other: '其他' };
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

.title-cell {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.registration-form-panel {
  width: 100%;
  border: 1px solid #e4e7ed;
  border-radius: 6px;
  padding: 14px;
  box-sizing: border-box;
}

.registration-form-head,
.field-row,
.option-row,
.stats-row,
.detail-answer-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.form-section-title {
  font-size: 14px;
  font-weight: 600;
  color: #303133;
}

.form-section-desc,
.muted-text {
  color: #909399;
  font-size: 12px;
}

.form-toolbar {
  margin-top: 12px;
  display: flex;
  gap: 8px;
}

.empty-form-tip {
  margin-top: 12px;
  padding: 18px;
  color: #909399;
  background: #f8fafc;
  border-radius: 6px;
  text-align: center;
}

.field-list {
  margin-top: 12px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.field-row {
  padding: 10px;
  border-radius: 6px;
  background: #f8fafc;
}

.field-order {
  width: 24px;
  height: 24px;
  line-height: 24px;
  border-radius: 50%;
  background: #eef2f7;
  color: #606266;
  text-align: center;
  flex-shrink: 0;
}

.field-main {
  flex: 1;
  min-width: 0;
}

.field-title-row,
.answer-chip-list {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}

.field-label {
  color: #303133;
  font-weight: 600;
}

.field-options {
  margin-top: 4px;
  color: #909399;
  font-size: 12px;
}

.field-actions {
  display: flex;
  gap: 2px;
  flex-shrink: 0;
}

.field-setting-row,
.option-editor,
.form-preview-list,
.stats-list,
.detail-answer-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
  width: 100%;
}

.option-row .el-input {
  flex: 1;
}

.preview-field,
.stats-card,
.registration-detail-panel {
  padding: 12px;
  border-radius: 6px;
  background: #f8fafc;
}

.preview-label,
.stats-title,
.detail-title {
  color: #303133;
  font-weight: 600;
  margin-bottom: 8px;
}

.required-mark {
  color: #f56c6c;
}

.preview-control {
  color: #909399;
  border: 1px solid #dcdfe6;
  border-radius: 4px;
  padding: 8px 10px;
  background: #fff;
}

.registration-detail-panel {
  margin-top: 14px;
}

.detail-answer-row,
.stats-row {
  padding: 8px 0;
  border-bottom: 1px solid #e4e7ed;
}

.detail-answer-row:last-child,
.stats-row:last-child {
  border-bottom: 0;
}
</style>
