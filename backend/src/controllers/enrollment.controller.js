const Enrollment = require('../models/Enrollment');
const Period = require('../models/Period');
const { success, errors } = require('../utils/response');
const logger = require('../utils/logger');
const mysqlBackupService = require('../services/mysql-backup.service');
const { publishSyncEvent } = require('../services/sync.service');

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
    const { userId } = req.user;
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
    if (
      !periodId ||
      !name ||
      !gender ||
      !province ||
      !detailedAddress ||
      !age ||
      !referrer ||
      !hasReadBook ||
      !enrollReason ||
      !expectation ||
      !commitment
    ) {
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
      return res.status(400).json(errors.badRequest(`缺少必填字段: ${missingFields.join(', ')}`));
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
      age: parseInt(age, 10),
      referrer,
      hasReadBook,
      readTimes: hasReadBook === 'yes' ? parseInt(readTimes, 10) : 0,
      enrollReason,
      expectation,
      commitment,
      paymentStatus: 'pending', // 报名后需要支付
      status: 'active' // 直接生效
    });

    // 填充用户和期次信息（重新查询以获取populate后的数据）
    const populatedEnrollment = await Enrollment.findById(enrollment._id)
      .populate('userId', 'nickname avatar avatarUrl')
      .populate('periodId', 'title description startDate endDate');

    // 更新期次的报名人数
    await Period.findByIdAndUpdate(periodId, {
      $inc: { enrollmentCount: 1 }
    });

    // 异步备份到 MySQL（使用原始未populate的文档以避免数据库关系问题）
    mysqlBackupService.syncEnrollment(enrollment).catch(err =>
      logger.warn('MySQL backup failed for enrollment', {
        id: enrollment._id,
        error: err.message
      })
    );
    mysqlBackupService
      .syncPeriod(period)
      .catch(err =>
        logger.warn('MySQL backup failed for period', { id: period._id, error: err.message })
      );

    // 异步同步到 MySQL
    publishSyncEvent({
      type: 'create',
      collection: 'enrollments',
      documentId: enrollment._id.toString(),
      data: enrollment.toObject()
    });

    res.json(success(populatedEnrollment, '报名成功'));
  } catch (error) {
    logger.error('Enrollment form submission failed', error, { userId: req.user.userId });
    res.status(500).json(errors.serverError(`报名失败: ${error.message}`));
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
    const { userId } = req.user;

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
      paymentStatus: 'free', // 默认免费
      status: 'active'
    });

    // 填充用户和期次信息（重新查询以获取populate后的数据）
    const populatedEnrollment = await Enrollment.findById(enrollment._id)
      .populate('userId', 'nickname avatar avatarUrl')
      .populate('periodId', 'title description startDate endDate');

    // 更新期次的报名人数
    await Period.findByIdAndUpdate(periodId, {
      $inc: { enrollmentCount: 1 }
    });

    // 异步同步到 MySQL
    publishSyncEvent({
      type: 'create',
      collection: 'enrollments',
      documentId: enrollment._id.toString(),
      data: enrollment.toObject()
    });

    res.json(success(populatedEnrollment, '报名成功'));
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
      page: parseInt(page, 10),
      limit: parseInt(limit, 10),
      sortBy,
      sortOrder: parseInt(sortOrder, 10),
      status
    });

    // 直接返回完整的 Enrollment 数据（包含 populate 后的 userId 对象）
    // 前端可以通过 row.userId.nickname 等访问用户信息
    res.json(
      success({
        list: result.list,
        total: result.total,
        page: result.page,
        limit: result.limit,
        totalPages: result.totalPages
      })
    );
  } catch (error) {
    logger.error('Get members list failed', error, { periodId: req.params.periodId });
    res.status(500).json(errors.serverError(`获取成员列表失败: ${error.message}`));
  }
};

/**
 * 获取用户的报名列表
 * GET /api/v1/enrollments/user/:userId?
 */
exports.getUserEnrollments = async (req, res) => {
  try {
    const userId = req.params.userId || req.user.userId;
    const { page = 1, limit = 20, status } = req.query;

    console.log('🔍 [getUserEnrollments] 调试信息:');
    console.log('  - req.params.userId:', req.params.userId);
    console.log('  - req.user:', req.user);
    console.log('  - 最终使用的 userId:', userId);
    console.log('  - 传入的 status:', status);

    // 获取报名列表
    const result = await Enrollment.getUserEnrollments(userId, {
      page: parseInt(page, 10),
      limit: parseInt(limit, 10),
      status
    });

    console.log('  - 查询结果列表长度:', result.list.length);
    console.log('  - 完整结果:', result);

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

    res.json(
      success({
        list: enrollments,
        total: result.total,
        page: result.page,
        limit: result.limit,
        totalPages: result.totalPages
      })
    );
  } catch (error) {
    logger.error('Get enrollment list failed', error);
    res.status(500).json(errors.serverError(`获取报名列表失败: ${error.message}`));
  }
};

/**
 * 检查用户是否已报名
 * GET /api/v1/enrollments/check/:periodId
 */
