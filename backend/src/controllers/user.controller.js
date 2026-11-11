const axios = require('axios');
const User = require('../models/User');
const Checkin = require('../models/Checkin');
const Enrollment = require('../models/Enrollment');
const { success, errors } = require('../utils/response');
const { getCurrentTenantId } = require('../utils/tenantContext');
const { computeDayMetrics } = require('../utils/checkin-day-metrics');
const { publishSyncEvent } = require('../services/sync.service');
const subscribeMessageService = require('../services/subscribe-message.service');

function buildParticipatingEnrollmentQuery(userId) {
  return {
    userId,
    status: { $in: ['active', 'completed'] },
    deleted: { $ne: true }
  };
}

// 打卡口径：按东八区自然日去重（租户隔离由 Checkin 的 tenantPlugin 对 find 自动生效）
async function getCheckinDayStats(userId) {
  const checkins = await Checkin.find({ userId }).select('checkinDate').lean();
  const metrics = computeDayMetrics(checkins.map(item => item.checkinDate));
  return {
    totalCheckins: checkins.length,
    totalCheckinDays: metrics.totalDays,
    currentStreak: metrics.currentStreak,
    maxStreak: metrics.maxStreak
  };
}

const USER_ROLES = ['user', 'admin', 'super_admin'];
const USER_STATUSES = ['active', 'banned', 'deleted'];
const PLATFORM_ADMIN_ROLES = ['platform_superadmin', 'superadmin'];
// 可以修改小程序用户角色、删除用户的后台角色（不含 operator）
const USER_ROLE_MANAGER_ROLES = [...PLATFORM_ADMIN_ROLES, 'tenant_admin', 'admin'];

// 获取当前用户信息
async function getCurrentUser(req, res, next) {
  try {
    const {userId} = req.user;
    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json(errors.notFound('用户不存在'));
    }

    if (user.status !== 'active') {
      return res.status(403).json(errors.forbidden('用户已被禁用'));
    }

    const [checkinStats, enrollmentPeriodCount] = await Promise.all([
      getCheckinDayStats(userId),
      Enrollment.countDocuments(buildParticipatingEnrollmentQuery(userId))
    ]);

    res.json(
      success({
        _id: user._id,
        openid: user.openid,
        nickname: user.nickname,
        avatar: user.avatar,
        avatarUrl: user.avatarUrl,
        signature: user.signature,
        gender: user.gender,
        totalCheckinDays: checkinStats.totalCheckinDays,
        totalCheckins: checkinStats.totalCheckins,
        currentStreak: checkinStats.currentStreak,
        maxStreak: checkinStats.maxStreak,
        totalCompletedPeriods: enrollmentPeriodCount,
        totalPoints: user.totalPoints,
        level: user.level,
        role: user.role,
        status: user.status,
        createdAt: user.createdAt,
        phone: user.phone ? user.phone.replace(/(\d{3})\d{4}(\d{4})/, '$1****$2') : null,
        phoneBindAt: user.phoneBindAt || null
      })
    );
  } catch (error) {
    next(error);
  }
}

// 更新用户资料
async function updateProfile(req, res, next) {
  try {
    const { nickname, avatar, avatarUrl, signature, gender } = req.body;

    const user = await User.findById(req.user.userId);

    if (!user) {
      return res.status(404).json(errors.notFound('用户不存在'));
    }

    // 昵称必须在当前租户内唯一，修改本人原昵称时除外。
    if (nickname !== undefined) {
      if (typeof nickname !== 'string' || !nickname.trim() || nickname.trim().length > 50) {
        return res.status(400).json(errors.badRequest('昵称不能为空且不能超过50个字符'));
      }
      const normalizedNickname = nickname.trim();
      // 已有昵称不变时允许继续使用，避免历史同名影响头像/签名保存。
      if (normalizedNickname !== String(user.nickname || '').trim()) {
        const nicknameQuery = {
          nickname: normalizedNickname,
          _id: { $ne: user._id }
        };
        const tenantId = getCurrentTenantId();
        if (tenantId) nicknameQuery.tenantId = tenantId;

        const duplicateUser = await User.findOne(nicknameQuery).select('_id').lean();
        if (duplicateUser) {
          return res.status(409).json(errors.conflict('该昵称已被使用，请修改后再保存'));
        }
      }
      user.nickname = normalizedNickname;
    }
    if (avatar !== undefined) user.avatar = avatar;
    if (avatarUrl !== undefined) user.avatarUrl = avatarUrl;
    if (signature !== undefined) user.signature = signature;
    if (gender !== undefined) user.gender = gender;

    await user.save();

    // 异步同步到 MySQL（不阻塞响应）
    publishSyncEvent({
      type: 'update',
      collection: 'users',
      documentId: user._id.toString(),
      data: user.toObject()
    });

    res.json(
      success(
        {
          _id: user._id,
          nickname: user.nickname,
          avatar: user.avatar,
          avatarUrl: user.avatarUrl,
          signature: user.signature,
          gender: user.gender
        },
        '资料更新成功'
      )
    );
  } catch (error) {
    next(error);
  }
}

