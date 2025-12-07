const Insight = require('../models/Insight');
const Checkin = require('../models/Checkin');
const InsightRequest = require('../models/InsightRequest');
const User = require('../models/User');
const Enrollment = require('../models/Enrollment');
const { success, errors } = require('../utils/response');
const { createNotification, createNotifications } = require('./notification.controller');
const logger = require('../utils/logger');

/**
 * 辅助函数：创建通知并自动添加 WebSocket 管理器
 * @param {Object} req - Express 请求对象
 * @param {string} userId - 用户ID
 * @param {string} type - 通知类型
 * @param {string} title - 标题
 * @param {string} content - 内容
 * @param {Object} options - 选项
 */
async function notifyUser(req, userId, type, title, content, options = {}) {
  return createNotification(userId, type, title, content, {
    ...options,
    wsManager: req.wsManager
  });
}

/**
 * 辅助函数：为多个用户创建通知并自动添加 WebSocket 管理器
 * @param {Object} req - Express 请求对象
 * @param {string[]} userIds - 用户ID列表
 * @param {string} type - 通知类型
 * @param {string} title - 标题
 * @param {string} content - 内容
 * @param {Object} options - 选项
 */
async function notifyUsers(req, userIds, type, title, content, options = {}) {
  return createNotifications(userIds, type, title, content, {
    ...options,
    wsManager: req.wsManager
  });
}

// 生成AI反馈（Mock版）
async function generateInsight(req, res, next) {
  try {
    const { checkinId } = req.body;
    const userId = req.user.userId;

    // 验证打卡存在
    const checkin = await Checkin.findById(checkinId)
      .populate('sectionId', 'title day');

    if (!checkin) {
      return res.status(404).json(errors.notFound('打卡记录不存在'));
    }

    if (checkin.userId.toString() !== userId) {
      return res.status(403).json(errors.forbidden('无权操作'));
    }

    // 检查是否已生成
    const existing = await Insight.findOne({
      userId,
      checkinId
    });

    if (existing) {
      return res.json(success(existing, '反馈已生成'));
    }

    // Mock AI生成反馈内容
    const mockContent = `
      <div class="insight-content">
        <h3>📊 今日学习洞察</h3>
        <p>恭喜你完成了第 ${checkin.day} 天的晨读！</p>

        <h4>💪 你的进步</h4>
        <ul>
          <li>阅读时长: ${checkin.readingTime || 15} 分钟</li>
          <li>完成度: ${checkin.completionRate || 100}%</li>
          <li>坚持天数已达到新高度！</li>
        </ul>

        <h4>🎯 关键收获</h4>
        <p>通过今天的学习，你正在培养${checkin.sectionId?.title || '重要习惯'}。持续的积累会带来质的飞跃。</p>

        <h4>🌟 下一步建议</h4>
        <ul>
          <li>将今天学到的内容应用到实际生活中</li>
          <li>坚持打卡，保持学习节奏</li>
          <li>在社区中分享你的心得</li>
        </ul>
      </div>
    `;

    const mockSummary = `完成第${checkin.day}天学习，阅读${checkin.readingTime || 15}分钟，收获满满！`;

    // 创建反馈
    const insight = await Insight.create({
      userId,
      checkinId,
      periodId: checkin.periodId,
      sectionId: checkin.sectionId,
      day: checkin.day,
      type: 'daily',
      content: mockContent,
      summary: mockSummary,
      tags: ['学习反馈', '每日总结', '进步追踪'],
      status: 'completed'
    });

    res.status(201).json(success(insight, 'AI反馈生成成功'));
  } catch (error) {
    if (error.code === 11000) {
      const existing = await Insight.findOne({
        userId: req.user.userId,
        checkinId: req.body.checkinId
      });
      return res.json(success(existing, '反馈已生成'));
    }
    next(error);
  }
}

