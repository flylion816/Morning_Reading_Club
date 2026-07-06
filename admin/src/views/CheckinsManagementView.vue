<template>
  <AdminLayout>
    <div class="checkins-management-container">

      <!-- 顶部标签页切换 -->
      <el-tabs v-model="activeTab" class="main-tabs">
        <el-tab-pane label="打卡记录" name="records">
        </el-tab-pane>
        <el-tab-pane label="庆祝配置" name="config">
        </el-tab-pane>
      </el-tabs>

      <!-- ========== 打卡庆祝配置 Tab ========== -->
      <div v-if="activeTab === 'config'" class="config-panel">

        <!-- 动画方式选择 -->
        <el-card class="config-card">
          <template #header>
            <div class="card-header">
              <span class="card-title">动画特效方式</span>
              <span class="card-sub">点击卡片选中，点"预览"查看效果</span>
            </div>
          </template>
          <div class="style-selector">
            <div
              v-for="opt in styleOptions" :key="opt.value"
              class="style-option"
              :class="{ active: celebConfig.animationStyle === opt.value }"
              @click="setAnimationStyle(opt.value)"
            >
              <div class="style-icon">{{ opt.icon }}</div>
              <div class="style-label">{{ opt.label }}</div>
              <div class="style-desc">{{ opt.desc }}</div>
              <div
                v-if="opt.value !== 'random'"
                class="random-toggle"
                @click.stop
              >
                <span>随机启用</span>
                <el-switch
                  :model-value="isRandomStyleEnabled(opt.value)"
                  size="small"
                  @change="toggleRandomStyle(opt.value)"
                />
              </div>
              <el-button
                v-if="opt.value !== 'random'"
                size="small"
                class="preview-btn"
                @click.stop="openPreview(opt.value)"
              >预览</el-button>
              <el-button
                v-else
                size="small"
                class="preview-btn"
                @click.stop="openPreview(randomPreviewStyle())"
              >预览随机</el-button>
            </div>
          </div>
        </el-card>

        <!-- 手机尺寸预览弹窗 -->
        <el-dialog
          v-model="previewVisible"
          title="效果预览"
          width="480px"
          :show-close="true"
          align-center
          @closed="previewKey++"
        >
          <div class="phone-frame-wrap">
            <div class="phone-frame">
              <!-- 手机顶部状态栏 -->
              <div class="phone-status-bar">
                <span>14:06</span>
                <span>● ● ●</span>
              </div>
              <!-- 手机导航栏 -->
              <div class="phone-nav-bar">
                <span class="phone-nav-back">‹</span>
                <span>每日打卡</span>
                <span></span>
              </div>
              <!-- 动画内容区 -->
              <div class="phone-body">
                <!-- 背景页面内容（模拟打卡页） -->
                <div class="phone-page-bg">
                  <div class="phone-page-title">第二天 思维方式的力量</div>
                  <div class="phone-page-textarea">请输入日记内容...</div>
                </div>

                <!-- ====== Style A：能量爆发 ====== -->
                <div v-if="previewStyle === 'A'" :key="'A'+previewKey" class="cel-overlay-web cel-a-web">
                  <div class="cel-ring-web r1"></div>
                  <div class="cel-ring-web r2"></div>
                  <div v-for="n in 12" :key="n" :class="'cel-p-web p'+n"></div>
                  <div class="cel-card-web card-a-web">
                    <div class="cel-icon-a-web">✓</div>
                    <div class="cel-msg-web msg-a-web">{{ previewMessage }}</div>
                    <div class="cel-hint-web">点击任意处关闭</div>
                  </div>
                </div>

                <!-- ====== Style B：书页翻飞 ====== -->
                <div v-if="previewStyle === 'B'" :key="'B'+previewKey" class="cel-overlay-web cel-b-web">
                  <div v-for="n in 6" :key="n" :class="'cel-page-web pg'+n"></div>
                  <div class="cel-card-web card-b-web">
                    <div class="cel-book-web">📖</div>
                    <div class="cel-msg-web msg-b-web">{{ previewMessage }}</div>
                    <div class="cel-hint-web hint-b-web">点击任意处关闭</div>
                  </div>
                </div>

                <!-- ====== Style C：光芒升起 ====== -->
                <div v-if="previewStyle === 'C'" :key="'C'+previewKey" class="cel-overlay-web cel-c-web">
                  <div class="cel-sheet-web">
                    <div class="cel-icon-c-web">✓</div>
                    <div class="cel-title-c-web">打卡成功</div>
                    <div class="cel-msg-web msg-c-web">{{ previewMessage }}</div>
                    <div class="cel-dots-web">
                      <span class="dot-web primary-dot" style="animation-delay:0s"></span>
                      <span class="dot-web" style="background:#FFD700;animation-delay:0.15s"></span>
                      <span class="dot-web" style="background:#4ECDC4;animation-delay:0.3s"></span>
                    </div>
                    <div class="cel-close-btn-web">好的，继续加油 💪</div>
                  </div>
                </div>

                <!-- ====== Style D：碎片裂变 ====== -->
                <div v-if="previewStyle === 'D'" :key="'D'+previewKey" class="cel-overlay-web cel-d-web">
                  <div class="shock-web shock-web-1"></div>
                  <div class="shock-web shock-web-2"></div>
                  <div class="crack-web crack-web-h"></div>
                  <div class="crack-web crack-web-v"></div>
                  <div v-for="n in 10" :key="n" :class="'shard-web shard-web-'+n"></div>
                  <div class="cel-card-web card-d-web">
                    <div class="cel-icon-d-web">✹</div>
                    <div class="cel-msg-web msg-d-web">{{ previewMessage }}</div>
                    <div class="cel-hint-web">点击任意处关闭</div>
                  </div>
                </div>

                <!-- ====== Style E：聚光登场 ====== -->
                <div v-if="previewStyle === 'E'" :key="'E'+previewKey" class="cel-overlay-web cel-e-web">
                  <div class="spotlight-web spot-web-left"></div>
                  <div class="spotlight-web spot-web-right"></div>
                  <div class="stage-web"></div>
                  <div class="medal-glow-web"></div>
                  <div class="stage-star-web stage-star-web-1">★</div>
                  <div class="stage-star-web stage-star-web-2">★</div>
                  <div class="stage-star-web stage-star-web-3">★</div>
                  <div class="cel-card-web card-e-web">
                    <div class="cel-icon-e-web">🏅</div>
                    <div class="cel-title-e-web">今日达成</div>
                    <div class="cel-msg-web msg-e-web">{{ previewMessage }}</div>
                    <div class="cel-hint-web">点击任意处关闭</div>
                  </div>
                </div>

                <!-- ====== Style F：彩带狂欢 ====== -->
                <div v-if="previewStyle === 'F'" :key="'F'+previewKey" class="cel-overlay-web cel-f-web">
                  <div v-for="n in 12" :key="n" :class="'confetti-web cf-web-'+n"></div>
                  <div class="cel-card-web card-f-web">
                    <div class="cel-icon-f-web">🎊</div>
                    <div class="cel-title-f-web">打卡成功</div>
                    <div class="cel-msg-web msg-f-web">{{ previewMessage }}</div>
                    <div class="hint-f-web">点击任意处关闭</div>
                  </div>
                </div>

                <!-- ====== Style G：火箭升空 ====== -->
                <div v-if="previewStyle === 'G'" :key="'G'+previewKey" class="cel-overlay-web cel-g-web">
                  <div class="rocket-trail-web trail-web-1"></div>
                  <div class="rocket-trail-web trail-web-2"></div>
                  <div class="rocket-trail-web trail-web-3"></div>
                  <div class="cloud-web cloud-web-1"></div>
                  <div class="cloud-web cloud-web-2"></div>
                  <div class="cloud-web cloud-web-3"></div>
                  <div v-for="n in 4" :key="n" :class="'rocket-spark-web rocket-spark-web-'+n"></div>
                  <div class="cel-card-web card-g-web">
                    <div class="cel-icon-g-web">🚀</div>
                    <div class="cel-msg-web msg-g-web">{{ previewMessage }}</div>
                    <div class="cel-hint-web">点击任意处关闭</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <template #footer>
            <el-button @click="previewKey++">重播</el-button>
            <el-button type="primary" @click="previewVisible = false">关闭</el-button>
          </template>
        </el-dialog>

        <!-- 祝福语管理 -->
        <el-card class="config-card">
          <template #header>
            <div class="card-header">
              <span class="card-title">打卡祝福语池（{{ enabledMsgCount }}/{{ celebConfig.messages.length }} 条启用）</span>
              <el-button type="primary" size="small" @click="openAddMsg">+ 新增</el-button>
            </div>
          </template>

          <!-- 分类筛选 -->
          <div class="category-filter">
            <el-tag
              v-for="cat in allCategories" :key="cat"
              :type="filterCat === cat ? '' : 'info'"
              class="cat-tag"
              @click="filterCat = cat === filterCat ? '' : cat"
            >{{ cat }}</el-tag>
          </div>

          <el-table :data="filteredMessages" size="small" class="msg-table">
            <el-table-column prop="category" label="分类" width="100" />
            <el-table-column prop="content" label="内容" />
            <el-table-column label="状态" width="90" align="center">
              <template #default="{ row }">
                <el-switch
                  :model-value="row.isEnabled"
                  @change="toggleMsg(row)"
                />
              </template>
            </el-table-column>
            <el-table-column label="操作" width="140" align="center">
              <template #default="{ row }">
                <el-button size="small" @click="openEditMsg(row)">编辑</el-button>
                <el-button size="small" type="danger" @click="deleteMsg(row)">删除</el-button>
              </template>
            </el-table-column>
          </el-table>
        </el-card>
      </div>

      <!-- 新增/编辑消息弹窗 -->
      <el-dialog v-model="msgDialogVisible" :title="editingMsg._id ? '编辑祝福语' : '新增祝福语'" width="500px">
        <el-form :model="msgForm" label-width="60px">
          <el-form-item label="分类">
            <el-select v-model="msgForm.category" placeholder="选择分类">
              <el-option v-for="c in CATEGORIES" :key="c" :label="c" :value="c" />
            </el-select>
          </el-form-item>
          <el-form-item label="内容">
            <el-input
              v-model="msgForm.content"
              type="textarea"
              :rows="3"
              placeholder="输入祝福语内容，支持 emoji"
              maxlength="100"
              show-word-limit
            />
          </el-form-item>
        </el-form>
        <template #footer>
          <el-button @click="msgDialogVisible = false">取消</el-button>
          <el-button type="primary" :loading="msgSaving" @click="saveMsg">保存</el-button>
        </template>
      </el-dialog>

      <!-- ========== 打卡记录 Tab ========== -->
      <div v-if="activeTab === 'records'">
      <!-- 统计卡片 -->
      <div class="stats-cards">
        <el-card class="stat-card">
          <template #header>
            <div class="stat-header">打卡总数</div>
          </template>
          <div class="stat-value">{{ stats.totalCount }}</div>
          <div class="stat-label">条记录</div>
        </el-card>

        <el-card class="stat-card">
          <template #header>
            <div class="stat-header">今日打卡</div>
          </template>
          <div class="stat-value">{{ stats.todayCount }}</div>
          <div class="stat-label">次打卡</div>
        </el-card>

        <el-card class="stat-card">
          <template #header>
            <div class="stat-header">打卡用户</div>
          </template>
          <div class="stat-value">{{ stats.uniqueUserCount }}</div>
          <div class="stat-label">个用户</div>
        </el-card>

        <el-card class="stat-card">
          <template #header>
            <div class="stat-header">总积分</div>
          </template>
          <div class="stat-value">{{ stats.totalPoints }}</div>
          <div class="stat-label">分</div>
        </el-card>
      </div>

      <!-- 搜索和筛选 -->
      <el-card class="filter-card">
        <template #header>
          <div class="card-header">
            <span class="card-title">搜索和筛选</span>
          </div>
        </template>

        <el-form :model="filters" class="compact-filter-form">
          <el-form-item label="用户昵称" class="filter-search">
            <el-input
              v-model="filters.search"
              placeholder="搜索用户昵称或ID"
              clearable
              @input="handleSearch"
            />
          </el-form-item>

          <el-form-item label="期次" class="filter-period">
            <el-select
              v-model="filters.periodId"
              placeholder="选择期次"
              clearable
              @change="loadCheckins"
            >
              <el-option
                v-for="period in periods"
                :key="period._id"
                :label="period.name"
                :value="period._id"
              />
            </el-select>
          </el-form-item>

          <el-form-item label="开始日期" class="filter-date">
            <el-date-picker
              v-model="filters.dateFrom"
              type="date"
              placeholder="选择开始日期"
              @change="loadCheckins"
            />
          </el-form-item>

          <el-form-item label="结束日期" class="filter-date">
            <el-date-picker
              v-model="filters.dateTo"
              type="date"
              placeholder="选择结束日期"
              @change="loadCheckins"
            />
          </el-form-item>

          <el-form-item class="filter-actions">
            <el-button type="primary" @click="loadCheckins">查询</el-button>
            <el-button @click="resetFilters">重置</el-button>
          </el-form-item>
        </el-form>
      </el-card>

      <!-- 打卡列表 -->
      <el-card>
        <template #header>
          <div class="card-header">
            <span>打卡记录列表 (共 {{ total }} 条)</span>
            <el-pagination
              :current-page="currentPage"
              :page-size="pageSize"
              :total="total"
              @current-change="
                currentPage = $event;
                loadCheckins();
              "
              style="margin-left: auto"
            />
          </div>
        </template>

        <el-table :data="checkins" stripe style="width: 100%" v-loading="loading">
          <!-- 用户 -->
          <el-table-column label="用户" width="150">
            <template #default="{ row }">
              <div class="user-cell">
                <div v-if="row.userId && typeof row.userId === 'object'" class="user-info">
                  <div class="user-name">{{ row.userId.nickname }}</div>
                </div>
                <div v-else>未知用户</div>
              </div>
            </template>
          </el-table-column>

          <!-- 期次 -->
          <el-table-column label="期次" width="150">
            <template #default="{ row }">
              {{
                row.periodId && typeof row.periodId === 'object' ? row.periodId.name || '-' : '-'
              }}
            </template>
          </el-table-column>

          <!-- 课程 -->
          <el-table-column label="课程" width="300">
            <template #default="{ row }">
              <div v-if="row.sectionId && typeof row.sectionId === 'object'">
                Day {{ row.sectionId.day }} - {{ row.sectionId.title }}
              </div>
              <div v-else>-</div>
            </template>
          </el-table-column>

          <!-- 打卡时间 -->
          <el-table-column label="打卡时间" width="160">
            <template #default="{ row }">
              {{ formatDate(row.checkinDate) }}
            </template>
          </el-table-column>

          <!-- 打卡时间（分） -->
          <el-table-column label="打卡时间（分）" width="130">
            <template #default="{ row }">
              {{ row.readingTime || '-' }}
            </template>
          </el-table-column>

          <!-- 操作 -->
          <el-table-column label="操作" width="200" fixed="right">
            <template #default="{ row }">
              <div class="action-buttons">
                <el-button type="primary" size="small" @click="handleViewDetail(row)"
                  >详情</el-button
                >
                <el-button type="warning" size="small" @click="handleEditCheckin(row)"
                  >修改</el-button
                >
                <el-button type="danger" size="small" @click="handleDeleteCheckin(row)"
                  >删除</el-button
                >
              </div>
            </template>
          </el-table-column>
        </el-table>
      </el-card>

      <!-- 修改弹窗 -->
      <el-dialog v-model="editDialogVisible" title="修改打卡内容" width="600px">
        <el-form v-if="editingCheckin" :model="editForm" label-width="80px">
          <el-form-item label="打卡内容">
            <el-input
              v-model="editForm.note"
              type="textarea"
              :rows="8"
              placeholder="打卡内容"
            />
          </el-form-item>
          <el-form-item label="可见范围">
            <el-radio-group v-model="editForm.isPublic">
              <el-radio :label="true">公开</el-radio>
              <el-radio :label="false">仅管理员可见</el-radio>
            </el-radio-group>
          </el-form-item>
        </el-form>
        <template #footer>
          <el-button @click="editDialogVisible = false">取消</el-button>
          <el-button type="primary" :loading="editLoading" @click="handleUpdateCheckin">保存</el-button>
        </template>
      </el-dialog>

      <!-- 详情弹窗 -->
      <el-dialog v-model="detailDialogVisible" title="打卡详情" width="700px">
        <div v-if="selectedCheckin" class="checkin-detail">
          <el-descriptions :column="1" border label-width="132px" class="detail-descriptions">
            <el-descriptions-item label="用户">
              <div v-if="selectedCheckin.userId && typeof selectedCheckin.userId === 'object'">
                <div>{{ selectedCheckin.userId.nickname }}</div>
                <div style="font-size: 12px; color: #999">{{ selectedCheckin.userId.openid }}</div>
              </div>
            </el-descriptions-item>

            <el-descriptions-item label="期次">
              {{
                selectedCheckin.periodId && typeof selectedCheckin.periodId === 'object'
                  ? selectedCheckin.periodId.name
                  : '-'
              }}
            </el-descriptions-item>

            <el-descriptions-item label="课程">
              <div
                v-if="selectedCheckin.sectionId && typeof selectedCheckin.sectionId === 'object'"
              >
                Day {{ selectedCheckin.sectionId.day }} - {{ selectedCheckin.sectionId.title }}
              </div>
            </el-descriptions-item>

            <el-descriptions-item label="打卡时间">
              {{ formatDate(selectedCheckin.checkinDate) }}
            </el-descriptions-item>

            <el-descriptions-item label="阅读时间">
              {{ selectedCheckin.readingTime }} 分钟
            </el-descriptions-item>

            <el-descriptions-item label="完成度">
              {{ selectedCheckin.completionRate }}%
            </el-descriptions-item>

            <el-descriptions-item label="心情">
              <el-tag v-if="selectedCheckin.mood" :type="getMoodColor(selectedCheckin.mood)">
                {{ getMoodLabel(selectedCheckin.mood) }}
              </el-tag>
            </el-descriptions-item>

            <el-descriptions-item label="积分">
              {{ selectedCheckin.points }}
            </el-descriptions-item>

            <el-descriptions-item label="公开状态">
              <el-tag :type="selectedCheckin.isPublic ? 'success' : 'info'">
                {{ selectedCheckin.isPublic ? '公开' : '私密' }}
              </el-tag>
            </el-descriptions-item>

            <el-descriptions-item label="精选状态">
              <el-tag :type="selectedCheckin.isFeatured ? 'success' : 'info'">
                {{ selectedCheckin.isFeatured ? '已精选' : '未精选' }}
              </el-tag>
            </el-descriptions-item>

            <el-descriptions-item label="获赞数">
              {{ selectedCheckin.likeCount || 0 }}
            </el-descriptions-item>

            <el-descriptions-item label="日记内容" v-if="selectedCheckin.note">
              <div class="note-content">
                {{ selectedCheckin.note }}
              </div>
            </el-descriptions-item>
          </el-descriptions>
        </div>
      </el-dialog>
      </div><!-- /records tab -->

    </div>
  </AdminLayout>
