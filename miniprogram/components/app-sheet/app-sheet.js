/**
 * 统一底部菜单：替代系统 wx.showActionSheet。
 * 页面里放一个 <app-sheet id="app-sheet" />，再通过 utils/dialog.js 的 showActionSheet 调用。
 */
Component({
  data: {
    visible: false,
    title: '',
    items: [],
    cancelText: '取消'
  },

  methods: {
    // 返回 Promise<{ tapIndex }>，点取消或遮罩返回 { cancel: true }
    open(options = {}) {
      if (this._resolve) this._finish({ cancel: true });
      const items = (options.itemList || []).map((label) => ({
        label: typeof label === 'string' ? label : label.label,
        danger: typeof label === 'object' && label.danger === true
      }));
      return new Promise((resolve) => {
        this._resolve = resolve;
        this.setData({
          visible: true,
          title: options.title || '',
          items,
          cancelText: options.cancelText || '取消'
        });
      });
    },

    _finish(result) {
      const resolve = this._resolve;
      this._resolve = null;
      this.setData({ visible: false });
      if (resolve) resolve(result);
    },

    handleTap(event) {
      const index = Number(event.currentTarget.dataset.index);
      this._finish({ tapIndex: index });
    },

    handleCancel() {
      this._finish({ cancel: true });
    },

    noop() {}
  }
});
