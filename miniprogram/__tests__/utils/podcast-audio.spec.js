const {
  createPodcastAudioContext,
  setPodcastAudioSource,
  stopPodcastAudio
} = require('../../utils/podcast-audio');

describe('podcast audio utils', () => {
  afterEach(() => {
    delete global.wx.getBackgroundAudioManager;
  });

  test('should create and start background audio with metadata', () => {
    const ctx = {
      offCanplay: jest.fn(),
      offPlay: jest.fn(),
      offPause: jest.fn(),
      offStop: jest.fn(),
      offEnded: jest.fn(),
      offTimeUpdate: jest.fn(),
      offError: jest.fn(),
      play: jest.fn(),
      stop: jest.fn()
    };
    global.wx.getBackgroundAudioManager = jest.fn(() => ctx);

    const audio = createPodcastAudioContext({
      title: '第七天播客',
      coverUrl: 'https://example.com/cover.jpg'
    });
    setPodcastAudioSource(audio, 'https://example.com/podcast.mp3');

    expect(global.wx.getBackgroundAudioManager).toHaveBeenCalled();
    expect(ctx.offPlay).toHaveBeenCalled();
    expect(ctx.title).toBe('第七天播客');
    expect(ctx.epname).toBe('第七天播客');
    expect(ctx.singer).toBe('凡人共读');
    expect(ctx.coverImgUrl).toBe('https://example.com/cover.jpg');
    expect(ctx.src).toBe('https://example.com/podcast.mp3');
    expect(ctx.play).toHaveBeenCalled();
  });

  test('should stop audio without requiring destroy', () => {
    const ctx = {
      stop: jest.fn()
    };

    stopPodcastAudio(ctx);

    expect(ctx.stop).toHaveBeenCalled();
  });
});