</template>

<script setup lang="ts">
// @ts-nocheck
import { ref, computed, onMounted } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import AdminLayout from '../components/AdminLayout.vue';
import api from '../services/api';

// ==================== 庆祝配置 ====================
const CATEGORIES = ['七个习惯', '晨读', '积累', '励志', '社区'];

const styleOptions = [
  { value: 'A', icon: '⚡', label: '能量爆发', desc: '深色背景，金色粒子四射' },
  { value: 'B', icon: '📖', label: '书页翻飞', desc: '浅色背景，书页纷飞' },
  { value: 'C', icon: '🌅', label: '光芒升起', desc: '底部卡片滑入' },
  { value: 'D', icon: '💥', label: '碎片裂变', desc: '屏幕裂光闪过，晶片向外爆开' },
  { value: 'E', icon: '🏅', label: '聚光登场', desc: '舞台聚光扫过，奖章弹出' },
  { value: 'F', icon: '🎊', label: '彩带狂欢', desc: '彩带飘落，白底欢庆' },
  { value: 'G', icon: '🚀', label: '火箭升空', desc: '火箭冲出云层，尾焰爆发' },
  { value: 'random', icon: '🎲', label: '随机', desc: '每次随机选一种' },
];
const randomStyleValues = styleOptions.filter(opt => opt.value !== 'random').map(opt => opt.value);

