const Section = require('../models/Section');
const Period = require('../models/Period');
const { success, errors } = require('../utils/response');

// 获取期次的课程列表（用户端 - 仅已发布）
async function getSectionsByPeriod(req, res, next) {
  try {
    const { periodId } = req.params;
    const { page = 1, limit = 50 } = req.query;

    // 验证期次存在
    const period = await Period.findById(periodId);
    if (!period) {
      return res.status(404).json(errors.notFound('期次不存在'));
    }

    const query = { periodId, isPublished: true };

    const total = await Section.countDocuments(query);
    const sections = await Section.find(query)
      .sort({ day: 1, sortOrder: 1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit))
      .select('-content -__v'); // 列表不返回详细内容

    res.json(success({
      list: sections,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    }));
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
      .skip((page - 1) * limit)
      .limit(parseInt(limit));

    res.json(success({
      list: sections,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    }));
  } catch (error) {
    next(error);
  }
}

// 获取课程详情
async function getSectionDetail(req, res, next) {
  try {
    const { sectionId } = req.params;

    const section = await Section.findById(sectionId)
      .populate('periodId', 'name title');

    if (!section) {
      return res.status(404).json(errors.notFound('课程不存在'));
    }

    if (!section.isPublished) {
      return res.status(403).json(errors.forbidden('课程未发布'));
    }

    res.json(success(section));
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
      isPublished: false
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

    await Section.findByIdAndDelete(sectionId);

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

    console.log('\n===== getTodayTask 调试日志 =====');
    console.log('userId:', userId);

    // 获取用户所有报名（包括待批准的）
    // 使用 $in 匹配多个状态，允许 pending 和 approved
    const enrollments = await Enrollment.find({
      userId,
      approvalStatus: { $in: ['approved', 'pending'] }
    }).populate('periodId');

    console.log('找到报名数:', enrollments.length);
    if (!enrollments || enrollments.length === 0) {
      console.log('❌ 没有找到报名');
      return res.json(success(null, '暂无任务'));
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0); // 设置为今天00:00:00
    console.log('today:', today);

    let todayTask = null;

    // 遍历每个报名的期次，找到今天应该学习的课节
    for (const enrollment of enrollments) {
      const period = enrollment.periodId;

      console.log('\n检查报名:', enrollment._id);
      console.log('  period:', period);

      if (!period) {
        console.log('  ❌ 期次不存在');
        continue;
      }

      console.log('  period.startDate:', period.startDate);
      console.log('  period.totalDays:', period.totalDays);

      // 计算从期次开始日期到今天经过了多少天
      const periodStartDate = new Date(period.startDate);
      periodStartDate.setHours(0, 0, 0, 0);

      const daysDiff = Math.floor((today - periodStartDate) / (1000 * 60 * 60 * 24));
      console.log('  daysDiff:', daysDiff);

      // 如果今天在期次范围内，计算应该学习的day
      if (daysDiff >= 0 && daysDiff < period.totalDays) {
        console.log('  ✅ 在期次范围内');
        // 通常day从0开始，所以第一天是day 0
        const currentDay = daysDiff;
        console.log('  currentDay:', currentDay);

        // 查询这一天的课节
        const section = await Section.findOne({
          periodId: period._id,
          day: currentDay,
          isPublished: true
        }).select('-content -__v'); // 不返回完整内容，减少数据传输

        console.log('  找到的section:', section ? section._id : '无');

        if (section) {
          console.log('  ✅ 找到今日任务');

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
          console.log('  isCheckedIn:', isCheckedIn);

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
            checkinCount: section.checkinCount || 0,
            isCheckedIn: isCheckedIn
          };

          // 找到今天的任务就可以返回
          break;
        }
      } else {
        console.log('  ❌ 不在期次范围内 (daysDiff:', daysDiff, ', totalDays:', period.totalDays, ')');
      }
    }

    console.log('最终todayTask:', todayTask ? '有' : '无');
    console.log('===== getTodayTask 调试日志结束 =====\n');

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
  createSection,
  updateSection,
  deleteSection,
  getTodayTask
};
