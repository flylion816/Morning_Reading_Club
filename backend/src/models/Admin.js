const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const adminSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true
    },
    password: {
      type: String,
      required: true,
      minlength: 6,
      select: false // 默认不返回密码字段
    },
    avatar: {
      type: String,
      default: null
    },
    role: {
      type: String,
      enum: ['superadmin', 'admin', 'operator'],
      default: 'operator'
    },
    permissions: {
      type: [String],
      default: []
    },
    status: {
      type: String,
      enum: ['active', 'inactive'],
      default: 'active'
    },
    lastLoginAt: {
      type: Date,
      default: null
    },
    loginCount: {
      type: Number,
      default: 0
    }
  },
  {
    timestamps: true
  }
);

// 密码保存前加密
adminSchema.pre('save', async function (next) {
  if (!this.isModified('password')) {
    return next();
  }

  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// 比较密码方法
adminSchema.methods.comparePassword = async function (password) {
  return bcrypt.compare(password, this.password);
};

// 获取公开信息（不包含敏感数据）
adminSchema.methods.toJSON = function () {
  const obj = this.toObject();
  delete obj.password;
  return obj;
};

// 创建索引
adminSchema.index({ email: 1 });
adminSchema.index({ status: 1 });
adminSchema.index({ createdAt: -1 });

module.exports = mongoose.model('Admin', adminSchema);
