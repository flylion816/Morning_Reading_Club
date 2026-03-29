<template>
  <AdminLayout>
    <div class="subscription-debug-container">
      <el-alert
        title="只读排查页"
        description="用于查看每个用户在不同订阅消息场景下的剩余次数、自动补量目标、计划发送状态和最近授权结果。当前版本不提供手工加次数操作。"
        type="info"
        show-icon
        :closable="false"
        class="page-tip"
      />

      <el-card style="margin-bottom: 20px">
        <template #header>
          <span class="card-title">订阅消息排查</span>
        </template>

        <div class="filter-panel">
          <el-input
            v-model="filters.search"
            placeholder="搜索昵称、手机号、openid、用户ID..."
            clearable
            style="width: 300px"
            @keyup.enter="handleSearch"
          >
            <template #prefix>
              <span style="margin-right: 4px">🔍</span>
            </template>
          </el-input>

          <el-select
            v-model="filters.scene"
            placeholder="筛选场景"
            clearable
            style="width: 180px"
            @change="handleSearch"
          >
            <el-option label="报名结果" value="enrollment_result" />
            <el-option label="付款结果" value="payment_result" />
            <el-option label="收到评论" value="comment_received" />
            <el-option label="收到点赞" value="like_received" />
            <el-option label="申请小凡看见" value="insight_request_created" />
            <el-option label="明日学习提醒" value="next_day_study_reminder" />
          </el-select>

          <el-input
            v-model="filters.periodId"
            placeholder="筛选期次ID"
            clearable
            style="width: 220px"
            @keyup.enter="handleSearch"
          />

          <el-select
            v-model="filters.status"
            placeholder="筛选状态"
            clearable
            style="width: 160px"
            @change="handleSearch"
          >
            <el-option label="全部" value="all" />
            <el-option label="正常" value="normal" />
            <el-option label="待补量" value="shortage" />
            <el-option label="计划发送" value="planned" />
            <el-option label="已拒绝" value="rejected" />
            <el-option label="已封禁" value="banned" />
            <el-option label="异常" value="anomaly" />
          </el-select>

          <el-switch
            v-model="filters.onlyAnomalies"
            active-text="只看异常"
            inactive-text="全部"
            style="margin-left: 8px"
            @change="handleSearch"
          />

          <el-button type="primary" style="margin-left: auto" @click="handleRefresh">
            刷新
          </el-button>
          <el-button @click="handleResetFilters">重置</el-button>
        </div>
      </el-card>

      <div class="stats-grid">
        <el-card
          v-for="card in overviewCards"
          :key="card.label"
          class="stat-card"
          shadow="hover"
        >
          <div class="stat-title">{{ card.label }}</div>
          <div class="stat-value">{{ card.value }}</div>
          <div class="stat-desc">{{ card.desc }}</div>
        </el-card>
      </div>

      <el-card class="table-card">
        <template #header>
          <div class="table-header">
            <span class="card-title">用户订阅库存</span>
            <span class="table-hint">每行展示一个用户，列内显示各场景的剩余次数与状态</span>
          </div>
        </template>

        <el-table
          :data="rows"
          stripe
          style="width: 100%"
          :default-sort="{ prop: 'lastRequestedAt', order: 'descending' }"
          v-loading="loading"
        >
          <el-table-column label="用户" min-width="240" fixed="left">
            <template #default="{ row }">
              <div class="user-cell">
                <div class="user-name">{{ row.nickname || row.user?.nickname || '未知用户' }}</div>
                <div class="user-meta">用户ID：{{ formatShortText(row.userId || row.user?._id) }}</div>
                <div class="user-meta">手机号：{{ row.phone || row.user?.phone || '-' }}</div>
                <div class="user-meta">期次：{{ row.periodName || row.periodId || '-' }}</div>
              </div>
            </template>
          </el-table-column>

          <el-table-column label="总状态" width="110">
            <template #default="{ row }">
              <el-tag :type="getRowStatusMeta(row).type" disable-transitions>
                {{ getRowStatusMeta(row).label }}
              </el-tag>
            </template>
          </el-table-column>

          <el-table-column label="总可发送次数" width="120">
            <template #default="{ row }">
              <span class="count-main">{{ row.totalAvailableCount ?? 0 }}</span>
            </template>
          </el-table-column>

          <el-table-column
            v-for="scene in sceneColumns"
            :key="scene.scene"
            :label="scene.title"
            min-width="180"
          >
            <template #default="{ row }">
              <div class="scene-cell">
                <el-tag :type="getSceneMeta(row, scene.scene).type" size="small" disable-transitions>
                  {{ getSceneMeta(row, scene.scene).label }}
                </el-tag>
                <div class="scene-count">
                  {{ getSceneMeta(row, scene.scene).countText }}
                </div>
                <div class="scene-subtext">
                  {{ getSceneMeta(row, scene.scene).subText }}
                </div>
              </div>
            </template>
          </el-table-column>

          <el-table-column label="最近更新时间" width="180">
            <template #default="{ row }">
              {{ formatDateTime(row.lastRequestedAt || row.lastAcceptedAt || row.lastRejectedAt) }}
            </template>
          </el-table-column>

          <el-table-column label="操作" width="110" fixed="right">
            <template #default="{ row }">
              <el-button type="primary" text size="small" @click="openDetail(row)">
                详情
              </el-button>
            </template>
          </el-table-column>
        </el-table>

        <div class="pagination">
          <el-pagination
            v-model:current-page="pagination.page"
            v-model:page-size="pagination.pageSize"
            :page-sizes="[10, 20, 50, 100]"
            :total="pagination.total"
            layout="total, sizes, prev, pager, next, jumper"
            @current-change="handlePageChange"
            @size-change="handlePageSizeChange"
          />
        </div>
      </el-card>

      <el-drawer
        v-model="detailDrawer.visible"
        title="订阅消息详情"
        size="860px"
        destroy-on-close
      >
        <div v-loading="detailLoading" class="detail-drawer">
          <template v-if="selectedDetail">
            <el-descriptions :column="2" border class="detail-descriptions">
              <el-descriptions-item label="用户">
                {{ selectedDetail.user?.nickname || selectedDetail.user?.openid || '-' }}
              </el-descriptions-item>
              <el-descriptions-item label="用户ID">
                {{ formatLongText(selectedDetail.user?._id || selectedRow?.userId) }}
              </el-descriptions-item>
              <el-descriptions-item label="手机号">
                {{ selectedDetail.user?.phone || '-' }}
              </el-descriptions-item>
              <el-descriptions-item label="OpenID">
                {{ formatLongText(selectedDetail.user?.openid) }}
              </el-descriptions-item>
              <el-descriptions-item label="当前期次">
                {{ selectedDetail.period?.title || selectedDetail.period?.name || selectedRow?.periodName || '-' }}
              </el-descriptions-item>
              <el-descriptions-item label="总可发送次数">
                {{ selectedDetail.summary?.totalAvailableCount ?? selectedRow?.totalAvailableCount ?? 0 }}
              </el-descriptions-item>
            </el-descriptions>

            <div class="detail-section">
              <div class="section-title">场景明细</div>
              <div class="detail-scene-grid">
                <el-card v-for="scene in detailScenes" :key="scene.scene" class="detail-scene-card">
                  <div class="detail-scene-head">
                    <div>
                      <div class="detail-scene-title">{{ scene.title }}</div>
                      <div class="detail-scene-desc">{{ scene.description }}</div>
                    </div>
                    <el-tag :type="scene.statusType" size="small" disable-transitions>
                      {{ scene.statusLabel }}
                    </el-tag>
                  </div>

                  <div class="detail-scene-counts">
                    <div class="detail-scene-count">
                      <span class="label">剩余次数</span>
                      <span class="value">{{ scene.availableCount ?? 0 }}</span>
                    </div>
                    <div class="detail-scene-count">
                      <span class="label">目标库存</span>
                      <span class="value">{{ scene.autoTopUpTarget ?? 1 }}</span>
                    </div>
                    <div class="detail-scene-count">
                      <span class="label">待补量</span>
                      <span class="value">{{ scene.remainingToTarget ?? 0 }}</span>
                    </div>
                  </div>

                  <div class="detail-scene-meta">
                    <div>最近授权：{{ formatDateTime(scene.lastAcceptedAt) || '-' }}</div>
                    <div>最近拒绝：{{ formatDateTime(scene.lastRejectedAt) || '-' }}</div>
                    <div>最近请求：{{ formatDateTime(scene.lastRequestedAt) || '-' }}</div>
                    <div v-if="scene.scheduledSendDate">
                      计划发送：{{ formatDateTime(scene.scheduledSendDate) }}
                    </div>
                    <div v-if="scene.retryAt">
                      重试时间：{{ formatDateTime(scene.retryAt) }}（{{ scene.retryCount || 0 }}）
                    </div>
                    <div v-if="scene.sourceAction">来源：{{ scene.sourceAction }}</div>
                    <div v-if="scene.periodId">期次：{{ scene.periodId }}</div>
                  </div>
                </el-card>
              </div>
            </div>

            <div class="detail-section">
              <div class="section-title">最近发送记录</div>
              <el-table
                :data="selectedDetail.deliveries || []"
                stripe
                size="small"
                empty-text="暂无发送记录"
              >
                <el-table-column label="时间" width="180">
                  <template #default="{ row }">
                    {{ formatDateTime(row.createdAt) }}
                  </template>
                </el-table-column>
                <el-table-column label="场景" width="180">
                  <template #default="{ row }">
                    {{ getSceneTitle(row.scene) }}
                  </template>
                </el-table-column>
                <el-table-column label="状态" width="120">
                  <template #default="{ row }">
                    <el-tag :type="getDeliveryType(row.status)" size="small" disable-transitions>
                      {{ formatDeliveryStatus(row.status) }}
                    </el-tag>
                  </template>
                </el-table-column>
                <el-table-column label="来源" width="160">
                  <template #default="{ row }">
                    {{ row.sourceType || '-' }}
                  </template>
                </el-table-column>
                <el-table-column label="错误信息" min-width="220" show-overflow-tooltip>
                  <template #default="{ row }">
                    {{ row.errorMessage || '-' }}
                  </template>
                </el-table-column>
              </el-table>
            </div>
          </template>

          <el-empty v-else description="请选择用户查看详情" />
        </div>
      </el-drawer>
    </div>
  </AdminLayout>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import AdminLayout from '../components/AdminLayout.vue';