// 获取用户的反馈列表（包括创建的和分配给他们的）
async function getUserInsights(req, res, next) {
  try {
    const { page = 1, limit = 20, periodId, type } = req.query;
    const currentUserId = req.user.userId;
    const targetUserId = req.params.userId || currentUserId;

    // 如果查看的是他人的小凡看见，需要检查权限
    if (targetUserId !== currentUserId) {
      logger.debug('🔐 检查权限 - 当前用户:', { currentUserId, targetUserId });

      // 检查当前用户是否有approved的申请来查看目标用户的insights
      const hasPermission = await InsightRequest.findOne({
        fromUserId: currentUserId,
        toUserId: targetUserId,
        status: 'approved'
      });

      if (!hasPermission) {
        logger.warn('⛔ 无权查看该用户的小凡看见', { currentUserId, targetUserId });
        return res.status(403).json(errors.forbidden('无权查看该用户的小凡看见，需要获得用户同意'));
      }

      logger.debug('✅ 权限检查通过，允许查看', { currentUserId, targetUserId });
    }

    // 构建查询条件：
    // 1. 如果查看自己：返回自己创建的 + 分配给自己的insights
    // 2. 如果查看他人：只返回他人创建的insights（已approved权限）
    const baseQuery = { status: 'completed' };
    if (periodId) baseQuery.periodId = periodId;
    if (type) baseQuery.type = type;

    let query;
    if (targetUserId === currentUserId) {
      // 查看自己的insights
      const orConditions = [
        { userId: targetUserId, ...baseQuery },  // 自己创建的
        { targetUserId: targetUserId, ...baseQuery }  // 分配给自己的
      ];
      query = { $or: orConditions };
    } else {
      // 查看他人的insights（只返回他人创建的）
      query = { userId: targetUserId, ...baseQuery };
    }

    const total = await Insight.countDocuments(query);
    const insights = await Insight.find(query)
      .populate('sectionId', 'title day icon')
      .populate('periodId', 'name title')
      .populate('userId', 'nickname avatar _id')
      .populate('targetUserId', 'nickname avatar _id')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit))
      .select('-__v');

    res.json(success({
      list: insights,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    }));
  } catch (error) {
    next(error);
  }
}

// 获取反馈详情
async function getInsightDetail(req, res, next) {
  try {
    const { insightId } = req.params;

    const insight = await Insight.findById(insightId)
      .populate('userId', 'nickname avatar avatarUrl')
      .populate('sectionId', 'title day icon')
      .populate('periodId', 'name title')
      .populate('checkinId');

    if (!insight) {
      return res.status(404).json(errors.notFound('反馈不存在'));
    }

    res.json(success(insight));
  } catch (error) {
    next(error);
  }
}

// 删除反馈
async function deleteInsight(req, res, next) {
  try {
    const { insightId } = req.params;
    const userId = req.user.userId;

    const insight = await Insight.findById(insightId);

    if (!insight) {
      return res.status(404).json(errors.notFound('反馈不存在'));
    }

    // 只能删除自己的反馈
    if (insight.userId.toString() !== userId) {
      return res.status(403).json(errors.forbidden('无权删除'));
    }

    await Insight.findByIdAndDelete(insightId);

    res.json(success(null, '反馈删除成功'));
  } catch (error) {
    next(error);
  }
}

// ==================== 小凡看见(Insight) 相关接口 ====================

// 获取小凡看见列表（管理后台）
async function getInsights(req, res, next) {
  try {
    const { periodId, type, page = 1, limit = 20 } = req.query;

    const query = {};
    if (periodId) query.periodId = periodId;
    if (type) query.type = type;

    const total = await Insight.countDocuments(query);
    const insights = await Insight.find(query)
      .populate('userId', 'nickname avatar')
      .populate('targetUserId', 'nickname avatar')
      .populate('periodId', 'name title')
      .populate('sectionId', 'title day')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit))
      .select('-__v');

    res.json(success({
      list: insights,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    }));
  } catch (error) {
    next(error);
  }
}

// 创建小凡看见（手动导入）
async function createInsightManual(req, res, next) {
  try {
    const { periodId, type, mediaType, content, imageUrl, targetUserId } = req.body;

    // ✅ 修复：支持两种认证方式
    // 1. 来自 authMiddleware 的小程序用户 (req.user.userId)
    // 2. 来自 adminAuthMiddleware 的管理员用户 (req.admin.id)
    const userId = req.user?.userId || req.admin?.id;

    // 验证必填字段
    if (!periodId || !type || !mediaType || !content) {
      return res.status(400).json(errors.badRequest('缺少必填字段'));
    }

    // 验证 mediaType
    if (!['text', 'image'].includes(mediaType)) {
      return res.status(400).json(errors.badRequest('无效的媒体类型'));
    }

    // 验证 type
    if (!['daily', 'weekly', 'monthly', 'insight'].includes(type)) {
      return res.status(400).json(errors.badRequest('无效的内容类型'));
    }

    // 创建小凡看见
    const insight = await Insight.create({
      userId,
      targetUserId: targetUserId || null,
      periodId,
      type,
      mediaType,
      content,
      imageUrl: mediaType === 'image' ? imageUrl : null,
      source: 'manual',
      status: 'completed',
      isPublished: true
    });

    res.status(201).json(success(insight, '小凡看见创建成功'));
  } catch (error) {
    next(error);
  }
}

