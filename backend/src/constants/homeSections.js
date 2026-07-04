const HOME_SECTION_KEYS = [
  'recentActivities',
  'todayTask',
  'zaichang',
  'myCheckins',
  'xiaofanInsights',
  'insightRequests'
];

const HOME_SECTION_LABELS = {
  recentActivities: '近期活动',
  todayTask: '今日任务',
  zaichang: '凡人生活',
  myCheckins: '我的打卡',
  xiaofanInsights: '小凡看见',
  insightRequests: '请求看见'
};

function normalizeHomeSectionOrder(order, options = {}) {
  const appendMissing = options.appendMissing !== false;
  const input = Array.isArray(order) ? order : [];
  const valid = input
    .map((item) => (typeof item === 'string' ? item : item?.key))
    .filter((key) => HOME_SECTION_KEYS.includes(key));
  const unique = [...new Set(valid)];
  if (!appendMissing) {
    return unique;
  }
  const missing = HOME_SECTION_KEYS.filter((key) => !unique.includes(key));
  return [...unique, ...missing];
}

function normalizeHomeHiddenSections(hiddenSections, order = HOME_SECTION_KEYS) {
  const input = Array.isArray(hiddenSections) ? hiddenSections : [];
  const hiddenSet = new Set(
    input
      .map((item) => (typeof item === 'string' ? item : item?.key))
      .filter((key) => HOME_SECTION_KEYS.includes(key))
  );
  return normalizeHomeSectionOrder(order).filter((key) => hiddenSet.has(key));
}

function validateHomeSectionOrder(order) {
  if (!Array.isArray(order)) {
    return { valid: false, message: 'sections 必须是数组' };
  }

  if (order.length !== HOME_SECTION_KEYS.length) {
    return {
      valid: false,
      message: `sections 必须包含 ${HOME_SECTION_KEYS.length} 个板块`
    };
  }

  const seen = new Set();
  for (const item of order) {
    const key = typeof item === 'string' ? item : item?.key;
    if (!HOME_SECTION_KEYS.includes(key)) {
      return { valid: false, message: `未知板块: ${key}` };
    }
    if (seen.has(key)) {
      return { valid: false, message: `板块重复: ${key}` };
    }
    seen.add(key);
  }

  return { valid: true };
}

function getHomeSectionItems(order, hiddenSections = [], options = {}) {
  const hiddenSet = new Set(normalizeHomeHiddenSections(hiddenSections, order));
  return normalizeHomeSectionOrder(order, options).map((key) => ({
    key,
    label: HOME_SECTION_LABELS[key],
    hidden: hiddenSet.has(key)
  }));
}

module.exports = {
  HOME_SECTION_KEYS,
  HOME_SECTION_LABELS,
  normalizeHomeSectionOrder,
  normalizeHomeHiddenSections,
  validateHomeSectionOrder,
  getHomeSectionItems
};