import { subscriptionDebugApi } from '../services/api';
import { ElMessage } from 'element-plus';
import type {
  SubscriptionGrantDetail,
  SubscriptionGrantRow,
  SubscriptionGrantScene,
  SubscriptionGrantSummary
} from '../types/api';

const sceneColumns = [
  { scene: 'enrollment_result', title: '报名结果', description: '报名成功后提醒' },
  { scene: 'payment_result', title: '付款结果', description: '支付完成后提醒' },
  { scene: 'comment_received', title: '收到评论', description: '有人评论或回复时提醒' },
  { scene: 'like_received', title: '收到点赞', description: '有人点赞时提醒' },
  { scene: 'insight_request_created', title: '申请小凡看见', description: '有人请求查看时提醒' },
  { scene: 'next_day_study_reminder', title: '明日学习提醒', description: '次日 05:45 学习提醒' }
] as const;

const loading = ref(false);
const detailLoading = ref(false);
const rows = ref<SubscriptionGrantRow[]>([]);
const summary = ref<SubscriptionGrantSummary | null>(null);
const selectedRow = ref<SubscriptionGrantRow | null>(null);
const selectedDetail = ref<SubscriptionGrantDetail | null>(null);
const detailDrawer = ref({
  visible: false
});

const filters = ref({
  search: '',
  scene: '',
  periodId: '',
  status: 'all',
  onlyAnomalies: false
});