// 获取小凡看见列表（按期次）- 返回当前用户能看到的该期次的所有insights
// 包括：1) 当前用户创建的 2) 分配给当前用户的
async function getInsightsForPeriod(req, res, next) {
  try {
    const { periodId } = req.params;
    const { type, page = 1, limit = 20 } = req.query;  // 移除type的默认值，让前端灵活控制
    const userId = req.user?.userId;  // 获取当前登录用户

    // 构建查询条件：返回两类insights
    // 1. 当前用户创建的insights（userId === 当前用户）
    // 2. 分配给当前用户的insights（targetUserId === 当前用户）
    const baseQuery = {
      periodId,
      status: 'completed'
    };

    // 只在明确传递type参数时才过滤
    if (type) baseQuery.type = type;

    let orConditions = [];

    if (userId) {
      // 已登录：返回用户创建的或分配给用户的insights
      orConditions = [
        { userId, ...baseQuery },           // 当前用户创建的
        { targetUserId: userId, ...baseQuery }  // 分配给当前用户的
      ];
    } else {
      // 未登录：只返回已发布的insights（即创建者选择公开的）
      baseQuery.isPublished = true;
      orConditions = [
        { ...baseQuery }
      ];
    }

    const query = orConditions.length > 1 ? { $or: orConditions } : orConditions[0];

    const total = await Insight.countDocuments(query);
    const insights = await Insight.find(query)
      .populate('userId', 'nickname avatar _id')
      .populate('targetUserId', 'nickname avatar _id')
      .populate('sectionId', 'title day')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit));

    res.json(success({
      list: insights,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    }));
  } catch (error) {
    next(error);
  }
}

// 更新小凡看见（编辑文案）
async function updateInsight(req, res, next) {
  try {
    const { insightId } = req.params;
    const {
      periodId,
      targetUserId,
      type,
      mediaType,
      content,
      imageUrl,
      summary,
      tags,
      isPublished
    } = req.body;

    // 支持两种认证方式：
    // 1. 来自 authMiddleware 的小程序用户 (req.user.userId)
    // 2. 来自 adminAuthMiddleware 的管理员用户 (req.admin.id)
    const userId = req.user?.userId || req.admin?.id;
    const userRole = req.user?.role;
    const adminRole = req.admin?.role;

    const insight = await Insight.findById(insightId);

    if (!insight) {
      return res.status(404).json(errors.notFound('小凡看见不存在'));
    }

    // 权限检查：允许以下情况编辑
    // 1. 内容创建者可以编辑自己创建的内容
    // 2. 管理员（任何角色）可以编辑任何小凡看见（无论来源）
    const isCreator = insight.userId.toString() === userId;
    const isAdmin = (userRole === 'admin' || userRole === 'super_admin') ||
                    (adminRole === 'superadmin' || adminRole === 'admin');

    if (!isCreator && !isAdmin) {
      return res.status(403).json(errors.forbidden('无权编辑'));
    }

    // 更新所有字段
    if (periodId !== undefined) insight.periodId = periodId;
    if (targetUserId !== undefined) insight.targetUserId = targetUserId || null;
    if (type !== undefined) insight.type = type;
    if (mediaType !== undefined) insight.mediaType = mediaType;
    if (content !== undefined) insight.content = content;
    if (imageUrl !== undefined) insight.imageUrl = imageUrl;
    if (summary !== undefined) insight.summary = summary;
    if (tags !== undefined) insight.tags = Array.isArray(tags) ? tags : [];
    if (isPublished !== undefined) insight.isPublished = isPublished;

    await insight.save();

    // 保存后重新 populate 返回完整数据
    await insight.populate('targetUserId', 'nickname avatar');

    res.json(success(insight, '小凡看见更新成功'));
  } catch (error) {
    next(error);
  }
}

// 删除小凡看见
async function deleteInsightManual(req, res, next) {
  try {
    const { insightId } = req.params;

    // 支持两种认证方式：
    // 1. 来自 authMiddleware 的小程序用户 (req.user.userId)
    // 2. 来自 adminAuthMiddleware 的管理员用户 (req.admin.id)
    const userId = req.user?.userId || req.admin?.id;
    const userRole = req.user?.role;
    const adminRole = req.admin?.role;

    const insight = await Insight.findById(insightId);

    if (!insight) {
      return res.status(404).json(errors.notFound('小凡看见不存在'));
    }

    // 权限检查：允许以下情况删除
    // 1. 内容创建者可以删除自己创建的内容
    // 2. 管理员（任何角色）可以删除任何小凡看见（无论来源）
    const isCreator = insight.userId.toString() === userId;
    const isAdmin = (userRole === 'admin' || userRole === 'super_admin') ||
                    (adminRole === 'superadmin' || adminRole === 'admin');

    if (!isCreator && !isAdmin) {
      return res.status(403).json(errors.forbidden('无权删除'));
    }

    await Insight.findByIdAndDelete(insightId);

    res.json(success(null, '小凡看见删除成功'));
  } catch (error) {
    next(error);
  }
}