const activeTab = ref('records');
const celebConfig = ref<{ animationStyle: string; enabledAnimationStyles: string[]; messages: any[] }>({
  animationStyle: 'random',
  enabledAnimationStyles: [...randomStyleValues],
  messages: []
});
const filterCat = ref('');
const msgDialogVisible = ref(false);
const msgSaving = ref(false);
const editingMsg = ref<any>({});
const msgForm = ref({ content: '', category: '励志' });

// Preview dialog
const previewVisible = ref(false);
const previewStyle = ref('A');
const previewMessage = ref('打卡成功！坚持就是力量！');
const previewKey = ref(0);

const enabledMsgCount = computed(() => celebConfig.value.messages.filter((m: any) => m.isEnabled).length);
const allCategories = computed(() => [...new Set(celebConfig.value.messages.map((m: any) => m.category))]);
const filteredMessages = computed(() =>
  filterCat.value
    ? celebConfig.value.messages.filter((m: any) => m.category === filterCat.value)
    : celebConfig.value.messages
);

const loadCelebConfig = async () => {
  try {
    const res = await api.get('/checkin-celebration-config/admin');
    celebConfig.value = {
      ...res,
      enabledAnimationStyles: Array.isArray(res.enabledAnimationStyles) && res.enabledAnimationStyles.length > 0
        ? res.enabledAnimationStyles
        : [...randomStyleValues]
    };
  } catch (e) {
    console.error('加载庆祝配置失败', e);
  }
};

const setAnimationStyle = async (style: string) => {
  try {
    await api.put('/checkin-celebration-config/admin/style', { animationStyle: style });
    celebConfig.value.animationStyle = style;
    ElMessage.success('已更新动画方式');
  } catch (e) {
    ElMessage.error('更新失败');
  }
};

const isRandomStyleEnabled = (style: string): boolean => {
  return (celebConfig.value.enabledAnimationStyles || []).includes(style);
};

const toggleRandomStyle = async (style: string) => {
  try {
    const res = await api.patch(`/checkin-celebration-config/admin/random-styles/${style}/toggle`);
    celebConfig.value.enabledAnimationStyles = res.enabledAnimationStyles || [];
    ElMessage.success('已更新随机池');
  } catch (e: any) {
    ElMessage.error(e?.response?.data?.message || '更新随机池失败');
  }
};

const openAddMsg = () => {
  editingMsg.value = {};
  msgForm.value = { content: '', category: '励志' };
  msgDialogVisible.value = true;
};

const openEditMsg = (row: any) => {
  editingMsg.value = row;
  msgForm.value = { content: row.content, category: row.category };
  msgDialogVisible.value = true;
};