exports.checkEnrollment = async (req, res) => {
  try {
    const { periodId } = req.params;
    const { userId } = req.user;

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

    res.json(
      success({
        isEnrolled,
        paymentStatus: enrollment?.paymentStatus || null,
        enrollmentId: enrollment?._id || null,
        userId,
        periodId
      })
    );
  } catch (error) {
    logger.error('Check enrollment status failed', error);
    res.status(500).json(errors.serverError(`检查报名状态失败: ${error.message}`));
  }
};

/**
 * 退出期次
 * DELETE /api/v1/enrollments/:enrollmentId
 */
exports.withdrawEnrollment = async (req, res) => {
  try {
    const { enrollmentId } = req.params;
    const { userId } = req.user;

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

    // 保存报名信息用于同步
    const enrollmentData = enrollment.toObject();

    await enrollment.withdraw();

    // 更新期次的报名人数
    await Period.findByIdAndUpdate(enrollment.periodId, {
      $inc: { enrollmentCount: -1 }
    });

    // 异步同步到 MySQL
    publishSyncEvent({
      type: 'update',
      collection: 'enrollments',
      documentId: enrollment._id.toString(),
      data: enrollmentData
    });

    res.json(success(enrollment, '退出成功'));
  } catch (error) {
    logger.error('Withdrawal failed', error);
    res.status(500).json(errors.serverError(`退出失败: ${error.message}`));
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

    // 保存报名信息用于同步
    const enrollmentData = enrollment.toObject();

    await enrollment.complete();

    // 异步同步到 MySQL
    publishSyncEvent({
      type: 'update',
      collection: 'enrollments',
      documentId: enrollment._id.toString(),
      data: enrollmentData
    });

    res.json(success(enrollment, '标记为已完成'));
  } catch (error) {
    logger.error('Completion failed', error);
    res.status(500).json(errors.serverError(`完成失败: ${error.message}`));
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
    const query = {
      deleted: { $ne: true } // ✅ 排除已删除的记录
    };
    if (status) query.status = status;
    if (approvalStatus) query.approvalStatus = approvalStatus;
    if (paymentStatus) query.paymentStatus = paymentStatus;
    if (periodId) query.periodId = periodId;

    // 分页和排序
    const skip = (parseInt(page, 10) - 1) * parseInt(limit, 10);
    const sort = { [sortBy]: parseInt(sortOrder, 10) };

    // 获取总数
    const total = await Enrollment.countDocuments(query);

    // 获取数据
    const enrollments = await Enrollment.find(query)
      .populate('userId', 'nickname avatar')
      .populate('periodId', 'name')
      .sort(sort)
      .skip(skip)
      .limit(parseInt(limit, 10))
      .lean();

    res.json(
      success({
        list: enrollments,
        total,
        page: parseInt(page, 10),
        limit: parseInt(limit, 10),
        totalPages: Math.ceil(total / parseInt(limit, 10))
      })
    );
  } catch (error) {
    logger.error('Get enrollment list failed', error);
    res.status(500).json(errors.serverError(`获取报名列表失败: ${error.message}`));
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

    // 异步同步到 MySQL（转换为纯对象，避免populate的嵌套问题）
    const enrollmentForSync = await Enrollment.findById(id).lean();
    publishSyncEvent({
      type: 'update',
      collection: 'enrollments',
      documentId: id,
      data: enrollmentForSync
    });

    res.json(success(enrollment, '更新成功'));
  } catch (error) {
    logger.error('Update failed', error);
    res.status(500).json(errors.serverError(`更新失败: ${error.message}`));
  }
};

/**
 * 删除报名记录（管理员）
 * DELETE /api/v1/enrollments/:id
 */
exports.deleteEnrollment = async (req, res) => {
  try {
    const { id } = req.params;

    const enrollment = await Enrollment.findById(id);
    if (!enrollment) {
      return res.status(404).json(errors.notFound('报名记录不存在'));
    }

    // 保存报名信息用于同步
    const enrollmentData = enrollment.toObject();

    await Enrollment.findByIdAndDelete(id);

    // 更新期次的报名人数
    await Period.findByIdAndUpdate(enrollment.periodId, {
      $inc: { enrollmentCount: -1 }
    });

    // 异步同步到 MySQL
    publishSyncEvent({
      type: 'delete',
      collection: 'enrollments',
      documentId: id,
      data: enrollmentData
    });

    res.json(success(null, '删除成功'));
  } catch (error) {
    logger.error('Deletion failed', error);
    res.status(500).json(errors.serverError(`删除失败: ${error.message}`));
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

    res.json(
      success({
        deleted: deleteResult.deletedCount,
        message: `已删除 ${deleteResult.deletedCount} 条报名记录，仅保留期次 ${keepPeriodId} 的报名`
      })
    );
  } catch (error) {
    logger.error('Cleanup failed', error);
    res.status(500).json(errors.serverError(`清理失败: ${error.message}`));
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
    const period = await Period.findOne({ name: periodName });
    if (!period) {
      return res.status(404).json(errors.notFound(`期次不存在：${periodName}`));
    }

    // 查询所有报名了该期次的用户（active 或 completed 状态）
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

    res.json(
      success(
        {
          periodName: period.name,
          userCount: users.length,
          users
        },
        '获取成功'
      )
    );
  } catch (error) {
    logger.error('获取期次用户失败:', error);
    next(error);
  }
};
