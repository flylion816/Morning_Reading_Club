const Enrollment = require('../models/Enrollment');
const Period = require('../models/Period');
const User = require('../models/User');
const { success, errors } = require('../utils/response');

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
      return res.status(404).json(errors.notFound('期次不存在'));
    }

    // 检查是否已报名
    const existingEnrollment = await Enrollment.findOne({
      userId,
      periodId,
      status: { $in: ['active', 'completed'] }
    });

    if (existingEnrollment) {
      return res.status(400).json(errors.badRequest('您已报名该期次'));
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

    res.json(success(enrollment, '报名成功'));
  } catch (error) {
    console.error('报名失败:', error);
    res.status(500).json(errors.serverError(error.message));
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
      return res.status(404).json(errors.notFound('期次不存在'));
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

    res.json(success({
      list: members,
      total: result.total,
      page: result.page,
      limit: result.limit,
      totalPages: result.totalPages
    }));
  } catch (error) {
    console.error('获取成员列表失败:', error);
    res.status(500).json(errors.serverError('获取成员列表失败: ' + error.message));
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

    res.json(success({
      list: enrollments,
      total: result.total,
      page: result.page,
      limit: result.limit,
      totalPages: result.totalPages
    }));
  } catch (error) {
    console.error('获取报名列表失败:', error);
    res.status(500).json(errors.serverError('获取报名列表失败: ' + error.message));
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

    res.json(success({
      isEnrolled,
      userId,
      periodId
    }));
  } catch (error) {
    console.error('检查报名状态失败:', error);
    res.status(500).json(errors.serverError('检查报名状态失败: ' + error.message));
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
      return res.status(404).json(errors.notFound('报名记录不存在'));
    }

    if (enrollment.status !== 'active') {
      return res.status(400).json(errors.badRequest('该报名已结束，无法退出'));
    }

    await enrollment.withdraw();

    // 更新期次的报名人数
    await Period.findByIdAndUpdate(enrollment.periodId, {
      $inc: { currentEnrollment: -1 }
    });

    res.json(success(enrollment, '退出成功'));
  } catch (error) {
    console.error('退出失败:', error);
    res.status(500).json(errors.serverError('退出失败: ' + error.message));
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
      return res.status(404).json(errors.notFound('报名记录不存在'));
    }

    if (enrollment.status !== 'active') {
      return res.status(400).json(errors.badRequest('该报名不是进行中状态'));
    }

    await enrollment.complete();

    res.json(success(enrollment, '标记为已完成'));
  } catch (error) {
    console.error('完成失败:', error);
    res.status(500).json(errors.serverError('完成失败: ' + error.message));
  }
};
