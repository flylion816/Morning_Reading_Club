// 个人中心页面
const userService = require('../../services/user.service');
const authService = require('../../services/auth.service');
const courseService = require('../../services/course.service');
const { formatNumber, formatDate } = require('../../utils/formatters');

Page({
  data: {
    // 用户信息
    userInfo: null,
    isLogin: false,
    hasValidSignature: false,

    // 当前期次
    currentPeriod: null,

    // 今日课节
    todaySection: null,

    // 统计信息
    stats: {
      current_day: 1,
      total_days: 23
    },

    // 最近的小凡看见（最多3条）
    recentInsights: [],

    // 收到的小凡看见请求列表
    insightRequests: [],

    // 加载状态
    loading: true,

    // 编辑个人信息相关
    showEditProfile: false,
    isSavingProfile: false,
    avatarOptions: ['🦁', '🐯', '🐻', '🐼', '🐨', '🦊', '🦝', '🐶', '🐱', '🦌', '🦅', '⭐'],
    editForm: {
      avatar: '🦁',
      nickname: '',
      signature: ''
    }
  },

  onLoad(options) {
    console.log('个人中心加载', options);
    this.checkLoginStatus();
  },

  onShow() {
    // 每次显示时刷新数据
    const app = getApp();
    const isLogin = app.globalData.isLogin;

    this.checkLoginStatus();

    // 直接使用app.globalData.isLogin判断，避免setData异步问题
    if (isLogin) {
      this.loadUserData();
    }
  },

  onPullDownRefresh() {
    console.log('下拉刷新');
    this.loadUserData().then(() => {
      wx.stopPullDownRefresh();
    });
  },

  /**
   * 检查登录状态
   */
  checkLoginStatus() {
    const app = getApp();
    const isLogin = app.globalData.isLogin;
    const userInfo = app.globalData.userInfo;

    this.setData({
      isLogin,
      userInfo,
      loading: false  // 设置loading为false
    }, () => {
      // 更新签名有效性状态
      this.updateSignatureValidation();
    });

    // 根据登录状态显示/隐藏tabBar
    this.updateTabBarVisibility(isLogin);
  },

  /**
   * 更新tabBar显示状态
   */
  updateTabBarVisibility(isLogin) {
    if (isLogin) {
      // 已登录：显示tabBar
      wx.showTabBar();
    } else {
      // 未登录：隐藏tabBar
      wx.hideTabBar();
    }
  },

  /**
   * 加载用户数据
   */
  async loadUserData() {
    if (!this.data.isLogin) {
      this.setData({ loading: false });
      return;
    }

    this.setData({ loading: true });

    try {
      // 并行加载用户信息、统计信息和当前期次
      const [userInfo, stats, periods] = await Promise.all([
        userService.getUserProfile(),
        userService.getUserStats(),
        courseService.getPeriods()
      ]);

      const app = getApp();
      app.globalData.userInfo = userInfo;

      // 根据期次状态选择当前期次
      console.log('====== getPeriods 原始响应 ======');
      console.log('periods类型:', typeof periods);
      console.log('periods:', periods);
      console.log('periods.list:', periods?.list);

      const periodsList = periods.list || periods.items || periods || [];
      console.log('处理后的periodsList长度:', periodsList.length);
      console.log('periodsList:', periodsList);

      let currentPeriod = null;
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      // 基于当前日期选择期次
      // 优先级：1) 包含今天的期次  2) ongoing状态  3) 最近的期次
      for (const period of periodsList) {
        const startDate = new Date(period.startDate || period.startTime || 0);
        const endDate = new Date(period.endDate || period.endTime || 0);
        startDate.setHours(0, 0, 0, 0);
        endDate.setHours(23, 59, 59, 999);

        if (today >= startDate && today <= endDate) {
          currentPeriod = period;
          console.log('📅 根据日期范围找到当前期次:', currentPeriod.name || currentPeriod.title, '(status:', currentPeriod.status + ')');
          break;
        }
      }

      if (!currentPeriod) {
        // 如果没有包含今天的期次，选择 ongoing 状态的
        currentPeriod = periodsList.find(p => p.status === 'ongoing');
        if (currentPeriod) {
          console.log('⚠️ 未找到包含今天的期次，使用ongoing期次:', currentPeriod.name || currentPeriod.title);
        }
      }

      if (!currentPeriod) {
        // 最后选择最新创建的期次
        const sortedPeriods = [...periodsList].sort((a, b) => {
          const timeA = new Date(a.createdAt || 0).getTime();
          const timeB = new Date(b.createdAt || 0).getTime();
          return timeB - timeA;  // 倒序
        });
        currentPeriod = sortedPeriods[0];
        console.log('⚠️ 未找到合适期次，使用最新的期次:', currentPeriod?.name || currentPeriod?.title);
      }

      // 获取今日课节（根据当前日期动态计算）
      let todaySection = null;
      console.log('===== 开始获取今日任务 =====');
      try {
        const taskRes = await courseService.getTodayTask();
        console.log('✅ 今日任务API响应:', taskRes);
        console.log('taskRes类型:', typeof taskRes);
        console.log('taskRes.sectionId:', taskRes?.sectionId);
        console.log('taskRes.code:', taskRes?.code);
        console.log('taskRes.message:', taskRes?.message);

        // 检查是否有有效的任务数据
        // API返回格式：{code: 200, message: "...", data: {...}} 或 {code: 200, message: "暂无任务", data: null}
        // request.js会解包返回：{...data.data} 或 {code, message, data: null}
        const hasValidTask = taskRes && taskRes.sectionId && taskRes.sectionId !== undefined;

        if (hasValidTask) {
          console.log('🔄 开始获取课节详情，sectionId:', taskRes.sectionId);
          // 获取该课节的完整信息用于显示
          const sectionRes = await courseService.getSectionDetail(taskRes.sectionId);
          console.log('✅ 课节详情API响应:', sectionRes);

          if (sectionRes) {
            // 合并任务信息和课节信息
            todaySection = {
              ...sectionRes,
              _id: sectionRes._id || taskRes.sectionId,
              id: sectionRes.id || taskRes.sectionId,
              day: taskRes.day,
              periodId: taskRes.periodId,
              periodTitle: taskRes.periodTitle,
              checkinCount: taskRes.checkinCount || 0,
              checkinUsers: taskRes.checkinUsers || [],
              isCheckedIn: taskRes.isCheckedIn || sectionRes.isCheckedIn || false
            };

            // 计算进度：0% 未打卡，100% 已打卡
            todaySection.progress = todaySection.isCheckedIn ? 100 : 0;

            // 设置封面样式
            if (!todaySection.coverColor) {
              todaySection.coverColor = currentPeriod.coverColor || '#4a90e2';
            }
            if (!todaySection.coverEmoji) {
              todaySection.coverEmoji = currentPeriod.coverEmoji || '🏔️';
            }

            // 处理subtitle：移除末尾的"至"
            if (todaySection.subtitle) {
              todaySection.subtitleDisplay = todaySection.subtitle.replace(/至$/, '');
            }

            // 动态计算当天日期
            const today = new Date();
            const year = today.getFullYear();
            const month = String(today.getMonth() + 1).padStart(2, '0');
            const date = String(today.getDate()).padStart(2, '0');
            todaySection.displayDate = `${year}.${month}.${date} 全天`;

            console.log('✅ 处理后的今日课节:', todaySection);
          }
        } else {
          console.warn('⚠️ API返回暂无任务，使用备选方案:', taskRes);
          // 使用备选方案：获取当前期次的第一个未打卡或第一个课节
          const periodId = currentPeriod && (currentPeriod._id || currentPeriod.id);
          console.log('📋 使用备选方案，periodId:', periodId);
          if (periodId) {
            try {
              const sectionsRes = await courseService.getPeriodSections(periodId);
              const sections = sectionsRes.list || sectionsRes.items || sectionsRes || [];
              const normalSections = sections.filter(s => s.day > 0);
              todaySection = normalSections.find(s => !s.isCheckedIn) || normalSections[0];

              if (todaySection) {
                if (!todaySection.coverColor) {
                  todaySection.coverColor = currentPeriod.coverColor || '#4a90e2';
                }
                if (!todaySection.coverEmoji) {
                  todaySection.coverEmoji = currentPeriod.coverEmoji || '🏔️';
                }
                todaySection.periodId = periodId;
                todaySection.periodTitle = currentPeriod.title;

                // 确保包含isCheckedIn状态
                if (todaySection.isCheckedIn === undefined) {
                  todaySection.isCheckedIn = false;
                }
                // 计算进度：0% 未打卡，100% 已打卡
                todaySection.progress = todaySection.isCheckedIn ? 100 : 0;

                if (todaySection.subtitle) {
                  todaySection.subtitleDisplay = todaySection.subtitle.replace(/至$/, '');
                }
                // 动态计算当天日期
                const today = new Date();
                const year = today.getFullYear();
                const month = String(today.getMonth() + 1).padStart(2, '0');
                const date = String(today.getDate()).padStart(2, '0');
                todaySection.displayDate = `${year}.${month}.${date} 全天`;
                console.log('✅ 备选方案成功:', todaySection);
              }
            } catch (fallbackError) {
              console.error('❌ 备选方案也失败了:', fallbackError);
            }
          }
        }
      } catch (error) {
        console.error('❌ 获取今日任务失败:', error);
        console.error('错误消息:', error.message);
        console.error('错误详情:', error);
        // 降级方案：如果动态获取失败，使用备选方案
        const periodId = currentPeriod && (currentPeriod._id || currentPeriod.id);
        console.log('📋 发生错误，使用备选方案，periodId:', periodId);
        if (periodId) {
          try {
            const sectionsRes = await courseService.getPeriodSections(periodId);
            const sections = sectionsRes.list || sectionsRes.items || sectionsRes || [];
            const normalSections = sections.filter(s => s.day > 0);
            todaySection = normalSections.find(s => !s.isCheckedIn) || normalSections[0];

            if (todaySection) {
              if (!todaySection.coverColor) {
                todaySection.coverColor = currentPeriod.coverColor || '#4a90e2';
              }
              if (!todaySection.coverEmoji) {
                todaySection.coverEmoji = currentPeriod.coverEmoji || '🏔️';
              }
              todaySection.periodId = periodId;
              todaySection.periodTitle = currentPeriod.title;

              // 确保包含isCheckedIn状态
              if (todaySection.isCheckedIn === undefined) {
                todaySection.isCheckedIn = false;
              }
              // 计算进度：0% 未打卡，100% 已打卡
              todaySection.progress = todaySection.isCheckedIn ? 100 : 0;

              if (todaySection.subtitle) {
                todaySection.subtitleDisplay = todaySection.subtitle.replace(/至$/, '');
              }
              // 动态计算当天日期
              const today = new Date();
              const year = today.getFullYear();
              const month = String(today.getMonth() + 1).padStart(2, '0');
              const date = String(today.getDate()).padStart(2, '0');
              todaySection.displayDate = `${year}.${month}.${date} 全天`;
              console.log('✅ 备选方案成功:', todaySection);
            }
          } catch (fallbackError) {
            console.error('❌ 备选方案也失败了:', fallbackError);
          }
        }
      }
      console.log('===== 今日任务获取完成，最终结果: =====', todaySection);

      // 加载最近的小凡看见记录（最多3条）
      // 重要：传递 currentPeriod 作为参数，避免从 this.data 读取（可能还未更新）
      let recentInsights = [];
      try {
        recentInsights = await this.loadRecentInsights(currentPeriod);
      } catch (error) {
        console.error('加载小凡看见失败:', error);
      }

      // 加载收到的小凡看见请求
      this.loadInsightRequests();

      console.log('setData前的recentInsights:', recentInsights);
      console.log('setData前的recentInsights长度:', recentInsights.length);

      this.setData({
        userInfo,
        userStats: stats,
        currentPeriod,
        todaySection,
        recentInsights,
        loading: false
      }, () => {
        // 更新签名有效性状态
        this.updateSignatureValidation();
      });

      console.log('setData后this.data.recentInsights:', this.data.recentInsights);
    } catch (error) {
      console.error('加载用户数据失败:', error);
      this.setData({ loading: false });

      wx.showToast({
        title: '加载失败,请重试',
        icon: 'none'
      });
    }
  },

  /**
   * 加载最近的小凡看见记录
   * 只加载当前期次的小凡看见记录
   */
  async loadRecentInsights(currentPeriod) {
    try {
      const insightService = require('../../services/insight.service');

      // 如果参数中没有传入 currentPeriod，尝试从 this.data 读取（后续可能被调用时）
      if (!currentPeriod) {
        currentPeriod = this.data.currentPeriod;
      }

      if (!currentPeriod) {
        console.warn('❌ 当前期次未加载，无法过滤小凡看见');
        return [];
      }

      const periodId = currentPeriod._id || currentPeriod.id;
      console.log('=== 加载小凡看见 ===');
      console.log('当前期次对象:', currentPeriod);
      console.log('当前期次名称:', currentPeriod.name || currentPeriod.title);
      console.log('按期次ID加载小凡看见，periodId:', periodId);
      console.log('当前用户ID:', this.data.userInfo?._id || this.data.userInfo?.id);

      if (!periodId) {
        console.error('❌ 错误：periodId为空！无法加载小凡看见');
        return [];
      }

      // 调用API获取指定期次的小凡看见记录
      const res = await insightService.getInsightsForPeriod(periodId, { limit: 10 });

      console.log('API 响应原始数据:', res);
      console.log('API 响应列表:', res?.list);
      console.log('API 响应列表长度:', res?.list?.length);

      // request.js 会自动提取 data.data，所以这里 res 应该是 { list: [...], pagination: {...} }
      let insights = [];
      if (res && res.list) {
        // 标准格式
        insights = res.list;
      } else if (Array.isArray(res)) {
        // 直接是数组
        insights = res;
      }

      console.log('处理后的insights数据:', insights);

      if (!insights || insights.length === 0) {
        console.warn('当前期次没有小凡看见记录');
        return [];
      }

      // 按创建时间倒序排列（最新的在前）
      insights.sort((a, b) => {
        const timeA = new Date(a.createdAt || 0).getTime();
        const timeB = new Date(b.createdAt || 0).getTime();
        return timeB - timeA;
      });

      // 格式化数据
      const { getInsightTypeConfig } = require('../../utils/formatters');
      const formatted = insights.map(item => {
        console.log('处理单条insight:', item);

        // 提取preview：从content中提取前两行的纯文本
        let preview = '';
        if (item.content) {
          // 提取纯文本（去除所有HTML标签）
          const plainText = item.content.replace(/<[^>]*>/g, '').trim();
          // 分行并取前两行
          const lines = plainText.split('\n').filter(line => line.trim());
          preview = lines.slice(0, 2).join('\n');
          // 如果超过150个字符，截断
          if (preview.length > 150) {
            preview = preview.substring(0, 150) + '...';
          }
        }

        // 获取类型配置
        const typeConfig = getInsightTypeConfig(item.type);

        return {
          id: item._id || item.id,
          day: `第${item.day}天`,
          title: item.sectionId?.title || '学习反馈',
          preview: preview || '暂无预览',
          periodId: item.periodId,  // 保留期次ID用于详情页跳转
          type: item.type,           // 小凡看见类型
          typeConfig: typeConfig     // 类型配置（用于显示）
        };
      });

      console.log('格式化后的insights:', formatted);

      // 只返回前2条（已按createdAt倒序排列）
      const recent = formatted.slice(0, 2);
      console.log('返回的最近insights:', recent);
      return recent;
    } catch (error) {
      console.error('加载小凡看见失败:', error);
      return [];
    }
  },

  /**
   * 加载收到的小凡看见请求
   */
  loadInsightRequests() {
    const app = getApp();
    const currentUser = app.globalData.userInfo;

    if (!currentUser || !currentUser._id) {
      this.setData({ insightRequests: [] });
      return;
    }

    // 从本地存储读取所有申请
    let allRequests = wx.getStorageSync('insight_requests') || [];

    // 筛选出发给当前用户的待处理申请
    let myRequests = allRequests.filter(req =>
      req.toUserId === currentUser._id && req.status === 'pending'
    );

    // 如果没有待处理申请，添加一个Mock申请（仅用于演示）
    if (myRequests.length === 0) {
      const mockRequest = {
        id: Date.now(),
        fromUserId: 1,  // 阿泰的用户ID
        fromUserName: '阿泰',
        fromUserAvatar: '泰',  // 使用名字的最后一个字
        avatarColor: '#4a90e2',  // 蓝色圆形背景
        toUserId: currentUser._id,
        toUserName: currentUser.nickname,
        time: '2小时前',
        status: 'pending'
      };
      myRequests = [mockRequest];
    }

    console.log('收到的小凡看见请求:', myRequests);

    this.setData({
      insightRequests: myRequests
    });
  },

  /**
   * 微信一键登录
   */
  async handleWechatLogin() {
    if (this.data.loading) return;

    this.setData({ loading: true });

    try {
      console.log('开始获取用户信息...');

      // 1. 必须在点击事件中同步调用getUserProfile
      const userInfo = await new Promise((resolve, reject) => {
        wx.getUserProfile({
          desc: '用于完善会员资料',
          success: (res) => {
            console.log('获取用户信息成功:', res.userInfo);
            resolve(res.userInfo);
          },
          fail: (err) => {
            console.error('获取用户信息失败:', err);
            reject(err);
          }
        });
      });

      console.log('用户信息获取完成，开始登录...');

      // 2. 使用Mock登录（因为没有后端服务器）
      const envConfig = require('../../config/env');
      let loginData;

      if (envConfig.useMock) {
        // Mock模式
        loginData = await authService.wechatLoginMock(userInfo);
      } else {
        // 生产模式
        loginData = await authService.wechatLogin(userInfo);
      }

      console.log('登录成功:', loginData);

      // 3. 更新全局状态
      const app = getApp();
      app.globalData.isLogin = true;
      app.globalData.userInfo = loginData.user;
      app.globalData.token = loginData.access_token;

      // 4. 更新页面状态
      this.setData({
        isLogin: true,
        userInfo: loginData.user,
        loading: false
      });

      // 5. 显示tabBar
      this.updateTabBarVisibility(true);

      wx.showToast({
        title: '登录成功',
        icon: 'success',
        duration: 2000
      });

      // 6. 加载用户数据
      this.loadUserData();
    } catch (error) {
      console.error('登录失败:', error);

      this.setData({ loading: false });

      // 处理用户拒绝授权的情况
      if (error.errMsg && error.errMsg.includes('getUserProfile:fail auth deny')) {
        wx.showToast({
          title: '您拒绝了授权',
          icon: 'none',
          duration: 2000
        });
      } else {
        wx.showToast({
          title: '登录失败,请重试',
          icon: 'none',
          duration: 2000
        });
      }
    }
  },

  /**
   * 返回首页
   */
  handleBackHome() {
    wx.switchTab({
      url: '/pages/index/index'
    });
  },

  /**
   * 点击头像
   */
  handleAvatarClick() {
    if (!this.data.isLogin) {
      this.handleLogin();
      return;
    }

    // 跳转到编辑资料页面
    wx.navigateTo({
      url: '/pages/edit-profile/edit-profile'
    });
  },

  /**
   * 授权请求 - 同意查看小凡看见
   */
  handleApproveRequest(e) {
    const { request } = e.currentTarget.dataset;
    this.approveRequest(request);
  },

  /**
   * 拒绝请求
   */
  handleRejectRequest(e) {
    const { request } = e.currentTarget.dataset;
    this.rejectRequest(request);
  },

  /**
   * 批准请求
   */
  async approveRequest(request) {
    try {
      console.log('批准请求:', request);

      // 从本地存储更新请求状态
      let allRequests = wx.getStorageSync('insight_requests') || [];
      const requestIndex = allRequests.findIndex(r => r.id === request.id);

      if (requestIndex !== -1) {
        allRequests[requestIndex].status = 'approved';
        wx.setStorageSync('insight_requests', allRequests);
      }

      // 从待处理列表中移除该请求
      const newRequests = this.data.insightRequests.filter(r => r.id !== request.id);
      this.setData({ insightRequests: newRequests });

      wx.showToast({
        title: '已授权',
        icon: 'success'
      });
    } catch (error) {
      console.error('授权失败:', error);
      wx.showToast({
        title: '授权失败',
        icon: 'none'
      });
    }
  },

  /**
   * 拒绝请求
   */
  async rejectRequest(request) {
    try {
      console.log('拒绝请求:', request);

      // 从本地存储更新请求状态
      let allRequests = wx.getStorageSync('insight_requests') || [];
      const requestIndex = allRequests.findIndex(r => r.id === request.id);

      if (requestIndex !== -1) {
        allRequests[requestIndex].status = 'rejected';
        wx.setStorageSync('insight_requests', allRequests);
      }

      // 从待处理列表中移除该请求
      const newRequests = this.data.insightRequests.filter(r => r.id !== request.id);
      this.setData({ insightRequests: newRequests });

      wx.showToast({
        title: '已拒绝',
        icon: 'success'
      });
    } catch (error) {
      console.error('拒绝失败:', error);
      wx.showToast({
        title: '操作失败',
        icon: 'none'
      });
    }
  },

  /**
   * 点击今日课节卡片
   */
  handleTodaySectionClick() {
    console.log('🚨🚨🚨 handleTodaySectionClick 被触发 🚨🚨🚨');

    const { todaySection } = this.data;
    const sectionId = todaySection && (todaySection.id || todaySection._id);

    if (!sectionId) {
      console.error('今日课节信息不存在');
      wx.showToast({
        title: '课节信息不存在',
        icon: 'none'
      });
      return;
    }

    // 跳转到课程详情页
    wx.navigateTo({
      url: `/pages/course-detail/course-detail?id=${sectionId}`
    });
  },

  /**
   * 点击小凡看见条目
   */
  handleInsightClick(e) {
    console.log('🚨🚨🚨 handleInsightClick 被触发 🚨🚨🚨');
    console.log('Event:', e);

    const { id } = e.currentTarget.dataset;
    console.log('Insight ID:', id);

    if (!id) {
      console.error('❌ ID不存在');
      return;
    }

    // 暂时添加Toast以确认函数被调用
    wx.showToast({
      title: '正在跳转详情...',
      icon: 'none'
    });

    const url = `/pages/insight-detail/insight-detail?id=${id}`;
    console.log('🚀 准备跳转:', url);

    wx.navigateTo({
      url: url,
      success: () => console.log('✅ 跳转成功'),
      fail: (err) => console.error('❌ 跳转失败:', err)
    });
  },

  /**
   * 跳转到小凡看见列表
   */
  navigateToInsights() {
    console.log('🚨🚨🚨 navigateToInsights 被触发 🚨🚨🚨');

    wx.showToast({
      title: '正在跳转列表...',
      icon: 'none'
    });

    const url = '/pages/insights/insights';
    console.log('🚀 准备跳转:', url);

    wx.navigateTo({
      url: url,
      success: () => console.log('✅ 跳转成功'),
      fail: (err) => console.error('❌ 跳转失败:', err)
    });
  },

  /**
   * 去打卡 - 跳转到打卡页面（或显示已打卡提示）
   */
  handleCreateCheckin() {
    console.log('⚠️⚠️⚠️ handleCreateCheckin 被触发! ⚠️⚠️⚠️');

    const { currentPeriod, todaySection } = this.data;

    if (!currentPeriod || !todaySection) {
      wx.showToast({
        title: '无法获取课程信息',
        icon: 'none'
      });
      return;
    }

    // 检查是否已经打卡
    if (todaySection.isCheckedIn) {
      wx.showToast({
        title: '今天已打卡，继续加油！',
        icon: 'success'
      });
      return;
    }

    const periodId = currentPeriod._id || currentPeriod.id;
    const sectionId = todaySection._id || todaySection.id;

    wx.navigateTo({
      url: `/pages/checkin/checkin?periodId=${periodId}&sectionId=${sectionId}`
    });
  },

  /**
   * 格式化数字
   */
  formatNumber(num) {
    return formatNumber(num);
  },

  /**
   * 格式化加入时间
   */
  formatJoinDate(date) {
    if (!date) return '';
    return '加入于 ' + formatDate(date, 'YYYY-MM-DD');
  },

  /**
   * 分享
   */
  onShareAppMessage() {
    const { userInfo } = this.data;

    return {
      title: `${userInfo?.nickname || '我'}邀请你一起晨读`,
      path: '/pages/index/index',
      imageUrl: '/assets/images/share-default.png'
    };
  },

  /**
   * 分享到朋友圈
   */
  onShareTimeline() {
    return {
      title: '晨读营 - 在晨光中,遇见更好的自己',
      query: '',
      imageUrl: '/assets/images/share-default.png'
    };
  },

  /**
   * 打开编辑个人信息模态框
   */
  openEditProfile() {
    const { userInfo } = this.data;
    if (!userInfo) return;

    this.setData({
      showEditProfile: true,
      editForm: {
        avatar: userInfo.avatar || '🦁',
        nickname: userInfo.nickname || userInfo.name || '',
        signature: userInfo.signature || ''
      }
    });
  },

  /**
   * 关闭编辑个人信息模态框
   */
  closeEditProfile() {
    this.setData({
      showEditProfile: false
    });
  },

  /**
   * 防止事件冒泡
   */
  stopPropagation() {
    return false;
  },

  /**
   * 选择头像
   */
  selectAvatar(e) {
    const { avatar } = e.currentTarget.dataset;
    this.setData({
      'editForm.avatar': avatar
    });
  },

  /**
   * 昵称输入事件
   */
  onNicknameInput(e) {
    const { value } = e.detail;
    this.setData({
      'editForm.nickname': value
    });
  },

  /**
   * 签名输入事件
   */
  onSignatureInput(e) {
    const { value } = e.detail;
    this.setData({
      'editForm.signature': value
    });
  },

  /**
   * 检查签名是否有效（不为空、不只有空白字符和换行）
   */
  isValidSignature(signature) {
    if (!signature) return false;
    // 移除所有空白字符和换行，如果还有内容则认为有效
    return signature.trim().length > 0;
  },

  /**
   * 更新签名有效性状态
   */
  updateSignatureValidation() {
    const { userInfo } = this.data;
    const hasValidSignature = userInfo && this.isValidSignature(userInfo.signature);
    this.setData({ hasValidSignature });
  },

  /**
   * 保存用户个人信息
   */
  async saveUserProfile() {
    const { editForm, userInfo } = this.data;

    if (!editForm.nickname.trim()) {
      wx.showToast({
        title: '请输入昵称',
        icon: 'none'
      });
      return;
    }

    this.setData({ isSavingProfile: true });

    try {
      const app = getApp();

      // 调用更新用户信息API
      const response = await userService.updateUserProfile({
        avatar: editForm.avatar,
        nickname: editForm.nickname,
        signature: editForm.signature || null
      });

      // 如果没有异常，说明request.js已经验证了响应成功
      // 此时response是解包后的用户数据对象
      if (response && response._id) {
        // 更新本地用户信息
        const updatedUserInfo = {
          ...userInfo,
          avatar: editForm.avatar,
          nickname: editForm.nickname,
          signature: editForm.signature || null
        };

        this.setData({ userInfo: updatedUserInfo });

        // 更新全局应用数据
        app.globalData.userInfo = updatedUserInfo;

        // 保存到本地存储（使用 constants 中定义的 key 保持一致）
        const constants = require('../../config/constants');
        wx.setStorageSync(constants.STORAGE_KEYS.USER_INFO, updatedUserInfo);

        wx.showToast({
          title: '保存成功',
          icon: 'success'
        });

        // 关闭对话框
        this.setData({ showEditProfile: false });
      } else {
        wx.showToast({
          title: '保存失败，请重试',
          icon: 'none'
        });
      }
    } catch (error) {
      console.error('保存用户信息失败:', error);
      wx.showToast({
        title: '保存失败，请重试',
        icon: 'none'
      });
    } finally {
      this.setData({ isSavingProfile: false });
    }
  }
});
