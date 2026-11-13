jest.mock('../../utils/request', () => ({ get: jest.fn(() => Promise.resolve({ ready: true })) }));

const request = require('../../utils/request');
const keepsakeService = require('../../pages/keepsake/keepsake.service');

describe('keepsake.service', () => {
  it('getPeriodKeepsake 请求对应期次的纪念册', async () => {
    const data = await keepsakeService.getPeriodKeepsake('p1');
    expect(request.get).toHaveBeenCalledWith('/keepsakes/period/p1', {}, { suppressError: true });
    expect(data.ready).toBe(true);
  });
});
