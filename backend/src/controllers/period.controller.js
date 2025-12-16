const Period = require('../models/Period');
const { success, errors } = require('../utils/response');

// 获取期次列表
async function getPeriodList(req, res, next) {
  try {
    const { page = 1, limit = 20, status, isPublished } = req.query;

    const query = {};
    if (status) query.status = status;
    if (isPublished !== undefined) query.isPublished = isPublished === 'true';

    const total = await Period.countDocuments(query);
    const periods = await Period.find(query)
      .sort({ sortOrder: 1, createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit))
      .select('-__v');

    // 转换数据格式以匹配前端期望
    const transformedPeriods = periods.map(period => {
      const periodObj = period.toObject ? period.toObject() : period;

      // 添加前端需要的字段
      return {
        ...periodObj,
        id: period._id || period.id, // 前端期望使用 id 字段
        color: period.coverColor || 'linear-gradient(135deg, #4a90e2 0%, #357abd 100%)',
        icon: period.icon || '📚',
        startTime: period.startDate ? period.startDate.toISOString() : null,
        endTime: period.endDate ? period.endDate.toISOString() : null,
        dateRange: period.dateRange || '',
        statusText: getStatusText(period),
        checkedDays: 0, // 这个值需要从用户的打卡记录中计算
        progress: 0, // 这个值也需要计算
        isCheckedIn: false,
        currentEnrollment: period.enrollmentCount || 0 // 报名人数（映射enrollmentCount为currentEnrollment）
      };
    });

    res.json(success(transformedPeriods));
  } catch (error) {
    next(error);
  }
}

// 获取动态状态（基于当前日期和期次日期范围）
function getDynamicStatus(period) {
  const now = new Date();
  const startDate = new Date(period.startDate);
  const endDate = new Date(period.endDate);

  // 比较日期（不考虑时间，只比较日期部分）
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const start = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate());
  const end = new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate());

  if (today < start) {
    return 'not_started';
  } else if (today > end) {
    return 'completed';
  } else {
    return 'ongoing';
  }
}

// 获取状态文本
function getStatusText(period) {
  // 动态计算状态，而不是使用数据库中的静态值
  const dynamicStatus = getDynamicStatus(period);

  const statusMap = {
    not_started: '未开始',
    ongoing: '进行中',
    completed: '已完成'
  };
  return statusMap[dynamicStatus] || '未知状态';
}

// 获取期次详情
async function getPeriodDetail(req, res, next) {
  try {
    const { periodId } = req.params;

    const period = await Period.findById(periodId);

    if (!period) {
      return res.status(404).json(errors.notFound('期次不存在'));
    }

    res.json(success(period));
  } catch (error) {
    next(error);
  }
}

// 创建期次（管理员）
async function createPeriod(req, res, next) {
  try {
    const {
      name,
      subtitle,
      title,
      description,
      icon,
      coverColor,
      coverEmoji,
      startDate,
      endDate,
      totalDays,
      price,
      originalPrice,
      maxEnrollment,
      sortOrder
    } = req.body;

    const period = await Period.create({
      name,
      subtitle,
      title,
      description,
      icon,
      coverColor,
      coverEmoji,
      startDate,
      endDate,
      totalDays,
      price,
      originalPrice,
      maxEnrollment,
      sortOrder,
      status: 'not_started',
      isPublished: false,
      currentEnrollment: 0
    });

    res.status(201).json(success(period, '期次创建成功'));
  } catch (error) {
    next(error);
  }
}

// 更新期次（管理员）
async function updatePeriod(req, res, next) {
  try {
    const { periodId } = req.params;
    const updates = req.body;

    const period = await Period.findById(periodId);

    if (!period) {
      return res.status(404).json(errors.notFound('期次不存在'));
    }

    // 更新字段
    Object.keys(updates).forEach(key => {
      if (updates[key] !== undefined) {
        period[key] = updates[key];
      }
    });

    await period.save();

    res.json(success(period, '期次更新成功'));
  } catch (error) {
    next(error);
  }
}

// 删除期次（管理员）
async function deletePeriod(req, res, next) {
  try {
    const { periodId } = req.params;

    const period = await Period.findById(periodId);

    if (!period) {
      return res.status(404).json(errors.notFound('期次不存在'));
    }

    // 检查是否有报名
    if (period.enrollmentCount > 0) {
      return res.status(400).json(errors.badRequest('该期次已有用户报名，无法删除'));
    }

    await Period.findByIdAndDelete(periodId);

    res.json(success(null, '期次删除成功'));
  } catch (error) {
    next(error);
  }
}

module.exports = {
  getPeriodList,
  getPeriodDetail,
  createPeriod,
  updatePeriod,
  deletePeriod
};
