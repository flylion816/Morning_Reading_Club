const Insight = require('../models/Insight');
const Checkin = require('../models/Checkin');
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

// 获取用户的反馈列表
async function getUserInsights(req, res, next) {
  try {
    const { page = 1, limit = 20, periodId, type } = req.query;
    const userId = req.params.userId || req.user.userId;

    const query = { userId, status: 'completed' };
    if (periodId) query.periodId = periodId;
    if (type) query.type = type;

    const total = await Insight.countDocuments(query);
    const insights = await Insight.find(query)
      .populate('sectionId', 'title day icon')
      .populate('periodId', 'name title')
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
    const { periodId, type, mediaType, content, imageUrl } = req.body;
    const userId = req.user.userId;

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

// 获取小凡看见列表（按期次）
async function getInsightsForPeriod(req, res, next) {
  try {
    const { periodId } = req.params;
    const { type = 'insight', page = 1, limit = 20 } = req.query;

    const query = {
      periodId,
      isPublished: true,
      status: 'completed'
    };

    if (type) query.type = type;

    const total = await Insight.countDocuments(query);
    const insights = await Insight.find(query)
      .populate('userId', 'nickname avatar')
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
    const { content, imageUrl, isPublished } = req.body;
    const userId = req.user.userId;

    const insight = await Insight.findById(insightId);

    if (!insight) {
      return res.status(404).json(errors.notFound('小凡看见不存在'));
    }

    // 权限检查（仅Admin或创建者可编辑）
    const user = req.user;
    if (insight.userId.toString() !== userId && user.role !== 'admin') {
      return res.status(403).json(errors.forbidden('无权编辑'));
    }

    // 更新字段
    if (content !== undefined) insight.content = content;
    if (imageUrl !== undefined) insight.imageUrl = imageUrl;
    if (isPublished !== undefined) insight.isPublished = isPublished;

    await insight.save();

    res.json(success(insight, '小凡看见更新成功'));
  } catch (error) {
    next(error);
  }
}

// 删除小凡看见
async function deleteInsightManual(req, res, next) {
  try {
    const { insightId } = req.params;
    const userId = req.user.userId;

    const insight = await Insight.findById(insightId);

    if (!insight) {
      return res.status(404).json(errors.notFound('小凡看见不存在'));
    }

    // 权限检查
    const user = req.user;
    if (insight.userId.toString() !== userId && user.role !== 'admin') {
      return res.status(403).json(errors.forbidden('无权删除'));
    }

    await Insight.findByIdAndDelete(insightId);

    res.json(success(null, '小凡看见删除成功'));
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
  deleteInsightManual
};
