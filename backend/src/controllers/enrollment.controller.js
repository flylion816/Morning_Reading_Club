const Enrollment = require('../models/Enrollment');
const Period = require('../models/Period');
const User = require('../models/User');
const { success, errors } = require('../utils/response');

/**
 * 提交报名表单（完整的报名信息）
 * POST /api/v1/enrollments
 */
exports.submitEnrollmentForm = async (req, res) => {
  try {
    console.log('========== 报名表单提交 ==========');
    console.log('请求体:', req.body);
    console.log('用户信息:', req.user);

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

    // 详细检查每个字段
    console.log('字段检查:');
    console.log('- periodId:', periodId, periodId ? '✓' : '✗ 缺失');
    console.log('- name:', name, name ? '✓' : '✗ 缺失');
    console.log('- gender:', gender, gender ? '✓' : '✗ 缺失');
    console.log('- province:', province, province ? '✓' : '✗ 缺失');
    console.log('- detailedAddress:', detailedAddress, detailedAddress ? '✓' : '✗ 缺失');
    console.log('- age:', age, age ? '✓' : '✗ 缺失');
    console.log('- referrer:', referrer, referrer ? '✓' : '✗ 缺失');
    console.log('- hasReadBook:', hasReadBook, hasReadBook ? '✓' : '✗ 缺失');
    console.log('- enrollReason:', enrollReason, enrollReason ? '✓' : '✗ 缺失');
    console.log('- expectation:', expectation, expectation ? '✓' : '✗ 缺失');
    console.log('- commitment:', commitment, commitment ? '✓' : '✗ 缺失');

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
      console.log('缺失的字段:', missingFields);
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
    console.error('报名失败:', error);
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
    const userId = req.user.userId;

    console.log(`\n========== checkEnrollment ==========`);
    console.log(`userId: ${userId}`);
    console.log(`periodId: ${periodId}`);
    console.log(`userId类型: ${typeof userId}, periodId类型: ${typeof periodId}`);

    // 直接查询数据库
    const enrollment = await Enrollment.findOne({
      userId,
      periodId,
      status: { $in: ['active', 'completed'] }
    });

    console.log(`直接查询结果: ${enrollment ? 'found' : 'not found'}`);
    if (enrollment) {
      console.log(`  status: ${enrollment.status}`);
      console.log(`  _id: ${enrollment._id}`);
    }

    const isEnrolled = !!enrollment;

    console.log(`返回isEnrolled: ${isEnrolled}`);
    console.log(`========== checkEnrollment 结束 ==========\n`);

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
      approvalStatus = 'pending',
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
    console.error('获取报名列表失败:', error);
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
    console.error('更新失败:', error);
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
    console.error('删除失败:', error);
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

    console.log(`\n========== 清理报名记录 ==========`);
    console.log(`userId: ${userId}`);
    console.log(`keepPeriodId: ${keepPeriodId}`);

    // 查询所有报名记录
    const allEnrollments = await Enrollment.find({ userId });
    console.log(`总共找到 ${allEnrollments.length} 条报名记录`);

    // 删除除了 keepPeriodId 之外的所有报名
    const deleteResult = await Enrollment.deleteMany({
      userId,
      periodId: { $ne: keepPeriodId }
    });

    console.log(`删除了 ${deleteResult.deletedCount} 条报名记录`);
    console.log(`========== 清理完成 ==========\n`);

    res.json(success({
      deleted: deleteResult.deletedCount,
      message: `已删除 ${deleteResult.deletedCount} 条报名记录，仅保留期次 ${keepPeriodId} 的报名`
    }));
  } catch (error) {
    console.error('清理失败:', error);
    res.status(500).json(errors.serverError('清理失败: ' + error.message));
  }
};
