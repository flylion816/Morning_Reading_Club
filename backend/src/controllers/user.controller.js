const User = require('../models/User');
const { success, errors } = require('../utils/response');

// 获取当前用户信息
async function getCurrentUser(req, res, next) {
  try {
    const user = await User.findById(req.user.userId);

    if (!user) {
      return res.status(404).json(errors.notFound('用户不存在'));
    }

    if (user.status !== 'active') {
      return res.status(403).json(errors.forbidden('用户已被禁用'));
    }

    res.json(success({
      id: user._id,
      openid: user.openid,
      nickname: user.nickname,
      avatar: user.avatar,
      avatarUrl: user.avatarUrl,
      signature: user.signature,
      gender: user.gender,
      totalCheckinDays: user.totalCheckinDays,
      currentStreak: user.currentStreak,
      maxStreak: user.maxStreak,
      totalCompletedPeriods: user.totalCompletedPeriods,
      totalPoints: user.totalPoints,
      level: user.level,
      role: user.role,
      status: user.status,
      createdAt: user.createdAt
    }));
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

    // 更新字段
    if (nickname !== undefined) user.nickname = nickname;
    if (avatar !== undefined) user.avatar = avatar;
    if (avatarUrl !== undefined) user.avatarUrl = avatarUrl;
    if (signature !== undefined) user.signature = signature;
    if (gender !== undefined) user.gender = gender;

    await user.save();

    res.json(success({
      id: user._id,
      nickname: user.nickname,
      avatar: user.avatar,
      avatarUrl: user.avatarUrl,
      signature: user.signature,
      gender: user.gender
    }, '资料更新成功'));
  } catch (error) {
    next(error);
  }
}

// 获取用户统计信息
async function getUserStats(req, res, next) {
  try {
    // 如果userId是"me"或未提供，使用当前登录用户的ID
    let userId = req.params.userId;
    if (!userId || userId === 'me') {
      userId = req.user.userId;
    }

    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json(errors.notFound('用户不存在'));
    }

    res.json(success({
      totalCheckinDays: user.totalCheckinDays,
      currentStreak: user.currentStreak,
      maxStreak: user.maxStreak,
      totalCompletedPeriods: user.totalCompletedPeriods,
      totalPoints: user.totalPoints,
      level: user.level
    }));
  } catch (error) {
    next(error);
  }
}

// 获取用户列表（管理员）
async function getUserList(req, res, next) {
  try {
    const { page = 1, limit = 20, role, status, search, keyword } = req.query;

    // 支持 search 和 keyword 两个参数名（search 用于前端搜索框，keyword 用于兼容）
    const searchTerm = search || keyword;

    const query = {};
    if (role) query.role = role;
    if (status) query.status = status;
    if (searchTerm) {
      query.$or = [
        { nickname: { $regex: searchTerm, $options: 'i' } },
        { email: { $regex: searchTerm, $options: 'i' } },
        { openid: { $regex: searchTerm, $options: 'i' } }
      ];
    }

    const total = await User.countDocuments(query);
    const users = await User.find(query)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit))
      .select('-__v');

    res.json(success({
      list: users,
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

// 更新用户信息（管理员）
async function updateUser(req, res, next) {
  try {
    const { userId } = req.params;
    const { isActive, status, role } = req.body;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json(errors.notFound('用户不存在'));
    }

    // 只允许管理员修改这些字段
    if (isActive !== undefined) {
      user.status = isActive ? 'active' : 'inactive';
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

    const user = await User.findByIdAndDelete(userId);
    if (!user) {
      return res.status(404).json(errors.notFound('用户不存在'));
    }

    res.json(success({ id: userId }, '用户已删除'));
  } catch (error) {
    next(error);
  }
}

module.exports = {
  getCurrentUser,
  updateProfile,
  getUserStats,
  getUserList,
  updateUser,
  deleteUser
};
