const Enrollment = require('../models/Enrollment');
const Period = require('../models/Period');
const User = require('../models/User');
const { success, errors } = require('../utils/response');
const logger = require('../utils/logger');

/**
 * 提交报名表单（完整的报名信息）
 * POST /api/v1/enrollments
 */
exports.submitEnrollmentForm = async (req, res) => {
  try {
    logger.info('Enrollment form submission started', {
      userId: req.user.userId,
      hasBody: !!req.body
    });

    // 从认证token中获取userId（token payload中的字段名是userId）
    const userId = req.user.userId;
    const {
      periodId,
      name,
      gender,
      province,
      detailedAddress,
      age,
      referrer,
      hasReadBook,
      readTimes,
      enrollReason,
      expectation,
      commitment
    } = req.body;

    // 验证必填字段
    if (!periodId || !name || !gender || !province || !detailedAddress || !age || !referrer || !hasReadBook || !enrollReason || !expectation || !commitment) {
      const missingFields = [];
      if (!periodId) missingFields.push('periodId');
      if (!name) missingFields.push('name');
      if (!gender) missingFields.push('gender');
      if (!province) missingFields.push('province');
      if (!detailedAddress) missingFields.push('detailedAddress');
      if (!age) missingFields.push('age');
      if (!referrer) missingFields.push('referrer');
      if (!hasReadBook) missingFields.push('hasReadBook');
      if (!enrollReason) missingFields.push('enrollReason');
      if (!expectation) missingFields.push('expectation');
      if (!commitment) missingFields.push('commitment');
      logger.warn('Missing required enrollment fields', { missingFields, userId });
      return res.status(400).json(errors.badRequest('缺少必填字段: ' + missingFields.join(', ')));
    }

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

    // 创建报名记录（包含所有表单字段）
    const enrollment = await Enrollment.create({
      userId,
      periodId,
      name,
      gender,
      province,
      detailedAddress,
      age: parseInt(age),
      referrer,
      hasReadBook,
      readTimes: hasReadBook === 'yes' ? parseInt(readTimes) : 0,
      enrollReason,
      expectation,
      commitment,
      paymentStatus: 'pending',  // 报名后需要支付
      status: 'active'  // 直接生效
    });

    // 填充用户和期次信息
    await enrollment.populate('userId', 'nickname avatar avatarUrl');
    await enrollment.populate('periodId', 'title description startDate endDate');

    // 更新期次的报名人数
    await Period.findByIdAndUpdate(periodId, {
      $inc: { enrollmentCount: 1 }
    });

    res.json(success(enrollment, '报名成功'));
  } catch (error) {
    logger.error('Enrollment form submission failed', error, { userId: req.user.userId });
    res.status(500).json(errors.serverError('报名失败: ' + error.message));
  }
};

/**
 * 报名参加期次（简化版，仅periodId）
 * POST /api/v1/enrollments/simple
 */
exports.enrollPeriod = async (req, res) => {
  try {
    const { periodId } = req.body;
    // 从认证token中获取userId（token payload中的字段名是userId）
    const userId = req.user.userId;

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

    // 更新期次的报名人数
    await Period.findByIdAndUpdate(periodId, {
      $inc: { enrollmentCount: 1 }
    });

    res.json(success(enrollment, '报名成功'));
  } catch (error) {
    logger.error('Simple enrollment failed', error, { userId: req.user?.userId });
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
    logger.error('Get members list failed', error, { periodId: req.params.periodId });
    res.status(500).json(errors.serverError('获取成员列表失败: ' + error.message));
  }
};

/**
 * 获取用户的报名列表
 * GET /api/v1/enrollments/user/:userId?
 */
exports.getUserEnrollments = async (req, res) => {
  try {
    const userId = req.params.userId || req.user.userId;
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
    logger.error('Get enrollment list failed', error);
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
    const userId = req.user.userId;

    logger.debug('checkEnrollment called', {
      userId,
      periodId,
      userIdType: typeof userId,
      periodIdType: typeof periodId
    });

    // 直接查询数据库
    const enrollment = await Enrollment.findOne({
      userId,
      periodId,
      status: { $in: ['active', 'completed'] }
    });

    const isEnrolled = !!enrollment;

    logger.debug('checkEnrollment result', {
      isEnrolled,
      enrollmentStatus: enrollment?.status,
      enrollmentId: enrollment?._id
    });

    res.json(success({
      isEnrolled,
      userId,
      periodId
    }));
  } catch (error) {
    logger.error('Check enrollment status failed', error);
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
    const userId = req.user.userId;

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
      $inc: { enrollmentCount: -1 }
    });

    res.json(success(enrollment, '退出成功'));
  } catch (error) {
    logger.error('Withdrawal failed', error);
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
    logger.error('Completion failed', error);
    res.status(500).json(errors.serverError('完成失败: ' + error.message));
  }
};

/**
 * 获取待审批的报名列表（管理员）
 * GET /api/v1/enrollments?approvalStatus=pending&page=1&limit=20
 */
