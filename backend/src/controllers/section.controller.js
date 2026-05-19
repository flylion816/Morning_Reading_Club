const Section = require('../models/Section');
const Period = require('../models/Period');
const Checkin = require('../models/Checkin');
const UserReadingCompletion = require('../models/UserReadingCompletion');
const { success, errors } = require('../utils/response');
const logger = require('../utils/logger');
const { publishSyncEvent } = require('../services/sync.service');
const { getCurrentTenantId } = require('../utils/tenantContext');

const ADMIN_SECTION_LIST_FIELDS =
  '_id periodId day title subtitle icon duration sortOrder order isPublished checkinCount createdAt updatedAt';

function getRequestUserId(req) {
  return req.user?.userId || req.user?.id || req.user?._id || '';
}

async function getReadingCompletionMap(userId, sectionIds = []) {
  if (!userId || !sectionIds.length) {
    return new Map();
  }

  const completions = await UserReadingCompletion.find({
    userId,
    sectionId: { $in: sectionIds }
  })
    .select('sectionId durationMs completedAt')
    .lean();

  return new Map(
    completions.map(item => [
      String(item.sectionId),
      {
        readingCompleted: true,
        readingCompletedAt: item.completedAt || null,
        readingDurationMs: item.durationMs || 0
      }
    ])
  );
}

function attachReadingCompletion(section, completionMap) {
  const completion = completionMap.get(String(section._id));
  return {
    ...section,
    readingCompleted: !!completion,
    readingCompletedAt: completion?.readingCompletedAt || null,
    readingDurationMs: completion?.readingDurationMs || 0
  };
}

// 获取期次的课程列表（用户端 - 仅已发布）
async function getSectionsByPeriod(req, res, next) {
  try {
    const { periodId } = req.params;
    const { page = 1, limit = 50, startDay, endDay } = req.query;

    const tenantId = getCurrentTenantId();
    logger.debug('[TENANT-SECTION] getSectionsByPeriod', {
      tenantId: tenantId ? tenantId.toString() : null,
      periodId,
      userId: req.user?.userId || req.user?._id || null
    });

    // 验证期次存在
    const period = await Period.findById(periodId);
    if (!period) {
      return res.status(404).json(errors.notFound('期次不存在'));
    }

    const query = { periodId, isPublished: true };

    // 支持日期范围查询
    if (startDay !== undefined && endDay !== undefined) {
      query.day = { $gte: parseInt(startDay, 10), $lte: parseInt(endDay, 10) };
    } else if (startDay !== undefined) {
      query.day = { $gte: parseInt(startDay, 10) };
    } else if (endDay !== undefined) {
      query.day = { $lte: parseInt(endDay, 10) };
    }

    const total = await Section.countDocuments(query);
    const sections = await Section.find(query)
      .sort({ day: 1, order: 1, sortOrder: 1 })
      .skip((parseInt(page, 10) - 1) * parseInt(limit, 10))
      .limit(parseInt(limit, 10))
      .select('-content -__v')
      .lean(); // 列表不返回详细内容

    const sectionIds = sections.map(section => section._id);
    const checkinCounts = sectionIds.length > 0
      ? await Checkin.aggregate([
          {
            $match: {
              sectionId: { $in: sectionIds },
              isPublic: true
            }
          },
          {
            $group: {
              _id: '$sectionId',
              count: { $sum: 1 }
            }
          }
        ])
      : [];
    const checkinCountMap = new Map(
      checkinCounts.map(item => [String(item._id), item.count])
    );
    const readingCompletionMap = await getReadingCompletionMap(
      getRequestUserId(req),
      sectionIds
    );
    const sectionsWithLiveCheckinCount = sections.map(section => ({
      ...attachReadingCompletion(section, readingCompletionMap),
      checkinCount: checkinCountMap.get(String(section._id)) || 0
    }));

    res.json(success(sectionsWithLiveCheckinCount));
  } catch (error) {
    next(error);
  }
}

async function markReadingCompletion(req, res, next) {
  try {
    const { sectionId } = req.params;
    const userId = getRequestUserId(req);
    const durationMs = Math.max(0, Number(req.body?.durationMs) || 0);
    const clientCompletedAt = req.body?.completedAt
      ? new Date(req.body.completedAt)
      : null;
    const completedAt =
      clientCompletedAt && !Number.isNaN(clientCompletedAt.getTime())
        ? clientCompletedAt
        : new Date();

    const section = await Section.findById(sectionId).select('periodId');
    if (!section) {
      return res.status(404).json(errors.notFound('课程不存在'));
    }

    const completion = await UserReadingCompletion.findOneAndUpdate(
      { userId, sectionId },
      {
        $set: {
          userId,
          periodId: section.periodId,
          sectionId,
          durationMs,
          completedAt
        }
      },
      {
        upsert: true,
        new: true,
        setDefaultsOnInsert: true
      }
    ).lean();

    return res.json(
      success(
        {
          sectionId: String(completion.sectionId),
          periodId: String(completion.periodId),
          readingCompleted: true,
          readingCompletedAt: completion.completedAt,
          readingDurationMs: completion.durationMs || 0
        },
        '阅读完成状态已保存'
      )
    );
  } catch (error) {
    next(error);
  }
}