// 创建小凡看见查看申请
async function createInsightRequest(req, res, next) {
  try {
    const { toUserId, periodId } = req.body;
    const fromUserId = req.user.userId;

    if (!toUserId) {
      return res.status(400).json(errors.badRequest('被申请用户ID不能为空'));
    }

    if (fromUserId === toUserId) {
      return res.status(400).json(errors.badRequest('不能申请查看自己的小凡看见'));
    }

    // 检查是否已申请
    const existingRequest = await InsightRequest.findOne({
      fromUserId,
      toUserId
    });

    if (existingRequest) {
      if (existingRequest.status === 'approved') {
        return res.json(success(existingRequest, '已获得查看权限'));
      } else if (existingRequest.status === 'pending') {
        return res.json(success(existingRequest, '申请已存在，请等待对方回复'));
      } else if (existingRequest.status === 'rejected') {
        return res.json(success(existingRequest, '申请已被拒绝'));
      }
    }

    // 创建新的申请，包含可选的periodId
    const createData = {
      fromUserId,
      toUserId,
      status: 'pending'
    };

    // 如果提供了periodId，则使用它
    let finalPeriodId = periodId;

    // 如果没有提供periodId，自动查询目标用户的报名记录
    if (!periodId) {
      // 先查询活跃的报名，如果没有再查询最近的报名
      let enrollment = await Enrollment.findOne({
        userId: toUserId,
        status: 'active'
      }).sort({ createdAt: -1 });

      // 如果没有活跃报名，查询最近的任何报名
      if (!enrollment) {
        enrollment = await Enrollment.findOne({
          userId: toUserId
        }).sort({ createdAt: -1 });
      }

      if (enrollment && enrollment.periodId) {
        finalPeriodId = enrollment.periodId;
      }
    }

    // 保存periodId
    if (finalPeriodId) {
      createData.periodId = finalPeriodId;
    }

    const request = await InsightRequest.create(createData);

    // 获取申请者和被申请者信息
    const fromUser = await User.findById(fromUserId).select('nickname avatar');
    const toUser = await User.findById(toUserId).select('nickname avatar');

    // 发送通知给被申请者
    if (toUser) {
      await notifyUser(req, 
        toUserId,
        'request_created',
        '收到新的小凡看见查看申请',
        `${fromUser?.nickname || '用户'} 申请查看你的小凡看见`,
        {
          requestId: request._id,
          senderId: fromUserId,
          data: {
            senderName: fromUser?.nickname,
            senderAvatar: fromUser?.avatar,
            fromUserName: fromUser?.nickname
          }
        }
      );
    }

    res.json(success(request, '申请已发送'));
  } catch (error) {
    next(error);
  }
}

// 获取收到的查看申请列表
async function getReceivedRequests(req, res, next) {
  try {
    const userId = req.user.userId;
    const { status } = req.query;

    // 构建查询条件
    const query = { toUserId: userId };
    if (status && status !== 'all') {
      query.status = status;
    }

    // 查询申请，并populate申请者信息
    const requests = await InsightRequest.find(query)
      .populate('fromUserId', 'nickname avatarUrl avatar')
      .sort({ createdAt: -1 });

    res.json(success(requests, '获取成功'));
  } catch (error) {
    next(error);
  }
}

// 获取发起的查看申请列表
async function getSentRequests(req, res, next) {
  try {
    const userId = req.user.userId;
    const { status } = req.query;

    // 构建查询条件
    const query = { fromUserId: userId };
    if (status && status !== 'all') {
      query.status = status;
    }

    // 查询申请，并populate被申请者信息
    const requests = await InsightRequest.find(query)
      .populate('toUserId', 'nickname avatarUrl avatar')
      .sort({ createdAt: -1 });

    res.json(success(requests, '获取成功'));
  } catch (error) {
    next(error);
  }
}

// 检查与某个用户的小凡看见查看申请状态
async function getRequestStatus(req, res, next) {
  try {
    const userId = req.user.userId;
    const targetUserId = req.params.userId;

    // 查询与该用户的最新申请
    const request = await InsightRequest.findOne({
      fromUserId: userId,
      toUserId: targetUserId
    }).sort({ createdAt: -1 });

    if (!request) {
      // 没有申请记录
      return res.json(success({ approved: false, pending: false }, '无申请记录'));
    }

    // 返回申请状态
    const response = {
      approved: request.status === 'approved',
      pending: request.status === 'pending',
      requestId: request._id,
      status: request.status,
      createdAt: request.createdAt
    };

    res.json(success(response, '申请状态'));
  } catch (error) {
    next(error);
  }
}

