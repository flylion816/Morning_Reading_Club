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
    const { activityId, userId, status, scope, page = 1, limit = 20 } = req.query;
    const tenantId = getCurrentTenantId();

    const query = { tenantId };
    if (activityId) query.activityId = activityId;
    if (userId) query.userId = userId;
    if (status) query.status = status;
    if (scope) query.scope = scope;

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
 * 创建优惠券：
 *   scope=global 时创建一张全平台通用券（不绑定用户）
 *   scope=personal（默认）时按 userIds 数组批量创建个人券
 */
exports.adminCreate = async (req, res) => {
  try {
    const tenantId = getCurrentTenantId();
    if (!tenantId) {
      return res.status(400).json(errors.badRequest('请先在右上角选择租户后再创建优惠券'));
    }

    const { userIds, scope = 'personal', activityId, name, discountType, discountValue, validFrom, validUntil } = req.body;

    const base = { tenantId, activityId: activityId || null, name, discountType, discountValue, validFrom, validUntil };

    if (scope === 'global') {
      const created = await ActivityCoupon.create({ ...base, scope: 'global', userId: null });
      return res.json(success({ count: 1 }, '成功创建 1 张全平台通用券'));
    }

    if (!Array.isArray(userIds) || userIds.length === 0) {
      return res.status(400).json(errors.badRequest('个人券必须指定 userIds'));
    }

    const docs = userIds.map((uid) => ({ ...base, scope: 'personal', userId: uid }));
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

    const newScope = req.body.scope;
    if (newScope === 'global') {
      coupon.scope = 'global';
      coupon.userId = null;
    } else if (newScope === 'personal') {
      coupon.scope = 'personal';
      // userIds 是前端传的数组，取第一个更新 userId
      if (Array.isArray(req.body.userIds) && req.body.userIds.length > 0) {
        coupon.userId = req.body.userIds[0];
      }
    } else {
      // scope 未变，仅更新 userId（兼容旧逻辑）
      if (Array.isArray(req.body.userIds) && req.body.userIds.length > 0) {
        coupon.userId = req.body.userIds[0];
      }
    }

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

    // forActivity 模式：报名时筛选可用券（个人券 + 全平台券）
    if (forActivity || activityId) {
      const targetActivity = forActivity || activityId;
      const baseCondition = {
        tenantId,
        status: 'active',
        validFrom: { $lte: now },
        validUntil: { $gte: now },
        $or: [{ activityId: targetActivity }, { activityId: null }]
      };
      const list = await ActivityCoupon.find({
        ...baseCondition,
        $or: [
          { scope: 'personal', userId },
          { scope: 'global' },
          { scope: { $exists: false }, userId }
        ]
      })
        .populate('activityId', 'title')
        .sort({ createdAt: -1 })
        .lean();
      return res.json(success(list));
    }

    // 默认：返回用户个人券 + 全平台券
    const list = await ActivityCoupon.find({
      tenantId,
      $or: [
        { scope: 'personal', userId },
        { scope: 'global' },
        { scope: { $exists: false }, userId }
      ]
    })
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