const saveMsg = async () => {
  if (!msgForm.value.content.trim()) {
    ElMessage.warning('内容不能为空');
    return;
  }
  msgSaving.value = true;
  try {
    if (editingMsg.value._id) {
      await api.put(`/checkin-celebration-config/admin/messages/${editingMsg.value._id}`, msgForm.value);
    } else {
      await api.post('/checkin-celebration-config/admin/messages', msgForm.value);
    }
    ElMessage.success(editingMsg.value._id ? '编辑成功' : '新增成功');
    msgDialogVisible.value = false;
    await loadCelebConfig();
  } catch (e) {
    ElMessage.error('保存失败');
  } finally {
    msgSaving.value = false;
  }
};

const toggleMsg = async (row: any) => {
  try {
    await api.patch(`/checkin-celebration-config/admin/messages/${row._id}/toggle`);
    row.isEnabled = !row.isEnabled;
  } catch (e) {
    ElMessage.error('操作失败');
  }
};

const deleteMsg = (row: any) => {
  ElMessageBox.confirm('确定要删除这条祝福语吗？', '删除确认', {
    confirmButtonText: '删除',
    cancelButtonText: '取消',
    type: 'warning'
  }).then(async () => {
    try {
      await api.delete(`/checkin-celebration-config/admin/messages/${row._id}`);
      ElMessage.success('已删除');
      await loadCelebConfig();
    } catch (e) {
      ElMessage.error('删除失败');
    }
  }).catch(() => {});
};

const randomPreviewStyle = (): string => {
  const styles = celebConfig.value.enabledAnimationStyles?.length
    ? celebConfig.value.enabledAnimationStyles
    : randomStyleValues;
  return styles[Math.floor(Math.random() * styles.length)];
};

const openPreview = (style: string) => {
  previewStyle.value = style;
  const enabled = celebConfig.value.messages.filter((m: any) => m.isEnabled);
  previewMessage.value = enabled.length > 0
    ? enabled[Math.floor(Math.random() * enabled.length)].content
    : '打卡成功！坚持就是力量！';
  previewKey.value++;
  previewVisible.value = true;
};

interface Checkin {
  _id: string;
  userId: any;
  periodId: any;
  sectionId: any;
  checkinDate: string;
  readingTime: number;
  completionRate: number;
  note: string;
  images: string[];
  mood: string;
  points: number;
  isPublic: boolean;
  isFeatured: boolean;
  likeCount: number;
  createdAt: string;
  updatedAt: string;
}

interface Period {
  _id: string;
  name: string;
  title: string;
}

// State
const checkins = ref<Checkin[]>([]);
const periods = ref<Period[]>([]);
const stats = ref({
  totalCount: 0,
  todayCount: 0,
  uniqueUserCount: 0,
  totalPoints: 0
});

const loading = ref(false);
const currentPage = ref(1);
const pageSize = ref(20);
const total = ref(0);

const detailDialogVisible = ref(false);
const selectedCheckin = ref<Checkin | null>(null);

const editDialogVisible = ref(false);
const editingCheckin = ref<Checkin | null>(null);
const editLoading = ref(false);
const editForm = ref({ note: '', isPublic: true });

const filters = ref({
  search: '',
  periodId: '',
  dateFrom: null as any,
  dateTo: null as any
});

// Methods
const formatDate = (date: string) => {
  return new Date(date).toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  });
};

const getMoodColor = (mood: string) => {
  const colors: Record<string, string> = {
    happy: 'success',
    calm: 'info',
    thoughtful: 'warning',
    inspired: 'success',
    other: 'info'
  };
  return colors[mood] || 'info';
};

const getMoodLabel = (mood: string) => {
  const labels: Record<string, string> = {
    happy: '😊 开心',
    calm: '😌 平静',
    thoughtful: '🤔 沉思',
    inspired: '✨ 灵感',
    other: '🤷 其他'
  };
  return labels[mood] || mood;
};

const getProgressColor = (percentage: number) => {
  if (percentage >= 90) return '#85ce61';
  if (percentage >= 70) return '#e6a23c';
  return '#f56c6c';
};

const handleSearch = () => {
  currentPage.value = 1;
  loadCheckins();
};

const resetFilters = () => {
  filters.value = {
    search: '',
    periodId: '',
    dateFrom: null,
    dateTo: null
  };
  currentPage.value = 1;
  loadCheckins();
};

const loadCheckins = async () => {
  loading.value = true;
  try {
    const params: Record<string, any> = {
      page: currentPage.value,
      limit: pageSize.value
    };

    if (filters.value.search) {
      params.search = filters.value.search;
    }
    if (filters.value.periodId) {
      params.periodId = filters.value.periodId;
    }
    if (filters.value.dateFrom) {
      params.dateFrom = new Date(filters.value.dateFrom).toISOString().split('T')[0];
    }
    if (filters.value.dateTo) {
      params.dateTo = new Date(filters.value.dateTo).toISOString().split('T')[0];
    }

    const res = await api.get('/admin/checkins', { params });
    checkins.value = res.list;
    total.value = res.pagination.total;
    stats.value = {
      ...stats.value,
      totalCount: res.stats.totalCount,
      todayCount: res.stats.todayCount,
      uniqueUserCount: res.stats.uniqueUserCount,
      totalPoints: res.stats.totalPoints
    };
  } catch (error) {
    ElMessage.error('加载打卡列表失败');
    console.error(error);
  } finally {
    loading.value = false;
  }
};

const loadStats = async () => {
  try {
    const params: Record<string, any> = {};
    if (filters.value.periodId) {
      params.periodId = filters.value.periodId;
    }
    if (filters.value.dateFrom) {
      params.dateFrom = new Date(filters.value.dateFrom).toISOString().split('T')[0];
    }
    if (filters.value.dateTo) {
      params.dateTo = new Date(filters.value.dateTo).toISOString().split('T')[0];
    }

    const res = await api.get('/admin/checkins/stats', { params });
    stats.value = res;
  } catch (error) {
    console.error('加载统计数据失败:', error);
  }
};

const loadPeriods = async () => {
  try {
    const res = await api.get('/periods');
    periods.value = res.list;
  } catch (error) {
    console.error('加载期次失败:', error);
  }
};

const handleViewDetail = (checkin: Checkin) => {
  selectedCheckin.value = checkin;
  detailDialogVisible.value = true;
};

const handleEditCheckin = (checkin: Checkin) => {
  editingCheckin.value = checkin;
  editForm.value = { note: checkin.note || '', isPublic: checkin.isPublic !== false };
  editDialogVisible.value = true;
};

const handleUpdateCheckin = async () => {
  if (!editingCheckin.value) return;
  editLoading.value = true;
  try {
    await api.put(`/admin/checkins/${editingCheckin.value._id}`, editForm.value);
    ElMessage.success('修改成功');
    editDialogVisible.value = false;
    loadCheckins();
  } catch (error) {
    ElMessage.error('修改失败');
    console.error(error);
  } finally {
    editLoading.value = false;
  }
};

const handleDeleteCheckin = (checkin: Checkin) => {
  ElMessageBox.confirm(
    `确定要删除 ${checkin.userId && typeof checkin.userId === 'object' ? checkin.userId.nickname : '该用户'} 的打卡记录吗？`,
    '删除确认',
    {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning'
    }
  )
    .then(async () => {
      try {
        await api.delete(`/admin/checkins/${checkin._id}`);
        ElMessage.success('打卡记录已删除');
        loadCheckins();
        loadStats();
      } catch (error) {
        ElMessage.error('删除失败');
        console.error(error);
      }
    })
    .catch(() => {
      // 取消删除
    });
};

// Lifecycle
onMounted(() => {
  loadPeriods();
  loadCheckins();
  loadStats();
  loadCelebConfig();
});
</script>

