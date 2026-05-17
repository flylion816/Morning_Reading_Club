const Tenant = require('../models/Tenant');
const { success, errors } = require('../utils/response');
const { withSystemContext } = require('../utils/tenantContext');

/**
 * 列出所有租户（仅 platform_superadmin）
 */
exports.listTenants = async (req, res) => {
  try {
    if (req.admin.role !== 'platform_superadmin' && req.admin.role !== 'superadmin') {
      return res.status(403).json(errors.forbidden('仅平台管理员可访问'));
    }
    const tenants = await withSystemContext(null, () =>
      Tenant.find().sort({ createdAt: -1 }).lean()
    );
    return res.json(success(tenants));
  } catch (error) {
    return res.status(500).json(errors.serverError('获取租户列表失败'));
  }
};

/**
 * 创建租户（仅 platform_superadmin）
 */
exports.createTenant = async (req, res) => {
  try {
    if (req.admin.role !== 'platform_superadmin' && req.admin.role !== 'superadmin') {
      return res.status(403).json(errors.forbidden('仅平台管理员可访问'));
    }
    const { slug, name, description, wxAppIds, wechatLogin, wechatPay, branding } = req.body;
    if (!slug || !name) {
      return res.status(400).json(errors.badRequest('slug 和 name 必填'));
    }
    const tenant = await withSystemContext(null, () =>
      Tenant.create({
        slug,
        name,
        description,
        wxAppIds: wxAppIds || [],
        wechatLogin: wechatLogin || {},
        wechatPay: wechatPay || {},
        branding: branding || {}
      })
    );
    return res.json(success(tenant, '租户创建成功'));
  } catch (error) {
    return res.status(500).json(errors.serverError('创建租户失败'));
  }
};

/**
 * 更新租户（仅 platform_superadmin）
 */
exports.updateTenant = async (req, res) => {
  try {
    if (req.admin.role !== 'platform_superadmin' && req.admin.role !== 'superadmin') {
      return res.status(403).json(errors.forbidden('仅平台管理员可访问'));
    }
    const { tenantId } = req.params;
    const updates = { ...req.body };
    delete updates._id;
    delete updates.slug; // slug 不允许修改（数据隔离键）

    // Secret 字段空值语义：空字符串 = 不修改
    if (updates.wechatLogin?.appSecret === '') delete updates['wechatLogin.appSecret'];
    if (updates.wechatPay?.apiKey === '') delete updates['wechatPay.apiKey'];
    if (updates.wechatLogin && updates.wechatLogin.appSecret === '') {
      delete updates.wechatLogin.appSecret;
    }
    if (updates.wechatPay && updates.wechatPay.apiKey === '') {
      delete updates.wechatPay.apiKey;
    }

    const tenant = await withSystemContext(null, () =>
      Tenant.findByIdAndUpdate(tenantId, updates, { new: true })
    );
    if (!tenant) return res.status(404).json(errors.notFound('租户不存在'));
    return res.json(success(tenant, '更新成功'));
  } catch (error) {
    return res.status(500).json(errors.serverError('更新租户失败'));
  }
};

/**
 * 当前管理员所属租户信息
 */
exports.getCurrentTenant = async (req, res) => {
  try {
    if (req.admin.role === 'platform_superadmin') {
      const activeTenant = req.header('X-Active-Tenant');
      if (!activeTenant) return res.json(success(null));
      const tenant = await withSystemContext(null, () => Tenant.findById(activeTenant).lean());
      return res.json(success(tenant));
    }
    if (!req.admin.tenantId) {
      return res.status(403).json(errors.forbidden('管理员未绑定租户'));
    }
    const tenant = await withSystemContext(null, () => Tenant.findById(req.admin.tenantId).lean());
    return res.json(success(tenant));
  } catch (error) {
    return res.status(500).json(errors.serverError('获取租户信息失败'));
  }
};