// 同意查看申请
async function approveInsightRequest(req, res, next) {
  try {
    const requestId = req.params.requestId;
    const userId = req.user.userId;
    const { periodId } = req.body;

    if (!periodId) {
      return res.status(400).json(errors.badRequest('期次ID不能为空'));
    }

    // 查找申请
    const request = await InsightRequest.findById(requestId);

    if (!request) {
      return res.status(404).json(errors.notFound('申请不存在'));
    }

    // 验证当前用户是被申请者
    if (request.toUserId.toString() !== userId) {
      return res.status(403).json(errors.forbidden('无权审批'));
    }

    // 验证申请状态为pending
    if (request.status !== 'pending') {
      return res.status(400).json(errors.badRequest('申请状态已改变，无法操作'));
    }

    // 更新申请
    request.status = 'approved';
    request.periodId = periodId;
    request.approvedAt = new Date();
    await request.save();

    // 获取被申请者和期次信息
    const toUser = await User.findById(request.toUserId).select('nickname avatar');
    const Period = require('../models/Period');
    const period = await Period.findById(periodId).select('name');

    // 发送通知给申请者
    await notifyUser(req, 
      request.fromUserId,
      'request_approved',
      '小凡看见查看申请已批准',
      `${toUser?.nickname || '用户'} 同意了你的查看申请，允许查看 ${period?.name || '本期'} 的小凡看见`,
      {
        requestId: request._id,
        senderId: request.toUserId,
        data: {
          senderName: toUser?.nickname,
          senderAvatar: toUser?.avatar,
          periodName: period?.name
        }
      }
    );

    res.json(success(request, '已同意查看请求'));
  } catch (error) {
    next(error);
  }
}

// 拒绝查看申请
async function rejectInsightRequest(req, res, next) {
  try {
    const requestId = req.params.requestId;
    const userId = req.user.userId;

    // 查找申请
    const request = await InsightRequest.findById(requestId);

    if (!request) {
      return res.status(404).json(errors.notFound('申请不存在'));
    }

    // 验证当前用户是被申请者
    if (request.toUserId.toString() !== userId) {
      return res.status(403).json(errors.forbidden('无权拒绝'));
    }

    // 验证申请状态为pending
    if (request.status !== 'pending') {
      return res.status(400).json(errors.badRequest('申请状态已改变，无法操作'));
    }

    // 更新申请
    request.status = 'rejected';
    request.rejectedAt = new Date();
    await request.save();

    // 获取被申请者信息
    const toUser = await User.findById(request.toUserId).select('nickname avatar');

    // 发送通知给申请者
    await notifyUser(req, 
      request.fromUserId,
      'request_rejected',
      '小凡看见查看申请已被拒绝',
      `${toUser?.nickname || '用户'} 拒绝了你的查看申请`,
      {
        requestId: request._id,
        senderId: request.toUserId,
        data: {
          senderName: toUser?.nickname,
          senderAvatar: toUser?.avatar
        }
      }
    );

    res.json(success(request, '已拒绝查看请求'));
  } catch (error) {
    next(error);
  }
}

// ==================== 管理员相关接口 ====================

// 获取所有查看申请列表（管理员视图）
async function getInsightRequestsAdmin(req, res, next) {
  try {
    const { status, page = 1, limit = 20, fromUser, toUser } = req.query;

    // 构建查询条件
    const query = {};
    if (status && status !== 'all') {
      query.status = status;
    }

    // 根据用户搜索
    if (fromUser || toUser) {
      const User = require('../models/User');
      const users = await User.find({
        $or: [
          { nickname: new RegExp(fromUser || toUser, 'i') },
          { email: new RegExp(fromUser || toUser, 'i') }
        ]
      });

      if (fromUser) {
        query.fromUserId = { $in: users.map(u => u._id) };
      }
      if (toUser) {
        query.toUserId = { $in: users.map(u => u._id) };
      }
    }

    // 计算分页
    const skip = (page - 1) * limit;

    // 查询总数
    const total = await InsightRequest.countDocuments(query);

    // 查询申请，并populate用户信息
    const requests = await InsightRequest.find(query)
      .populate('fromUserId', 'nickname avatarUrl avatar email')
      .populate('toUserId', 'nickname avatarUrl avatar email')
      .populate('periodId', 'name startDate endDate')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    res.json(success({
      requests,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(total / limit)
      }
    }, '获取成功'));
  } catch (error) {
    next(error);
  }
}

