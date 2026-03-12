const Period = require('../models/Period');
const Checkin = require('../models/Checkin');
const { success, errors } = require('../utils/response');
const { publishSyncEvent } = require('../services/sync.service');

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
  }
  if (today > end) {
    return 'completed';
  }
  return 'ongoing';
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

// 将 coverColor 转换为前端可识别的格式（hex 或 rgb，不支持渐变）
function convertCoverColorForForm(coverColor) {
  if (!coverColor) {
    return '#4a90e2'; // 默认蓝色
  }

  // 如果是渐变格式，提取第一个颜色
  if (coverColor.includes('linear-gradient') || coverColor.includes('rgb')) {
    // 对于渐变，返回默认蓝色（表示这是旧数据）
    return '#4a90e2';
  }

  // 如果已经是 hex 格式，直接返回
  if (coverColor.startsWith('#')) {
    return coverColor;
  }

  // 其他格式，返回默认值
  return '#4a90e2';
}

// 获取当前用户的期次列表（包含用户个人的打卡统计）
async function getPeriodListForUser(req, res, next) {
  try {
    const userId = req.user.userId || req.user._id;
    const userRole = req.user.role;
    const { page = 1, limit = 20, status, isPublished } = req.query;

    const query = {};
    if (status) {
      if (status === 'active') {
        query.status = 'ongoing';
      } else {
        query.status = status;
      }
    }

    // 如果用户不是管理员，只返回已发布的期次
    // 管理员可以看到所有期次用于管理后台
    if (isPublished !== undefined) {
      query.isPublished = isPublished === 'true';
    } else if (userRole !== 'admin') {
      // 非管理员：只显示已发布的期次
      query.isPublished = true;
    }
    // 管理员：如果未指定 isPublished，返回所有期次

    const total = await Period.countDocuments(query);
    const skip = (parseInt(page, 10) - 1) * parseInt(limit, 10);
    const periods = await Period.find(query)
      .sort({ endDate: -1, createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit, 10))
      .select('-__v');

    // 转换数据格式，并计算用户的打卡天数
    const transformedPeriods = await Promise.all(
      periods.map(async period => {
        const periodObj = period.toObject ? period.toObject({ virtuals: true }) : period;

        // 查询用户在该期次的打卡日期数（不同的打卡日期数）
        const checkinDates = await Checkin.distinct('checkinDate', {
          userId,
          periodId: period._id
        });

        return {
          ...periodObj,
          status: period.status === 'ongoing' ? 'active' : period.status,
          title: period.title || period.name,
          color: period.coverColor || 'linear-gradient(135deg, #4a90e2 0%, #357abd 100%)',
          // 转换 coverColor 为前端编辑表单能识别的格式（hex/rgb，不支持渐变）
          coverColor: convertCoverColorForForm(period.coverColor),
          icon: period.icon || period.coverEmoji || '📚',
          startTime: period.startDate ? period.startDate.toISOString() : null,
          endTime: period.endDate ? period.endDate.toISOString() : null,
          dateRange: periodObj.dateRange || '',
          statusText: getStatusText(period),
          checkedDays: checkinDates.length, // 真实的打卡天数
          progress: 0,
          isCheckedIn: false,
          currentEnrollment: period.enrollmentCount || 0
        };
      })
    );

    const response = success(transformedPeriods);
    response.pagination = {
      page: parseInt(page, 10),
      limit: parseInt(limit, 10),
      total,
      totalPages: Math.ceil(total / parseInt(limit, 10))
    };
    res.json(response);
  } catch (error) {
    next(error);
  }
}

// 获取期次列表
async function getPeriodList(req, res, next) {
  try {
    const { page = 1, limit = 20, status, isPublished } = req.query;

    const query = {};
    if (status) {
      // 处理测试中使用的"active"状态 -> 映射为"ongoing"
      if (status === 'active') {
        query.status = 'ongoing';
      } else {
        query.status = status;
      }
    }

    // 公开端点（未登录用户）：只返回已发布的期次
    if (isPublished !== undefined) {
      query.isPublished = isPublished === 'true';
    } else {
      // 默认只返回已发布的期次给公众
      query.isPublished = true;
    }

    const total = await Period.countDocuments(query);
    const skip = (parseInt(page, 10) - 1) * parseInt(limit, 10);
    const periods = await Period.find(query)
      .sort({ endDate: -1, createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit, 10))
      .select('-__v');

    // 转换数据格式以匹配前端期望
    // 注意：price 和 originalPrice 单位为"分"（100分 = 1元），前端负责转换显示
    const transformedPeriods = periods.map(period => {
      // 使用 virtuals: true 确保虚拟字段被包含
      const periodObj = period.toObject ? period.toObject({ virtuals: true }) : period;

      // 添加前端需要的字段
      return {
        ...periodObj,
        // 状态映射：ongoing -> active （向后兼容）
        status: period.status === 'ongoing' ? 'active' : period.status,
        title: period.title || period.name, // 如果没有title，使用name作为备选
        color: period.coverColor || 'linear-gradient(135deg, #4a90e2 0%, #357abd 100%)',
        // 转换 coverColor 为前端编辑表单能识别的格式（hex/rgb，不支持渐变）
        coverColor: convertCoverColorForForm(period.coverColor),
        icon: period.icon || period.coverEmoji || '📚',
        startTime: period.startDate ? period.startDate.toISOString() : null,
        endTime: period.endDate ? period.endDate.toISOString() : null,
        dateRange: periodObj.dateRange || '', // 虚拟字段现在应该被包含了
        statusText: getStatusText(period),
        checkedDays: 0, // 这个值需要从用户的打卡记录中计算
        progress: 0, // 这个值也需要计算
        isCheckedIn: false,
        currentEnrollment: period.enrollmentCount || 0 // 报名人数（映射enrollmentCount为currentEnrollment）
        // price 和 originalPrice 为分单位，不做转换，由前端负责转换为元显示
      };
    });

    // 返回带分页信息的响应
    const response = success(transformedPeriods);
    response.pagination = {
      page: parseInt(page, 10),
      limit: parseInt(limit, 10),
      total,
      totalPages: Math.ceil(total / parseInt(limit, 10))
    };
    res.json(response);
  } catch (error) {
    next(error);
  }
}

