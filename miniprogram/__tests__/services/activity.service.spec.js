const request = require('../../utils/request');
const activityService = require('../../services/activity.service');
const constants = require('../../config/constants');
const { tenantStorage } = require('../../utils/storage');

jest.mock('../../utils/request');

describe('Activity Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    global.wx.__storage = {};
  });

  test('should skip tracking when token is missing', async () => {
    await activityService.track('app_open');

    expect(request.post).not.toHaveBeenCalled();
  });

  test('should send tracking request with silent auth error handling', async () => {
    tenantStorage.set(constants.STORAGE_KEYS.TOKEN, 'token_123');
    request.post.mockResolvedValue({});

    await activityService.track('app_open', {
      targetType: 'app',
      metadata: { scene: 1001 }
    });

    expect(request.post).toHaveBeenCalledWith(
      '/activities',
      {
        action: 'app_open',
        targetType: 'app',
        targetId: null,
        periodId: null,
        sectionId: null,
        metadata: { scene: 1001 }
      },
      { showLoading: false, suppressAuthError: true }
    );
  });
});
