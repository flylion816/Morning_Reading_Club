const courseService = require('../../services/course.service');
const constants = require('../../config/constants');

Page({
  data: {
    courseId: null,
    course: {},
    calendar: [],
    checkedDays: 0,
    loading: true
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

  async loadCourseDetail() {
    this.setData({ loading: true });

    try {
      console.log('开始加载课程详情，ID:', this.data.courseId);
      const course = await courseService.getCourseDetail(this.data.courseId);
      console.log('课程详情加载成功:', course);
      console.log('course.comments:', course.comments);
      console.log('comments 是否存在:', !!course.comments);
      console.log('comments 长度:', course.comments ? course.comments.length : 0);

      // 从本地存储加载打卡记录
      const storageKey = `checkins_${this.data.courseId}`;
      const localCheckins = wx.getStorageSync(storageKey) || [];
      console.log('本地打卡记录:', localCheckins);

      // 合并打卡记录和初始评论，使用 Map 去重
      const commentsMap = new Map();

      // 先添加本地打卡记录
      localCheckins.forEach(checkin => {
        commentsMap.set(checkin.id, checkin);
      });

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
   * 点击打卡人头像 - 跳转到他人主页
   */
  handleAvatarClick(e) {
    const { userId } = e.currentTarget.dataset;

    if (!userId) {
      console.error('用户ID不存在');
      return;
    }

    // 跳转到他人主页
    wx.navigateTo({
      url: `/pages/profile-others/profile-others?userId=${userId}`
    });
  }
});
