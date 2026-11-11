/**
 * 心情天气选项（值与后端 Checkin.mood 枚举一致）。
 * 心情只有本人可见；不选就不传 mood。
 */
const MOOD_OPTIONS = [
  { value: 'happy', name: '晴', desc: '心里亮堂堂', icon: 'sun' },
  { value: 'calm', name: '多云', desc: '平静安稳', icon: 'cloud' },
  { value: 'thoughtful', name: '微风', desc: '若有所思', icon: 'wind' },
  { value: 'inspired', name: '朝霞', desc: '被点亮了', icon: 'sunrise' },
  { value: 'low', name: '小雨', desc: '有点低落', icon: 'rain' },
  { value: 'other', name: '雾', desc: '说不清', icon: 'fog' }
];

// 提交/更新打卡时必须同时带 moodSource: MOOD_SOURCE，后端才会采纳 mood（防旧版客户端写死 happy）
const MOOD_SOURCE = 'picker';

function getMoodOption(value) {
  return MOOD_OPTIONS.find((item) => item.value === value) || null;
}

module.exports = { MOOD_OPTIONS, MOOD_SOURCE, getMoodOption };