const pagination = ref({
  page: 1,
  pageSize: 10,
  total: 0
});

const overviewCards = computed(() => {
  const readyUsers = summary.value?.readyUserCount ?? rows.value.filter(row => !row.hasAnomaly).length;
  const shortageUsers =
    summary.value?.shortageUserCount ?? rows.value.filter(row => row.hasAnomaly).length;
  const totalAvailable =
    summary.value?.totalAvailableCount ??
    rows.value.reduce((sum, row) => sum + (row.totalAvailableCount || 0), 0);
  const plannedReminderCount =
    summary.value?.plannedReminderCount ??
    rows.value.filter(row =>
      (row.scenes || []).some(
        scene => scene.scene === 'next_day_study_reminder' && !!scene.scheduledSendDate
      )
    ).length;
  const anomalyCount =
    summary.value?.anomalyUserCount ??
    rows.value.filter(row => row.hasAnomaly || row.summaryStatus === '异常').length;

  return [
    { label: '用户总数', value: summary.value?.totalUsers ?? rows.value.length, desc: '当前查询结果用户数' },
    { label: '总可发送次数', value: totalAvailable, desc: '所有场景剩余次数汇总' },
    { label: '库存充足', value: readyUsers, desc: '场景库存达到目标的用户' },
    { label: '待补量', value: shortageUsers, desc: '至少一个场景低于目标' },
    { label: '明日提醒计划', value: plannedReminderCount, desc: '已排入次日 05:45 的记录' },
    { label: '异常用户', value: anomalyCount, desc: '存在拒绝、封禁或库存异常' }
  ];
});

