const MODULE_TYPES = new Set(['shortText', 'text', 'body', 'image']);
const MAX_MODULES = 20;
const MAX_NAME_LENGTH = 30;
const MODULE_ID_PATTERN = /^[a-zA-Z0-9_-]{1,64}$/;
const EXTENSION_KEYS = ['duration', 'closingVideo', 'podcast'];

/**
 * Validate a template before it is persisted. Module IDs, unlike labels, are
 * stable keys used to associate existing course values with their definitions.
 */
function validateCourseTemplate(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return '模板格式无效';
  }
  if (typeof input.name !== 'string' || !input.name.trim() || input.name.trim().length > MAX_NAME_LENGTH) {
    return `模板名称须为1至${MAX_NAME_LENGTH}个字符`;
  }
  if (!Array.isArray(input.modules) || input.modules.length < 1 || input.modules.length > MAX_MODULES) {
    return `模板须包含1至${MAX_MODULES}个模块`;
  }

  const ids = new Set();
  let bodyCount = 0;
  for (const module of input.modules) {
    if (!module || typeof module !== 'object' || Array.isArray(module)) return '模块格式无效';
    if (
      typeof module.id !== 'string' ||
      !MODULE_ID_PATTERN.test(module.id) ||
      ['__proto__', 'prototype', 'constructor'].includes(module.id)
    ) return '模块标识无效';
    if (ids.has(module.id)) return '模块标识不能重复';
    ids.add(module.id);
    if (typeof module.name !== 'string' || !module.name.trim() || module.name.trim().length > MAX_NAME_LENGTH) {
      return `模块名称须为1至${MAX_NAME_LENGTH}个字符`;
    }
    if (!MODULE_TYPES.has(module.type)) return '模块类型无效';
    if (module.type === 'body') bodyCount += 1;
  }
  if (bodyCount > 1) return '正文模块最多一个';
  if (input.extensions !== undefined) {
    if (!input.extensions || typeof input.extensions !== 'object' || Array.isArray(input.extensions)) return '扩展能力配置无效';
    for (const key of Object.keys(input.extensions)) {
      if (!EXTENSION_KEYS.includes(key) || typeof input.extensions[key] !== 'boolean') return '扩展能力配置无效';
    }
  }
  return null;
}

module.exports = { validateCourseTemplate, MAX_MODULES, MAX_NAME_LENGTH, EXTENSION_KEYS };
