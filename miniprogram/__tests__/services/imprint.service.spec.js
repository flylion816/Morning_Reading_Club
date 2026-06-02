const imprintService = require('../../services/imprint.service');
const request = require('../../utils/request');

jest.mock('../../utils/request');

describe('imprint.service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('list should request paged imprint list', async () => {
    request.get.mockResolvedValue({ list: [] });

    await imprintService.list({ page: 1, pageSize: 10, activityType: 'tea' });

    expect(request.get).toHaveBeenCalledWith('/imprints', {
      page: 1,
      pageSize: 10,
      activityType: 'tea'
    });
  });

  test('create should post imprint payload', async () => {
    const payload = {
      title: '下午茶',
      activityType: 'tea',
      mediaList: [{ type: 'image', url: 'https://example.com/a.jpg' }]
    };
    request.post.mockResolvedValue({ _id: 'imprint_1' });

    await imprintService.create(payload);

    expect(request.post).toHaveBeenCalledWith('/imprints', payload);
  });

  test('update and remove should use imprint id path', async () => {
    request.put.mockResolvedValue({});
    request.delete.mockResolvedValue({});

    await imprintService.update('imprint_1', { title: '新标题' });
    await imprintService.remove('imprint_1');

    expect(request.put).toHaveBeenCalledWith('/imprints/imprint_1', { title: '新标题' });
    expect(request.delete).toHaveBeenCalledWith('/imprints/imprint_1');
  });

  test('reaction, attend and comments should call interaction endpoints', async () => {
    request.post.mockResolvedValue({});
    request.delete.mockResolvedValue({});
    request.get.mockResolvedValue({ list: [] });

    await imprintService.attend('imprint_1');
    await imprintService.cancelAttend('imprint_1');
    await imprintService.react('imprint_1', 'gonming');
    await imprintService.cancelReaction('imprint_1');
    await imprintService.listComments('imprint_1', { page: 1 });
    await imprintService.createComment('imprint_1', { content: '真好' });
    await imprintService.deleteComment('imprint_1', 'comment_1');

    expect(request.post).toHaveBeenCalledWith('/imprints/imprint_1/attend');
    expect(request.delete).toHaveBeenCalledWith('/imprints/imprint_1/attend');
    expect(request.post).toHaveBeenCalledWith('/imprints/imprint_1/reactions', { type: 'gonming' });
    expect(request.delete).toHaveBeenCalledWith('/imprints/imprint_1/reactions');
    expect(request.get).toHaveBeenCalledWith('/imprints/imprint_1/comments', { page: 1 });
    expect(request.post).toHaveBeenCalledWith('/imprints/imprint_1/comments', { content: '真好' });
    expect(request.delete).toHaveBeenCalledWith('/imprints/imprint_1/comments/comment_1');
  });

  test('getActivityTypes should request dynamic activity type list', async () => {
    request.get.mockResolvedValue({ list: [] });

    await imprintService.getActivityTypes();

    expect(request.get).toHaveBeenCalledWith('/imprints/activity-types');
  });
});
