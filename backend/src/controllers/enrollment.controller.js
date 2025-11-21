const Enrollment = require('../models/Enrollment');
const Period = require('../models/Period');
const User = require('../models/User');
const { successResponse, errorResponse } = require('../utils/response');

/**
 * 报名参加期次
 * POST /api/v1/enrollments/
 */
exports.enrollPeriod = async (req, res) => {
  try {
    const { periodId } = req.body;
    const userId = req.user._id;

    // 验证期次是否存在
    const period = await Period.findById(periodId);
    if (!period) {
      return errorResponse(res, '期次不存在', 404);
    }

    // 检查是否已报名
    const existingEnrollment = await Enrollment.findOne({
      userId,
      periodId,
      status: { $in: ['active', 'completed'] }
    });

    if (existingEnrollment) {
      return errorResponse(res, '您已报名该期次', 400);
    }

    // 创建报名记录
    const enrollment = await Enrollment.create({
      userId,
      periodId,
      paymentStatus: 'free',  // 默认免费
      status: 'active'
    });

    // 填充用户和期次信息
    await enrollment.populate('userId', 'nickname avatar avatarUrl');
    await enrollment.populate('periodId', 'title description startDate endDate');

    // 更新期次的报名人数（可选，如果Period有这个字段）
    await Period.findByIdAndUpdate(periodId, {
      $inc: { currentEnrollment: 1 }
    });

    return successResponse(res, enrollment, '报名成功');
  } catch (error) {
    console.error('报名失败:', error);
    return errorResponse(res, '报名失败', 500, error.message);
  }
};

/**
 * 获取期次的成员列表
 * GET /api/v1/enrollments/period/:periodId
 */
exports.getPeriodMembers = async (req, res) => {
  try {
    const { periodId } = req.params;
    const {
      page = 1,
      limit = 20,
      sortBy = 'enrolledAt',
      sortOrder = -1,
      status = 'active'
    } = req.query;

    // 验证期次是否存在
    const period = await Period.findById(periodId);
    if (!period) {
      return errorResponse(res, '期次不存在', 404);
    }

    // 获取成员列表
    const result = await Enrollment.getPeriodMembers(periodId, {
      page: parseInt(page),
      limit: parseInt(limit),
      sortBy,
      sortOrder: parseInt(sortOrder),
      status
    });

    // 转换数据格式，添加前端需要的字段
    const members = result.list.map(enrollment => ({
      userId: enrollment.userId._id,
      nickname: enrollment.userId.nickname,
      avatar: enrollment.userId.avatar,
      avatarUrl: enrollment.userId.avatarUrl,
      enrolledAt: enrollment.enrolledAt,
      status: enrollment.status,
      paymentStatus: enrollment.paymentStatus
    }));

    return successResponse(res, {
      list: members,
      total: result.total,
      page: result.page,
      limit: result.limit,
      totalPages: result.totalPages
    });
  } catch (error) {
    console.error('获取成员列表失败:', error);
    return errorResponse(res, '获取成员列表失败', 500, error.message);
  }
};

/**
 * 获取用户的报名列表
 * GET /api/v1/enrollments/user/:userId?
 */
exports.getUserEnrollments = async (req, res) => {
  try {
    const userId = req.params.userId || req.user._id;
    const {
      page = 1,
      limit = 20,
      status
    } = req.query;

    // 获取报名列表
    const result = await Enrollment.getUserEnrollments(userId, {
      page: parseInt(page),
      limit: parseInt(limit),
      status
    });

    // 转换数据格式
    const enrollments = result.list.map(enrollment => ({
      enrollmentId: enrollment._id,
      periodId: enrollment.periodId._id,
      periodTitle: enrollment.periodId.title,
      periodDescription: enrollment.periodId.description,
      startDate: enrollment.periodId.startDate,
      endDate: enrollment.periodId.endDate,
      coverImage: enrollment.periodId.coverImage,
      enrolledAt: enrollment.enrolledAt,
      status: enrollment.status,
      paymentStatus: enrollment.paymentStatus,
      paymentAmount: enrollment.paymentAmount,
      paidAt: enrollment.paidAt,
      completedAt: enrollment.completedAt
    }));

    return successResponse(res, {
      list: enrollments,
      total: result.total,
      page: result.page,
      limit: result.limit,
      totalPages: result.totalPages
    });
  } catch (error) {
    console.error('获取报名列表失败:', error);
    return errorResponse(res, '获取报名列表失败', 500, error.message);
  }
};

/**
 * 检查用户是否已报名
 * GET /api/v1/enrollments/check/:periodId
 */
exports.checkEnrollment = async (req, res) => {
  try {
    const { periodId } = req.params;
    const userId = req.user._id;

    const isEnrolled = await Enrollment.isEnrolled(userId, periodId);

    return successResponse(res, {
      isEnrolled,
      userId,
      periodId
    });
  } catch (error) {
    console.error('检查报名状态失败:', error);
    return errorResponse(res, '检查报名状态失败', 500, error.message);
  }
};

/**
 * 退出期次
 * DELETE /api/v1/enrollments/:enrollmentId
 */
exports.withdrawEnrollment = async (req, res) => {
  try {
    const { enrollmentId } = req.params;
    const userId = req.user._id;

    const enrollment = await Enrollment.findOne({
      _id: enrollmentId,
      userId
    });

    if (!enrollment) {
      return errorResponse(res, '报名记录不存在', 404);
    }

    if (enrollment.status !== 'active') {
      return errorResponse(res, '该报名已结束，无法退出', 400);
    }

    await enrollment.withdraw();

    // 更新期次的报名人数
    await Period.findByIdAndUpdate(enrollment.periodId, {
      $inc: { currentEnrollment: -1 }
    });

    return successResponse(res, enrollment, '退出成功');
  } catch (error) {
    console.error('退出失败:', error);
    return errorResponse(res, '退出失败', 500, error.message);
  }
};

/**
 * 完成期次（管理员或系统调用）
 * PUT /api/v1/enrollments/:enrollmentId/complete
 */
exports.completeEnrollment = async (req, res) => {
  try {
    const { enrollmentId } = req.params;

    const enrollment = await Enrollment.findById(enrollmentId);

    if (!enrollment) {
      return errorResponse(res, '报名记录不存在', 404);
    }

    if (enrollment.status !== 'active') {
      return errorResponse(res, '该报名不是进行中状态', 400);
    }

    await enrollment.complete();

    return successResponse(res, enrollment, '标记为已完成');
  } catch (error) {
    console.error('完成失败:', error);
    return errorResponse(res, '完成失败', 500, error.message);
  }
};
