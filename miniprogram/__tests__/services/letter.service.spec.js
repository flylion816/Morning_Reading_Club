const letterService = require('../../services/letter.service');
const request = require('../../utils/request');

jest.mock('../../utils/request');

describe('letter service', () => {
  beforeEach(() => jest.clearAllMocks());

  test('getPeriodLetter / saveDraft / seal', async () => {
    request.get.mockResolvedValue({ status: 'none' });
    request.put.mockResolvedValue({});
    request.post.mockResolvedValue({});
    await letterService.getPeriodLetter('p1');
    await letterService.saveDraft('p1', { content: 'hi', stamp: 'leaf' });
    await letterService.seal('p1');
    expect(request.get).toHaveBeenCalledWith('/letters/period/p1', {}, { suppressError: true });
    expect(request.put).toHaveBeenCalledWith('/letters/period/p1/draft', { content: 'hi', stamp: 'leaf' });
    expect(request.post).toHaveBeenCalledWith('/letters/period/p1/seal');
  });

  test('open / reply / getMine', async () => {
    request.get.mockResolvedValue({ list: [] });
    request.post.mockResolvedValue({});
    await letterService.open('l1');
    await letterService.reply('l1', '谢谢');
    await letterService.getMine();
    expect(request.post).toHaveBeenCalledWith('/letters/l1/open');
    expect(request.post).toHaveBeenCalledWith('/letters/l1/reply', { reply: '谢谢' });
    expect(request.get).toHaveBeenCalledWith('/letters/mine');
  });
});