const detailScenes = computed(() => selectedDetail.value?.scenes || []);

onMounted(() => {
  loadRows();
});

function getListPayload(response: any): any {
  if (!response) return { list: [] };
  if (Array.isArray(response)) return { list: response };
  if (Array.isArray(response.list)) return response;
  if (Array.isArray(response.items)) return { ...response, list: response.items };
  if (response.data) {
    if (Array.isArray(response.data.list)) {
      return response.data;
    }
    if (Array.isArray(response.data.items)) {
      return { ...response.data, list: response.data.items };
    }
  }
  return { ...response, list: response.list || [] };
}

function getDetailPayload(response: any): SubscriptionGrantDetail {
  if (!response) return {};
  if (response.user || response.scenes || response.deliveries || response.summary) {
    return response;
  }
  if (response.data) {
    return response.data;
  }
  return response;
}

function normalizeScene(rawScene: any, meta: (typeof sceneColumns)[number]): SubscriptionGrantScene {
  const availableCount = Number(rawScene?.availableCount || 0);
  const autoTopUpTarget = Number(rawScene?.autoTopUpTarget || 1);
  const remainingToTarget = typeof rawScene?.remainingToTarget === 'number'
    ? rawScene.remainingToTarget
    : Math.max(0, autoTopUpTarget - availableCount);
  const lastResult = rawScene?.lastResult || null;
  const scheduledSendDate = rawScene?.scheduledSendDate || null;
  const retryAt = rawScene?.retryAt || null;
  const backendStatus = rawScene?.status || '';

  let statusLabel = '待补量';
  let statusType: 'success' | 'warning' | 'danger' | 'info' = 'warning';

  if (typeof rawScene?.statusLabel === 'string' && rawScene.statusLabel) {
    statusLabel = rawScene.statusLabel;
  } else if (lastResult === 'ban') {
    statusLabel = '已封禁';
    statusType = 'danger';
  } else if (lastResult === 'reject') {
    statusLabel = '已拒绝';
    statusType = 'danger';
  } else if (meta.scene === 'next_day_study_reminder' && scheduledSendDate) {
    statusLabel = '已计划';
    statusType = 'success';
  } else if (availableCount >= autoTopUpTarget) {
    statusLabel = '充足';
    statusType = 'success';
  } else if (availableCount > 0) {
    statusLabel = '不足';
    statusType = 'warning';
  } else {
    statusLabel = '待补量';
    statusType = 'danger';
  }

  if (typeof rawScene?.statusType === 'string' && rawScene.statusType) {
    statusType = rawScene.statusType;
  } else if (backendStatus === 'ready' && statusLabel !== '待补量') {
    statusType = 'success';
  } else if (backendStatus === 'scheduled') {
    statusType = 'success';
  } else if (backendStatus === 'blocked') {
    statusType = 'danger';
  }

  return {
    scene: rawScene?.scene || meta.scene,
    title: rawScene?.title || meta.title,
    description: rawScene?.description || meta.description,
    templateId: rawScene?.templateId,
    page: rawScene?.page,
    availableCount,
    autoTopUpTarget,
    remainingToTarget,
    lastResult,
    lastAcceptedAt: rawScene?.lastAcceptedAt || null,
    lastRejectedAt: rawScene?.lastRejectedAt || null,
    lastRequestedAt: rawScene?.lastRequestedAt || null,
    scheduledSendDate,
    scheduledSendDateKey: rawScene?.scheduledSendDateKey || null,
    retryAt,
    retryCount: Number(rawScene?.retryCount || 0),
    periodId: rawScene?.periodId || null,
    sourceAction: rawScene?.sourceAction || null,
    context: rawScene?.context || {},
    localOnly: !!rawScene?.localOnly,
    statusLabel,
    statusType
  };
}