// 获取申请统计信息
async function getInsightRequestsStats(req, res, next) {
  try {
    const stats = await InsightRequest.aggregate([
      {
        $facet: {
          total: [
            { $count: 'count' }
          ],
          byStatus: [
            {
              $group: {
                _id: '$status',
                count: { $sum: 1 }
              }
            }
          ],
          responseTime: [
            {
              $match: { status: { $in: ['approved', 'rejected'] } }
            },
            {
              $group: {
                _id: null,
                avgTime: {
                  $avg: {
                    $subtract: [
                      { $ifNull: ['$approvedAt', '$rejectedAt'] },
                      '$createdAt'
                    ]
                  }
                }
              }
            }
          ]
        }
      }
    ]);

    const totalCount = stats[0].total[0]?.count || 0;
    const byStatus = {};
    stats[0].byStatus.forEach(item => {
      byStatus[item._id] = item.count;
    });

    const avgResponseTime = stats[0].responseTime[0]?.avgTime || 0;

    res.json(success({
      totalRequests: totalCount,
      pendingRequests: byStatus.pending || 0,
      approvedRequests: byStatus.approved || 0,
      rejectedRequests: byStatus.rejected || 0,
      avgResponseTimeMs: Math.round(avgResponseTime),
      avgResponseTime: formatDuration(avgResponseTime)
    }, '获取成功'));
  } catch (error) {
    next(error);
  }
}

// 管理员同意申请
async function adminApproveRequest(req, res, next) {
  try {
    const requestId = req.params.requestId;
    const adminId = req.admin.id;
    const { periodId, adminNote } = req.body;

    if (!periodId) {
      return res.status(400).json(errors.badRequest('期次ID不能为空'));
    }

    // 查找申请
    const request = await InsightRequest.findById(requestId);

    if (!request) {
      return res.status(404).json(errors.notFound('申请不存在'));
    }

    // 验证申请状态为pending
    if (request.status !== 'pending') {
      return res.status(400).json(errors.badRequest('申请状态已改变，无法操作'));
    }

    // 更新申请
    request.status = 'approved';
    request.periodId = periodId;
    request.approvedAt = new Date();

    // 记录管理员操作
    if (!request.auditLog) {
      request.auditLog = [];
    }
    request.auditLog.push({
      action: 'admin_approve',
      actor: adminId,
      actorType: 'admin',
      timestamp: new Date(),
      note: adminNote || ''
    });

    await request.save();

    // 获取申请者、被申请者和期次信息
    const Period = require('../models/Period');
    const fromUser = await User.findById(request.fromUserId).select('nickname avatar');
    const toUser = await User.findById(request.toUserId).select('nickname avatar');
    const period = await Period.findById(periodId).select('name');

    // 发送通知给申请者
    await notifyUser(req, 
      request.fromUserId,
      'admin_approved',
      '小凡看见查看申请已由管理员批准',
      `管理员已批准你的查看申请，允许查看 ${period?.name || '本期'} 的小凡看见`,
      {
        requestId: request._id,
        data: {
          periodName: period?.name
        }
      }
    );

    res.json(success(request, '管理员已同意查看请求'));
  } catch (error) {
    next(error);
  }
}

// 管理员拒绝申请
async function adminRejectRequest(req, res, next) {
  try {
    const requestId = req.params.requestId;
    const adminId = req.admin.id;
    const { adminNote } = req.body;

    // 查找申请
    const request = await InsightRequest.findById(requestId);

    if (!request) {
      return res.status(404).json(errors.notFound('申请不存在'));
    }

    // 验证申请状态为pending
    if (request.status !== 'pending') {
      return res.status(400).json(errors.badRequest('申请状态已改变，无法操作'));
    }

    // 更新申请
    request.status = 'rejected';
    request.rejectedAt = new Date();

    // 记录管理员操作
    if (!request.auditLog) {
      request.auditLog = [];
    }
    request.auditLog.push({
      action: 'admin_reject',
      actor: adminId,
      actorType: 'admin',
      timestamp: new Date(),
      reason: adminNote || ''
    });

    await request.save();

    // 发送通知给申请者
    await notifyUser(req, 
      request.fromUserId,
      'admin_rejected',
      '小凡看见查看申请已由管理员拒绝',
      `管理员已拒绝你的查看申请`,
      {
        requestId: request._id,
        data: {
          reason: adminNote
        }
      }
    );

    res.json(success(request, '管理员已拒绝查看请求'));
  } catch (error) {
    next(error);
  }
}

