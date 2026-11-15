const buddyService = require('../../services/buddy.service');
const request = require('../../utils/request');

jest.mock('../../utils/request');

describe('buddy.service', () => {
  beforeEach(() => jest.clearAllMocks());

  test('getState 读取某一期的读伴状态', async () => {
    request.get.mockResolvedValue({ state: 'none' });
    await buddyService.getState('p1');
    expect(request.get).toHaveBeenCalledWith('/buddies/period/p1', {}, { suppressError: true });
  });

  test('join / cancel / nudge / leave 走对应的接口', async () => {
    request.post.mockResolvedValue({});
    await buddyService.join('p1');
    await buddyService.cancel('p1');
    await buddyService.nudge('p1');
    await buddyService.leave('p1');
    expect(request.post.mock.calls.map(c => c[0])).toEqual([
      '/buddies/period/p1/join',
      '/buddies/period/p1/cancel',
      '/buddies/period/p1/nudge',
      '/buddies/period/p1/leave'
    ]);
  });
  test('击掌、送一句、纪念、续伴走对应的接口，送一句带上 messageKey', async () => {
    request.post.mockResolvedValue({});
    request.get.mockResolvedValue({});
    await buddyService.highFive('p1');
    await buddyService.gift('p1', 'noRush');
    await buddyService.rematch('p1');
    await buddyService.getSouvenir('p1');
    expect(request.post.mock.calls).toEqual([
      ['/buddies/period/p1/highfive'],
      ['/buddies/period/p1/gift', { messageKey: 'noRush' }],
      ['/buddies/period/p1/rematch']
    ]);
    expect(request.get).toHaveBeenCalledWith('/buddies/period/p1/souvenir', {}, { suppressError: true });
  });
});