function normalizeRow(row: any): SubscriptionGrantRow {
  const sceneMap = new Map<string, any>();
  const rawScenes = Array.isArray(row?.scenes) ? row.scenes : [];
  rawScenes.forEach((scene: any) => {
    if (scene?.scene) {
      sceneMap.set(scene.scene, scene);
    }
  });

  const scenes = sceneColumns.map(meta => normalizeScene(sceneMap.get(meta.scene), meta));
  const totalAvailableCount =
    row?.totalAvailableCount ??
    scenes.reduce((sum, scene) => sum + (scene.availableCount || 0), 0);
  const shortageSceneCount =
    row?.shortageSceneCount ??
    scenes.filter(scene => (scene.availableCount || 0) < (scene.autoTopUpTarget || 1)).length;
  const anomalyCount =
    row?.anomalyCount ??
    scenes.filter(scene => scene.lastResult === 'reject' || scene.lastResult === 'ban').length;
  const hasAnomaly =
    row?.hasAnomaly ??
    Boolean(
      shortageSceneCount > 0 ||
        anomalyCount > 0 ||
        scenes.some(
          scene =>
            scene.scene === 'next_day_study_reminder' &&
            !scene.scheduledSendDate &&
            (scene.availableCount || 0) > 0
        )
    );

  const summaryStatus =
    row?.summaryStatus ||
    (scenes.some(scene => scene.lastResult === 'ban')
      ? '已封禁'
      : scenes.some(scene => scene.lastResult === 'reject')
        ? '已拒绝'
        : hasAnomaly
          ? '待补量'
          : '正常');

  return {
    ...row,
    nickname: row?.nickname || row?.user?.nickname,
    phone: row?.phone || row?.user?.phone,
    openid: row?.openid || row?.user?.openid,
    userId: row?.userId || row?.user?._id,
    scenes,
    totalAvailableCount,
    shortageSceneCount,
    anomalyCount,
    hasAnomaly,
    summaryStatus,
    periodId: row?.periodId || row?.currentPeriod?._id || null,
    periodName:
      row?.periodName || row?.currentPeriod?.title || row?.currentPeriod?.name || null
  };
}

function normalizeDetail(detail: any): SubscriptionGrantDetail {
  const payload = getDetailPayload(detail);
  const scenes = sceneColumns.map(meta => normalizeScene(
    (Array.isArray(payload.scenes) ? payload.scenes : []).find((scene: any) => scene?.scene === meta.scene),
    meta
  ));

  return {
    ...payload,
    scenes,
    deliveries: Array.isArray(payload.deliveries) ? payload.deliveries : []
  };
}