// 用户撤销已批准的权限
async function revokeInsightRequest(req, res, next) {
  try {
    const requestId = req.params.requestId;
    const userId = req.user.userId;

    // 查找申请
    const request = await InsightRequest.findById(requestId);

    if (!request) {
      return res.status(404).json(errors.notFound('申请不存在'));
    }

    // 验证当前用户是被申请者（只有被申请者可以撤销权限）
    if (request.toUserId.toString() !== userId) {
      return res.status(403).json(errors.forbidden('无权撤销权限'));
    }

    // 验证申请状态为approved
    if (request.status !== 'approved') {
      return res.status(400).json(errors.badRequest('只能撤销已批准的申请'));
    }

    // 更新申请
    request.status = 'revoked';
    request.revokedAt = new Date();

    // 记录操作到审计日志
    if (!request.auditLog) {
      request.auditLog = [];
    }
    request.auditLog.push({
      action: 'revoke',
      actor: userId,
      actorType: 'user',
      timestamp: new Date()
    });

    await request.save();

    // 获取被申请者信息
    const toUser = await User.findById(request.toUserId).select('nickname avatar');

    // 发送通知给申请者
    await notifyUser(req, 
      request.fromUserId,
      'permission_revoked',
      '小凡看见查看权限已被撤销',
      `${toUser?.nickname || '用户'} 撤销了你的小凡看见查看权限`,
      {
        requestId: request._id,
        senderId: request.toUserId,
        data: {
          senderName: toUser?.nickname,
          senderAvatar: toUser?.avatar
        }
      }
    );

    res.json(success(request, '已撤销查看权限'));
  } catch (error) {
    next(error);
  }
}

// 管理员删除申请
async function deleteInsightRequest(req, res, next) {
  try {
    const requestId = req.params.requestId;
    const adminId = req.admin?.id || req.user?.userId;
    const { adminNote } = req.body;

    // 查找申请
    const request = await InsightRequest.findById(requestId);

    if (!request) {
      return res.status(404).json(errors.notFound('申请不存在'));
    }

    // 记录删除操作到审计日志（在删除前）
    if (!request.auditLog) {
      request.auditLog = [];
    }
    request.auditLog.push({
      action: 'admin_delete',
      actor: adminId,
      actorType: 'admin',
      timestamp: new Date(),
      note: adminNote || ''
    });

    // 保存审计日志后删除
    await request.save();

    // 然后删除记录
    await InsightRequest.findByIdAndDelete(requestId);

    res.json(success(null, '申请已删除'));
  } catch (error) {
    next(error);
  }
}

// 辅助函数：格式化时间差
function formatDuration(ms) {
  if (!ms || ms < 0) return '0分钟';

  const hours = Math.floor(ms / (1000 * 60 * 60));
  const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));

  if (hours > 0) {
    return `${hours}小时${minutes}分钟`;
  }
  return `${minutes}分钟`;
}

/**
 * 管理员批量同意查看申请
 * @route   POST /admin/insights/requests/batch-approve
 * @desc    一次性同意多个查看申请，可以为不同用户分别指定期次
 * @access  Private (Admin)
 */
async function batchApproveRequests(req, res, next) {
  try {
    const adminId = req.user.userId;
    const { approvals } = req.body; // approvals: [{ requestId, periodId }, ...]

    // 验证参数
    if (!Array.isArray(approvals) || approvals.length === 0) {
      return res.status(400).json(errors.badRequest('approvals 必须是非空数组'));
    }

    if (approvals.length > 100) {
      return res.status(400).json(errors.badRequest('单次批量操作最多100个申请'));
    }

    // 获取所有申请
    const requestIds = approvals.map(a => a.requestId);
    const requests = await InsightRequest.find({
      _id: { $in: requestIds },
      status: 'pending'
    });

    if (requests.length === 0) {
      return res.status(400).json(errors.badRequest('没有找到待审批的申请'));
    }

    // 创建映射：requestId -> periodId
    const periodMap = new Map(approvals.map(a => [a.requestId, a.periodId]));

    // 验证所有 periodId 都存在
    const periodIds = [...new Set(approvals.map(a => a.periodId))];
    const Period = require('../models/Period');
    const periods = await Period.find({ _id: { $in: periodIds } });

    if (periods.length !== periodIds.length) {
      return res.status(400).json(errors.badRequest('某些期次不存在'));
    }

    // 批量更新申请
    const updatedRequests = [];
    const notifications = [];

    for (const request of requests) {
      const periodId = periodMap.get(request._id.toString());
      if (!periodId) continue;

      // 更新申请
      request.status = 'approved';
      request.periodId = periodId;
      request.approvedAt = new Date();

      // 记录审计日志
      if (!request.auditLog) {
        request.auditLog = [];
      }
      request.auditLog.push({
        action: 'batch_approved',
        actor: adminId,
        actorType: 'admin',
        timestamp: new Date()
      });

      await request.save();
      updatedRequests.push(request);

      // 准备通知数据
      notifications.push({
        fromUserId: request.fromUserId,
        type: 'batch_approved',
        title: '小凡看见查看申请已由管理员批准',
        content: `管理员已批准你的查看申请`,
        requestId: request._id
      });
    }

    // 批量发送通知
    if (notifications.length > 0) {
      const Period = require('../models/Period');
      const period = await Period.findById(requests[0].periodId).select('name');

      for (const notif of notifications) {
        await notifyUser(req,
          notif.fromUserId,
          notif.type,
          notif.title,
          `${notif.content}，允许查看 ${period?.name || '本期'} 的小凡看见`,
          {
            requestId: notif.requestId,
            data: {
              periodName: period?.name
            }
          }
        );
      }
    }

    res.json(success({
      processed: updatedRequests.length,
      total: requests.length,
      requests: updatedRequests
    }, `已批准 ${updatedRequests.length} 个申请`));

  } catch (error) {
    next(error);
  }
}

