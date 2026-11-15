/**
 * 统一确认弹窗：替代系统 wx.showModal，样式和晨光风格一致。
 * 页面里放一个 <app-dialog id="app-dialog" />，再通过 utils/dialog.js 的 showModal 调用；
 * 页面没放时 utils/dialog.js 会退回系统弹窗，不会出现“点了没反应”。
 */
Component({
  data: {
    visible: false,
    title: '',
    content: '',
    confirmText: '确定',
    cancelText: '取消',
    showCancel: true,
    danger: false
  },

  methods: {
    // 返回 Promise<{ confirm, cancel }>，和 wx.showModal 的结果结构一致
    open(options = {}) {
      // 上一个弹窗还没点就又来一个：把上一个当作取消
      if (this._resolve) this._finish({ confirm: false, cancel: true });
      return new Promise((resolve) => {
        this._resolve = resolve;
        this.setData({
          visible: true,
          title: options.title || '',
          content: options.content || '',
          confirmText: options.confirmText || '确定',
          cancelText: options.cancelText || '取消',
          showCancel: options.showCancel !== false,
          danger: options.danger === true
        });
      });
    },

    _finish(result) {
      const resolve = this._resolve;
      this._resolve = null;
      this.setData({ visible: false });
      if (resolve) resolve(result);
    },

    handleConfirm() {
      this._finish({ confirm: true, cancel: false });
    },

    handleCancel() {
      this._finish({ confirm: false, cancel: true });
    },

    noop() {}
  }
});