exports.getEnrollments = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      status,
      periodId,
      approvalStatus,
      paymentStatus,
      sortBy = 'enrolledAt',
      sortOrder = -1
    } = req.query;

    // 构建查询条件
    let query = {
      deleted: { $ne: true }  // ✅ 排除已删除的记录
    };
    if (status) query.status = status;
    if (approvalStatus) query.approvalStatus = approvalStatus;
    if (paymentStatus) query.paymentStatus = paymentStatus;
    if (periodId) query.periodId = periodId;

    // 分页和排序
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const sort = { [sortBy]: parseInt(sortOrder) };

    // 获取总数
    const total = await Enrollment.countDocuments(query);

    // 获取数据
    const enrollments = await Enrollment.find(query)
      .populate('userId', 'nickname avatar')
      .populate('periodId', 'name')
      .sort(sort)
      .skip(skip)
      .limit(parseInt(limit))
      .lean();

    res.json(success({
      list: enrollments,
      total,
      page: parseInt(page),
      limit: parseInt(limit),
      totalPages: Math.ceil(total / parseInt(limit))
    }));
  } catch (error) {
    logger.error('Get enrollment list failed', error);
    res.status(500).json(errors.serverError('获取报名列表失败: ' + error.message));
  }
};

/**
 * 更新报名记录（管理员）
 * PUT /api/v1/enrollments/:id
 */
exports.updateEnrollment = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    // 不允许修改的字段（不包括 approvalStatus，因为批量审批需要通过这个API来修改状态）
    const protectedFields = ['userId', 'periodId', 'enrolledAt'];
    protectedFields.forEach(field => {
      delete updateData[field];
    });

    const enrollment = await Enrollment.findByIdAndUpdate(id, updateData, { new: true })
      .populate('userId', 'nickname avatar')
      .populate('periodId', 'name');

    if (!enrollment) {
      return res.status(404).json(errors.notFound('报名记录不存在'));
    }

    res.json(success(enrollment, '更新成功'));
  } catch (error) {
    logger.error('Update failed', error);
    res.status(500).json(errors.serverError('更新失败: ' + error.message));
  }
};

/**
 * 删除报名记录（管理员）
 * DELETE /api/v1/enrollments/:id
 */
exports.deleteEnrollment = async (req, res) => {
  try {
    const { id } = req.params;

    const enrollment = await Enrollment.findByIdAndDelete(id);
    if (!enrollment) {
      return res.status(404).json(errors.notFound('报名记录不存在'));
    }

    // 更新期次的报名人数
    await Period.findByIdAndUpdate(enrollment.periodId, {
      $inc: { enrollmentCount: -1 }
    });

    res.json(success(null, '删除成功'));
  } catch (error) {
    logger.error('Deletion failed', error);
    res.status(500).json(errors.serverError('删除失败: ' + error.message));
  }
};

/**
 * 调试：删除用户的所有报名记录（除了指定的期次）
 * DELETE /api/v1/enrollments/debug/cleanup/:userId/:keepPeriodId
 */
exports.debugCleanupEnrollments = async (req, res) => {
  try {
    const { userId, keepPeriodId } = req.params;

    logger.info('Debug cleanup enrollments started', { userId, keepPeriodId });

    // 查询所有报名记录
    const allEnrollments = await Enrollment.find({ userId });
    logger.info('Found enrollments to cleanup', {
      userId,
      totalCount: allEnrollments.length
    });

    // 删除除了 keepPeriodId 之外的所有报名
    const deleteResult = await Enrollment.deleteMany({
      userId,
      periodId: { $ne: keepPeriodId }
    });

    logger.info('Cleanup completed', {
      userId,
      deletedCount: deleteResult.deletedCount,
      keptPeriodId: keepPeriodId
    });

    res.json(success({
      deleted: deleteResult.deletedCount,
      message: `已删除 ${deleteResult.deletedCount} 条报名记录，仅保留期次 ${keepPeriodId} 的报名`
    }));
  } catch (error) {
    logger.error('Cleanup failed', error);
    res.status(500).json(errors.serverError('清理失败: ' + error.message));
  }
};

/**
 * 外部接口：根据期次名称获取参加该期次的所有用户
 * @route   GET /api/v1/enrollments/external/users-by-period
 * @param   periodName {string} - 期次名称（必填）
 * @access  Public (外部系统调用)
 */
exports.getUsersByPeriodName = async (req, res, next) => {
  try {
    const { periodName } = req.query;

    // 验证必填字段
    if (!periodName) {
      return res.status(400).json(errors.badRequest('缺少必填字段：periodName'));
    }

    // 根据期次名称查询期次
    const Period = require('../models/Period');
    const period = await Period.findOne({ name: periodName });
    if (!period) {
      return res.status(404).json(errors.notFound(`期次不存在：${periodName}`));
    }

    // 查询所有报名了该期次的用户（active 或 completed 状态）
    const Enrollment = require('../models/Enrollment');
    const enrollments = await Enrollment.find({
      periodId: period._id,
      status: { $in: ['active', 'completed'] },
      deleted: { $ne: true }
    })
      .populate('userId', 'nickname')
      .sort({ enrolledAt: -1 })
      .lean();

    // 构建返回数据：只包含 userId 和 nickname
    const users = enrollments.map(enrollment => ({
      userId: enrollment.userId._id,
      nickname: enrollment.userId.nickname
    }));

    res.json(success({
      periodName: period.name,
      userCount: users.length,
      users: users
    }, '获取成功'));

  } catch (error) {
    logger.error('获取期次用户失败:', error);
    next(error);
  }
};
