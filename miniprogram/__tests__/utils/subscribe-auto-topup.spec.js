jest.mock('../../services/subscribe-message.service', () => ({
  getSettings: jest.fn(),
  saveGrants: jest.fn()
}));

const subscribeMessageService = require('../../services/subscribe-message.service');
const {
  AUTO_TOP_UP_POLICIES,
  buildEligibleScenes,
  mergeAutoTopUpScenes,
  maybeAutoTopUpSubscriptions,
  resetAutoTopUpState
} = require('../../utils/subscribe-auto-topup');

describe('subscribe-auto-topup helper', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resetAutoTopUpState();
    global.wx.getSetting = jest.fn();
    global.wx.requestSubscribeMessage = jest.fn();
  });

  test('mergeAutoTopUpScenes should add missing next_day scene for display', () => {
    const merged = mergeAutoTopUpScenes([
      {
        scene: 'comment_received',
        title: '收到评论',
        templateId: AUTO_TOP_UP_POLICIES.comment_received.templateId,
        availableCount: 12
      }
    ]);

    const sceneKeys = merged.map(item => item.scene);
    expect(sceneKeys).toContain('comment_received');
    expect(sceneKeys).toContain('enrollment_result');
    expect(sceneKeys).toContain('payment_result');
    expect(sceneKeys).toContain('next_day_study_reminder');

    const nextDay = merged.find(item => item.scene === 'next_day_study_reminder');
    expect(nextDay.localOnly).toBe(true);
    expect(nextDay.autoTopUpTarget).toBe(1);
    expect(nextDay.scheduledSendText).toBe('每天 05:45 自动发送');
  });

  test('buildEligibleScenes should respect thresholds and period requirement', () => {
    const scenes = [
      {
        scene: 'comment_received',
        templateId: AUTO_TOP_UP_POLICIES.comment_received.templateId,
        availableCount: 49
      },
      {
        scene: 'like_received',
        templateId: AUTO_TOP_UP_POLICIES.like_received.templateId,
        availableCount: 50
      },
      {
        scene: 'next_day_study_reminder',
        templateId: AUTO_TOP_UP_POLICIES.next_day_study_reminder.templateId,
        availableCount: 0
      }
    ];

    const eligibleWithoutPeriod = buildEligibleScenes(scenes, {
      sceneKeys: ['comment_received', 'like_received', 'next_day_study_reminder']
    });
    expect(eligibleWithoutPeriod.map(item => item.scene)).toEqual(['comment_received']);

    const eligibleWithPeriod = buildEligibleScenes(scenes, {
      sceneKeys: ['comment_received', 'like_received', 'next_day_study_reminder'],
      periodId: 'period_123'
    });
    expect(eligibleWithPeriod.map(item => item.scene)).toEqual([
      'comment_received',
      'next_day_study_reminder'
    ]);
  });

  test('maybeAutoTopUpSubscriptions should only request remembered accept templates', async () => {
    subscribeMessageService.getSettings.mockResolvedValue({
      scenes: [
        {
          scene: 'comment_received',
          templateId: AUTO_TOP_UP_POLICIES.comment_received.templateId,
          availableCount: 0
        },
        {
          scene: 'like_received',
          templateId: AUTO_TOP_UP_POLICIES.like_received.templateId,
          availableCount: 0
        },
        {
          scene: 'next_day_study_reminder',
          templateId: AUTO_TOP_UP_POLICIES.next_day_study_reminder.templateId,
          availableCount: 0
        }
      ]
    });

    global.wx.getSetting.mockImplementation(({ success }) => {
      success({
        subscriptionsSetting: {
          itemSettings: {
            [AUTO_TOP_UP_POLICIES.comment_received.templateId]: 'accept',
            [AUTO_TOP_UP_POLICIES.like_received.templateId]: 'reject',
            [AUTO_TOP_UP_POLICIES.next_day_study_reminder.templateId]: 'accept'
          }
        }
      });
    });

    global.wx.requestSubscribeMessage.mockImplementation(({ tmplIds, success }) => {
      success(
        tmplIds.reduce((result, templateId) => {
          result[templateId] = 'accept';
          return result;
        }, {})
      );
    });

    subscribeMessageService.saveGrants.mockResolvedValue({
      scenes: []
    });

    const result = await maybeAutoTopUpSubscriptions({
      periodId: 'period_001',
      sceneKeys: ['comment_received', 'like_received', 'next_day_study_reminder']
    });

    expect(result.skipped).toBe(false);
    expect(global.wx.requestSubscribeMessage).toHaveBeenCalledTimes(1);
    expect(global.wx.requestSubscribeMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        tmplIds: [
          AUTO_TOP_UP_POLICIES.comment_received.templateId,
          AUTO_TOP_UP_POLICIES.next_day_study_reminder.templateId
        ]
      })
    );
    expect(subscribeMessageService.saveGrants).toHaveBeenCalledWith([
      {
        scene: 'comment_received',
        templateId: AUTO_TOP_UP_POLICIES.comment_received.templateId,
        result: 'accept',
        context: {
          periodId: 'period_001',
          sourceAction: '',
          sourcePage: '',
          sectionId: null,
          courseId: null
        }
      },
      {
        scene: 'next_day_study_reminder',
        templateId: AUTO_TOP_UP_POLICIES.next_day_study_reminder.templateId,
        result: 'accept',
        context: {
          periodId: 'period_001',
          sourceAction: '',
          sourcePage: '',
          sectionId: null,
          courseId: null
        }
      }
    ]);
  });

  test('maybeAutoTopUpSubscriptions should not request next_day without periodId', async () => {
    subscribeMessageService.getSettings.mockResolvedValue({
      scenes: [
        {
          scene: 'comment_received',
          templateId: AUTO_TOP_UP_POLICIES.comment_received.templateId,
          availableCount: 0
        },
        {
          scene: 'next_day_study_reminder',
          templateId: AUTO_TOP_UP_POLICIES.next_day_study_reminder.templateId,
          availableCount: 0
        }
      ]
    });

    global.wx.getSetting.mockImplementation(({ success }) => {
      success({
        subscriptionsSetting: {
          itemSettings: {
            [AUTO_TOP_UP_POLICIES.comment_received.templateId]: 'accept',
            [AUTO_TOP_UP_POLICIES.next_day_study_reminder.templateId]: 'accept'
          }
        }
      });
    });

    global.wx.requestSubscribeMessage.mockImplementation(({ tmplIds, success }) => {
      success(
        tmplIds.reduce((result, templateId) => {
          result[templateId] = 'accept';
          return result;
        }, {})
      );
    });

    subscribeMessageService.saveGrants.mockResolvedValue({
      scenes: []
    });

    await maybeAutoTopUpSubscriptions({
      sceneKeys: ['comment_received', 'next_day_study_reminder']
    });

    expect(global.wx.requestSubscribeMessage).toHaveBeenCalledTimes(1);
    expect(global.wx.requestSubscribeMessage.mock.calls[0][0].tmplIds).toEqual([
      AUTO_TOP_UP_POLICIES.comment_received.templateId
    ]);
  });

  test('maybeAutoTopUpSubscriptions should request scenes even without remembered accept in direct prompt mode', async () => {
    global.wx.getSetting.mockImplementation(({ success }) => {
      success({
        subscriptionsSetting: {
          itemSettings: {}
        }
      });
    });

    global.wx.requestSubscribeMessage.mockImplementation(({ tmplIds, success }) => {
      success(
        tmplIds.reduce((result, templateId) => {
          result[templateId] = 'accept';
          return result;
        }, {})
      );
    });

    subscribeMessageService.saveGrants.mockResolvedValue({
      scenes: []
    });

    const result = await maybeAutoTopUpSubscriptions({
      sceneKeys: ['enrollment_result', 'payment_result'],
      requestMode: 'any'
    });

    expect(result.skipped).toBe(false);
    expect(subscribeMessageService.getSettings).not.toHaveBeenCalled();
    expect(global.wx.getSetting).toHaveBeenCalledTimes(1);
    expect(global.wx.requestSubscribeMessage).toHaveBeenCalledTimes(1);
    expect(global.wx.requestSubscribeMessage.mock.calls[0][0].tmplIds).toEqual([
      AUTO_TOP_UP_POLICIES.enrollment_result.templateId,
      AUTO_TOP_UP_POLICIES.payment_result.templateId
    ]);
  });
});
