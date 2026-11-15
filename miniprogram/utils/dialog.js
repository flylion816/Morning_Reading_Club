/**
 * 统一弹窗与底部菜单入口：用法和 wx.showModal / wx.showActionSheet 一致，
 * 但显示的是 components/app-dialog、components/app-sheet 的自定义样式。
 *
 * 页面需要放宿主节点：
 *   <app-dialog id="app-dialog" />   （确认弹窗）
 *   <app-sheet id="app-sheet" />     （底部菜单）
 * 当前页面没放时，自动退回系统弹窗，保证功能一定可用。
 */

function getHost(selector) {
  try {
    const pages = typeof getCurrentPages === 'function' ? getCurrentPages() : [];
    const page = pages[pages.length - 1];
    if (page && typeof page.selectComponent === 'function') {
      const host = page.selectComponent(selector);
      if (host && typeof host.open === 'function') return host;
    }
  } catch (error) {
    // 取不到宿主就走系统弹窗
  }
  return null;
}

function showModal(options = {}) {
  const host = getHost('#app-dialog');
  if (!host) return wx.showModal(options);

  const { success, complete } = options;
  // 兼容原来的 confirmColor；确认按钮写着“删除…”的，也按危险操作处理
  const danger =
    options.danger === true ||
    Boolean(options.confirmColor) ||
    /^删除/.test(options.confirmText || '');
  return host
    .open({
      title: options.title,
      content: options.content,
      confirmText: options.confirmText,
      cancelText: options.cancelText,
      showCancel: options.showCancel,
      danger
    })
    .then((res) => {
      if (typeof success === 'function') success(res);
      if (typeof complete === 'function') complete(res);
      return res;
    });
}

function showActionSheet(options = {}) {
  const host = getHost('#app-sheet');
  if (!host) return wx.showActionSheet(options);

  const { success, fail, complete } = options;
  return host
    .open({
      title: options.title,
      itemList: options.itemList,
      cancelText: options.cancelText
    })
    .then((res) => {
      if (res && res.cancel) {
        const error = { errMsg: 'showActionSheet:fail cancel' };
        if (typeof fail === 'function') fail(error);
        if (typeof complete === 'function') complete(error);
        return res;
      }
      if (typeof success === 'function') success(res);
      if (typeof complete === 'function') complete(res);
      return res;
    });
}

module.exports = { showModal, showActionSheet };
