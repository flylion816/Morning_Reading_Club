// 租户配置字段契约 + 校验
// apply-tenant.js 在写入任何文件前先过此校验，任一 required 缺失即 process.exit(1)
const RULES = {
  slug:         { required: true,  validate: v => /^[a-z][a-z0-9_-]*$/.test(v) },
  brandName:    { required: true,  validate: v => typeof v === 'string' && v.length > 0 && v.length <= 50 },
  wxAppId:      { required: true,  validate: v => /^wx[0-9a-f]{16}$/i.test(v) },
  cloudEnv:     { required: false },
  primaryColor: { required: true,  validate: v => /^#[0-9a-fA-F]{6}$/.test(v) },
  logo:         { required: true,  validate: v => typeof v === 'string' && v.startsWith('/assets/') },
  navBar:       { required: true,  validate: v => v && v.title && /^#[0-9a-fA-F]{6}$/.test(v.bgColor) && ['white', 'black'].includes(v.textStyle) },
  tabBar:       { required: true,  validate: v => v && v.iconsDir && /^#[0-9a-fA-F]{6}$/.test(v.selectedColor) },
  legalEntity:  { required: true,  validate: v => typeof v === 'string' && v.length > 0 },
  contactEmail: { required: false, validate: v => v == null || /@/.test(v) },
  subscribeTemplates: { required: true, validate: v => v !== null && typeof v === 'object' },
  apiBaseUrl:   { required: false }
};

function validateTenant(cfg) {
  const errors = [];
  for (const [key, rule] of Object.entries(RULES)) {
    const val = cfg[key];
    const missing = val === undefined || val === null || val === '';
    if (rule.required && missing) {
      errors.push(`缺少必填字段: ${key}`);
      continue;
    }
    if (!missing && rule.validate && !rule.validate(val)) {
      errors.push(`字段格式不合法: ${key} = ${JSON.stringify(val)}`);
    }
  }
  return errors;
}

module.exports = { RULES, validateTenant };
