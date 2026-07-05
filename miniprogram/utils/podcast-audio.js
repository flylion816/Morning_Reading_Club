const { getBrandName } = require('./brand');

function stopPodcastAudio(ctx) {
  if (!ctx) return;
  if (typeof ctx.stop === 'function') {
    ctx.stop();
  }
  if (typeof ctx.destroy === 'function') {
    ctx.destroy();
  }
}

function resetPodcastAudioListeners(ctx) {
  if (!ctx) return;
  [
    'offCanplay',
    'offPlay',
    'offPause',
    'offStop',
    'offEnded',
    'offTimeUpdate',
    'offError'
  ].forEach(method => {
    if (typeof ctx[method] === 'function') {
      ctx[method]();
    }
  });
}

function createPodcastAudioContext({ title = '凡人播客', description = '', coverUrl = '' } = {}) {
  const useBackgroundAudio = typeof wx.getBackgroundAudioManager === 'function';
  const ctx = useBackgroundAudio
    ? wx.getBackgroundAudioManager()
    : wx.createInnerAudioContext();

  resetPodcastAudioListeners(ctx);

  if (useBackgroundAudio) {
    ctx.title = title || '凡人播客';
    ctx.epname = title || '凡人播客';
    ctx.singer = getBrandName();
    if (coverUrl && /^https?:\/\//.test(coverUrl)) {
      ctx.coverImgUrl = coverUrl;
    }
  }

  return ctx;
}

function setPodcastAudioSource(ctx, src) {
  if (!ctx || !src) return;
  if (!ctx.title) {
    ctx.title = '凡人播客';
  }
  if ('autoplay' in ctx) {
    ctx.autoplay = true;
  }
  ctx.src = src;
  if (typeof ctx.play === 'function') {
    ctx.play();
  }
}

module.exports = {
  createPodcastAudioContext,
  resetPodcastAudioListeners,
  setPodcastAudioSource,
  stopPodcastAudio
};