// 获取期次的所有课程列表（管理员 - 包括草稿）
async function getAllSectionsByPeriod(req, res, next) {
  try {
    const { periodId } = req.params;
    const { page = 1, limit = 50 } = req.query;

    // 验证期次存在
    const period = await Period.findById(periodId);
    if (!period) {
      return res.status(404).json(errors.notFound('期次不存在'));
    }

    const query = { periodId };

    const total = await Section.countDocuments(query);
    const sections = await Section.find(query)
      .sort({ day: 1, sortOrder: 1 })
      .skip((parseInt(page, 10) - 1) * parseInt(limit, 10))
      .limit(parseInt(limit, 10))
      .select(ADMIN_SECTION_LIST_FIELDS)
      .lean();

    res.json(
      success({
        list: sections,
        pagination: {
          page: parseInt(page, 10),
          limit: parseInt(limit, 10),
          total,
          pages: Math.ceil(total / parseInt(limit, 10))
        }
      })
    );
  } catch (error) {
    next(error);
  }
}

// 获取课程详情
async function getSectionDetail(req, res, next) {
  try {
    const { sectionId } = req.params;

    const tenantId = getCurrentTenantId();
    logger.debug('[TENANT-SECTION] getSectionDetail', {
      tenantId: tenantId ? tenantId.toString() : null,
      sectionId,
      userId: req.user?.userId || req.user?._id || null
    });

    const section = await Section.findById(sectionId)
      .populate('periodId', '_id name title')
      .lean();

    if (!section) {
      return res.status(404).json(errors.notFound('课程不存在'));
    }

    const readingCompletionMap = await getReadingCompletionMap(
      getRequestUserId(req),
      [section._id]
    );

    // 返回课程详情（无论是否发布，因为可能是管理员查询）
    res.json(success(attachReadingCompletion(section, readingCompletionMap)));
  } catch (error) {
    next(error);
  }
}

// 创建课程（管理员）
async function createSection(req, res, next) {
  try {
    const {
      periodId,
      day,
      title,
      subtitle,
      icon,
      meditation,
      question,
      content,
      reflection,
      action,
      learn,
      extract,
      say,
      audioUrl,
      videoCover,
      duration,
      sortOrder
    } = req.body;

    // 验证期次存在
    const period = await Period.findById(periodId);
    if (!period) {
      return res.status(404).json(errors.notFound('期次不存在'));
    }

    const section = await Section.create({
      periodId,
      day,
      title,
      subtitle,
      icon,
      meditation,
      question,
      content,
      reflection,
      action,
      learn,
      extract,
      say,
      audioUrl,
      videoCover,
      duration,
      sortOrder,
      tenantId: getCurrentTenantId()
    });

    // 异步同步到 MySQL
    publishSyncEvent({
      type: 'create',
      collection: 'sections',
      documentId: section._id.toString(),
      data: section.toObject()
    });

    res.status(201).json(success(section, '课程创建成功'));
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json(errors.badRequest('该期次的第' + req.body.day + '天课程已存在'));
    }
    next(error);
  }
}

// 更新课程（管理员）
async function updateSection(req, res, next) {
  try {
    const { sectionId } = req.params;
    const updates = req.body;

    const section = await Section.findById(sectionId);

    if (!section) {
      return res.status(404).json(errors.notFound('课程不存在'));
    }

    // 更新字段
    Object.keys(updates).forEach(key => {
      if (updates[key] !== undefined) {
        section[key] = updates[key];
      }
    });

    await section.save();

    // 异步同步到 MySQL
    publishSyncEvent({
      type: 'update',
      collection: 'sections',
      documentId: section._id.toString(),
      data: section.toObject()
    });

    res.json(success(section, '课程更新成功'));
  } catch (error) {
    next(error);
  }
}

// 删除课程（管理员）
async function deleteSection(req, res, next) {
  try {
    const { sectionId } = req.params;

    const section = await Section.findById(sectionId);

    if (!section) {
      return res.status(404).json(errors.notFound('课程不存在'));
    }

    // 保存课程信息用于同步
    const sectionData = section.toObject();

    await Section.findByIdAndDelete(sectionId);

    // 异步同步到 MySQL
    publishSyncEvent({
      type: 'delete',
      collection: 'sections',
      documentId: section._id.toString(),
      data: sectionData
    });

    res.json(success(null, '课程删除成功'));
  } catch (error) {
    next(error);
  }
}

