const Tenant = require('../models/Tenant');
const { success, errors } = require('../utils/response');
const { withSystemContext } = require('../utils/tenantContext');

const BRANDING_FIELDS = [
  'logo',
  'shareCover',
  'primaryColor',
  'brandName',
  'navBarBgColor',
  'navBarTextStyle',
  'tabBarColor',
  'tabBarSelectedColor',
  'tabBarBackgroundColor'
];

/**
 * 列出所有租户（platform_superadmin / superadmin）
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
 * 创建租户（platform_superadmin / superadmin）
 */
exports.createTenant = async (req, res) => {
  try {
    if (req.admin.role !== 'platform_superadmin' && req.admin.role !== 'superadmin') {
      return res.status(403).json(errors.forbidden('仅平台管理员可访问'));
    }
    const {
      slug,
      name,
      description,
      status,
      wxAppIds,
      wechatLogin,
      wechatPay,
      cloudEnv,
      subscribeTemplates,
      branding,
      legalEntity,
      contactEmail,
      apiBaseUrl
    } = req.body;
    if (!slug || !name) {
      return res.status(400).json(errors.badRequest('slug 和 name 必填'));
    }
    const tenant = await withSystemContext(null, () =>
      Tenant.create({
        slug,
        name,
        description,
        status: status || 'active',
        wxAppIds: wxAppIds || [],
        wechatLogin: wechatLogin || {},
        wechatPay: wechatPay || {},
        cloudEnv: cloudEnv || null,
        subscribeTemplates: subscribeTemplates || {},
        branding: branding || {},
        legalEntity: legalEntity || null,
        contactEmail: contactEmail || null,
        apiBaseUrl: apiBaseUrl || null
      })
    );
    return res.json(success(tenant, '租户创建成功'));
  } catch (error) {
    return res.status(500).json(errors.serverError('创建租户失败'));
  }
};

/**
 * 更新租户（platform_superadmin / superadmin）
 */
exports.updateTenant = async (req, res) => {
  try {
    if (req.admin.role !== 'platform_superadmin' && req.admin.role !== 'superadmin') {
      return res.status(403).json(errors.forbidden('仅平台管理员可访问'));
    }
    const { tenantId } = req.params;
    const {
      name,
      description,
      status,
      wxAppIds,
      wechatLogin,
      wechatPay,
      cloudEnv,
      subscribeTemplates,
      branding,
      legalEntity,
      contactEmail,
      apiBaseUrl
    } = req.body;
    const updates = {};
    if (name !== undefined) updates.name = name;
    if (description !== undefined) updates.description = description;
    if (status !== undefined) updates.status = status;
    if (wxAppIds !== undefined) updates.wxAppIds = wxAppIds;
    if (cloudEnv !== undefined) updates.cloudEnv = cloudEnv || null;
    if (subscribeTemplates !== undefined) updates.subscribeTemplates = subscribeTemplates || {};
    if (branding !== undefined) {
      BRANDING_FIELDS.forEach(key => {
        if (branding[key] !== undefined) updates[`branding.${key}`] = branding[key] || null;
      });
    }
    if (legalEntity !== undefined) updates.legalEntity = legalEntity || null;
    if (contactEmail !== undefined) updates.contactEmail = contactEmail || null;
    if (apiBaseUrl !== undefined) updates.apiBaseUrl = apiBaseUrl || null;

    if (wechatLogin !== undefined) {
      if (wechatLogin.appId !== undefined) updates['wechatLogin.appId'] = wechatLogin.appId || null;
      if (wechatLogin.appSecret) updates['wechatLogin.appSecret'] = wechatLogin.appSecret;
    }
    if (wechatPay !== undefined) {
      if (wechatPay.appId !== undefined) updates['wechatPay.appId'] = wechatPay.appId || null;
      if (wechatPay.mchId !== undefined) updates['wechatPay.mchId'] = wechatPay.mchId || null;
      if (wechatPay.notifyUrl !== undefined) updates['wechatPay.notifyUrl'] = wechatPay.notifyUrl || null;
      if (wechatPay.apiKey) updates['wechatPay.apiKey'] = wechatPay.apiKey;
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
    if (req.admin.role === 'platform_superadmin' || req.admin.role === 'superadmin') {
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