// 获取期次详情
async function getPeriodDetail(req, res, next) {
  try {
    const { periodId } = req.params;

    const period = await Period.findById(periodId);

    if (!period) {
      return res.status(404).json(errors.notFound('期次不存在'));
    }

    // 返回转换后的数据，与列表 API 格式一致
    const periodObj = period.toObject ? period.toObject({ virtuals: true }) : period;

    const transformedPeriod = {
      ...periodObj,
      status: period.status === 'ongoing' ? 'active' : period.status,
      title: period.title || period.name,
      color: period.coverColor || 'linear-gradient(135deg, #4a90e2 0%, #357abd 100%)',
      // 转换 coverColor 为前端编辑表单能识别的格式（hex/rgb，不支持渐变）
      coverColor: convertCoverColorForForm(period.coverColor),
      icon: period.icon || period.coverEmoji || '📚',
      startTime: period.startDate ? period.startDate.toISOString() : null,
      endTime: period.endDate ? period.endDate.toISOString() : null,
      dateRange: periodObj.dateRange || '',
      statusText: getStatusText(period)
    };

    res.json(success(transformedPeriod));
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
      title: title || name, // 如果没有提供title，使用name作为默认值
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

    // 异步同步到 MySQL
    publishSyncEvent({
      type: 'create',
      collection: 'periods',
      documentId: period._id.toString(),
      data: period.toObject()
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

    // 异步同步到 MySQL
    publishSyncEvent({
      type: 'update',
      collection: 'periods',
      documentId: period._id.toString(),
      data: period.toObject()
    });

    // 返回转换后的数据，与列表 API 格式一致
    const periodObj = period.toObject ? period.toObject({ virtuals: true }) : period;

    const transformedPeriod = {
      ...periodObj,
      status: period.status === 'ongoing' ? 'active' : period.status,
      title: period.title || period.name,
      color: period.coverColor || 'linear-gradient(135deg, #4a90e2 0%, #357abd 100%)',
      coverColor: convertCoverColorForForm(period.coverColor),
      icon: period.icon || period.coverEmoji || '📚',
      startTime: period.startDate ? period.startDate.toISOString() : null,
      endTime: period.endDate ? period.endDate.toISOString() : null,
      dateRange: periodObj.dateRange || '',
      statusText: getStatusText(period)
    };

    res.json(success(transformedPeriod, '期次更新成功'));
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

    // 保存期次信息用于同步
    const periodData = period.toObject();

    await Period.findByIdAndDelete(periodId);

    // 异步同步到 MySQL
    publishSyncEvent({
      type: 'delete',
      collection: 'periods',
      documentId: period._id.toString(),
      data: periodData
    });

    res.json(success(null, '期次删除成功'));
  } catch (error) {
    next(error);
  }
}

// 复制期次（管理员）
async function copyPeriod(req, res, next) {
  try {
    const { id } = req.params;
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

    // 验证源期次是否存在
    const sourcePeriod = await Period.findById(id);
    if (!sourcePeriod) {
      return res.status(404).json(errors.notFound('源期次不存在'));
    }

    // 创建新期次
    const newPeriod = await Period.create({
      name,
      subtitle,
      title: title || name,
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

    // 获取源期次的所有课节
    const Section = require('../models/Section');
    const sourceSections = await Section.find({ periodId: id });

    // 复制课节
    let copiedSectionCount = 0;
    if (sourceSections.length > 0) {
      const newSections = sourceSections.map(section => {
        const sectionObj = section.toObject();
        delete sectionObj._id; // 删除_id以生成新的
        delete sectionObj.createdAt;
        delete sectionObj.updatedAt;
        return {
          ...sectionObj,
          periodId: newPeriod._id,
          checkinCount: 0 // 重置打卡数
        };
      });

      await Section.insertMany(newSections);
      copiedSectionCount = newSections.length;
    }

    // 异步同步到 MySQL
    publishSyncEvent({
      type: 'create',
      collection: 'periods',
      documentId: newPeriod._id.toString(),
      data: newPeriod.toObject()
    });

    res.status(201).json(success({
      period: newPeriod,
      copiedSectionCount
    }, `期次复制成功，已复制 ${copiedSectionCount} 节课程`));
  } catch (error) {
    next(error);
  }
}

module.exports = {
  getPeriodList,
  getPeriodListForUser,
  getPeriodDetail,
  createPeriod,
  updatePeriod,
  deletePeriod,
  copyPeriod
};
