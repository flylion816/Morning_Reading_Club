const { haptic, success } = require('../../utils/feedback');

describe('feedback', () => {
  let originalWx;

  beforeEach(() => {
    originalWx = global.wx;
    global.wx = { vibrateShort: jest.fn(), showToast: jest.fn() };
  });

  afterEach(() => {
    global.wx = originalWx;
  });

  test('haptic defaults to light', () => {
    haptic();
    expect(wx.vibrateShort).toHaveBeenCalledWith({ type: 'light' });
  });

  test('haptic passes custom type', () => {
    haptic('heavy');
    expect(wx.vibrateShort).toHaveBeenCalledWith({ type: 'heavy' });
  });

  test('haptic is silent when wx is missing or throws', () => {
    global.wx = undefined;
    expect(() => haptic()).not.toThrow();
    global.wx = { vibrateShort: () => { throw new Error('boom'); } };
    expect(() => haptic()).not.toThrow();
  });

  test('success vibrates lightly and shows a toast', () => {
    success('已保存');
    expect(wx.vibrateShort).toHaveBeenCalledWith({ type: 'light' });
    expect(wx.showToast).toHaveBeenCalledWith({ title: '已保存', icon: 'none', duration: 1600 });
  });

  test('success still toasts when vibration fails and honors options', () => {
    wx.vibrateShort.mockImplementation(() => { throw new Error('x'); });
    success('好了', { duration: 800 });
    expect(wx.showToast).toHaveBeenCalledWith({ title: '好了', icon: 'none', duration: 800 });
  });
});