<style scoped lang="scss">
.checkins-management-container {
  padding: 20px;

  .stats-cards {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: 20px;
    margin-bottom: 20px;

    .stat-card {
      text-align: center;

      .stat-header {
        color: #666;
        font-size: 14px;
      }

      .stat-value {
        font-size: 32px;
        font-weight: bold;
        color: var(--admin-primary);
        margin: 10px 0;
      }

      .stat-label {
        color: #999;
        font-size: 12px;
      }
    }
  }

  .card-header {
    display: flex;
    align-items: center;
    justify-content: space-between;

    .card-title {
      font-weight: bold;
      color: #333;
    }
  }

  .filter-card {
    margin-bottom: 20px;
  }

  .compact-filter-form {
    display: grid;
    grid-template-columns: minmax(260px, 1.3fr) minmax(220px, 1fr) 220px 220px auto;
    gap: 12px 16px;
    align-items: center;

    :deep(.el-form-item) {
      margin: 0;
    }

    :deep(.el-form-item__label) {
      white-space: nowrap;
    }

    :deep(.el-input),
    :deep(.el-select),
    :deep(.el-date-editor) {
      width: 100%;
    }

    .filter-actions {
      justify-self: start;
    }
  }

  @media (max-width: 1500px) {
    .compact-filter-form {
      grid-template-columns: minmax(260px, 1fr) minmax(220px, 1fr) 220px 220px;

      .filter-actions {
        grid-column: 1 / -1;
      }
    }
  }

  @media (max-width: 1100px) {
    .compact-filter-form {
      grid-template-columns: 1fr 1fr;
    }
  }

  .user-cell {
    .user-info {
      .user-name {
        font-weight: 500;
        color: #333;
      }

      .user-id {
        font-size: 12px;
        color: #999;
      }
    }
  }

  .action-buttons {
    display: flex;
    gap: 8px;
  }

  .checkin-detail {
    padding: 20px 0;

    .note-content {
      white-space: pre-wrap;
      word-break: break-word;
      line-height: 1.6;
      color: #333;
    }
  }

  .main-tabs {
    margin-bottom: 20px;
  }

  .config-panel {
    display: flex;
    flex-direction: column;
    gap: 20px;
  }

  .config-card {
    .style-selector {
      display: grid;
      grid-template-columns: repeat(4, minmax(0, 1fr));
      gap: 16px;

      .style-option {
        min-width: 140px;
        border: 2px solid #e5e7eb;
        border-radius: 12px;
        padding: 20px 16px;
        text-align: center;
        cursor: pointer;
        transition: all 0.2s;

        &:hover { border-color: var(--admin-primary); }
        &.active { border-color: var(--admin-primary); background: var(--admin-primary-soft); }

        .style-icon { font-size: 32px; margin-bottom: 8px; }
        .style-label { font-weight: bold; color: #1f2937; margin-bottom: 4px; }
        .style-desc { font-size: 12px; color: #6b7280; }
        .random-toggle {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          margin-top: 12px;
          color: #6b7280;
          font-size: 12px;
          cursor: default;
        }
        .preview-btn { margin-top: 8px; }
      }
    }

    .category-filter {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
      margin-bottom: 16px;

      .cat-tag { cursor: pointer; }
    }

    .msg-table { margin-top: 8px; }
  }
}

// ====== Phone Preview Frame ======
.phone-frame-wrap {
  display: flex;
  justify-content: center;
  padding: 8px 0 0;
}

.phone-frame {
  width: 320px;
  height: 568px;
  border: 3px solid #222;
  border-radius: 36px;
  overflow: hidden;
  background: #fff;
  position: relative;
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.25);
}

.phone-status-bar {
  height: 28px;
  background: #f5f5f5;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 16px;
  font-size: 10px;
  color: #333;
  border-bottom: 1px solid #e0e0e0;
}

.phone-nav-bar {
  height: 44px;
  background: #fff;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 14px;
  border-bottom: 1px solid #eee;
  font-size: 14px;
  font-weight: 600;
  color: #1f2937;
}

.phone-nav-back {
  font-size: 22px;
  color: var(--admin-primary);
  line-height: 1;
}

.phone-body {
  position: relative;
  width: 100%;
  height: calc(568px - 28px - 44px);
  overflow: hidden;
  background: #fff;
}

.phone-page-bg {
  padding: 16px;

  .phone-page-title {
    font-size: 15px;
    font-weight: bold;
    color: #1f2937;
    margin-bottom: 12px;
  }

  .phone-page-textarea {
    background: #f3f4f6;
    border-radius: 8px;
    padding: 12px;
    min-height: 100px;
    color: #bbb;
    font-size: 13px;
  }
}

// ====== Web Celebration Animations ======
.cel-overlay-web {
  position: absolute;
  top: 0; left: 0;
  width: 100%; height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  animation: cel-fade-in-web 0.25s ease-out forwards;
}

@keyframes cel-fade-in-web {
  from { opacity: 0; }
  to   { opacity: 1; }
}

// Style A — Energy Burst
.cel-a-web { background: rgba(0, 0, 0, 0.88); }

.cel-ring-web {
  position: absolute;
  top: 50%; left: 50%;
  border-radius: 50%;
  border: 2px solid rgba(255, 215, 0, 0.8);
  animation: ring-expand-web 0.7s ease-out forwards;

  &.r1 { width: 60px; height: 60px; animation-delay: 0s; }
  &.r2 { width: 80px; height: 80px; animation-delay: 0.1s; }
}

@keyframes ring-expand-web {
  0%   { transform: translate(-50%, -50%) scale(0.5); opacity: 1; }
  100% { transform: translate(-50%, -50%) scale(4);   opacity: 0; }
}

.cel-p-web {
  position: absolute;
  top: 50%; left: 50%;
  width: 8px; height: 8px;
  border-radius: 50%;
  background: #FFD700;
  animation-duration: 0.7s;
  animation-timing-function: ease-out;
  animation-fill-mode: both;
}

.p1  { animation-name: cfly-up-w;  animation-delay: 0.05s; }
.p2  { animation-name: cfly-dn-w;  animation-delay: 0.10s; }
.p3  { animation-name: cfly-lt-w;  animation-delay: 0.05s; }
.p4  { animation-name: cfly-rt-w;  animation-delay: 0.10s; }
.p5  { animation-name: cfly-ul-w;  animation-delay: 0.08s; background: #FF6B6B; }
.p6  { animation-name: cfly-ur-w;  animation-delay: 0.12s; background: #4ECDC4; }
.p7  { animation-name: cfly-dl-w;  animation-delay: 0.06s; background: #FF6B6B; }
.p8  { animation-name: cfly-dr-w;  animation-delay: 0.14s; background: #4ECDC4; }
.p9  { animation-name: cfly-up-w;  animation-delay: 0.16s; background: #FF6B6B; width: 5px; height: 5px; }
.p10 { animation-name: cfly-rt-w;  animation-delay: 0.18s; background: #4ECDC4; width: 5px; height: 5px; }
.p11 { animation-name: cfly-ul-w;  animation-delay: 0.20s; width: 5px; height: 5px; }
.p12 { animation-name: cfly-dr-w;  animation-delay: 0.22s; background: #FF6B6B; width: 5px; height: 5px; }

@keyframes cfly-up-w { 0% { transform: translate(-50%, -50%); opacity: 1; } 100% { transform: translate(-50%, calc(-50% - 110px)); opacity: 0; } }
@keyframes cfly-dn-w { 0% { transform: translate(-50%, -50%); opacity: 1; } 100% { transform: translate(-50%, calc(-50% + 110px)); opacity: 0; } }
@keyframes cfly-lt-w { 0% { transform: translate(-50%, -50%); opacity: 1; } 100% { transform: translate(calc(-50% - 110px), -50%); opacity: 0; } }
@keyframes cfly-rt-w { 0% { transform: translate(-50%, -50%); opacity: 1; } 100% { transform: translate(calc(-50% + 110px), -50%); opacity: 0; } }
@keyframes cfly-ul-w { 0% { transform: translate(-50%, -50%); opacity: 1; } 100% { transform: translate(calc(-50% - 78px), calc(-50% - 78px)); opacity: 0; } }
@keyframes cfly-ur-w { 0% { transform: translate(-50%, -50%); opacity: 1; } 100% { transform: translate(calc(-50% + 78px), calc(-50% - 78px)); opacity: 0; } }
@keyframes cfly-dl-w { 0% { transform: translate(-50%, -50%); opacity: 1; } 100% { transform: translate(calc(-50% - 78px), calc(-50% + 78px)); opacity: 0; } }
@keyframes cfly-dr-w { 0% { transform: translate(-50%, -50%); opacity: 1; } 100% { transform: translate(calc(-50% + 78px), calc(-50% + 78px)); opacity: 0; } }

.cel-card-web {
  position: relative; z-index: 10;
  border-radius: 16px;
  padding: 18px 14px 14px;
  text-align: center;
  width: 200px;
  animation: card-drop-web 0.45s cubic-bezier(0.34, 1.56, 0.64, 1) 0.2s both;
}

@keyframes card-drop-web {
  from { transform: translateY(-24px) scale(0.85); opacity: 0; }
  to   { transform: translateY(0) scale(1); opacity: 1; }
}

.card-a-web {
  background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
  box-shadow: 0 8px 32px rgba(255, 215, 0, 0.3);
}

.cel-icon-a-web {
  width: 44px; height: 44px;
  background: linear-gradient(135deg, #FFD700, #FF8C00);
  border-radius: 50%;
  margin: 0 auto 10px;
  font-size: 20px; color: #fff; font-weight: bold;
  display: flex; align-items: center; justify-content: center;
  animation: icon-pop-web 0.35s cubic-bezier(0.34, 1.56, 0.64, 1) 0.4s both;
}

@keyframes icon-pop-web {
  from { transform: scale(0) rotate(-180deg); }
  to   { transform: scale(1) rotate(0deg); }
}

.cel-msg-web  { font-size: 12px; line-height: 1.5; }
.msg-a-web    { color: #FFD700; font-weight: 500; }
.cel-hint-web { margin-top: 8px; font-size: 10px; opacity: 0.5; color: #fff; }

// Style B — Flying Pages
.cel-b-web { background: rgba(240, 248, 255, 0.96); }

.cel-page-web {
  position: absolute;
  top: 50%; left: 50%;
  width: 30px; height: 38px;
  border-radius: 3px;
  background: linear-gradient(135deg, #fff 60%, #e8f4fd);
  border: 1px solid #c8e6f9;
  box-shadow: 2px 2px 6px rgba(0, 0, 0, 0.08);
  animation-duration: 0.85s;
  animation-timing-function: ease-out;
  animation-fill-mode: both;
}

.pg1 { animation-name: pflip1-w; animation-delay: 0.05s; }
.pg2 { animation-name: pflip2-w; animation-delay: 0.10s; }
.pg3 { animation-name: pflip3-w; animation-delay: 0.15s; }
.pg4 { animation-name: pflip4-w; animation-delay: 0.08s; }
.pg5 { animation-name: pflip5-w; animation-delay: 0.12s; }
.pg6 { animation-name: pflip6-w; animation-delay: 0.18s; }

@keyframes pflip1-w { 0% { transform: translate(-50%, -50%) scale(0); opacity: 1; } 100% { transform: translate(calc(-50% - 85px),  calc(-50% - 110px)) scale(1) rotate(-22deg); opacity: 0; } }
@keyframes pflip2-w { 0% { transform: translate(-50%, -50%) scale(0); opacity: 1; } 100% { transform: translate(calc(-50% + 85px),  calc(-50% - 110px)) scale(1) rotate(22deg);  opacity: 0; } }
@keyframes pflip3-w { 0% { transform: translate(-50%, -50%) scale(0); opacity: 1; } 100% { transform: translate(calc(-50% - 115px), calc(-50% - 55px))  scale(1) rotate(-38deg); opacity: 0; } }
@keyframes pflip4-w { 0% { transform: translate(-50%, -50%) scale(0); opacity: 1; } 100% { transform: translate(calc(-50% + 115px), calc(-50% - 55px))  scale(1) rotate(38deg);  opacity: 0; } }
@keyframes pflip5-w { 0% { transform: translate(-50%, -50%) scale(0); opacity: 1; } 100% { transform: translate(calc(-50% - 55px),  calc(-50% + 120px)) scale(1) rotate(-12deg); opacity: 0; } }
@keyframes pflip6-w { 0% { transform: translate(-50%, -50%) scale(0); opacity: 1; } 100% { transform: translate(calc(-50% + 55px),  calc(-50% + 120px)) scale(1) rotate(12deg);  opacity: 0; } }

.card-b-web {
  background: #fff;
  box-shadow: 0 8px 24px rgba(74, 144, 226, 0.2);
}

.cel-book-web {
  font-size: 36px; margin-bottom: 10px;
  animation: book-pop-web 0.45s cubic-bezier(0.34, 1.56, 0.64, 1) 0.3s both;
}

@keyframes book-pop-web {
  from { transform: scale(0) translateY(16px); }
  to   { transform: scale(1) translateY(0); }
}

.msg-b-web  { color: #1f2937; font-weight: 500; }
.hint-b-web { color: #9ca3af; margin-top: 6px; font-size: 10px; }

// Style C — Rising Light
.cel-c-web {
  background: rgba(0, 0, 0, 0.45);
  backdrop-filter: blur(3px);
  align-items: flex-end;
}

.cel-sheet-web {
  width: 100%;
  background: linear-gradient(180deg, #fff 0%, #f8faff 100%);
  border-radius: 18px 18px 0 0;
  padding: 18px 16px 28px;
  text-align: center;
  animation: sheet-up-web 0.4s cubic-bezier(0.34, 1.56, 0.64, 1) both;
}

@keyframes sheet-up-web {
  from { transform: translateY(100%); }
  to   { transform: translateY(0); }
}

.cel-icon-c-web {
  width: 48px; height: 48px;
  background: linear-gradient(135deg, var(--admin-primary), var(--admin-primary-deep));
  border-radius: 50%;
  margin: 0 auto 10px;
  font-size: 22px; color: #fff; font-weight: bold;
  display: flex; align-items: center; justify-content: center;
}

.cel-title-c-web {
  font-size: 17px; font-weight: bold;
  color: #1f2937; margin-bottom: 6px;
}

.msg-c-web { color: #4b5563; font-size: 12px; line-height: 1.5; }

.cel-dots-web {
  display: flex; justify-content: center; gap: 6px; margin: 10px 0;
}

.dot-web {
  width: 7px; height: 7px;
  border-radius: 50%;
  animation: dot-pulse-w 1.2s ease-in-out infinite;
}

.primary-dot {
  background: var(--admin-primary);
}

@keyframes dot-pulse-w {
  0%, 100% { transform: scale(1); opacity: 0.6; }
  50%      { transform: scale(1.4); opacity: 1; }
}

.cel-close-btn-web {
  display: inline-block;
  margin-top: 10px;
  background: linear-gradient(135deg, var(--admin-primary), var(--admin-primary-deep));
  color: #fff;
  border-radius: 18px;
  padding: 7px 18px;
  font-size: 12px;
}

// Style D — Split Shards
.cel-d-web {
  background: linear-gradient(135deg, #111827 0%, #0f172a 55%, #020617 100%);
}

.shock-web {
  position: absolute;
  left: 50%;
  top: 50%;
  border-radius: 50%;
  border: 2px solid rgba(45,212,191,0.64);
}

.shock-web-1 { width: 96px; height: 96px; animation: shock-split-web 0.92s ease-out 0.06s both; }
.shock-web-2 { width: 160px; height: 160px; animation: shock-split-web 1.05s ease-out 0.16s both; }

.crack-web {
  position: absolute;
  left: 50%;
  top: 50%;
  background: linear-gradient(90deg, transparent, rgba(255,255,255,0.94), transparent);
  box-shadow: 0 0 14px rgba(45,212,191,0.8);
  opacity: 0;
}

.crack-web-h { width: 300px; height: 2px; animation: crack-flash-web 0.46s ease-out 0.08s both; }
.crack-web-v { width: 2px; height: 300px; animation: crack-flash-v-web 0.46s ease-out 0.12s both; }

.shard-web {
  position: absolute;
  left: 50%;
  top: 50%;
  width: 20px;
  height: 28px;
  border-radius: 4px 4px 10px 4px;
  background: linear-gradient(135deg, rgba(45,212,191,0.95), rgba(14,165,233,0.72));
  box-shadow: 0 0 12px rgba(45,212,191,0.5);
  opacity: 0;
}

.shard-web-1 { animation: shard1-web 0.82s ease-out 0.06s both; }
.shard-web-2 { animation: shard2-web 0.86s ease-out 0.08s both; }
.shard-web-3 { animation: shard3-web 0.78s ease-out 0.1s both; }
.shard-web-4 { animation: shard4-web 0.88s ease-out 0.06s both; }
.shard-web-5 { animation: shard5-web 0.8s ease-out 0.12s both; }
.shard-web-6 { animation: shard6-web 0.84s ease-out 0.16s both; }
.shard-web-7 { animation: shard7-web 0.9s ease-out 0.08s both; }
.shard-web-8 { animation: shard8-web 0.82s ease-out 0.14s both; }
.shard-web-9 { animation: shard9-web 0.74s ease-out 0.18s both; }
.shard-web-10 { animation: shard10-web 0.86s ease-out 0.2s both; }

.card-d-web {
  background: rgba(15,23,42,0.78);
  border: 1px solid rgba(45,212,191,0.4);
  box-shadow: 0 12px 36px rgba(45,212,191,0.24);
}

.cel-icon-d-web {
  font-size: 44px;
  color: #99f6e4;
  margin-bottom: 8px;
  text-shadow: 0 0 18px rgba(45,212,191,0.9);
}

.msg-d-web {
  color: #ccfbf1;
  font-weight: 600;
  text-shadow: 0 0 12px rgba(45,212,191,0.72);
}

@keyframes shock-split-web { 0% { transform: translate(-50%,-50%) scale(0.2); opacity: 0; } 24% { opacity: 1; } 100% { transform: translate(-50%,-50%) scale(2.45); opacity: 0; } }
@keyframes crack-flash-web { 0% { transform: translate(-50%,-50%) scaleX(0); opacity: 0; } 30% { opacity: 1; } 100% { transform: translate(-50%,-50%) scaleX(1); opacity: 0; } }
@keyframes crack-flash-v-web { 0% { transform: translate(-50%,-50%) scaleY(0); opacity: 0; } 30% { opacity: 1; } 100% { transform: translate(-50%,-50%) scaleY(1); opacity: 0; } }
@keyframes shard1-web { 0% { transform: translate(-50%,-50%) rotate(0); opacity: 1; } 100% { transform: translate(-122px,-112px) rotate(-160deg); opacity: 0; } }
@keyframes shard2-web { 0% { transform: translate(-50%,-50%) rotate(0); opacity: 1; } 100% { transform: translate(-38px,-145px) rotate(110deg); opacity: 0; } }
@keyframes shard3-web { 0% { transform: translate(-50%,-50%) rotate(0); opacity: 1; } 100% { transform: translate(98px,-122px) rotate(190deg); opacity: 0; } }
@keyframes shard4-web { 0% { transform: translate(-50%,-50%) rotate(0); opacity: 1; } 100% { transform: translate(140px,-24px) rotate(-120deg); opacity: 0; } }
@keyframes shard5-web { 0% { transform: translate(-50%,-50%) rotate(0); opacity: 1; } 100% { transform: translate(104px,108px) rotate(150deg); opacity: 0; } }
@keyframes shard6-web { 0% { transform: translate(-50%,-50%) rotate(0); opacity: 1; } 100% { transform: translate(-10px,148px) rotate(-210deg); opacity: 0; } }
@keyframes shard7-web { 0% { transform: translate(-50%,-50%) rotate(0); opacity: 1; } 100% { transform: translate(-126px,84px) rotate(130deg); opacity: 0; } }
@keyframes shard8-web { 0% { transform: translate(-50%,-50%) rotate(0); opacity: 1; } 100% { transform: translate(-150px,-14px) rotate(-90deg); opacity: 0; } }
@keyframes shard9-web { 0% { transform: translate(-50%,-50%) rotate(0); opacity: 1; } 100% { transform: translate(36px,-96px) rotate(230deg); opacity: 0; } }
@keyframes shard10-web { 0% { transform: translate(-50%,-50%) rotate(0); opacity: 1; } 100% { transform: translate(40px,112px) rotate(-180deg); opacity: 0; } }

// Style E — Stage Spotlight
.cel-e-web {
  background: linear-gradient(180deg, #1e3a8a 0%, #312e81 50%, #111827 100%);
}

.spotlight-web {
  position: absolute;
  top: -60px;
  width: 110px;
  height: 360px;
  background: linear-gradient(180deg, rgba(253,224,71,0.62), rgba(253,224,71,0));
  transform-origin: top center;
  opacity: 0;
}

.spot-web-left { left: 8%; transform: rotate(24deg); animation: spot-left-web 1.25s ease-out 0.08s both; }
.spot-web-right { right: 8%; transform: rotate(-24deg); animation: spot-right-web 1.25s ease-out 0.14s both; }

.stage-web {
  position: absolute;
  left: 50%;
  bottom: 0;
  width: 290px;
  height: 90px;
  border-radius: 50% 50% 0 0;
  background: radial-gradient(ellipse at center, rgba(251,191,36,0.52), rgba(251,191,36,0));
  animation: stage-rise-web 0.7s ease-out both;
}

.medal-glow-web {
  position: absolute;
  left: 50%;
  top: 42%;
  width: 110px;
  height: 110px;
  border-radius: 50%;
  background: radial-gradient(circle, rgba(251,191,36,0.7), rgba(251,191,36,0));
  animation: medal-glow-web 1.1s ease-out 0.24s both;
}

.stage-star-web {
  position: absolute;
  color: #fde68a;
  font-size: 18px;
  opacity: 0;
  text-shadow: 0 0 12px rgba(253,230,138,0.9);
}

.stage-star-web-1 { left: 20%; top: 30%; animation: stage-star-web 0.8s ease-out 0.3s both; }
.stage-star-web-2 { right: 22%; top: 27%; animation: stage-star-web 0.8s ease-out 0.42s both; }
.stage-star-web-3 { left: 48%; top: 16%; animation: stage-star-web 0.8s ease-out 0.54s both; }

.card-e-web {
  background: rgba(255,255,255,0.94);
  box-shadow: 0 12px 38px rgba(251,191,36,0.3);
}

.card-e-web .cel-hint-web {
  color: #9ca3af;
  opacity: 1;
}

.cel-icon-e-web {
  font-size: 42px;
  margin-bottom: 4px;
  animation: medal-drop-web 0.7s cubic-bezier(0.34, 1.56, 0.64, 1) 0.34s both;
}

.cel-title-e-web {
  color: #92400e;
  font-size: 17px;
  font-weight: 700;
  margin-bottom: 6px;
}

.msg-e-web {
  color: #78350f;
  font-weight: 600;
}

@keyframes spot-left-web { 0% { opacity: 0; transform: rotate(48deg); } 35% { opacity: 1; } 100% { opacity: 0.85; transform: rotate(24deg); } }
@keyframes spot-right-web { 0% { opacity: 0; transform: rotate(-48deg); } 35% { opacity: 1; } 100% { opacity: 0.85; transform: rotate(-24deg); } }
@keyframes stage-rise-web { from { transform: translateX(-50%) translateY(60px); opacity: 0; } to { transform: translateX(-50%) translateY(0); opacity: 1; } }
@keyframes medal-glow-web { 0% { transform: translate(-50%,-50%) scale(0.2); opacity: 0; } 45% { opacity: 1; } 100% { transform: translate(-50%,-50%) scale(1.9); opacity: 0; } }
@keyframes stage-star-web { 0% { transform: translateY(14px) scale(0); opacity: 0; } 60% { transform: translateY(0) scale(1.4); opacity: 1; } 100% { transform: translateY(-12px) scale(1); opacity: 0.8; } }
@keyframes medal-drop-web { 0% { transform: translateY(-58px) rotate(-18deg); opacity: 0; } 70% { transform: translateY(4px) rotate(5deg); opacity: 1; } 100% { transform: translateY(0) rotate(0); opacity: 1; } }

// Style F — Confetti
.cel-f-web {
  background: linear-gradient(180deg, #fff7ed 0%, #fef3c7 44%, #ffffff 100%);
}

.confetti-web {
  position: absolute;
  top: -34px;
  width: 8px;
  height: 22px;
  border-radius: 3px;
  opacity: 0;
  animation: confetti-fall-web 1.45s ease-in both;
}

.cf-web-1 { left: 8%; background: #ef4444; animation-delay: 0.02s; }
.cf-web-2 { left: 16%; background: #f97316; animation-delay: 0.16s; }
.cf-web-3 { left: 24%; background: #facc15; animation-delay: 0.07s; }
.cf-web-4 { left: 34%; background: #22c55e; animation-delay: 0.24s; }
.cf-web-5 { left: 43%; background: #14b8a6; animation-delay: 0.12s; }
.cf-web-6 { left: 51%; background: var(--admin-primary); animation-delay: 0.28s; }
.cf-web-7 { left: 60%; background: #6366f1; animation-delay: 0.06s; }
.cf-web-8 { left: 68%; background: #a855f7; animation-delay: 0.2s; }
.cf-web-9 { left: 76%; background: #ec4899; animation-delay: 0.1s; }
.cf-web-10 { left: 84%; background: #06b6d4; animation-delay: 0.32s; }
.cf-web-11 { left: 30%; background: #f43f5e; animation-delay: 0.4s; }
.cf-web-12 { left: 70%; background: #84cc16; animation-delay: 0.44s; }

.card-f-web {
  background: rgba(255,255,255,0.95);
  box-shadow: 0 10px 34px rgba(249,115,22,0.22);
}

.cel-icon-f-web {
  font-size: 42px;
  margin-bottom: 6px;
}

.cel-title-f-web {
  color: #9a3412;
  font-size: 17px;
  font-weight: 700;
  margin-bottom: 6px;
}

.msg-f-web {
  color: #7c2d12;
  font-weight: 600;
}

.hint-f-web {
  margin-top: 8px;
  color: #9ca3af;
  font-size: 10px;
}

@keyframes confetti-fall-web { 0% { transform: translateY(0) rotate(0); opacity: 0; } 12% { opacity: 1; } 100% { transform: translateY(500px) rotate(520deg); opacity: 0; } }

// Style G — Rocket Launch
.cel-g-web {
  background: linear-gradient(180deg, #38bdf8 0%, #2563eb 46%, #0f172a 100%);
}

.rocket-trail-web {
  position: absolute;
  left: 50%;
  bottom: 108px;
  width: 12px;
  height: 120px;
  border-radius: 999px;
  transform-origin: bottom center;
  opacity: 0;
  background: linear-gradient(180deg, rgba(255,255,255,0), rgba(251,191,36,0.95), rgba(239,68,68,0));
}

.trail-web-1 { margin-left: -6px; animation: rocket-trail-web 0.95s ease-out 0.06s both; }
.trail-web-2 { margin-left: -28px; transform: rotate(-12deg); animation: rocket-trail-left-web 1s ease-out 0.12s both; }
.trail-web-3 { margin-left: 16px; transform: rotate(12deg); animation: rocket-trail-right-web 1s ease-out 0.12s both; }

.cloud-web {
  position: absolute;
  bottom: 72px;
  width: 68px;
  height: 32px;
  border-radius: 999px;
  background: rgba(255,255,255,0.86);
  opacity: 0;
}

.cloud-web-1 { left: 14%; animation: cloud-left-web 0.92s ease-out 0.15s both; }
.cloud-web-2 { right: 12%; animation: cloud-right-web 0.92s ease-out 0.18s both; }
.cloud-web-3 { left: 40%; width: 82px; animation: cloud-center-web 0.92s ease-out 0.12s both; }

.rocket-spark-web {
  position: absolute;
  left: 50%;
  bottom: 118px;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #fde68a;
  box-shadow: 0 0 8px rgba(253,230,138,0.95);
  opacity: 0;
}

.rocket-spark-web-1 { animation: rocket-spark1-web 0.75s ease-out 0.18s both; }
.rocket-spark-web-2 { animation: rocket-spark2-web 0.75s ease-out 0.24s both; }
.rocket-spark-web-3 { animation: rocket-spark3-web 0.75s ease-out 0.3s both; }
.rocket-spark-web-4 { animation: rocket-spark4-web 0.75s ease-out 0.34s both; }

.card-g-web {
  background: rgba(255,255,255,0.92);
  box-shadow: 0 12px 38px rgba(37,99,235,0.34);
}

.card-g-web .cel-hint-web {
  color: #9ca3af;
  opacity: 1;
}

.cel-icon-g-web {
  font-size: 44px;
  margin-bottom: 8px;
  animation: rocket-lift-web 0.9s cubic-bezier(0.34, 1.56, 0.64, 1) 0.22s both;
}

.msg-g-web {
  color: #1e3a8a;
  font-weight: 600;
}

@keyframes rocket-trail-web { 0% { transform: scaleY(0); opacity: 0; } 30% { opacity: 1; } 100% { transform: scaleY(1.5) translateY(58px); opacity: 0; } }
@keyframes rocket-trail-left-web { 0% { transform: rotate(-12deg) scaleY(0); opacity: 0; } 30% { opacity: 0.9; } 100% { transform: rotate(-12deg) scaleY(1.2) translateY(50px); opacity: 0; } }
@keyframes rocket-trail-right-web { 0% { transform: rotate(12deg) scaleY(0); opacity: 0; } 30% { opacity: 0.9; } 100% { transform: rotate(12deg) scaleY(1.2) translateY(50px); opacity: 0; } }
@keyframes cloud-left-web { 0% { transform: translateX(38px) scale(0.4); opacity: 0; } 35% { opacity: 1; } 100% { transform: translateX(-58px) scale(1.25); opacity: 0; } }
@keyframes cloud-right-web { 0% { transform: translateX(-38px) scale(0.4); opacity: 0; } 35% { opacity: 1; } 100% { transform: translateX(58px) scale(1.25); opacity: 0; } }
@keyframes cloud-center-web { 0% { transform: translateY(14px) scale(0.4); opacity: 0; } 35% { opacity: 1; } 100% { transform: translateY(34px) scale(1.35); opacity: 0; } }
@keyframes rocket-spark1-web { 0% { transform: translate(0,0); opacity: 1; } 100% { transform: translate(-70px,-56px); opacity: 0; } }
@keyframes rocket-spark2-web { 0% { transform: translate(0,0); opacity: 1; } 100% { transform: translate(70px,-60px); opacity: 0; } }
@keyframes rocket-spark3-web { 0% { transform: translate(0,0); opacity: 1; } 100% { transform: translate(-52px,42px); opacity: 0; } }
@keyframes rocket-spark4-web { 0% { transform: translate(0,0); opacity: 1; } 100% { transform: translate(58px,38px); opacity: 0; } }
@keyframes rocket-lift-web { 0% { transform: translateY(42px) rotate(-10deg); opacity: 0; } 62% { transform: translateY(-8px) rotate(5deg); opacity: 1; } 100% { transform: translateY(0) rotate(0); opacity: 1; } }

@media (max-width: 1200px) {
  .checkins-management-container .config-card .style-selector {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
</style>
