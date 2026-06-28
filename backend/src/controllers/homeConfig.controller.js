const HomeConfig = require('../models/HomeConfig');
const { success, errors } = require('../utils/response');
const { getCurrentTenantId } = require('../utils/tenantContext');
const {
  HOME_SECTION_KEYS,
  getHomeSectionItems,
  normalizeHomeSectionOrder,
  validateHomeSectionOrder
} = require('../constants/homeSections');

function serializeConfig(config) {
  const sections = normalizeHomeSectionOrder(config?.sections || HOME_SECTION_KEYS);
  return {
    sections,
    items: getHomeSectionItems(sections)
  };
}

async function getOrCreateHomeConfig() {
  let config = await HomeConfig.findOne();
  if (!config) {
    config = await HomeConfig.create({
      tenantId: getCurrentTenantId(),
      sections: HOME_SECTION_KEYS
    });
  } else {
    const normalized = normalizeHomeSectionOrder(config.sections);
    if (normalized.join('|') !== (config.sections || []).join('|')) {
      config.sections = normalized;
      await config.save();
    }
  }
  return config;
}

const getPublicHomeConfig = async (req, res) => {
  try {
    const config = await getOrCreateHomeConfig();
    res.json(success(serializeConfig(config)));
  } catch (err) {
    res.status(500).json(errors.serverError(err.message));
  }
};

const getAdminHomeConfig = async (req, res) => {
  try {
    if (!req._resolvedTenantId) {
      return res.status(400).json(errors.badRequest('请先选择租户'));
    }
    const config = await getOrCreateHomeConfig();
    return res.json(success(serializeConfig(config)));
  } catch (err) {
    return res.status(500).json(errors.serverError(err.message));
  }
};

const updateAdminHomeConfig = async (req, res) => {
  try {
    if (!req._resolvedTenantId) {
      return res.status(400).json(errors.badRequest('请先选择租户'));
    }
    const { sections } = req.body;
    const validation = validateHomeSectionOrder(sections);
    if (!validation.valid) {
      return res.status(400).json(errors.badRequest(validation.message));
    }

    const config = await getOrCreateHomeConfig();
    config.sections = sections;
    await config.save();
    return res.json(success(serializeConfig(config), '保存成功'));
  } catch (err) {
    return res.status(500).json(errors.serverError(err.message));
  }
};

module.exports = {
  getPublicHomeConfig,
  getAdminHomeConfig,
  updateAdminHomeConfig
};
