const courseService = require('../../services/course.service');
const checkinService = require('../../services/checkin.service');
const constants = require('../../config/constants');

Page({
  data: {
    courseId: null,
    course: {},
    calendar: [],
    checkedDays: 0,
    loading: true,
    hasUserCheckedIn: false
  },

  onLoad(options) {
    console.log('课程详情页加载，参数:', options);
    this.setData({ courseId: options.id });
    this.loadCourseDetail();
  },

  onShow() {
    // 每次显示页面时重新加载，以显示最新的打卡记录
    if (this.data.courseId && this.data.course) {
      this.loadCourseDetail();
    }
  },

  /**
   * 检查内容是否为空（包括去除空格）
   */
  isContentEmpty(content) {
    if (!content) return true;
    if (typeof content === 'string') {
      return content.trim() === '';
    }
    return false;
  },

  /**
   * 处理课程数据，添加模块可见性标志
   */
  processCourseModules(course) {
    const modules = ['meditation', 'question', 'content', 'reflection', 'action', 'learn', 'extract', 'say'];

    modules.forEach(module => {
      // 判断模块内容是否为空，添加 visible 标志
      const isEmpty = this.isContentEmpty(course[module]);
      course[`${module}Visible`] = !isEmpty;
    });

    return course;
  },

  async loadCourseDetail() {
    this.setData({ loading: true });

    try {
      console.log('开始加载课程详情，ID:', this.data.courseId);
      const course = await courseService.getCourseDetail(this.data.courseId);
      console.log('课程详情加载成功:', course);

      // 确保 course.comments 是数组（后端可能不返回这个字段）
      if (!course.comments) {
        course.comments = [];
      }

      // 处理课程模块的可见性
      this.processCourseModules(course);

      console.log('course.comments:', course.comments);
      console.log('comments 是否存在:', !!course.comments);
      console.log('comments 长度:', course.comments ? course.comments.length : 0);

      // 从数据库加载打卡记录
      let dbCheckins = [];
      try {
        // 使用 /checkins/period/:periodId 端点获取期次的所有打卡记录（包括其他用户的）
        // 这样才能在课程详情页显示所有人的打卡记录，与课程列表页保持一致
        const checkinRes = await courseService.getPeriodCheckins(course.periodId?._id || course.periodId);
        console.log('打卡API响应:', checkinRes);

        if (checkinRes) {
          // request.js 会自动提取 data.data，所以这里应该是 { list: [...], pagination: {...} }
          let allCheckins = [];
          if (checkinRes.list) {
            allCheckins = checkinRes.list;
          } else if (Array.isArray(checkinRes)) {
            allCheckins = checkinRes;
          }

          // 过滤出当前课节的打卡记录
          // 注意：API返回的sectionId可能被populate了，需要取_id并转换为字符串比对
          console.log('🔍 开始过滤打卡记录，目标courseId:', this.data.courseId);
          console.log('📊 需要过滤的打卡记录数:', allCheckins.length);

          // 显示前几条的用户信息
          if (allCheckins.length > 0) {
            console.log('📌 打卡记录来源用户ID:', allCheckins[0].userId?._id || allCheckins[0].userId || 'unknown');
            console.log('📌 当前登录用户ID:', getApp().globalData.userInfo?.id || getApp().globalData.userInfo?._id || 'unknown');
          }

          dbCheckins = allCheckins.filter((checkin, index) => {
            const sectionId = checkin.sectionId?._id || checkin.sectionId;
            const sectionIdStr = String(sectionId);
            const matches = sectionIdStr === this.data.courseId;

            console.log(`  [${index}] sectionId=${sectionId} (type: ${typeof checkin.sectionId}), 转换后=${sectionIdStr}, 匹配=${matches}`);

            return matches;
          });

          console.log('✅ 从数据库加载的打卡记录:', dbCheckins);
        }
      } catch (error) {
        console.warn('从打卡API加载失败，尝试使用本地存储:', error);
      }

      // 如果数据库没有数据，则从本地存储加载
      if (dbCheckins.length === 0) {
        const storageKey = `checkins_${this.data.courseId}`;
        dbCheckins = wx.getStorageSync(storageKey) || [];
        console.log('本地打卡记录:', dbCheckins);
      }

      // 合并打卡记录和初始评论，使用 Map 去重
      const commentsMap = new Map();

      // 先添加数据库打卡记录，转换为评论格式
      const app = getApp();
      let hasUserCheckedIn = false;
      const currentUserId = app.globalData.userInfo?.id;

      dbCheckins.forEach(checkin => {
        // 检查当前用户是否已经打过卡
        const checkinUserId = checkin.userId?._id || checkin.userId?.id || checkin.userId;
        if (checkinUserId === currentUserId) {
          hasUserCheckedIn = true;
        }

        // 获取用户信息（可能是被populate的对象，也可能只是ID字符串）
        let userName = '匿名用户';
        let avatarText = '👤';
        let avatarUrl = '';

        if (checkin.userId && typeof checkin.userId === 'object') {
          // userId被populate了，包含用户完整信息
          userName = checkin.userId.nickname || '匿名用户';
          avatarUrl = checkin.userId.avatarUrl || '';
          // 优先使用真实头像，没有则用昵称首字
          avatarText = avatarUrl ? '' : (userName ? userName.charAt(0) : '👤');
        } else {
          // userId只是字符串ID，使用默认信息
          userName = checkin.userName || '匿名用户';
          avatarText = checkin.avatarText || '👤';
        }

        // 将打卡记录转换为评论格式
        const comment = {
          id: checkin._id || checkin.id,
          userId: checkinUserId, // 添加userId字段以支持头像点击
          userName: userName,
          avatarText: avatarText,
          avatarUrl: avatarUrl,
          avatarColor: checkin.avatarColor || '#4a90e2',
          content: checkin.note || checkin.content || '',
          createTime: checkin.createdAt ? this.formatTime(checkin.createdAt) : '刚刚',
          likeCount: checkin.likeCount || 0,
          isLiked: false,
          replies: checkin.replies || []
        };
        commentsMap.set(comment.id, comment);
      });

      // 保存当前用户是否已打卡的状态
      this.setData({ hasUserCheckedIn });

      // 再添加初始评论（如果ID已存在则不覆盖）
      if (course.comments && course.comments.length > 0) {
        course.comments.forEach(comment => {
          if (!commentsMap.has(comment.id)) {
            commentsMap.set(comment.id, comment);
          }
        });
      }

      // 转换为数组
      const allComments = Array.from(commentsMap.values());

      // 为评论和回复添加 avatarText 字段
      if (allComments && allComments.length > 0) {
        allComments.forEach(comment => {
          // 如果没有avatarText，则生成
          if (!comment.avatarText) {
            comment.avatarText = comment.userName ? comment.userName.charAt(comment.userName.length - 1) : '';
          }

          // 添加回复的头像文字
          if (comment.replies && comment.replies.length > 0) {
            comment.replies.forEach(reply => {
              if (!reply.avatarText) {
                reply.avatarText = reply.userName ? reply.userName.charAt(reply.userName.length - 1) : '';
              }
            });
          }
        });
      }

      course.comments = allComments;

      const calendar = this.generateCalendar(course);
      const checkedDays = calendar.filter(d => d.status === 'checked').length;

      this.setData({
        course,
        calendar,
        checkedDays,
        loading: false
      });

      console.log('页面数据设置完成');
      console.log('this.data.course.comments:', this.data.course.comments);
    } catch (error) {
      console.error('加载课程详情失败:', error);
      this.setData({ loading: false });
      wx.showToast({
        title: '加载失败',
        icon: 'none'
      });
    }
  },

  generateCalendar(course) {
    const calendar = [];
    for (let day = 1; day <= constants.COURSE_DURATION; day++) {
      calendar.push({
        day,
        status: day <= (course.currentDay || 0) ? 'checked' : 'pending',
        statusText: day <= (course.currentDay || 0) ? '✓' : ''
      });
    }
    return calendar;
  },

  handleDayClick(e) {
    const { day } = e.currentTarget.dataset;
    console.log('点击第', day.day, '天');
  },

  handleEnroll() {
    wx.showModal({
      title: '确认报名',
      content: '确定要报名该课程吗？',
      success: (res) => {
        if (res.confirm) {
          // TODO: 调用报名API
          wx.showToast({
            title: '报名成功',
            icon: 'success'
          });
        }
      }
    });
  },

  handleBack() {
    wx.navigateBack();
  },

  handleCheckin() {
    // 跳转到打卡页面
    wx.navigateTo({
      url: `/pages/checkin/checkin?courseId=${this.data.courseId}`
    });
  },

  /**
   * 点赞评论
   */
  handleLikeComment(e) {
    const { id } = e.currentTarget.dataset;
    const comments = this.data.course.comments;
    const comment = comments.find(c => c.id === id);

    if (comment) {
      if (comment.isLiked) {
        // 取消点赞
        comment.likeCount = Math.max(0, comment.likeCount - 1);
        comment.isLiked = false;
      } else {
        // 点赞
        comment.likeCount += 1;
        comment.isLiked = true;
      }

      this.setData({
        'course.comments': comments
      });
    }
  },

  /**
   * 回复评论
   */
  handleReplyComment(e) {
    const { id } = e.currentTarget.dataset;
    const comments = this.data.course.comments;
    const comment = comments.find(c => c.id === id);

    if (!comment) {
      return;
    }

    // 使用 wx.showModal 获取回复内容
    wx.showModal({
      title: `回复 ${comment.userName}`,
      editable: true,
      placeholderText: '请输入回复内容...',
      success: (res) => {
        if (res.confirm && res.content && res.content.trim()) {
          // 创建新的回复
          const newReply = {
            id: Date.now(),
            userId: 1000, // 当前用户ID（mock）
            userName: '我',
            avatarText: '我',
            avatarColor: '#7eb5f0',
            content: res.content.trim(),
            createTime: '刚刚',
            likeCount: 0,
            isLiked: false
          };

          // 添加到回复列表
          if (!comment.replies) {
            comment.replies = [];
          }
          comment.replies.push(newReply);

          // 更新数据
          this.setData({
            'course.comments': comments
          });

          wx.showToast({
            title: '回复成功',
            icon: 'success'
          });
        }
      }
    });
  },

  /**
   * 点赞回复
   */
  handleLikeReply(e) {
    const { commentId, replyId } = e.currentTarget.dataset;
    const comments = this.data.course.comments;
    const comment = comments.find(c => c.id === commentId);

    if (!comment || !comment.replies) {
      return;
    }

    const reply = comment.replies.find(r => r.id === replyId);
    if (reply) {
      if (reply.isLiked) {
        // 取消点赞
        reply.likeCount = Math.max(0, reply.likeCount - 1);
        reply.isLiked = false;
      } else {
        // 点赞
        reply.likeCount = (reply.likeCount || 0) + 1;
        reply.isLiked = true;
      }

      this.setData({
        'course.comments': comments
      });
    }
  },

  /**
   * 回复某条回复
   */
  handleReplyToReply(e) {
    const { commentId, replyId, userName } = e.currentTarget.dataset;
    const comments = this.data.course.comments;
    const comment = comments.find(c => c.id === commentId);

    if (!comment) {
      return;
    }

    // 使用 wx.showModal 获取回复内容
    wx.showModal({
      title: `回复 ${userName}`,
      editable: true,
      placeholderText: '请输入回复内容...',
      success: (res) => {
        if (res.confirm && res.content && res.content.trim()) {
          // 创建新的回复
          const newReply = {
            id: Date.now(),
            userId: 1000, // 当前用户ID（mock）
            userName: '我',
            avatarText: '我',
            avatarColor: '#7eb5f0',
            content: res.content.trim(),
            createTime: '刚刚',
            likeCount: 0,
            isLiked: false,
            replyTo: userName // 标记这是回复谁的
          };

          // 添加到回复列表
          if (!comment.replies) {
            comment.replies = [];
          }
          comment.replies.push(newReply);

          // 更新数据
          this.setData({
            'course.comments': comments
          });

          wx.showToast({
            title: '回复成功',
            icon: 'success'
          });
        }
      }
    });
  },

  /**
   * 格式化时间
   */
  formatTime(dateStr) {
    if (!dateStr) return '刚刚';

    try {
      const date = new Date(dateStr);
      const now = new Date();
      const diff = Math.floor((now - date) / 1000); // 秒数

      if (diff < 60) return '刚刚';
      if (diff < 3600) return Math.floor(diff / 60) + '分钟前';
      if (diff < 86400) return Math.floor(diff / 3600) + '小时前';
      if (diff < 604800) return Math.floor(diff / 86400) + '天前';

      // 其他情况显示日期
      return `${date.getMonth() + 1}月${date.getDate()}日`;
    } catch (error) {
      return '刚刚';
    }
  },

  /**
   * 点击打卡人头像 - 跳转到他人主页
   */
  handleAvatarClick(e) {
    const { userId } = e.currentTarget.dataset;
    const { course } = this.data;

    console.log('🎯 handleAvatarClick - 开始构造导航URL');
    console.log('   userId:', userId);
    console.log('   course:', course);
    console.log('   course.periodId:', course?.periodId);

    if (!userId) {
      console.error('❌ 用户ID不存在');
      return;
    }

    // 跳转到他人主页，同时传递当前课程所属的期次ID
    let url = `/pages/profile-others/profile-others?userId=${userId}`;
    if (course && course.periodId) {
      // 处理periodId可能是对象的情况（API返回的是populate的对象）
      const periodId = course.periodId._id || course.periodId;
      url += `&periodId=${periodId}`;
      console.log('✅ 成功添加periodId:', periodId);
    } else {
      console.warn('⚠️ course.periodId未找到或为空');
    }

    console.log('🔗 最终导航URL:', url);
    wx.navigateTo({ url });
  }
});
