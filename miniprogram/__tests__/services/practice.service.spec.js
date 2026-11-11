jest.mock('../../utils/request');

const request = require('../../utils/request');
const practiceService = require('../../services/practice.service');

describe('practice service', () => {
  beforeEach(() => {
    request.get = jest.fn().mockResolvedValue({});
    request.put = jest.fn().mockResolvedValue({});
  });

  it('getCurrent / getHistory 走 GET', async () => {
    await practiceService.getCurrent('p1');
    expect(request.get).toHaveBeenCalledWith('/practices/period/p1/current', {}, { suppressError: true });
    await practiceService.getHistory('p1');
    expect(request.get).toHaveBeenCalledWith('/practices/period/p1/history');
  });

  it('setCurrent 传 text', async () => {
    await practiceService.setCurrent('p1', '先听完再开口');
    expect(request.put).toHaveBeenCalledWith('/practices/period/p1/current', { text: '先听完再开口' });
  });

  it('logToday 传 done 与 note', async () => {
    await practiceService.logToday('p1', false, '今天太累');
    expect(request.put).toHaveBeenCalledWith('/practices/period/p1/today', { done: false, note: '今天太累' });
  });
});