// 获取用户详情（他人主页）
async function getUserById(req, res, next) {
  try {
    const { userId } = req.params;

    if (!userId) {
      return res.status(400).json(errors.badRequest('用户ID不能为空'));
    }

    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json(errors.notFound('用户不存在'));
    }

    if (user.status !== 'active') {
      return res.status(403).json(errors.forbidden('用户已被禁用'));
    }

    const [checkinStats, enrollmentPeriodCount] = await Promise.all([
      getCheckinDayStats(userId),
      Enrollment.countDocuments(buildParticipatingEnrollmentQuery(userId))
    ]);

    res.json(
      success({
        _id: user._id,
        nickname: user.nickname,
        avatarUrl: user.avatarUrl,
        avatar: user.avatar,
        signature: user.signature,
        gender: user.gender,
        totalCheckinDays: checkinStats.totalCheckinDays,
        totalCheckins: checkinStats.totalCheckins,
        currentStreak: checkinStats.currentStreak,
        maxStreak: checkinStats.maxStreak,
        totalCompletedPeriods: enrollmentPeriodCount,
        totalPoints: user.totalPoints,
        level: user.level,
        createdAt: user.createdAt
      })
    );
  } catch (error) {
    next(error);
  }
}

// 获取用户统计信息
async function getUserStats(req, res, next) {
  try {
    // 如果userId是"me"或未提供，使用当前登录用户的ID
    let { userId } = req.params;
    if (!userId || userId === 'me') {
      userId = req.user.userId;
    }

    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json(errors.notFound('用户不存在'));
    }

    // 根据实际记录计算统计值（不依赖可能不准确的用户缓存字段）
    const [checkinStats, enrollmentPeriodCount] = await Promise.all([
      getCheckinDayStats(userId),
      Enrollment.countDocuments(buildParticipatingEnrollmentQuery(userId))
    ]);

    res.json(
      success({
        totalCheckinDays: checkinStats.totalCheckinDays,
        totalCheckins: checkinStats.totalCheckins,
        currentStreak: checkinStats.currentStreak,
        maxStreak: checkinStats.maxStreak,
        totalCompletedPeriods: enrollmentPeriodCount,
        totalPoints: user.totalPoints,
        level: user.level
      })
    );
  } catch (error) {
    next(error);
  }
}

// 获取用户列表（管理员）
async function getUserList(req, res, next) {
  try {
    const { page = 1, limit = 20, role, status, search, keyword, sortBy, sortOrder } = req.query;

    // 支持 search 和 keyword 两个参数名（search 用于前端搜索框，keyword 用于兼容）
    const searchTerm = search || keyword;

    // 默认排除已删除用户；若前端明确指定 status=deleted 则显示
    const query = { status: { $ne: 'deleted' } };

    // 租户隔离：只返回当前租户的用户
    const tenantId = getCurrentTenantId();
    if (tenantId) query.tenantId = tenantId;
    if (role === 'admin') {
      query.role = { $in: ['admin', 'super_admin'] };
    } else if (role) {
      query.role = role;
    }
    if (status) query.status = status;
    if (searchTerm) {
      query.$or = [
        { nickname: { $regex: searchTerm, $options: 'i' } },
        { email: { $regex: searchTerm, $options: 'i' } },
        { openid: { $regex: searchTerm, $options: 'i' } }
      ];
    }

    const allowedSortFields = new Set(['createdAt', 'lastLoginAt']);
    const sortField = allowedSortFields.has(sortBy) ? sortBy : 'createdAt';
    const sortDirection = sortOrder === 'ascending' || sortOrder === 'asc' || sortOrder === '1' ? 1 : -1;

    const total = await User.countDocuments(query);
    const users = await User.find(query)
      .sort({ [sortField]: sortDirection })
      .skip((page - 1) * limit)
      .limit(parseInt(limit, 10))
      .select('-__v');

    res.json(
      success({
        list: users,
        pagination: {
          page: parseInt(page, 10),
          limit: parseInt(limit, 10),
          total,
          pages: Math.ceil(total / limit)
        }
      })
    );
  } catch (error) {
    next(error);
  }
}

