// 课节列表页 - 显示某一期的每天课程
const courseService = require('../../services/course.service');

Page({
  data: {
    periodId: null,
    periodName: '',
    periodDate: '',
    sections: [],
    loading: true,
    makeupCount: 99,  // 剩余补打卡次数
    allCheckins: [],   // 所有打卡记录
    currentTab: 'tasks',  // 当前选中的tab
    scrollTop: 0  // 滚动位置
  },

  onLoad(options) {
    console.log('课节列表页加载', options);
    if (options.periodId) {
      this.setData({ periodId: parseInt(options.periodId) });
      this.loadSections();
    } else {
      wx.showToast({
        title: '参数错误',
        icon: 'none'
      });
    }
  },

  onShow() {
    // 每次显示页面时重新加载打卡记录
    if (this.data.sections.length > 0) {
      this.loadAllCheckins();
    }
  },

  /**
   * 加载课节列表
   */
  async loadSections() {
    this.setData({ loading: true });

    try {
      const res = await courseService.getPeriodSections(this.data.periodId);
      const sections = res.items || res || [];

      // 获取期次信息用于显示头部
      const periods = await courseService.getPeriods();
      const currentPeriod = periods.items.find(p => p.id === this.data.periodId);

      this.setData({
        sections,
        loading: false,
        periodName: currentPeriod ? currentPeriod.title : '晨读营',
        periodDate: currentPeriod ? `${currentPeriod.startDate} 至 ${currentPeriod.endDate}` : ''
      });

      // 加载所有打卡记录
      this.loadAllCheckins();
    } catch (error) {
      console.error('获取课节列表失败:', error);
      this.setData({
        loading: false,
        sections: []
      });

      wx.showToast({
        title: '加载失败,请重试',
        icon: 'none'
      });
    }
  },

  /**
   * 加载所有课节的打卡记录
   */
  loadAllCheckins() {
    // 从全局存储读取所有打卡记录
    const allCheckinsKey = 'all_checkins';
    let allCheckins = wx.getStorageSync(allCheckinsKey) || [];

    console.log('从全局存储读取打卡记录:', allCheckins);
    console.log('打卡记录数量:', allCheckins.length);

    // 为打卡记录添加课节信息
    const sections = this.data.sections;
    allCheckins = allCheckins.map(checkin => {
      // 查找对应的课节信息
      const section = sections.find(s => s.id === checkin.courseId);

      return {
        ...checkin,
        sectionId: checkin.courseId,
        sectionTitle: section ? section.title : checkin.courseTitle || '未知课程',
        sectionDay: section ? section.day : 0
      };
    });

    // 按时间戳倒序排序（最新的在前面）
    allCheckins.sort((a, b) => {
      const timeA = a.timestamp || a.id;
      const timeB = b.timestamp || b.id;
      return timeB - timeA;
    });

    console.log('处理后的打卡记录:', allCheckins);

    this.setData({
      allCheckins
    });
  },

  /**
   * Tab 切换
   */
  handleTabChange(e) {
    const { tab } = e.currentTarget.dataset;

    this.setData({
      currentTab: tab
    });

    // 使用 SelectorQuery 查询目标元素位置并滚动
    if (tab === 'tasks') {
      // 切换到任务，滚动到顶部
      this.setData({ scrollTop: 0 });
    } else if (tab === 'dynamics') {
      // 切换到动态，查询动态区域的位置
      const query = wx.createSelectorQuery();
      query.select('#dynamics-section').boundingClientRect();
      query.select('.content-scroll').scrollOffset();
      query.exec((res) => {
        if (res[0] && res[1]) {
          // 计算需要滚动的距离
          const targetTop = res[0].top + res[1].scrollTop;
          this.setData({
            scrollTop: targetTop
          });
        }
      });
    }
  },

  /**
   * 跳转到排行榜
   */
  handleRanking() {
    wx.navigateTo({
      url: `/pages/ranking/ranking?periodId=${this.data.periodId}`
    });
  },

  /**
   * 跳转到打卡记录
   */
  handleCheckinRecords() {
    wx.navigateTo({
      url: `/pages/checkin-records/checkin-records?periodId=${this.data.periodId}`
    });
  },

  /**
   * 跳转到成员列表
   */
  handleMembers() {
    wx.navigateTo({
      url: `/pages/members/members?periodId=${this.data.periodId}`
    });
  },

  /**
   * 点击课节卡片 - 跳转到课程详情页
   */
  handleSectionClick(e) {
    const { section } = e.currentTarget.dataset;

    if (!section || !section.id) {
      console.error('课节信息不存在');
      return;
    }

    // 跳转到课程详情页（学习内容）
    wx.navigateTo({
      url: `/pages/course-detail/course-detail?id=${section.id}`
    });
  },

  /**
   * 点击"去打卡"按钮 - 直接跳转到打卡页面
   */
  handleCheckinClick(e) {
    const { section } = e.currentTarget.dataset;

    if (!section || !section.id) {
      console.error('课节信息不存在');
      return;
    }

    // 直接跳转到打卡页面
    wx.navigateTo({
      url: `/pages/checkin/checkin?courseId=${section.id}`
    });
  },

  /**
   * 返回首页
   */
  handleBack() {
    wx.navigateBack();
  }
});
