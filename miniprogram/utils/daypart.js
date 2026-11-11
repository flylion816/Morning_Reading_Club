// 晨光时段：纯函数，供首页问候区与导航栏共用
// 05:00–08:00 破晓；08:00–17:00 白天；17:00–19:30 黄昏；19:30–05:00 夜晚
const DAYPARTS = {
  dawn: { key: 'dawn', greeting: '早安', navBackground: '#fbe3c3', navFront: '#000000' },
  day: { key: 'day', greeting: '上午好', navBackground: '#fffdf8', navFront: '#000000' },
  dusk: { key: 'dusk', greeting: '傍晚好', navBackground: '#f3c7b2', navFront: '#000000' },
  night: { key: 'night', greeting: '夜深了', navBackground: '#1f2a44', navFront: '#ffffff' }
};

/**
 * @param {Date|number} [input] Date，或一天中的分钟数（0–1439）；缺省为当前时间
 * @returns {{key: string, greeting: string, navBackground: string, navFront: string}}
 */
function getDaypart(input) {
  let minutes;
  if (typeof input === 'number' && Number.isFinite(input)) {
    minutes = ((Math.floor(input) % 1440) + 1440) % 1440;
  } else {
    const date = input instanceof Date && !Number.isNaN(input.getTime()) ? input : new Date();
    minutes = date.getHours() * 60 + date.getMinutes();
  }

  if (minutes >= 5 * 60 && minutes < 8 * 60) return { ...DAYPARTS.dawn };
  if (minutes >= 8 * 60 && minutes < 17 * 60) {
    // 中午 12 点起问候改为「下午好」，背景仍是白天
    return { ...DAYPARTS.day, greeting: minutes >= 12 * 60 ? '下午好' : '上午好' };
  }
  if (minutes >= 17 * 60 && minutes < 19 * 60 + 30) return { ...DAYPARTS.dusk };
  return { ...DAYPARTS.night };
}

module.exports = { getDaypart, DAYPARTS };
