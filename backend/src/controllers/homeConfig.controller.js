const HomeConfig = require('../models/HomeConfig');
const { success, errors } = require('../utils/response');
const { getCurrentTenantId } = require('../utils/tenantContext');
const {
  HOME_SECTION_KEYS,
  getHomeSectionItems,
  normalizeHomeHiddenSections,
  normalizeHomeSectionOrder,
  validateHomeSectionOrder
} = require('../constants/homeSections');

function serializeConfig(config, options = {}) {
  const includeHidden = options.includeHidden === true;
  const sections = normalizeHomeSectionOrder(config?.sections || HOME_SECTION_KEYS);
  const hiddenSections = normalizeHomeHiddenSections(
    config?.hiddenSections || [],
    sections
  );
  const visibleSections = includeHidden
    ? sections
    : sections.filter((key) => !hiddenSections.includes(key));
  const payload = {
    sections: visibleSections,
    items: getHomeSectionItems(
      visibleSections,
      includeHidden ? hiddenSections : [],
      { appendMissing: includeHidden }
    )
  };

  if (includeHidden) {
    payload.hiddenSections = hiddenSections;
  }

  return payload;
}

function getHiddenSectionsFromPayload(sections, hiddenSections) {
  if (Array.isArray(sections) && sections.some((item) => typeof item === 'object')) {
    return sections
      .filter((item) => item && typeof item === 'object' && item.hidden === true)
      .map((item) => item.key);
  }

  return hiddenSections;
}

async function persistNormalizedConfig(config) {
  const normalizedSections = normalizeHomeSectionOrder(
    config.sections || HOME_SECTION_KEYS
  );
  const normalizedHiddenSections = normalizeHomeHiddenSections(
    config.hiddenSections || [],
    normalizedSections
  );

  const sectionsChanged =
    normalizedSections.join('|') !== (config.sections || []).join('|');
  const hiddenChanged =
    normalizedHiddenSections.join('|') !== (config.hiddenSections || []).join('|');

  if (sectionsChanged || hiddenChanged) {
    config.sections = normalizedSections;
    config.hiddenSections = normalizedHiddenSections;
    await config.save();
  }

  return {
    config,
    sections: normalizedSections,
    hiddenSections: normalizedHiddenSections
  };
}

async function getOrCreateHomeConfig() {
  let config = await HomeConfig.findOne();
  if (!config) {
    config = await HomeConfig.create({
      tenantId: getCurrentTenantId(),
      sections: HOME_SECTION_KEYS,
      hiddenSections: []
    });
  } else {
    await persistNormalizedConfig(config);
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
    return res.json(success(serializeConfig(config, { includeHidden: true })));
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
    const normalizedSections = normalizeHomeSectionOrder(sections);
    config.sections = normalizedSections;
    config.hiddenSections = normalizeHomeHiddenSections(
      getHiddenSectionsFromPayload(sections, req.body.hiddenSections),
      normalizedSections
    );
    await config.save();
    return res.json(
      success(serializeConfig(config, { includeHidden: true }), '保存成功')
    );
  } catch (err) {
    return res.status(500).json(errors.serverError(err.message));
  }
};

module.exports = {
  getPublicHomeConfig,
  getAdminHomeConfig,
  updateAdminHomeConfig
};
