const jwt = require('jsonwebtoken');
const Admin = require('../models/Admin');
const { success, errors } = require('../utils/response');
const logger = require('../utils/logger');
require('dotenv').config();

// 生成 JWT Token
function generateToken(admin) {
  return jwt.sign(
    {
      id: admin._id,
      email: admin.email,
      role: admin.role
    },
    process.env.JWT_SECRET || 'dev-secret-key-12345678',
    { expiresIn: process.env.JWT_EXPIRES_IN || '2h' }
  );
}

// 管理员登录
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    // 验证邮箱和密码是否提供
    if (!email || !password) {
      return res.status(400).json(errors.badRequest('邮箱和密码不能为空'));
    }

    // 查询管理员（包括密码字段用于验证）
    const admin = await Admin.findOne({ email }).select('+password');

    // 验证管理员是否存在
    if (!admin) {
      return res.status(401).json(errors.unauthorized('邮箱或密码错误'));
    }

    // 验证管理员状态
    if (admin.status !== 'active') {
      return res.status(403).json(errors.forbidden('账户已被禁用'));
    }

    // 验证密码
    const isPasswordValid = await admin.comparePassword(password);
    if (!isPasswordValid) {
      return res.status(401).json(errors.unauthorized('邮箱或密码错误'));
    }

    // 更新最后登录时间和登录次数
    admin.lastLoginAt = new Date();
    admin.loginCount = (admin.loginCount || 0) + 1;
    await admin.save();

    // 生成 Token
    const token = generateToken(admin);

    // 返回成功响应
    const adminData = admin.toJSON();
    return res.json(
      success(
        {
          token,
          admin: adminData
        },
        '登录成功'
      )
    );
  } catch (error) {
    logger.error('Admin login error', error);
    return res.status(500).json(errors.internal('登录失败'));
  }
};

// 获取当前管理员信息
exports.getProfile = async (req, res) => {
  try {
    // req.admin 由 adminAuthMiddleware 设置
    const admin = await Admin.findById(req.admin.id);

    if (!admin) {
      return res.status(404).json(errors.notFound('管理员不存在'));
    }

    return res.json(success(admin.toJSON()));
  } catch (error) {
    logger.error('Get admin profile error', error);
    return res.status(500).json(errors.internal('获取用户信息失败'));
  }
};

// 管理员登出
exports.logout = async (req, res) => {
  try {
    // 在客户端删除 token，这里只需返回成功消息
    return res.json(success(null, '已登出'));
  } catch (error) {
    logger.error('Admin logout error', error);
    return res.status(500).json(errors.internal('登出失败'));
  }
};

// 刷新 Token
exports.refreshToken = async (req, res) => {
  try {
    const admin = await Admin.findById(req.admin.id);

    if (!admin) {
      return res.status(404).json(errors.notFound('管理员不存在'));
    }

    if (admin.status !== 'active') {
      return res.status(403).json(errors.forbidden('账户已被禁用'));
    }

    const accessToken = generateToken(admin);

    return res.json(success({ accessToken }, 'Token 已刷新'));
  } catch (error) {
    logger.error('Refresh token error', error);
    return res.status(500).json(errors.internal('Token 刷新失败'));
  }
};

// 获取所有管理员（超级管理员权限）
exports.getAdmins = async (req, res) => {
  try {
    const { page = 1, limit = 10, role, status } = req.query;

    const filter = {};
    if (role) filter.role = role;
    if (status) filter.status = status;

    const skip = (page - 1) * limit;
    const admins = await Admin.find(filter)
      .skip(skip)
      .limit(parseInt(limit, 10))
      .sort({ createdAt: -1 });

    const total = await Admin.countDocuments(filter);

    return res.json(
      success({
        list: admins.map(admin => admin.toJSON()),
        total,
        page: parseInt(page, 10),
        limit: parseInt(limit, 10)
      })
    );
  } catch (error) {
    logger.error('Get admins error', error);
    return res.status(500).json(errors.internal('获取管理员列表失败'));
  }
};

