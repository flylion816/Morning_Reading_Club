const CommunityActivity = require('../models/CommunityActivity');
const ActivityRegistration = require('../models/ActivityRegistration');
const { success, errors } = require('../utils/response');
const logger = require('../utils/logger');
const { getCurrentTenantId } = require('../utils/tenantContext');

// ===== 用户端 =====

/**
 * GET /api/v1/community-activities
 * 获取已发布活动列表，支持 type 过滤，按 startTime 升序
 */
exports.listActivities = async (req, res) => {
  try {
    const { type, page = 1, limit = 20 } = req.query;
    const tenantId = getCurrentTenantId();

    const query = { tenantId, status: 'published' };
    if (type) query.type = type;

    const skip = (parseInt(page, 10) - 1) * parseInt(limit, 10);
    const [list, total] = await Promise.all([
      CommunityActivity.find(query)
        .sort({ startTime: 1 })
        .skip(skip)
        .limit(parseInt(limit, 10))
        .lean(),
      CommunityActivity.countDocuments(query)
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
    logger.error('listActivities failed', err);
    res.status(500).json(errors.serverError(err.message));
  }
};

/**
 * GET /api/v1/community-activities/popup
 * 获取当前应弹窗的活动（取最近一个）
 */
exports.getPopupActivity = async (req, res) => {
  try {
    const tenantId = getCurrentTenantId();
    const now = new Date();

    const activity = await CommunityActivity.findOne({
      tenantId,
      status: 'published',
      showPopup: true,
      popupStartTime: { $lte: now },
      popupEndTime: { $gte: now }
    })
      .sort({ startTime: 1 })
      .lean();

    res.json(success(activity || null));
  } catch (err) {
    logger.error('getPopupActivity failed', err);
    res.status(500).json(errors.serverError(err.message));
  }
};

/**
 * GET /api/v1/community-activities/:id
 * 活动详情（含报名人数、当前用户是否已报名）
 */
exports.getActivity = async (req, res) => {
  try {
    const { id } = req.params;
    const tenantId = getCurrentTenantId();

    const activity = await CommunityActivity.findOne({ _id: id, tenantId }).lean();
    if (!activity) {
      return res.status(404).json(errors.notFound('活动不存在'));
    }

    const registrationCount = await ActivityRegistration.countDocuments({
      activityId: id,
      status: 'registered'
    });

    let isRegistered = false;
    if (req.user) {
      const reg = await ActivityRegistration.findOne({
        activityId: id,
        userId: req.user.userId,
        status: 'registered'
      }).lean();
      isRegistered = !!reg;
    }

    res.json(success({ ...activity, registrationCount, isRegistered }));
  } catch (err) {
    logger.error('getActivity failed', err);
    res.status(500).json(errors.serverError(err.message));
  }
};

/**
 * POST /api/v1/community-activities/:id/register
 * 报名活动
 */
exports.registerActivity = async (req, res) => {
  try {
    const { id } = req.params;
    const { userId } = req.user;
    const { reminderGranted = false } = req.body;
    const tenantId = getCurrentTenantId();

    const activity = await CommunityActivity.findOne({ _id: id, tenantId }).lean();
    if (!activity) {
      return res.status(404).json(errors.notFound('活动不存在'));
    }
    if (activity.status !== 'published') {
      return res.status(403).json(errors.forbidden('活动未开放报名'));
    }

    if (activity.maxAttendees > 0) {
      const count = await ActivityRegistration.countDocuments({
        activityId: id,
        status: 'registered'
      });
      if (count >= activity.maxAttendees) {
        return res.status(400).json(errors.badRequest('活动名额已满'));
      }
    }

    const existing = await ActivityRegistration.findOne({ activityId: id, userId });
    if (existing) {
      if (existing.status === 'registered') {
        return res.status(400).json(errors.badRequest('您已报名该活动'));
      }
      existing.status = 'registered';
      existing.reminderGranted = reminderGranted;
      existing.registeredAt = new Date();
      await existing.save();
      return res.json(success(existing, '报名成功'));
    }

    const registration = await ActivityRegistration.create({
      tenantId,
      activityId: id,
      userId,
      reminderGranted
    });

    res.json(success(registration, '报名成功'));
  } catch (err) {
    if (err.code === 11000) {
      return res.status(400).json(errors.badRequest('您已报名该活动'));
    }
    logger.error('registerActivity failed', err);
    res.status(500).json(errors.serverError(err.message));
  }
};

/**
 * DELETE /api/v1/community-activities/:id/register
 * 取消报名
 */
exports.cancelRegistration = async (req, res) => {
  try {
    const { id } = req.params;
    const { userId } = req.user;

    const registration = await ActivityRegistration.findOne({
      activityId: id,
      userId,
      status: 'registered'
    });

    if (!registration) {
      return res.status(404).json(errors.notFound('报名记录不存在'));
    }

    registration.status = 'cancelled';
    await registration.save();

    res.json(success(null, '取消报名成功'));
  } catch (err) {
    logger.error('cancelRegistration failed', err);
    res.status(500).json(errors.serverError(err.message));
  }
};

/**
 * GET /api/v1/community-activities/my
 * 我报名的活动列表
 */
exports.myActivities = async (req, res) => {
  try {
    const { userId } = req.user;
    const { page = 1, limit = 20 } = req.query;

    const skip = (parseInt(page, 10) - 1) * parseInt(limit, 10);
    const query = { userId, status: 'registered' };

    const [registrations, total] = await Promise.all([
      ActivityRegistration.find(query)
        .populate('activityId')
        .sort({ registeredAt: -1 })
        .skip(skip)
        .limit(parseInt(limit, 10))
        .lean(),
      ActivityRegistration.countDocuments(query)
    ]);

    const list = registrations
      .filter(r => r.activityId)
      .map(r => ({ ...r.activityId, registeredAt: r.registeredAt, registrationId: r._id }));

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
    logger.error('myActivities failed', err);
    res.status(500).json(errors.serverError(err.message));
  }
};

// ===== 管理端 =====

/**
 * GET /api/v1/admin/community-activities
 * 活动列表（含草稿）
 */
exports.adminListActivities = async (req, res) => {
  try {
    const { type, status, page = 1, limit = 20 } = req.query;
    const tenantId = getCurrentTenantId();

    const query = { tenantId };
    if (type) query.type = type;
    if (status) query.status = status;

    const skip = (parseInt(page, 10) - 1) * parseInt(limit, 10);
    const [list, total] = await Promise.all([
      CommunityActivity.find(query)
        .sort({ startTime: -1 })
        .skip(skip)
        .limit(parseInt(limit, 10))
        .lean(),
      CommunityActivity.countDocuments(query)
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
    logger.error('adminListActivities failed', err);
    res.status(500).json(errors.serverError(err.message));
  }
};

/**
 * POST /api/v1/admin/community-activities
 * 创建活动
 */
exports.adminCreateActivity = async (req, res) => {
  try {
    const tenantId = getCurrentTenantId();
    const activity = await CommunityActivity.create({ ...req.body, tenantId });
    res.json(success(activity, '创建成功'));
  } catch (err) {
    logger.error('adminCreateActivity failed', err);
    res.status(500).json(errors.serverError(err.message));
  }
};

/**
 * PUT /api/v1/admin/community-activities/:id
 * 编辑活动
 */
exports.adminUpdateActivity = async (req, res) => {
  try {
    const { id } = req.params;
    const tenantId = getCurrentTenantId();

    const activity = await CommunityActivity.findOneAndUpdate(
      { _id: id, tenantId },
      req.body,
      { new: true, runValidators: true }
    );

    if (!activity) {
      return res.status(404).json(errors.notFound('活动不存在'));
    }

    res.json(success(activity, '更新成功'));
  } catch (err) {
    logger.error('adminUpdateActivity failed', err);
    res.status(500).json(errors.serverError(err.message));
  }
};

/**
 * DELETE /api/v1/admin/community-activities/:id
 * 软删除（status='cancelled'）
 */
exports.adminDeleteActivity = async (req, res) => {
  try {
    const { id } = req.params;
    const tenantId = getCurrentTenantId();

    const activity = await CommunityActivity.findOneAndUpdate(
      { _id: id, tenantId },
      { status: 'cancelled' },
      { new: true }
    );

    if (!activity) {
      return res.status(404).json(errors.notFound('活动不存在'));
    }

    res.json(success(null, '删除成功'));
  } catch (err) {
    logger.error('adminDeleteActivity failed', err);
    res.status(500).json(errors.serverError(err.message));
  }
};

/**
 * GET /api/v1/admin/community-activities/:id/registrations
 * 报名名单
 */
exports.adminGetRegistrations = async (req, res) => {
  try {
    const { id } = req.params;
    const { page = 1, limit = 50 } = req.query;
    const tenantId = getCurrentTenantId();

    const activity = await CommunityActivity.findOne({ _id: id, tenantId }).lean();
    if (!activity) {
      return res.status(404).json(errors.notFound('活动不存在'));
    }

    const skip = (parseInt(page, 10) - 1) * parseInt(limit, 10);
    const query = { activityId: id, status: 'registered' };

    const [list, total] = await Promise.all([
      ActivityRegistration.find(query)
        .populate('userId', 'nickname avatar avatarUrl')
        .sort({ registeredAt: 1 })
        .skip(skip)
        .limit(parseInt(limit, 10))
        .lean(),
      ActivityRegistration.countDocuments(query)
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
    logger.error('adminGetRegistrations failed', err);
    res.status(500).json(errors.serverError(err.message));
  }
};
