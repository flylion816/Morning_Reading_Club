const courseService = require('../../services/course.service');
const checkinService = require('../../services/checkin.service');
const commentService = require('../../services/comment.service');
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
    const modules = [
      'meditation',
      'question',
      'content',
      'reflection',
      'action',
      'learn',
      'extract',
      'say'
    ];

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
      console.log('📌 course.periodId:', course.periodId);
      console.log('📌 course.periodId._id:', course.periodId?._id);
      console.log('📌 course.periodId 类型:', typeof course.periodId);

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
        const periodId = course.periodId?._id || course.periodId;
        console.log('🔍 准备调用 getPeriodCheckins，periodId:', periodId);

        if (!periodId) {
          console.error('❌ periodId 为空，无法加载打卡记录!');
          throw new Error('periodId 为空');
        }

        const checkinRes = await courseService.getPeriodCheckins(periodId);
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
            console.log(
              '📌 打卡记录来源用户ID:',
              allCheckins[0].userId?._id || allCheckins[0].userId || 'unknown'
            );
            console.log(
              '📌 当前登录用户ID:',
              getApp().globalData.userInfo?.id || getApp().globalData.userInfo?._id || 'unknown'
            );
          }

          dbCheckins = allCheckins.filter((checkin, index) => {
            const sectionId = checkin.sectionId?._id || checkin.sectionId;
            const sectionIdStr = String(sectionId);
            const matches = sectionIdStr === this.data.courseId;

            console.log(
              `  [${index}] sectionId=${sectionId} (type: ${typeof checkin.sectionId}), 转换后=${sectionIdStr}, 匹配=${matches}`
            );

            return matches;
          });

          console.log('✅ 从数据库加载的打卡记录:', dbCheckins);
        }
      } catch (error) {
        console.warn('从打卡API加载失败，尝试使用本地存储:', error);
      }

      // 从每个打卡记录加载对应的评论
      let allComments = [];
      try {
        for (const checkin of dbCheckins) {
          try {
            const checkinComments = await commentService.getCommentsByCheckin(checkin._id, {
              limit: 100
            });
            if (checkinComments && checkinComments.list) {
              allComments = allComments.concat(checkinComments.list);
            }
          } catch (err) {
            console.warn(`获取打卡${checkin._id}的评论失败:`, err);
          }
        }
        console.log('✅ 加载的所有评论:', allComments);
      } catch (error) {
        console.warn('加载评论失败:', error);
      }

      // 如果数据库没有数据，则从本地存储加载
      if (dbCheckins.length === 0) {
        const storageKey = `checkins_${this.data.courseId}`;
        dbCheckins = wx.getStorageSync(storageKey) || [];
        console.log('本地打卡记录:', dbCheckins);
      }

      // 组织打卡记录的层级结构
      // 打卡(Checkin)为主层级，评论(Comment)为子层级
      const app = getApp();
      let hasUserCheckedIn = false;
      const currentUserId = app.globalData.userInfo?.id;

      // 为每个打卡记录构建完整的数据结构
      const checkinWithComments = dbCheckins.map(checkin => {
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
          avatarText = avatarUrl ? '' : userName ? userName.charAt(0) : '👤';
        } else {
          // userId只是字符串ID，使用默认信息
          userName = checkin.userName || '匿名用户';
          avatarText = checkin.avatarText || '👤';
        }

        // 将打卡记录转换为前端格式
        const checkinItem = {
          id: checkin._id || checkin.id,
          userId: checkinUserId,
          userName: userName,
          avatarText: avatarText,
          avatarUrl: avatarUrl,
          avatarColor: checkin.avatarColor || '#4a90e2',
          content: checkin.note || checkin.content || '',
          createTime: checkin.createdAt ? this.formatTime(checkin.createdAt) : '刚刚',
          likeCount: checkin.likeCount || 0,
          isLiked: false,
          replies: [] // 初始化为空，下面会填充评论
        };

        return checkinItem;
      });

      // 保存当前用户是否已打卡的状态
      this.setData({ hasUserCheckedIn });

      // 将加载的Comment关联到对应的Checkin下
      if (allComments && allComments.length > 0) {
        allComments.forEach(comment => {
          // 找到这个Comment所属的Checkin
          const parentCheckin = checkinWithComments.find(
            checkin => String(checkin.id) === String(comment.checkinId)
          );

          if (parentCheckin) {
            // 格式化Comment中的回复（嵌套回复）
            const formattedNestedReplies = (comment.replies || []).map(reply => ({
              id: reply._id,
              userId: reply.userId?._id || reply.userId,
              userName: reply.userId?.nickname || '匿名用户',
              avatarText: reply.userId?.nickname ? reply.userId.nickname.charAt(0) : '👤',
              avatarUrl: reply.userId?.avatarUrl || '',
              avatarColor: '#9cb5f0',
              content: reply.content || '',
              createTime: reply.createdAt ? this.formatTime(reply.createdAt) : '刚刚',
              likeCount: 0,
              isLiked: false
            }));

            // 格式化Comment
            const formattedComment = {
              id: comment._id,
              userId: comment.userId?._id || comment.userId,
              userName: comment.userId?.nickname || '匿名用户',
              avatarText: comment.userId?.nickname ? comment.userId.nickname.charAt(0) : '👤',
              avatarUrl: comment.userId?.avatarUrl || '',
              avatarColor: '#7eb5f0',
              content: comment.content || '',
              createTime: comment.createdAt ? this.formatTime(comment.createdAt) : '刚刚',
              likeCount: comment.likeCount || 0,
              isLiked: false,
              replies: formattedNestedReplies
            };
            parentCheckin.replies.push(formattedComment);
          }
        });
      }

      // 最终的打卡列表（包含每条打卡下的评论）
      const finalComments = checkinWithComments;

      // 为评论和回复添加 avatarText 字段
      if (finalComments && finalComments.length > 0) {
        finalComments.forEach(comment => {
          // 如果没有avatarText，则生成
          if (!comment.avatarText) {
            comment.avatarText = comment.userName
              ? comment.userName.charAt(comment.userName.length - 1)
              : '';
          }

          // 添加回复的头像文字
          if (comment.replies && comment.replies.length > 0) {
            comment.replies.forEach(reply => {
              if (!reply.avatarText) {
                reply.avatarText = reply.userName
                  ? reply.userName.charAt(reply.userName.length - 1)
                  : '';
              }

              // 添加嵌套回复的头像文字
              if (reply.replies && reply.replies.length > 0) {
                reply.replies.forEach(nestedReply => {
                  if (!nestedReply.avatarText) {
                    nestedReply.avatarText = nestedReply.userName
                      ? nestedReply.userName.charAt(0)
                      : '👤';
                  }
                });
              }
            });
          }
        });
      }

      course.comments = finalComments;

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
      success: res => {
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
  async handleLikeComment(e) {
    const { id } = e.currentTarget.dataset;
    const comments = this.data.course.comments;
    const comment = comments.find(c => c.id === id);

    if (!comment) {
      return;
    }

    try {
      if (comment.isLiked) {
        // 取消点赞
        await commentService.unlikeComment(id);
        comment.likeCount = Math.max(0, comment.likeCount - 1);
        comment.isLiked = false;
      } else {
        // 点赞
        await commentService.likeComment(id);
        comment.likeCount += 1;
        comment.isLiked = true;
      }

      this.setData({
        'course.comments': comments
      });
    } catch (error) {
      console.error('点赞操作失败:', error);
      wx.showToast({
        title: '操作失败，请重试',
        icon: 'none'
      });
    }
  },

  /**
   * 回复评论
   */
  async handleReplyComment(e) {
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
      success: async res => {
        if (res.confirm && res.content && res.content.trim()) {
          try {
            // 直接创建评论（关联到打卡记录）
            const app = getApp();
            const currentUser = app.globalData.userInfo;

            console.log('📝 创建评论，打卡ID:', id);

            const replyData = await commentService.createComment({
              checkinId: id,
              content: res.content.trim()
            });

            console.log('✅ 评论已保存到数据库:', replyData);

            // 创建新的回复对象
            const newReply = {
              id: replyData._id || replyData.id || Date.now(),
              userId: currentUser?._id || currentUser?.id,
              userName: currentUser?.nickname || '我',
              avatarText: currentUser?.nickname
                ? currentUser.nickname.charAt(currentUser.nickname.length - 1)
                : '我',
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
          } catch (error) {
            console.error('回复失败:', error);
            wx.showToast({
              title: '回复失败，请重试',
              icon: 'none'
            });
          }
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
   * 参数：
   *   - checkinId: 打卡记录ID（打卡列表的ID）
   *   - commentId: 评论ID（打卡的评论）
   *   - replyId: 被回复的用户ID（评论的回复者）
   *   - userName: 被回复的用户名
   */
  async handleReplyToReply(e) {
    const { checkinId, commentId, replyId, userName } = e.currentTarget.dataset;

    console.log('📝 准备回复:', { checkinId, commentId, replyId, userName });

    // 验证必要参数
    if (!checkinId || !commentId || !replyId) {
      console.error('❌ 参数不完整', { checkinId, commentId, replyId });
      wx.showToast({
        title: '参数错误',
        icon: 'none'
      });
      return;
    }

    // 在 course.comments（打卡列表）中找到这个打卡
    const checkins = this.data.course.comments;
    const checkin = checkins.find(c => c.id === checkinId);

    if (!checkin || !checkin.replies) {
      console.error('❌ 找不到打卡或评论列表', { checkinId, checkin });
      return;
    }

    // 在打卡的 replies（评论列表）中找到这条评论
    const comment = checkin.replies.find(c => c.id === commentId);

    if (!comment) {
      console.error('❌ 找不到评论', { commentId });
      return;
    }

    // 使用 wx.showModal 获取回复内容
    wx.showModal({
      title: `回复 ${userName}`,
      editable: true,
      placeholderText: '请输入回复内容...',
      success: async res => {
        if (res.confirm && res.content && res.content.trim()) {
          try {
            const app = getApp();
            const currentUser = app.globalData.userInfo;

            console.log(
              '📝 提交回复: commentId=' +
                commentId +
                ', content=' +
                res.content.trim().substring(0, 20)
            );

            // 调用API保存回复到这条评论
            // 后端返回的是整个更新后的 Comment 对象（包含更新的 replies 数组）
            const updatedComment = await commentService.replyComment(commentId, {
              content: res.content.trim(),
              replyToUserId: replyId // 标记回复的是哪个用户
            });

            console.log('✅ 回复已保存到数据库，更新后的评论:', updatedComment);
            console.log('回复列表长度:', updatedComment.replies?.length);

            // 重新加载该打卡的评论列表，确保前端数据与后端同步
            // （因为后端返回的 replies 数据结构需要格式化才能显示）
            try {
              const refreshedComments = await commentService.getCommentsByCheckin(checkinId, {
                limit: 100
              });

              if (refreshedComments && refreshedComments.list) {
                // 找到这条评论
                const updatedCommentData = refreshedComments.list.find(c => c._id === commentId);

                if (updatedCommentData && checkin.replies) {
                  // 更新前端的这条评论数据
                  const commentIdx = checkin.replies.findIndex(c => c.id === commentId);
                  if (commentIdx !== -1) {
                    // 重新格式化评论中的回复
                    const formattedReplies = updatedCommentData.replies.map(reply => ({
                      id: reply._id,
                      userId: reply.userId?._id || reply.userId,
                      userName: reply.userId?.nickname || '匿名用户',
                      avatarText: reply.userId?.nickname ? reply.userId.nickname.charAt(0) : '👤',
                      avatarUrl: reply.userId?.avatarUrl || '',
                      avatarColor: '#7eb5f0',
                      content: reply.content || '',
                      createTime: reply.createdAt ? this.formatTime(reply.createdAt) : '刚刚',
                      likeCount: 0,
                      isLiked: false
                    }));

                    checkin.replies[commentIdx].replies = formattedReplies;
                    checkin.replies[commentIdx].replyCount = updatedCommentData.replyCount || 0;

                    // 🔍 调试日志：验证嵌套回复数据结构
                    console.log('✅ 更新后的评论结构:');
                    console.log('   - 评论ID:', checkin.replies[commentIdx].id);
                    console.log('   - 评论内容:', checkin.replies[commentIdx].content);
                    console.log('   - 回复总数:', checkin.replies[commentIdx].replyCount);
                    console.log('   - 回复列表:', checkin.replies[commentIdx].replies);
                    if (checkin.replies[commentIdx].replies && checkin.replies[commentIdx].replies.length > 0) {
                      console.log('   - 最后一条回复:', checkin.replies[commentIdx].replies[checkin.replies[commentIdx].replies.length - 1]);
                    }
                  }
                }
              }
            } catch (err) {
              console.warn('刷新评论数据失败:', err);
              // 即使刷新失败也继续，不影响用户体验
            }

            // 更新页面数据
            this.setData({
              'course.comments': checkins
            });

            wx.showToast({
              title: '回复成功',
              icon: 'success'
            });
          } catch (error) {
            console.error('❌ 回复失败:', error);
            wx.showToast({
              title: '回复失败，请重试',
              icon: 'none'
            });
          }
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