// 获取今日任务（根据用户报名的期次动态计算）
async function getTodayTask(req, res, next) {
  try {
    const Enrollment = require('../models/Enrollment');

    // JWT payload from admin controller uses 'id', from auth uses 'userId'
    const userId = req.user.id || req.user.userId;

    logger.debug('getTodayTask called', { userId });

    // 获取用户所有报名（活跃和已完成的）
    // 使用 status 字段，这是 Enrollment 表中实际存在的字段
    const enrollments = await Enrollment.find({
      userId,
      status: { $in: ['active', 'completed'] }
    }).populate('periodId');

    logger.debug('Enrollments found', { count: enrollments.length, userId });
    if (!enrollments || enrollments.length === 0) {
      logger.debug('No enrollments found for user', { userId });
      return res.json(success(null, '暂无任务'));
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0); // 设置为今天00:00:00

    let todayTask = null;

    // 遍历每个报名的期次，找到今天应该学习的课节
    for (const enrollment of enrollments) {
      const period = enrollment.periodId;

      logger.debug('Checking enrollment', {
        enrollmentId: enrollment._id,
        periodId: period?._id
      });

      if (!period) {
        logger.debug('Period not found for enrollment', { enrollmentId: enrollment._id });
        continue;
      }

      // 计算从期次开始日期到今天经过了多少天
      const periodStartDate = new Date(period.startDate);
      periodStartDate.setHours(0, 0, 0, 0);

      const daysDiff = Math.floor((today - periodStartDate) / (1000 * 60 * 60 * 24));

      // 如果今天在期次范围内，计算应该学习的day
      if (daysDiff >= 0 && daysDiff < period.totalDays) {
        // 通常day从0开始，所以第一天是day 0
        const currentDay = daysDiff;
        logger.debug('Period is active today', {
          periodId: period._id,
          daysDiff,
          currentDay,
          totalDays: period.totalDays
        });

        // 查询这一天的课节
        const section = await Section.findOne({
          periodId: period._id,
          day: currentDay,
          isPublished: true
        }).select('-content -__v'); // 不返回完整内容，减少数据传输

        if (section) {
          logger.debug('Today task section found', { sectionId: section._id });

          // 检查用户是否已经为今天的这个课节打过卡
          const todayStart = new Date(today);
          const todayEnd = new Date(today);
          todayEnd.setHours(23, 59, 59, 999);

          const Checkin = require('../models/Checkin');
          const existingCheckin = await Checkin.findOne({
            userId,
            sectionId: section._id,
            checkinDate: {
              $gte: todayStart,
              $lte: todayEnd
            }
          });

          const isCheckedIn = !!existingCheckin;
          logger.debug('Checkin status', { sectionId: section._id, isCheckedIn });

          const readingCompletion = await UserReadingCompletion.findOne({
            userId,
            sectionId: section._id
          })
            .select('durationMs completedAt')
            .lean();

          // 获取今天打卡用户的头像列表（最多10个）
          const sectionCheckins = await Checkin.find({
            sectionId: section._id,
            checkinDate: {
              $gte: todayStart,
              $lte: todayEnd
            }
          })
            .populate('userId', 'avatar avatarUrl nickname')
            .limit(10);

          const checkinUsers = sectionCheckins.map(c => ({
            _id: c.userId._id,
            avatar: c.userId.avatar,
            avatarUrl: c.userId.avatarUrl,
            nickname: c.userId.nickname
          }));

          const todayCheckinCount = await Checkin.countDocuments({
            sectionId: section._id,
            checkinDate: { $gte: todayStart, $lte: todayEnd }
          });

          todayTask = {
            periodId: period._id,
            periodName: period.name,
            periodTitle: period.title,
            sectionId: section._id,
            day: section.day,
            title: section.title,
            icon: section.icon,
            meditation: section.meditation,
            question: section.question,
            reflection: section.reflection,
            action: section.action,
            learn: section.learn,
            checkinCount: todayCheckinCount,
            checkinUsers: checkinUsers,
            isCheckedIn: isCheckedIn,
            readingCompleted: !!readingCompletion,
            readingCompletedAt: readingCompletion?.completedAt || null,
            readingDurationMs: readingCompletion?.durationMs || 0
          };

          // 找到今天的任务就可以返回
          break;
        }
      } else {
        logger.debug('Period not active today', {
          periodId: period._id,
          daysDiff,
          totalDays: period.totalDays
        });
      }
    }

    logger.debug('getTodayTask result', { hasTodayTask: !!todayTask, userId });

    if (todayTask) {
      res.json(success(todayTask, '获取今日任务成功'));
    } else {
      res.json(success(null, '暂无今日任务'));
    }
  } catch (error) {
    next(error);
  }
}

module.exports = {
  getSectionsByPeriod,
  getAllSectionsByPeriod,
  getSectionDetail,
  markReadingCompletion,
  createSection,
  updateSection,
  deleteSection,
  getTodayTask
};