async function loadRows() {
  loading.value = true;
  try {
    const params: Record<string, any> = {
      page: pagination.value.page,
      limit: pagination.value.pageSize
    };

    if (filters.value.search) params.search = filters.value.search;
    if (filters.value.scene) params.scene = filters.value.scene;
    if (filters.value.periodId) params.periodId = filters.value.periodId;
    if (filters.value.status && filters.value.status !== 'all') params.status = filters.value.status;
    if (filters.value.onlyAnomalies) params.onlyAnomalies = true;

    const response = await subscriptionDebugApi.getGrants(params);
    const payload = getListPayload(response);
    rows.value = (payload.list || []).map((row: any) => normalizeRow(row));
    summary.value = payload.summary || payload.data?.summary || null;
    pagination.value.total =
      payload.total ||
      payload.pagination?.total ||
      payload.data?.pagination?.total ||
      rows.value.length;
  } catch (error) {
    console.error('加载订阅排查列表失败:', error);
    ElMessage.error('加载订阅排查列表失败');
  } finally {
    loading.value = false;
  }
}

async function openDetail(row: SubscriptionGrantRow) {
  const userId = row.userId || row.user?._id;
  if (!userId) {
    ElMessage.warning('缺少用户ID，无法查看详情');
    return;
  }

  selectedRow.value = row;
  selectedDetail.value = null;
  detailDrawer.value.visible = true;
  detailLoading.value = true;

  try {
    const response = await subscriptionDebugApi.getGrantDetail(userId, {
      periodId: filters.value.periodId || undefined
    });
    selectedDetail.value = normalizeDetail(response);
  } catch (error) {
    console.error('加载订阅排查详情失败:', error);
    ElMessage.error('加载订阅排查详情失败');
  } finally {
    detailLoading.value = false;
  }
}

function handleSearch() {
  pagination.value.page = 1;
  loadRows();
}

function handleResetFilters() {
  filters.value = {
    search: '',
    scene: '',
    periodId: '',
    status: 'all',
    onlyAnomalies: false
  };
  pagination.value.page = 1;
  loadRows();
}

function handleRefresh() {
  loadRows();
}

function handlePageChange(page: number) {
  pagination.value.page = page;
  loadRows();
}

function handlePageSizeChange(pageSize: number) {
  pagination.value.page = 1;
  pagination.value.pageSize = pageSize;
  loadRows();
}

function getSceneMeta(row: SubscriptionGrantRow, sceneName: string) {
  const scene = row.scenes?.find(item => item.scene === sceneName);
  if (!scene) {
    return {
      label: '无数据',
      type: 'info',
      countText: '0 / 0',
      subText: '未返回该场景'
    };
  }

  let subText = '';
  if (scene.scene === 'next_day_study_reminder' && scene.scheduledSendDate) {
    subText = `计划 ${formatDateTime(scene.scheduledSendDate)}`;
  } else if (scene.lastAcceptedAt) {
    subText = `最近补充 ${formatDateTime(scene.lastAcceptedAt)}`;
  } else if (scene.lastRejectedAt) {
    subText = `上次拒绝 ${formatDateTime(scene.lastRejectedAt)}`;
  } else if (scene.lastRequestedAt) {
    subText = `最近请求 ${formatDateTime(scene.lastRequestedAt)}`;
  } else {
    subText = '尚无记录';
  }

  return {
    label: scene.statusLabel || '待补量',
    type: scene.statusType || 'warning',
    countText: `${scene.availableCount ?? 0} / ${scene.autoTopUpTarget ?? 1}`,
    subText
  };
}

function getRowStatusMeta(row: SubscriptionGrantRow) {
  if (row.status === 'blocked') {
    return { label: '已阻断', type: 'danger' };
  }
  if (row.status === 'scheduled') {
    return { label: '计划发送', type: 'success' };
  }
  if (row.status === 'needs_topup' || row.hasAnomaly) {
    return { label: '待补量', type: 'warning' };
  }
  return { label: '正常', type: 'success' };
}