/**
 * 外部接口：创建小凡看见
 * 用于外部系统提交用户的"小凡看见"内容
 * @route   POST /api/v1/insights/external/create
 * @param   userId {string} - 用户ID（必填）
 * @param   periodName {string} - 期次名称（必填）
 * @param   day {number} - 第几天的课程（可选）
 * @param   content {string} - 小凡看见的文字内容（与imageUrl二选一）
 * @param   imageUrl {string} - 小凡看见的图片地址（与content二选一）
 * @access  Public (外部系统调用)
 */
async function createInsightFromExternal(req, res, next) {
  try {
    const { userId, periodName, day, content, imageUrl, targetUserId } = req.body;

    // 验证必填字段
    if (!userId) {
      return res.status(400).json(errors.badRequest('缺少必填字段：userId'));
    }

    if (!periodName) {
      return res.status(400).json(errors.badRequest('缺少必填字段：periodName'));
    }

    // 验证content和imageUrl至少有一个
    if (!content && !imageUrl) {
      return res.status(400).json(errors.badRequest('content 和 imageUrl 必选其一（至少填写一个）'));
    }

    // 查询用户
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json(errors.notFound(`用户不存在：ID ${userId}`));
    }

    // 根据期次名称查询期次
    const Period = require('../models/Period');
    const period = await Period.findOne({ name: periodName });
    if (!period) {
      return res.status(404).json(errors.notFound(`期次不存在：${periodName}`));
    }

    // 检查用户是否已报名该期次
    const enrollment = await Enrollment.findOne({
      userId: user._id,
      periodId: period._id
    });
    if (!enrollment) {
      return res.status(403).json(errors.forbidden(`用户 ${user.nickname} 未报名期次 ${periodName}`));
    }

    // 如果指定了被看见人，验证被看见人是否存在
    let targetUser = null;
    if (targetUserId) {
      targetUser = await User.findById(targetUserId);
      if (!targetUser) {
        return res.status(404).json(errors.notFound(`被看见人不存在：ID ${targetUserId}`));
      }
    }

    // 创建小凡看见
    const insight = await Insight.create({
      userId: user._id,
      targetUserId: targetUser ? targetUser._id : null,
      periodId: period._id,
      day: day || null,
      type: 'insight',
      mediaType: imageUrl ? 'image' : 'text',
      content,
      imageUrl: imageUrl || null,
      source: 'manual',
      status: 'completed',
      isPublished: true
    });

    // 填充关联数据
    const populatedInsight = await insight.populate([
      { path: 'userId', select: 'nickname avatar' },
      { path: 'targetUserId', select: 'nickname avatar' },
      { path: 'periodId', select: 'name' }
    ]);

    res.status(201).json(success(populatedInsight, '小凡看见创建成功'));

  } catch (error) {
    logger.error('创建外部小凡看见失败:', error);
    next(error);
  }
}

module.exports = {
  generateInsight,
  getUserInsights,
  getInsightDetail,
  deleteInsight,
  createInsightManual,
  createInsightFromExternal,
  getInsights,
  getInsightsForPeriod,
  updateInsight,
  deleteInsightManual,
  createInsightRequest,
  getReceivedRequests,
  getSentRequests,
  getRequestStatus,
  approveInsightRequest,
  rejectInsightRequest,
  revokeInsightRequest,
  getInsightRequestsAdmin,
  getInsightRequestsStats,
  adminApproveRequest,
  adminRejectRequest,
  deleteInsightRequest,
  batchApproveRequests
};
