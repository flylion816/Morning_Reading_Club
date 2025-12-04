const Insight = require('../models/Insight');
const Checkin = require('../models/Checkin');
const InsightRequest = require('../models/InsightRequest');
const { success, errors } = require('../utils/response');

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
    const userId = req.params.userId || req.user.userId;

    // 构建查询条件：返回两类insights
    // 1. 当前用户创建的insights（userId === 当前用户）
    // 2. 分配给当前用户的insights（targetUserId === 当前用户）
    const baseQuery = { status: 'completed' };
    if (periodId) baseQuery.periodId = periodId;
    if (type) baseQuery.type = type;

    const orConditions = [
      { userId, ...baseQuery },  // 当前用户创建的
      { targetUserId: userId, ...baseQuery }  // 分配给当前用户的
    ];

    const query = { $or: orConditions };

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
    const { toUserId } = req.body;
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

    // 创建新的申请
    const request = await InsightRequest.create({
      fromUserId,
      toUserId,
      status: 'pending'
    });

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

    res.json(success(request, '已拒绝查看请求'));
  } catch (error) {
    next(error);
  }
}

module.exports = {
  generateInsight,
  getUserInsights,
  getInsightDetail,
  deleteInsight,
  createInsightManual,
  getInsights,
  getInsightsForPeriod,
  updateInsight,
  deleteInsightManual,
  createInsightRequest,
  getReceivedRequests,
  getSentRequests,
  approveInsightRequest,
  rejectInsightRequest
};
