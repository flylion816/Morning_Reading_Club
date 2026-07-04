jest.mock('../../services/communityActivity.service', () => ({
  getMyActivities: jest.fn()
}));

describe('my community activities page', () => {
  let pageConfig;
  let pageInstance;
  let service;

  beforeEach(() => {
    jest.resetModules();
    pageConfig = null;
    global.Page = jest.fn((config) => {
      pageConfig = config;
      return config;
    });
    service = require('../../services/communityActivity.service');
    service.getMyActivities.mockResolvedValue({
      list: [{
        _id: 'activity_1',
        registrationId: 'reg_1',
        title: '晨光之约',
        startTime: '2026-07-10T06:00:00.000Z',
        status: 'published',
        paymentStatus: 'free',
        formSubmitted: true,
        formAnswers: [
          { fieldId: 'city', label: '城市', value: 'sh', valueText: '上海' }
        ]
      }]
    });

    require('../../pages/my-community-activities/my-community-activities');
    pageInstance = {
      ...pageConfig,
      data: JSON.parse(JSON.stringify(pageConfig.data)),
      setData(update) {
        this.data = { ...this.data, ...update };
      }
    };
  });

  afterEach(() => {
    delete global.Page;
  });

  test('loads submitted registration details and opens detail sheet', async () => {
    await pageInstance.loadMyActivities.call(pageInstance);

    expect(pageInstance.data.activities[0].registrationStatusText).toBe('报名信息已提交');
    expect(pageInstance.data.activities[0].formAnswers[0].displayValue).toBe('上海');

    pageInstance.handleShowRegistrationDetail.call(pageInstance, {
      currentTarget: { dataset: { registrationId: 'reg_1' } }
    });

    expect(pageInstance.data.showRegistrationDetail).toBe(true);
    expect(pageInstance.data.selectedActivity.title).toBe('晨光之约');
  });
});