// 创建新管理员（超级管理员权限）
exports.createAdmin = async (req, res) => {
  try {
    const { name, email, password, role = 'operator', permissions = [] } = req.body;

    // 验证必填字段
    if (!name || !email || !password) {
      return res.status(400).json(errors.badRequest('姓名、邮箱和密码不能为空'));
    }

    // 检查邮箱是否已存在
    const existingAdmin = await Admin.findOne({ email });
    if (existingAdmin) {
      return res.status(400).json(errors.badRequest('该邮箱已被使用'));
    }

    // 创建新管理员
    const newAdmin = new Admin({
      name,
      email,
      password,
      role,
      permissions,
      status: 'active'
    });

    await newAdmin.save();

    return res.json(success(newAdmin.toJSON(), '管理员创建成功'));
  } catch (error) {
    logger.error('Create admin error', error);
    return res.status(500).json(errors.internal('创建管理员失败'));
  }
};

// 修改管理员信息
exports.updateAdmin = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, role, permissions, status } = req.body;

    const admin = await Admin.findById(id);
    if (!admin) {
      return res.status(404).json(errors.notFound('管理员不存在'));
    }

    // 只允许超级管理员修改角色
    if (role && req.admin.role !== 'superadmin') {
      return res.status(403).json(errors.forbidden('没有权限修改角色'));
    }

    // 更新可修改的字段
    if (name) admin.name = name;
    if (role && req.admin.role === 'superadmin') admin.role = role;
    if (permissions && req.admin.role === 'superadmin') admin.permissions = permissions;
    if (status && req.admin.role === 'superadmin') admin.status = status;

    await admin.save();

    return res.json(success(admin.toJSON(), '管理员信息已更新'));
  } catch (error) {
    logger.error('Update admin error', error);
    return res.status(500).json(errors.internal('更新管理员失败'));
  }
};

// 修改密码
exports.changePassword = async (req, res) => {
  try {
    const { oldPassword, newPassword } = req.body;

    if (!oldPassword || !newPassword) {
      return res.status(400).json(errors.badRequest('原密码和新密码不能为空'));
    }

    if (newPassword.length < 6) {
      return res.status(400).json(errors.badRequest('新密码长度不能少于6位'));
    }

    const admin = await Admin.findById(req.admin.id).select('+password');

    // 验证原密码
    const isPasswordValid = await admin.comparePassword(oldPassword);
    if (!isPasswordValid) {
      return res.status(401).json(errors.unauthorized('原密码错误'));
    }

    // 更新新密码
    admin.password = newPassword;
    await admin.save();

    return res.json(success(null, '密码已修改'));
  } catch (error) {
    logger.error('Change password error', error);
    return res.status(500).json(errors.internal('修改密码失败'));
  }
};

// 删除管理员
exports.deleteAdmin = async (req, res) => {
  try {
    const { id } = req.params;

    // 不能删除自己
    if (id === req.admin.id.toString()) {
      return res.status(400).json(errors.badRequest('不能删除自己'));
    }

    const admin = await Admin.findByIdAndDelete(id);

    if (!admin) {
      return res.status(404).json(errors.notFound('管理员不存在'));
    }

    return res.json(success(null, '管理员已删除'));
  } catch (error) {
    logger.error('Delete admin error', error);
    return res.status(500).json(errors.internal('删除管理员失败'));
  }
};

// 初始化超级管理员（仅在第一次运行时使用）
exports.initSuperAdmin = async (req, res) => {
  try {
    // 检查是否已存在管理员
    const existingAdmin = await Admin.findOne();

    if (existingAdmin) {
      return res.status(400).json(errors.badRequest('已存在管理员，无需初始化'));
    }

    const superAdmin = new Admin({
      name: 'SuperAdmin',
      email: 'admin@morningreading.com',
      password: 'admin123456',
      role: 'superadmin',
      status: 'active'
    });

    await superAdmin.save();

    return res.json(
      success({
        email: superAdmin.email,
        message: '超级管理员已创建'
      })
    );
  } catch (error) {
    logger.error('Init super admin error', error);
    return res.status(500).json(errors.internal('初始化超级管理员失败'));
  }
};