function getSceneTitle(sceneName?: string) {
  return sceneColumns.find(item => item.scene === sceneName)?.title || sceneName || '-';
}

function getDeliveryType(status?: string) {
  const map: Record<string, 'success' | 'warning' | 'danger' | 'info'> = {
    sent: 'success',
    mocked: 'info',
    skipped_no_grant: 'warning',
    skipped_missing_openid: 'warning',
    skipped_missing_config: 'warning',
    failed: 'danger'
  };
  return map[status || ''] || 'info';
}

function formatDeliveryStatus(status?: string) {
  const map: Record<string, string> = {
    sent: '已发送',
    mocked: '已模拟',
    skipped_no_grant: '无库存',
    skipped_missing_openid: '缺少 OpenID',
    skipped_missing_config: '缺少配置',
    failed: '失败'
  };
  return map[status || ''] || status || '-';
}

function formatDateTime(value?: string | null) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hour = String(date.getHours()).padStart(2, '0');
  const minute = String(date.getMinutes()).padStart(2, '0');
  return `${year}-${month}-${day} ${hour}:${minute}`;
}

function formatShortText(value?: string | null) {
  if (!value) return '-';
  return value.length <= 12 ? value : `${value.slice(0, 6)}...${value.slice(-4)}`;
}

function formatLongText(value?: string | null) {
  if (!value) return '-';
  return value.length <= 24 ? value : `${value.slice(0, 12)}...${value.slice(-8)}`;
}
</script>

<style scoped>
.subscription-debug-container {
  padding: 24px;
}

.page-tip {
  margin-bottom: 20px;
}

.card-title {
  font-size: 16px;
  font-weight: 600;
}

.filter-panel {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 16px;
  margin-bottom: 20px;
}

.stat-card {
  min-height: 116px;
}

.stat-title {
  font-size: 14px;
  color: #64748b;
}

.stat-value {
  margin-top: 10px;
  font-size: 28px;
  font-weight: 700;
  color: #1f2937;
}

.stat-desc {
  margin-top: 6px;
  font-size: 12px;
  color: #94a3b8;
}

.table-card {
  margin-top: 4px;
}

.table-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
}

.table-hint {
  font-size: 12px;
  color: #94a3b8;
}

.user-cell {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.user-name {
  font-weight: 600;
  color: #1f2937;
}

.user-meta {
  font-size: 12px;
  color: #64748b;
}

.count-main {
  font-size: 16px;
  font-weight: 700;
  color: #1f2937;
}

.scene-cell {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.scene-count {
  font-size: 14px;
  font-weight: 600;
  color: #1f2937;
}

.scene-subtext {
  font-size: 12px;
  color: #64748b;
}

.pagination {
  display: flex;
  justify-content: flex-end;
  margin-top: 20px;
}

.detail-drawer {
  padding-right: 12px;
}

.detail-descriptions {
  margin-bottom: 20px;
}

.detail-section {
  margin-top: 20px;
}

.section-title {
  font-size: 16px;
  font-weight: 600;
  color: #1f2937;
  margin-bottom: 12px;
}

.detail-scene-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
  gap: 12px;
}

.detail-scene-card {
  border-radius: 8px;
}

.detail-scene-head {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  align-items: flex-start;
  margin-bottom: 12px;
}

.detail-scene-title {
  font-size: 15px;
  font-weight: 600;
  color: #1f2937;
}

.detail-scene-desc {
  font-size: 12px;
  color: #64748b;
  margin-top: 4px;
}

.detail-scene-counts {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10px;
  margin-bottom: 10px;
}

.detail-scene-count {
  background: #f8fafc;
  border-radius: 8px;
  padding: 10px;
}

.detail-scene-count .label {
  display: block;
  font-size: 12px;
  color: #64748b;
}

.detail-scene-count .value {
  display: block;
  margin-top: 4px;
  font-size: 16px;
  font-weight: 700;
  color: #1f2937;
}

.detail-scene-meta {
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: 12px;
  color: #64748b;
  line-height: 1.5;
}
</style>