// 更新用户信息（管理员）
async function updateUser(req, res, next) {
  try {
    const { userId } = req.params;
    const { isActive, status, role } = req.body;

    if (status !== undefined && !USER_STATUSES.includes(status)) {
      return res.status(400).json(errors.badRequest('无效的用户状态'));
    }
    if (role !== undefined) {
      if (!USER_ROLES.includes(role)) {
        return res.status(400).json(errors.badRequest('无效的用户角色'));
      }
      // 授予小程序管理员身份属于提权操作，operator 不允许；super_admin 仅平台管理员可授予。
      const adminRole = req.admin?.role;
      const canGrantRole = role === 'super_admin'
        ? PLATFORM_ADMIN_ROLES.includes(adminRole)
        : USER_ROLE_MANAGER_ROLES.includes(adminRole);
      if (!canGrantRole) {
        return res.status(403).json(errors.forbidden('当前账号无权修改用户角色'));
      }
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json(errors.notFound('用户不存在'));
    }

    // 只允许管理员修改这些字段
    if (isActive !== undefined) {
      // isActive=false 对应 banned 状态，与前端 UsersView 的 status 路径保持一致
      user.status = isActive ? 'active' : 'banned';
    }
    if (status !== undefined) {
      user.status = status;
    }
    if (role !== undefined) {
      user.role = role;
    }

    await user.save();

    res.json(success(user, '用户信息已更新'));
  } catch (error) {
    next(error);
  }
}

// 删除用户（管理员）
async function deleteUser(req, res, next) {
  try {
    const { userId } = req.params;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json(errors.notFound('用户不存在'));
    }

    user.status = 'deleted';
    await user.save();

    publishSyncEvent({
      type: 'update',
      collection: 'users',
      documentId: user._id.toString(),
      data: user.toObject()
    });

    res.json(success({ _id: userId }, '用户已删除'));
  } catch (error) {
    next(error);
  }
}

// 绑定手机号
async function bindPhone(req, res, next) {
  try {
    const { code } = req.body;

    if (!code) {
      return res.status(400).json(errors.badRequest('缺少微信手机号授权 code'));
    }

    const user = await User.findById(req.user.userId);
    if (!user) {
      return res.status(404).json(errors.notFound('用户不存在'));
    }

    // 获取 access_token（复用 subscribe-message 服务中的缓存逻辑）
    let accessToken;
    try {
      accessToken = await subscribeMessageService.getAccessToken();
    } catch (err) {
      return res.status(502).json(errors.serverError(`获取微信 access_token 失败: ${  err.message}`));
    }

    // 调用微信接口获取手机号
    let wxResponse;
    try {
      wxResponse = await axios.post(
        `https://api.weixin.qq.com/wxa/business/getuserphonenumber?access_token=${accessToken}`,
        { code },
        { timeout: 5000 }
      );
    } catch (err) {
      return res.status(502).json(errors.serverError('调用微信手机号接口失败'));
    }

    const { errcode, errmsg, phone_info } = wxResponse.data;
    if (errcode && errcode !== 0) {
      // code 无效或已过期
      if (errcode === 40029 || errcode === 40163) {
        return res.status(400).json(errors.badRequest('手机号授权 code 无效或已过期，请重新授权'));
      }
      return res.status(502).json(errors.serverError(`微信接口错误: ${errmsg || errcode}`));
    }

    const purePhoneNumber = phone_info && phone_info.purePhoneNumber;
    if (!purePhoneNumber) {
      return res.status(502).json(errors.serverError('未能从微信获取手机号'));
    }

    user.phone = purePhoneNumber;
    user.phoneBindAt = new Date();
    await user.save();

    publishSyncEvent({
      type: 'update',
      collection: 'users',
      documentId: user._id.toString(),
      data: user.toObject()
    });

    const maskedPhone = purePhoneNumber.replace(/(\d{3})\d{4}(\d{4})/, '$1****$2');

    res.json(success({ phone: maskedPhone, phoneBindAt: user.phoneBindAt }, '手机号绑定成功'));
  } catch (error) {
    next(error);
  }
}

// 获取当前用户手机号信息
async function getPhoneInfo(req, res, next) {
  try {
    const user = await User.findById(req.user.userId).select('phone phoneBindAt');
    if (!user) {
      return res.status(404).json(errors.notFound('用户不存在'));
    }

    const bound = !!user.phone;
    const maskedPhone = bound
      ? user.phone.replace(/(\d{3})\d{4}(\d{4})/, '$1****$2')
      : null;

    res.json(success({ bound, phone: maskedPhone, phoneBindAt: user.phoneBindAt || null }));
  } catch (error) {
    next(error);
  }
}

module.exports = {
  USER_ROLE_MANAGER_ROLES,
  getCurrentUser,
  updateProfile,
  getUserById,
  getUserStats,
  getUserList,
  updateUser,
  deleteUser,
  bindPhone,
  getPhoneInfo
};
