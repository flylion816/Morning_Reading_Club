/**
 * 触感与轻提示封装
 * wx 不存在或调用失败时静默，不影响主流程
 */

function haptic(type = 'light') {
  try {
    if (typeof wx !== 'undefined' && wx && typeof wx.vibrateShort === 'function') {
      wx.vibrateShort({ type });
    }
  } catch (e) {
    // 静默
  }
}

function success(title, options = {}) {
  haptic('light');
  try {
    if (typeof wx !== 'undefined' && wx && typeof wx.showToast === 'function') {
      wx.showToast({ title, icon: 'none', duration: 1600, ...options });
    }
  } catch (e) {
    // 静默
  }
}

module.exports = { haptic, success };
