const ActivityCoupon = require('../models/ActivityCoupon');
const { success, errors } = require('../utils/response');
const logger = require('../utils/logger');
const { getCurrentTenantId } = require('../utils/tenantContext');

// ===== 管理端 =====

/**
 * GET /api/v1/admin/activity-coupons
 * 优惠券列表，支持 activityId/userId/status 筛选，分页
 */
exports.adminList = async (req, res) => {
  try {
    const { activityId, userId, status, page = 1, limit = 20 } = req.query;
    const tenantId = getCurrentTenantId();

    const query = { tenantId };
    if (activityId) query.activityId = activityId;
    if (userId) query.userId = userId;
    if (status) query.status = status;

    const skip = (parseInt(page, 10) - 1) * parseInt(limit, 10);
    const [list, total] = await Promise.all([
      ActivityCoupon.find(query)
        .populate('userId', 'nickname avatar avatarUrl')
        .populate('activityId', 'title')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit, 10))
        .lean(),
      ActivityCoupon.countDocuments(query)
    ]);

    res.json(
      success({
        list,
        total,
        page: parseInt(page, 10),
        limit: parseInt(limit, 10),
        totalPages: Math.ceil(total / parseInt(limit, 10))
      })
    );
  } catch (err) {
    logger.error('activityCoupon.adminList failed', err);
    res.status(500).json(errors.serverError(err.message));
  }
};

/**
 * POST /api/v1/admin/activity-coupons
 * 批量创建优惠券，body.userIds 为用户 ID 数组，每个用户创建一条记录
 */
exports.adminCreate = async (req, res) => {
  try {
    const tenantId = getCurrentTenantId();
    if (!tenantId) {
      return res.status(400).json(errors.badRequest('请先在右上角选择租户后再创建优惠券'));
    }

    const { userIds, activityId, name, discountType, discountValue, validFrom, validUntil } = req.body;

    if (!Array.isArray(userIds) || userIds.length === 0) {
      return res.status(400).json(errors.badRequest('userIds 必须为非空数组'));
    }

    const docs = userIds.map((uid) => ({
      tenantId,
      userId: uid,
      activityId: activityId || null,
      name,
      discountType,
      discountValue,
      validFrom,
      validUntil
    }));

    const created = await ActivityCoupon.insertMany(docs);

    res.json(success({ count: created.length }, `成功创建 ${created.length} 张优惠券`));
  } catch (err) {
    logger.error('activityCoupon.adminCreate failed', err);
    res.status(500).json(errors.serverError(err.message));
  }
};

/**
 * PUT /api/v1/admin/activity-coupons/:id
 * 编辑优惠券（仅 active 状态可编辑）
 */
exports.adminUpdate = async (req, res) => {
  try {
    const { id } = req.params;
    const tenantId = getCurrentTenantId();

    const coupon = await ActivityCoupon.findOne({ _id: id, tenantId });
    if (!coupon) {
      return res.status(404).json(errors.notFound('优惠券不存在'));
    }
    if (coupon.status !== 'active') {
      return res.status(400).json(errors.badRequest('仅 active 状态的优惠券可编辑'));
    }

    const allowedFields = ['name', 'discountType', 'discountValue', 'validFrom', 'validUntil', 'activityId'];
    allowedFields.forEach((field) => {
      if (req.body[field] !== undefined) {
        coupon[field] = req.body[field];
      }
    });

    await coupon.save();
    res.json(success(coupon, '更新成功'));
  } catch (err) {
    logger.error('activityCoupon.adminUpdate failed', err);
    res.status(500).json(errors.serverError(err.message));
  }
};

/**
 * DELETE /api/v1/admin/activity-coupons/:id
 * 删除优惠券（仅 active 状态可删除）
 */
exports.adminDelete = async (req, res) => {
  try {
    const { id } = req.params;
    const tenantId = getCurrentTenantId();

    const coupon = await ActivityCoupon.findOne({ _id: id, tenantId });
    if (!coupon) {
      return res.status(404).json(errors.notFound('优惠券不存在'));
    }
    if (coupon.status !== 'active') {
      return res.status(400).json(errors.badRequest('仅 active 状态的优惠券可删除'));
    }

    await coupon.deleteOne();
    res.json(success(null, '删除成功'));
  } catch (err) {
    logger.error('activityCoupon.adminDelete failed', err);
    res.status(500).json(errors.serverError(err.message));
  }
};

// ===== 用户端 =====

/**
 * GET /api/v1/activity-coupons/my
 * 查询当前用户的所有优惠券（用于"我的优惠券"页面）
 * 可选 ?forActivity=activityId 时只返回可用于该活动的 active 券
 */
exports.getMyCoupons = async (req, res) => {
  try {
    const { userId } = req.user;
    const { activityId, forActivity } = req.query;
    const tenantId = getCurrentTenantId();
    const now = new Date();

    // forActivity 模式：报名时筛选可用券（保持原有逻辑）
    if (forActivity || activityId) {
      const targetActivity = forActivity || activityId;
      const query = {
        tenantId,
        userId,
        status: 'active',
        validFrom: { $lte: now },
        validUntil: { $gte: now },
        $or: [{ activityId: targetActivity }, { activityId: null }]
      };
      const list = await ActivityCoupon.find(query)
        .populate('activityId', 'title')
        .sort({ createdAt: -1 })
        .lean();
      return res.json(success(list));
    }

    // 默认：返回用户所有券，前端展示用
    const list = await ActivityCoupon.find({ tenantId, userId })
      .populate('activityId', 'title')
      .sort({ createdAt: -1 })
      .lean();

    // 补充计算状态：过期但 status 仍为 active 的券标记为 expired
    const enriched = list.map(c => {
      let displayStatus = c.status;
      if (c.status === 'active' && c.validUntil && new Date(c.validUntil) < now) {
        displayStatus = 'expired';
      }
      return { ...c, displayStatus };
    });

    res.json(success(enriched));
  } catch (err) {
    logger.error('activityCoupon.getMyCoupons failed', err);
    res.status(500).json(errors.serverError(err.message));
  }
};
