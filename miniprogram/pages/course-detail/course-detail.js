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
    hasUserCheckedIn: false,
    commentExpanded: {},
    commentLoading: {}
  },

  onLoad(options) {
    console.log('课程详情页加载，参数:', options);
    if (!options.id) {
      console.error('缺少课程 ID 参数');
      wx.showToast({ title: '参数错误', icon: 'none' });
      setTimeout(() => wx.navigateBack(), 1500);
      return;
    }
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
   * 清理 HTML，使其与小程序 rich-text 兼容
   * 小程序 rich-text 支持：p、br、strong、em、u、s、span、img、a、li、ol、ul 等标签
   */
  cleanHtmlForRichText(html) {
    if (!html) return '';

    let cleaned = html;

    // 1. 移除 class 属性
    cleaned = cleaned.replace(/\s+class="[^"]*"/gi, '');

    // 2. 移除旧的 style 属性，然后重新添加
    cleaned = cleaned.replace(/\s+style="[^"]*"/gi, '');

    // 3. 识别手工输入的列表项格式（如"1. 文本"、"2. 文本"）并增加间距
    // 匹配 <p> 标签中以数字+点开头的内容
    cleaned = cleaned.replace(/<p>(\d+\.\s)/gi, (match) => {
      // 为列表项段落添加 margin-bottom
      return '<p style="margin-bottom:16px;">' + match.substring(3);
    });

    // 4. 为所有 <img> 标签添加合适的 style
    // 关键：使用 display:block 和 width:100% 让图片充满容器
    cleaned = cleaned.replace(
      /<img([^>]*?)>/gi,
      '<img$1 style="display:block;width:100%;height:auto;margin:12px 0;border-radius:4px;" />'
    );

    // 5. 确保所有图片都有 alt 属性
    cleaned = cleaned.replace(/<img([^>]*?)src/gi, (match, before) => {
      if (!before.includes('alt=')) {
        return `<img${before}alt="图片" src`;
      }
      return match;
    });

    // 6. 移除其他不必要的属性（保留 src, href, alt, style）
    cleaned = cleaned.replace(/\s+(?!src|href|alt|style)[\w-]+="[^"]*"/gi, '');

    return cleaned;
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

      // 如果是富文本内容（content），清理 HTML
      if (module === 'content' && course[module]) {
        course[module] = this.cleanHtmlForRichText(course[module]);
        console.log('✅ 已清理富文本 HTML:', course[module].substring(0, 100) + '...');
      }
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
      const currentUserId = app.globalData.userInfo?._id || app.globalData.userInfo?.id;


      // 为每个打卡记录构建完整的数据结构
      const checkinWithComments = dbCheckins.map(checkin => {
        // 检查当前用户是否已经打过卡
        const checkinUserId = checkin.userId?._id || checkin.userId?.id || checkin.userId;
        if (currentUserId && String(checkinUserId) === String(currentUserId)) {
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

        if (checkin.likes && checkin.likes.length > 0) {
          console.log('--- Debug Likes (Checkin) ---', { checkinId: checkin._id || checkin.id, likes: checkin.likes, currentUserId });
          checkin.likes.forEach(l => {
            const extractedLikeId = String(l.userId?._id || l.userId?.id || l.userId || l);
            console.log('Comparing:', { extractedLikeId, currentUserIdCasted: String(currentUserId), match: extractedLikeId === String(currentUserId) });
          });
        }

        const isCheckinLikedLocally = Array.isArray(checkin.likes) && currentUserId ? checkin.likes.some(l =>
          String(l.userId?._id || l.userId?.id || l.userId || l) === String(currentUserId)
        ) : false;

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
          isLiked: isCheckinLikedLocally,
          replies: [] // 初始化为空，下面会填充评论
        };

        return checkinItem;
      });

      // 保存当前用户是否已打卡的状态
      this.setData({ hasUserCheckedIn });

      // 评论改为延迟加载：用户点击"查看评论"时才加载，避免串行 N 次 API 请求
      course.comments = checkinWithComments;

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
   * 切换评论展开/收起（延迟加载）
   */
  async toggleComments(e) {
    const { index } = e.currentTarget.dataset;
    const comments = this.data.course.comments;
    const checkin = comments[index];
    if (!checkin) return;

    const expandedKey = `commentExpanded.${checkin.id}`;

    // 已展开 → 收起
    if (this.data.commentExpanded[checkin.id]) {
      this.setData({ [expandedKey]: false });
      return;
    }

    // 已加载过评论 → 直接展开
    if (checkin.replies && checkin.replies.length > 0) {
      this.setData({ [expandedKey]: true });
      return;
    }

    // 首次展开：从 API 加载评论
    const loadingKey = `commentLoading.${checkin.id}`;
    this.setData({ [loadingKey]: true, [expandedKey]: true });

    try {
      const checkinComments = await commentService.getCommentsByCheckin(checkin.id, { limit: 100 });

      if (checkinComments && checkinComments.list && checkinComments.list.length > 0) {
        const app = getApp();
        const currentUserId = app.globalData.userInfo?._id || app.globalData.userInfo?.id;

        const formattedReplies = checkinComments.list.map(comment => {
          const formattedNestedReplies = (comment.replies || []).map(reply => {
            const isLiked = Array.isArray(reply.likes) && currentUserId
              ? reply.likes.some(l => String(l.userId?._id || l.userId?.id || l.userId || l) === String(currentUserId))
              : false;
            return {
              id: reply._id,
              userId: reply.userId?._id || reply.userId,
              userName: reply.userId?.nickname || '匿名用户',
              avatarText: reply.userId?.nickname ? reply.userId.nickname.charAt(0) : '👤',
              avatarUrl: reply.userId?.avatarUrl || '',
              avatarColor: '#9cb5f0',
              content: reply.content || '',
              createTime: reply.createdAt ? this.formatTime(reply.createdAt) : '刚刚',
              likeCount: reply.likeCount || 0,
              isLiked,
              parentId: comment._id
            };
          });

          const isCommentLiked = Array.isArray(comment.likes) && currentUserId
            ? comment.likes.some(l => String(l.userId?._id || l.userId?.id || l.userId || l) === String(currentUserId))
            : false;

          return {
            id: comment._id,
            userId: comment.userId?._id || comment.userId,
            userName: comment.userId?.nickname || '匿名用户',
            avatarText: comment.userId?.nickname ? comment.userId.nickname.charAt(0) : '👤',
            avatarUrl: comment.userId?.avatarUrl || '',
            avatarColor: '#7eb5f0',
            content: comment.content || '',
            createTime: comment.createdAt ? this.formatTime(comment.createdAt) : '刚刚',
            likeCount: comment.likeCount || 0,
            isLiked: isCommentLiked,
            replies: formattedNestedReplies
          };
        });

        this.setData({
          [`course.comments[${index}].replies`]: formattedReplies,
          [loadingKey]: false
        });
      } else {
        this.setData({ [loadingKey]: false });
      }
    } catch (error) {
      console.error('加载评论失败:', error);
      this.setData({ [loadingKey]: false, [expandedKey]: false });
      wx.showToast({ title: '加载评论失败', icon: 'none' });
    }
  },

  /**
   * 点赞打卡记录（顶层列表项是打卡记录，不是评论）
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
        // 取消点赞打卡记录
        console.log(`👎 取消点赞打卡: checkinId=${id}`);
        await commentService.unlikeCheckin(id);
        comment.likeCount = Math.max(0, comment.likeCount - 1);
        comment.isLiked = false;
        console.log(`✅ 取消点赞成功: 当前点赞数=${comment.likeCount}`);
      } else {
        // 点赞打卡记录
        console.log(`👍 点赞打卡: checkinId=${id}`);
        await commentService.likeCheckin(id);
        comment.likeCount += 1;
        comment.isLiked = true;
        console.log(`✅ 点赞成功: 当前点赞数=${comment.likeCount}`);
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
   * 点赞评论（回复列表里的项是评论，commentId 是打卡ID，replyId 是评论ID）
   */
  async handleLikeReply(e) {
    const { commentId, replyId } = e.currentTarget.dataset;
    const comments = this.data.course.comments;
    const comment = comments.find(c => c.id === commentId || c._id === commentId);

    if (!comment || !comment.replies) {
      console.error('评论或回复不存在', { commentId, replyId });
      return;
    }

    let isNestedReply = false;
    let parentCommentId = null;

    let reply = comment.replies.find(r => r.id === replyId || r._id === replyId);

    // 如果在第一层回复(replies)里找不到，就去第二层(replies.replies)里找
    if (!reply) {
      for (const r of comment.replies) {
        if (r.replies && r.replies.length > 0) {
          const nestedReply = r.replies.find(nr => nr.id === replyId || nr._id === replyId);
          if (nestedReply) {
            reply = nestedReply;
            isNestedReply = true;
            parentCommentId = nestedReply.parentId || r.id || r._id;
            break;
          }
        }
      }
    }

    if (!reply) {
      console.error('回复不存在');
      return;
    }

    try {
      if (reply.isLiked) {
        // 取消点赞评论
        console.log(`👎 取消点赞回复: checkinId=${commentId}, isNested=${isNestedReply}, parentCommentId=${parentCommentId}, replyId=${replyId}`);
        if (isNestedReply) {
          await commentService.unlikeReply(parentCommentId, replyId);
        } else {
          await commentService.unlikeComment(replyId);
        }
        reply.likeCount = Math.max(0, reply.likeCount - 1);
        reply.isLiked = false;
        console.log(`✅ 取消点赞成功: 当前点赞数=${reply.likeCount}`);
      } else {
        // 点赞评论
        console.log(`👍 点赞回复: checkinId=${commentId}, isNested=${isNestedReply}, parentCommentId=${parentCommentId}, replyId=${replyId}`);
        if (isNestedReply) {
          await commentService.likeReply(parentCommentId, replyId);
        } else {
          await commentService.likeComment(replyId);
        }
        reply.likeCount = (reply.likeCount || 0) + 1;
        reply.isLiked = true;
        console.log(`✅ 点赞成功: 当前点赞数=${reply.likeCount}`);
      }

      this.setData({
        'course.comments': comments
      });
    } catch (error) {
      console.error('回复点赞操作失败:', error);
      wx.showToast({
        title: '操作失败，请重试',
        icon: 'none'
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
                  if (commentIdx !== -1 && updatedCommentData && updatedCommentData.replies) {
                    const formattedReplies = updatedCommentData.replies.map(reply => {
                      const isNestedReplyLikedLocally = Array.isArray(reply.likes) && currentUser ? reply.likes.some(l =>
                        String(l.userId?._id || l.userId?.id || l.userId || l) === String(currentUser?._id || currentUser?.id)
                      ) : false;

                      return {
                        id: reply._id,
                        userId: reply.userId?._id || reply.userId,
                        userName: reply.userId?.nickname || '匿名用户',
                        avatarText: reply.userId?.nickname ? reply.userId.nickname.charAt(0) : '👤',
                        avatarColor: '#7eb5f0',
                        content: reply.content || '',
                        createTime: reply.createdAt ? this.formatTime(reply.createdAt) : '刚刚',
                        likeCount: reply.likeCount || 0,
                        isLiked: isNestedReplyLikedLocally
                      };
                    });

                    checkin.replies[commentIdx].replies = formattedReplies.map(reply => ({ ...reply, parentId: commentId }));
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
