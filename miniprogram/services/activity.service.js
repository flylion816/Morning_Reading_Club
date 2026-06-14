const request = require('../utils/request');
const logger = require('../utils/logger');
const constants = require('../config/constants');
const { tenantStorage } = require('../utils/storage');

class ActivityService {
  track(action, data = {}) {
    const token = tenantStorage.get(constants.STORAGE_KEYS.TOKEN);
    if (!token) {
      return Promise.resolve();
    }

    return request
      .post(
        '/activities',
        {
          action,
          targetType: data.targetType || null,
          targetId: data.targetId || null,
          periodId: data.periodId || null,
          sectionId: data.sectionId || null,
          metadata: data.metadata || {}
        },
        { showLoading: false, suppressAuthError: true }
      )
      .catch((error) => {
        logger.warn('用户行为上报失败:', { action, error });
      });
  }
}

module.exports = new ActivityService();
