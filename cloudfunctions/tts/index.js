const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

exports.main = async (event) => {
  const { text } = event;
  if (!text || !text.trim()) {
    return { errCode: -1, errMsg: '文本不能为空' };
  }

  try {
    const result = await cloud.openapi.textToSpeech.textToSpeech({
      text: text.slice(0, 200),
      speed: 1,
      volume: 5,
      pitchRate: 1,
      voiceType: 0
    });
    console.log('TTS result keys:', Object.keys(result || {}));
    console.log('TTS errCode:', result && result.errCode);
    return result;
  } catch (err) {
    console.error('TTS 调用失败 errCode:', err.errCode, 'errMsg:', err.errMsg || String(err));
    return { errCode: err.errCode || -1, errMsg: err.errMsg || String(err) };
  }
};
