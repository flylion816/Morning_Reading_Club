const checkinService = require('../../services/checkin.service');
const courseService = require('../../services/course.service');
const activityService = require('../../services/activity.service');
const subscribeAutoTopUp = require('../../utils/subscribe-auto-topup');
const { renderRichTextContent } = require('../../utils/markdown');
const {
  getPeriodAccess,
  extractId,
  redirectAfterCommunityDenied
} = require('../../utils/period-access');

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
    courseId: null,
    sectionId: null,
    periodId: null,
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
    visibility: 'all' // 'all' 或 'admin'
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
      periodId: resolvedPeriodId
    });

    await this.loadCourseDetail(prefetchedCourse);
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
    this.setData({
      diaryContent
    });
  },

  // 选择可见范围
  handleVisibilityChange(e) {
    const { value } = e.currentTarget.dataset;
    this.setData({
      visibility: value
    });
  },

  // 取消
  handleCancel() {
    wx.navigateBack();
  },

  // 提交打卡
  async handleSubmit() {
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
      const submitData = {
        sectionId: this.data.sectionId || this.data.courseId, // sectionId 和 courseId 在这里应该是一样的
        periodId: periodId, // 从课节或全局数据获取
        day: this.data.sectionDay || 1, // 课节的day值（表示第几节课）
        readingTime: Math.floor(Math.random() * 30) + 10, // 模拟阅读时间 10-40 分钟
        completionRate: 88, // 模拟完成度
        note: diaryContent,
        isPublic: this.data.visibility === 'all',
        mood: 'happy'
      };

      console.log('计算的day值:', submitData.day);

      console.log('提交打卡数据:', submitData);

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
        avatarText: currentUser.avatar || '我',
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

      wx.hideLoading();
      wx.showToast({
        title: '打卡成功',
        icon: 'success'
      });

      setTimeout(() => {
        wx.navigateBack();
      }, 1500);
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
