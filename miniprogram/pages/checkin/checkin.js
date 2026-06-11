const checkinService = require('../../services/checkin.service');
const courseService = require('../../services/course.service');
const checkinConfigService = require('../../services/checkinConfig.service');
const activityService = require('../../services/activity.service');
const subscribeAutoTopUp = require('../../utils/subscribe-auto-topup');
const { renderRichTextContent } = require('../../utils/markdown');
const { getLastTextChar } = require('../../utils/avatar');
const {
  getPeriodAccess,
  extractId,
  redirectAfterCommunityDenied
} = require('../../utils/period-access');
const { tenantStorage } = require('../../utils/storage');

const COMMUNITY_AUTO_TOP_UP_SCENES = [
  'comment_received',
  'like_received',
  'next_day_study_reminder'
];

const MAX_DIARY_LENGTH = 3000;

function getErrorMessage(error) {
  return (
    error?.message ||
    error?.data?.message ||
    error?.errMsg ||
    error?.error?.message ||
    ''
  );
}

Page({
  data: {
    statusBarHeight: 20,
    courseId: null,
    sectionId: null,
    periodId: null,
    checkinId: null,
    isEditMode: false,
    courseTitle: '',
    courseDate: '',

    // 五大学习模块内容
    meditation: '',
    question: '',
    content: '',
    reflection: '',
    action: '',

    // UI状态
    expanded: false,

    // 日记内容
    diaryContent: '',
    maxDiaryLength: MAX_DIARY_LENGTH,

    // 可见范围
    visibility: 'all', // 'all' 或 'admin'
    accessChecked: false,
    showPageContent: false,

    // 草稿状态
    isDirty: false,
    autoSaveStatus: '',
    showExitModal: false,

    // 打卡庆祝动画
    showCelebration: false,
    celebrationStyle: 'A',   // 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G'
    celebrationMessage: '打卡成功！坚持就是力量！'
  },

  /**
   * 清理 HTML，使其与课程详情页的 rich-text 呈现一致
   */
  cleanHtmlForRichText(content) {
    if (!content) return '';

    let cleaned = renderRichTextContent(content);

    cleaned = cleaned.replace(/\s+class="[^"]*"/gi, '');
    cleaned = cleaned.replace(/<img([^>]*?)\s+style="[^"]*"/gi, '<img$1');
    cleaned = cleaned.replace(
      /<p>(\d+\.\s)/gi,
      '<p style="margin-bottom:16px;">$1'
    );
    cleaned = cleaned.replace(
      /<img([^>]*?)>/gi,
      '<img$1 style="display:block;width:100%;height:auto;margin:12px 0;border-radius:4px;" />'
    );
    cleaned = cleaned.replace(/<img([^>]*?)src/gi, (match, before) => {
      if (!before.includes('alt=')) {
        return `<img${before}alt="图片" src`;
      }
      return match;
    });
    cleaned = cleaned.replace(/\s+(?!src|href|alt|style)[\w-]+="[^"]*"/gi, '');

    return cleaned;
  },

  async onLoad(options) {
    console.log('打卡页面加载，参数:', options);

    // 获取状态栏高度，用于自定义导航栏
    try {
      const { statusBarHeight } = wx.getWindowInfo?.() || {};
      this.setData({ statusBarHeight: statusBarHeight || 20 });
    } catch (e) {
      this.setData({ statusBarHeight: 20 });
    }

    // 编辑模式：从打卡详情页进入
    if (options.checkinId) {
      this.setData({ checkinId: options.checkinId, isEditMode: true });
      wx.setNavigationBarTitle({ title: '编辑打卡' });
    } else {
      // 记录进入页面的时间，提交时用于计算阅读时长
      this._readingStartTime = Date.now();
    }

    // 兼容多种参数形式：courseId、id、sectionId
    const sectionId = options.sectionId || options.courseId || options.id;
    const periodId = options.periodId;

    if (!sectionId) {
      wx.showToast({
        title: '缺少课节参数',
        icon: 'none'
      });
      setTimeout(() => {
        wx.navigateBack();
      }, 1500);
      return;
    }

    let resolvedPeriodId = extractId(periodId);
    let prefetchedCourse = null;

    try {
      prefetchedCourse = await courseService.getCourseDetail(sectionId);
      resolvedPeriodId =
        resolvedPeriodId || extractId(prefetchedCourse.periodId);
    } catch (error) {
      console.error('预加载课程详情失败:', error);
    }

    if (!resolvedPeriodId) {
      wx.showToast({
        title: '缺少期次信息',
        icon: 'none'
      });
      setTimeout(() => {
        wx.navigateBack();
      }, 1500);
      return;
    }

    const access = await getPeriodAccess(resolvedPeriodId);
    if (access.communityAccessState !== 'enabled') {
      redirectAfterCommunityDenied(
        `/pages/course-detail/course-detail?id=${sectionId}`
      );
      return;
    }

    this.setData({
      courseId: sectionId,
      sectionId,
      periodId: resolvedPeriodId,
      accessChecked: true
    });

    // 编辑模式：加载已有打卡内容填充表单（覆盖草稿）
    if (options.checkinId) {
      try {
        const existing = await checkinService.getCheckinDetail(options.checkinId);
        if (existing) {
          this.setData({
            diaryContent: existing.note || existing.content || '',
            visibility: existing.isPublic === false ? 'admin' : 'all',
            isDirty: false
          });
        }
      } catch (e) {
        console.error('加载打卡内容失败:', e);
      }
    } else {
      this._restoreDraft(sectionId);
    }

    await this.loadCourseDetail(prefetchedCourse);
    this.revealPageContent();
    this.loadCelebrationConfig();
  },

  revealPageContent() {
    if (this._pageRevealTimer) {
      clearTimeout(this._pageRevealTimer);
    }
    this._pageRevealTimer = setTimeout(() => {
      this._pageRevealTimer = null;
      this.setData({ showPageContent: true });
    }, 450);
  },

  async loadCourseDetail(prefetchedCourse = null) {
    try {
      const course =
        prefetchedCourse ||
        (await courseService.getCourseDetail(this.data.courseId));
      console.log('打卡页面-加载课程详情:', course);

      // 格式化日期
      let courseDate = '';
      if (course.startDate && course.endDate) {
        courseDate = `${course.startDate} 至 ${course.endDate}`;
      }

      this.setData({
        courseTitle: course.title || '',
        courseDate: courseDate,
        meditation: course.meditation || '',
        question: course.question || '',
        content: this.cleanHtmlForRichText(course.content || ''),
        reflection: course.reflection || '',
        action: course.action || '',
        // 保存期次ID和课节的day数（用于打卡时使用）
        sectionDay: course.day || 1,
        sectionPeriodId: course.periodId || null,
        periodId: this.data.periodId || extractId(course.periodId)
      });
    } catch (error) {
      console.error('加载课程详情失败:', error);
    }
  },

  /**
   * 加载期次信息
   */
  async loadPeriods() {
    try {
      const res = await courseService.getPeriods();
      console.log('获取期次列表:', res);

      let periods = [];
      if (res && res.list) {
        periods = res.list;
      } else if (res && res.items) {
        periods = res.items;
      } else if (Array.isArray(res)) {
        periods = res;
      }

      // 保存到全局数据
      const app = getApp();
      app.globalData.periods = periods;

      // 找到第一个进行中的期次作为当前期次
      const currentPeriod =
        periods.find((p) => p.status === 'ongoing') || periods[0];
      if (currentPeriod) {
        app.globalData.currentPeriod = currentPeriod;
        console.log('设置当前期次:', currentPeriod);
      }
    } catch (error) {
      console.error('加载期次失败:', error);
    }
  },

  // 切换展开/收起
  toggleExpand() {
    this.setData({
      expanded: !this.data.expanded
    });
  },

  // 输入日记内容
  handleInput(e) {
    const diaryContent = (e.detail.value || '').slice(0, MAX_DIARY_LENGTH);
    const wasClean = !this.data.isDirty;
    this.setData({ diaryContent, isDirty: true });

    // 第一次输入时启用离开拦截（兜底左上角返回）
    if (wasClean) this._enableLeaveGuard();

    if (this._autoSaveTimer) clearTimeout(this._autoSaveTimer);
    this._autoSaveTimer = setTimeout(() => this._saveDraft(), 2000);
  },

  // 选择可见范围
  handleVisibilityChange(e) {
    const { value } = e.currentTarget.dataset;
    this.setData({ visibility: value });
  },

  // 草稿：保存
  _saveDraft() {
    const { sectionId, diaryContent, visibility } = this.data;
    if (!sectionId || !diaryContent) return;
    const userId = getApp().globalData.userInfo?._id || getApp().globalData.userInfo?.id;
    // userId 未就绪时不保存，避免草稿 key 回退到 guest 导致多用户共享
    if (!userId) return;
    this.setData({ autoSaveStatus: '保存中...' });
    try {
      tenantStorage.set(`checkin_draft_${userId}_${sectionId}`, { content: diaryContent, visibility, savedAt: Date.now() });
      const now = new Date();
      const t = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
      this.setData({ autoSaveStatus: `已自动保存 ${t}` });
    } catch (e) {
      this.setData({ autoSaveStatus: '' });
    }
  },

  // 离开拦截：启用（兜底左上角返回，不支持 onBackPress 的旧版本）
  _enableLeaveGuard() {
    try {
      wx.enableAlertBeforeUnload({ message: '日记内容尚未发布，确定要离开？' });
    } catch (e) {}
  },

  // 离开拦截：关闭（提交或主动丢弃时调用，避免正常返回也弹窗）
  _disableLeaveGuard() {
    try {
      wx.disableAlertBeforeUnload();
    } catch (e) {}
  },

  // 草稿：清除
  _clearDraft() {
    const { sectionId } = this.data;
    if (!sectionId) return;
    const userId = getApp().globalData.userInfo?._id || getApp().globalData.userInfo?.id;
    if (!userId) return;
    try {
      tenantStorage.remove(`checkin_draft_${userId}_${sectionId}`);
    } catch (e) {}
  },

  // 草稿：恢复
  _restoreDraft(sectionId) {
    const userId = getApp().globalData.userInfo?._id || getApp().globalData.userInfo?.id;
    if (!userId) return;
    try {
      const draft = tenantStorage.get(`checkin_draft_${userId}_${sectionId}`);
      if (draft && draft.content) {
        this.setData({
          diaryContent: draft.content,
          visibility: draft.visibility || 'all',
          isDirty: true,
          autoSaveStatus: '已恢复草稿'
        });
        setTimeout(() => this.setData({ autoSaveStatus: '' }), 3000);
      }
    } catch (e) {}
  },

  // 退出：系统返回键拦截
  onBackPress() {
    if (this.data.isDirty) {
      this.setData({ showExitModal: true });
      return true;
    }
  },

  // 退出：取消按钮
  handleCancel() {
    if (this.data.isDirty) {
      this.setData({ showExitModal: true });
    } else {
      wx.navigateBack();
    }
  },

  // 退出：弹窗操作
  handleExitAction(e) {
    const { action } = e.currentTarget.dataset;
    this.setData({ showExitModal: false });
    if (action === 'publish') {
      this.handleSubmit();
    } else if (action === 'discard') {
      this._disableLeaveGuard();
      this._clearDraft();
      wx.navigateBack();
    }
    // 'stay' 关闭弹窗继续编辑
  },

  // 退出：点击遮罩 = 继续编辑
  handleModalMaskTap() {
    this.setData({ showExitModal: false });
  },

  // 阻止弹窗内部点击冒泡
  noop() {},

  // 每次 onLoad 都从服务端拉取最新配置（不缓存，保证实时性）
  async loadCelebrationConfig() {
    try {
      const res = await checkinConfigService.getConfig();
      if (res) {
        this._celebrationCfg = res; // 存到实例变量，不污染 globalData
      }
    } catch (e) {
      console.warn('[checkin] 获取庆祝配置失败，使用内置默认值', e);
    }
  },

  // 格式化打卡庆祝文字，如果是长句，尽量在标点符号处换行
  formatCelebrationMessage(message) {
    if (!message || message.length <= 13) return message;
    
    // 如果消息本身已经有换行，则不处理
    if (message.includes('\n')) return message;

    const punctuations = ['，', '。', '！', '？', ',', '.', '!', '?', '；', ';', '、'];
    let breakIndex = -1;
    
    // 假设每行大约容纳14-15个中文字符
    // 我们在这个限制范围内寻找最后一个标点符号
    for (let i = Math.min(14, message.length - 2); i >= 3; i--) {
      if (punctuations.includes(message[i])) {
        breakIndex = i;
        break;
      }
    }
    
    if (breakIndex !== -1) {
      // 在标点符号后插入换行符
      return message.substring(0, breakIndex + 1) + '\n' + message.substring(breakIndex + 1).trim();
    }
    
    return message;
  },

  // 打卡成功后展示庆祝动画
  showCheckinCelebration() {
    const cfg = this._celebrationCfg || {};

    // 决定动画方式
    let style = cfg.animationStyle || 'random';
    if (style === 'random') {
      const styles = Array.isArray(cfg.enabledAnimationStyles) && cfg.enabledAnimationStyles.length > 0
        ? cfg.enabledAnimationStyles
        : ['A', 'B', 'C', 'D', 'E', 'F', 'G'];
      style = styles[Math.floor(Math.random() * styles.length)];
    }

    // 服务端已随机返回一条，直接用；没有则用兜底文案
    let message = cfg.message || '打卡成功！坚持就是力量！';
    message = this.formatCelebrationMessage(message);

    this.setData({ showCelebration: true, celebrationStyle: style, celebrationMessage: message });

    if (this._celebrationTimer) clearTimeout(this._celebrationTimer);
    this._celebrationTimer = setTimeout(() => this.dismissCelebration(), 3000);
  },

  // 关闭庆祝动画并返回
  dismissCelebration() {
    if (this._celebrationTimer) clearTimeout(this._celebrationTimer);
    this.setData({ showCelebration: false });
    wx.navigateBack();
  },

  // 页面卸载时清理
  onUnload() {
    if (this._pageRevealTimer) clearTimeout(this._pageRevealTimer);
    if (this._celebrationTimer) clearTimeout(this._celebrationTimer);
    if (this._autoSaveTimer) clearTimeout(this._autoSaveTimer);
    this._disableLeaveGuard();
  },

  // 提交打卡
  async handleSubmit() {
    if (!this.data.accessChecked) {
      wx.showToast({
        title: '完成支付后可打卡',
        icon: 'none'
      });
      return;
    }

    const diaryContent = (this.data.diaryContent || '').trim();

    if (!diaryContent) {
      wx.showToast({
        title: '请输入打卡内容',
        icon: 'none'
      });
      return;
    }

    if (diaryContent.length > MAX_DIARY_LENGTH) {
      wx.showToast({
        title: `打卡内容不能超过${MAX_DIARY_LENGTH}字`,
        icon: 'none'
      });
      return;
    }

    try {
      wx.showLoading({ title: '提交中...' });

      // 编辑模式：直接更新已有打卡
      if (this.data.isEditMode && this.data.checkinId) {
        await checkinService.updateCheckin(this.data.checkinId, {
          note: diaryContent,
          isPublic: this.data.visibility === 'all'
        });
        this._disableLeaveGuard();
        this._clearDraft();
        this.setData({ isDirty: false });
        wx.hideLoading();
        wx.showToast({ title: '修改成功', icon: 'success' });
        setTimeout(() => wx.navigateBack(), 1500);
        return;
      }

      await subscribeAutoTopUp.maybeAutoTopUpSubscriptions({
        sourceAction: 'checkin_submit',
        periodId: this.data.periodId,
        sectionId: this.data.sectionId || this.data.courseId,
        courseId: this.data.courseId,
        sourcePage: 'checkin',
        sceneKeys: COMMUNITY_AUTO_TOP_UP_SCENES,
        requestMode: 'any'
      });

      // 获取当前期次和课节信息
      const app = getApp();
      const currentUser = app.globalData.userInfo || {};

      // 获取periodId - 优先使用从路由参数传递的值
      let periodId = this.data.periodId;

      // 如果路由参数中没有，尝试从课节数据获取
      if (!periodId && this.data.sectionPeriodId) {
        if (typeof this.data.sectionPeriodId === 'string') {
          periodId = this.data.sectionPeriodId;
        } else if (
          typeof this.data.sectionPeriodId === 'object' &&
          this.data.sectionPeriodId._id
        ) {
          periodId =
            this.data.sectionPeriodId._id || this.data.sectionPeriodId.id;
        }
      }

      // 如果还是没有，从全局currentPeriod获取
      if (!periodId && app.globalData.currentPeriod) {
        periodId =
          app.globalData.currentPeriod._id || app.globalData.currentPeriod.id;
      }

      // 如果仍然没有，从全局periods列表获取
      if (
        !periodId &&
        app.globalData.periods &&
        app.globalData.periods.length > 0
      ) {
        const period =
          app.globalData.periods.find((p) => p.status === 'ongoing') ||
          app.globalData.periods[0];
        if (period) {
          periodId = period._id || period.id;
        }
      }

      // 记录调试信息
      console.log('获取的periodId:', periodId);
      console.log('this.data.periodId:', this.data.periodId);
      console.log('sectionPeriodId:', this.data.sectionPeriodId);

      // 严格验证periodId
      if (!periodId || typeof periodId !== 'string' || periodId.length === 0) {
        wx.hideLoading();
        wx.showToast({
          title: '缺少期次信息，无法打卡',
          icon: 'none'
        });
        return;
      }

      // 构造后端需要的打卡数据
      // readingTime：从进入页面到提交的时长（分钟），最少 1 分钟，最多 120 分钟
      const elapsedMinutes = this._readingStartTime
        ? Math.min(120, Math.max(1, Math.round((Date.now() - this._readingStartTime) / 1000 / 60)))
        : 1;
      const submitData = {
        sectionId: this.data.sectionId || this.data.courseId,
        periodId: periodId,
        day: this.data.sectionDay || 1,
        readingTime: elapsedMinutes,
        completionRate: 100, // 提交即视为完成
        note: diaryContent,
        isPublic: this.data.visibility === 'all',
        mood: 'happy'
      };

      const result = await checkinService.submitCheckin(submitData);
      activityService.track('checkin_submit', {
        targetType: 'checkin',
        targetId: result?._id || result?.id || null,
        periodId,
        sectionId: this.data.sectionId || this.data.courseId,
        metadata: {
          visibility: this.data.visibility,
          day: submitData.day
        }
      });

      // 保存打卡记录到本地存储
      const storageKey = `checkins_${this.data.courseId}`;
      let checkins = wx.getStorageSync(storageKey) || [];

      console.log('保存打卡前的记录:', checkins);
      console.log('存储Key:', storageKey);
      console.log('courseId:', this.data.courseId);

      // 创建新的打卡记录
      const newCheckin = {
        id: result.id || Date.now(),
        userId: currentUser.id || 1, // 当前用户ID
        userName: currentUser.nickname || '我',
        avatarUrl: currentUser.avatarUrl || '',
        avatarText: getLastTextChar(currentUser.nickname || '我', '我'),
        avatarColor: '#4a90e2',
        content: diaryContent,
        likeCount: 0,
        createTime: '刚刚',
        isLiked: false,
        replies: [],
        // 添加课程信息，用于在列表页显示
        courseId: this.data.courseId,
        courseTitle: this.data.courseTitle,
        timestamp: Date.now()
      };

      checkins.unshift(newCheckin); // 添加到开头
      wx.setStorageSync(storageKey, checkins);

      // 同时保存到全局打卡记录（用于课程列表页显示）
      const allCheckinsKey = 'all_checkins';
      let allCheckins = wx.getStorageSync(allCheckinsKey) || [];
      allCheckins.unshift(newCheckin);
      wx.setStorageSync(allCheckinsKey, allCheckins);

      console.log('保存打卡后的记录:', checkins);
      console.log('全局打卡记录:', allCheckins);

      if (this._autoSaveTimer) {
        clearTimeout(this._autoSaveTimer);
        this._autoSaveTimer = null;
      }
      this._disableLeaveGuard();
      this._clearDraft();
      this.setData({ isDirty: false, diaryContent: '' });

      wx.hideLoading();
      this.showCheckinCelebration();
    } catch (error) {
      wx.hideLoading();
      console.error('打卡失败:', error);
      const message = getErrorMessage(error) || '打卡失败';
      wx.showToast({
        title: message,
        icon: 'none'
      });
    }
  }
});
