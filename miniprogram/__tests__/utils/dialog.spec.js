const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '../..');

function loadComponent(relativePath) {
  let definition;
  const previous = global.Component;
  global.Component = (def) => {
    definition = def;
  };
  jest.isolateModules(() => {
    require(path.join(root, relativePath));
  });
  global.Component = previous;
  const ctx = {
    data: { ...definition.data },
    setData(next) {
      Object.assign(this.data, next);
    },
    ...definition.methods
  };
  return ctx;
}

describe('utils/dialog', () => {
  let dialog;
  const originalGetCurrentPages = global.getCurrentPages;

  beforeEach(() => {
    jest.resetModules();
    wx.showModal = jest.fn();
    wx.showActionSheet = jest.fn();
    dialog = require('../../utils/dialog');
  });

  afterEach(() => {
    global.getCurrentPages = originalGetCurrentPages;
  });

  test('showModal falls back to the system dialog when the page has no host', () => {
    global.getCurrentPages = () => [{ selectComponent: () => null }];
    const options = { title: 't', content: 'c' };
    dialog.showModal(options);
    expect(wx.showModal).toHaveBeenCalledWith(options);
  });

  test('showModal uses the page host, keeps the wx result shape and flags destructive actions', async () => {
    const open = jest.fn().mockResolvedValue({ confirm: true, cancel: false });
    global.getCurrentPages = () => [{ selectComponent: () => ({ open }) }];
    const success = jest.fn();

    await dialog.showModal({ title: '删除评论', content: '确定删除吗？', confirmText: '删除', success });

    expect(wx.showModal).not.toHaveBeenCalled();
    expect(open).toHaveBeenCalledWith(
      expect.objectContaining({ title: '删除评论', confirmText: '删除', danger: true })
    );
    expect(success).toHaveBeenCalledWith({ confirm: true, cancel: false });

    await dialog.showModal({ title: '退出登录', confirmColor: '#e74c3c' });
    expect(open).toHaveBeenLastCalledWith(expect.objectContaining({ danger: true }));

    await dialog.showModal({ title: '确认报名', confirmText: '报名' });
    expect(open).toHaveBeenLastCalledWith(expect.objectContaining({ danger: false }));
  });

  test('showActionSheet maps taps to success and cancel to a wx-style fail', async () => {
    const open = jest
      .fn()
      .mockResolvedValueOnce({ tapIndex: 1 })
      .mockResolvedValueOnce({ cancel: true });
    global.getCurrentPages = () => [{ selectComponent: () => ({ open }) }];
    const success = jest.fn();
    const fail = jest.fn();

    await dialog.showActionSheet({ itemList: ['a', 'b'], success, fail });
    expect(success).toHaveBeenCalledWith({ tapIndex: 1 });

    await dialog.showActionSheet({ itemList: ['a', 'b'], success, fail });
    expect(fail).toHaveBeenCalledWith({ errMsg: 'showActionSheet:fail cancel' });
    expect(success).toHaveBeenCalledTimes(1);
  });

  test('showActionSheet falls back to the system sheet without a host', () => {
    global.getCurrentPages = () => [{ selectComponent: () => null }];
    const options = { itemList: ['a'] };
    dialog.showActionSheet(options);
    expect(wx.showActionSheet).toHaveBeenCalledWith(options);
  });
});

describe('app-dialog component', () => {
  test('resolves confirm and cancel like wx.showModal and supports single-button mode', async () => {
    const comp = loadComponent('components/app-dialog/app-dialog.js');

    let pending = comp.open({ title: '标题', content: '内容', confirmText: '好', danger: true });
    expect(comp.data).toMatchObject({ visible: true, title: '标题', confirmText: '好', danger: true, showCancel: true });
    comp.handleConfirm();
    await expect(pending).resolves.toEqual({ confirm: true, cancel: false });
    expect(comp.data.visible).toBe(false);

    pending = comp.open({ title: 'x', showCancel: false });
    expect(comp.data.showCancel).toBe(false);
    comp.handleCancel();
    await expect(pending).resolves.toEqual({ confirm: false, cancel: true });
  });

  test('opening a second dialog cancels the unanswered first one', async () => {
    const comp = loadComponent('components/app-dialog/app-dialog.js');
    const first = comp.open({ title: '1' });
    const second = comp.open({ title: '2' });
    await expect(first).resolves.toEqual({ confirm: false, cancel: true });
    comp.handleConfirm();
    await expect(second).resolves.toEqual({ confirm: true, cancel: false });
  });
});

describe('app-sheet component', () => {
  test('resolves the tapped index or cancel', async () => {
    const comp = loadComponent('components/app-sheet/app-sheet.js');
    let pending = comp.open({ itemList: ['摘下整段', '生成日签'] });
    expect(comp.data.items.map((i) => i.label)).toEqual(['摘下整段', '生成日签']);
    comp.handleTap({ currentTarget: { dataset: { index: 1 } } });
    await expect(pending).resolves.toEqual({ tapIndex: 1 });

    pending = comp.open({ itemList: ['a'] });
    comp.handleCancel();
    await expect(pending).resolves.toEqual({ cancel: true });
  });
});

describe('page hosts', () => {
  function walk(dir, result = []) {
    fs.readdirSync(dir, { withFileTypes: true }).forEach((entry) => {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full, result);
      else if (entry.name.endsWith('.js')) result.push(full);
    });
    return result;
  }

  test('every page that calls the custom dialog or sheet renders its host node', () => {
    const missing = [];
    walk(path.join(root, 'pages')).forEach((file) => {
      const source = fs.readFileSync(file, 'utf8');
      if (!/utils\/dialog'/.test(source)) return;
      const wxml = fs.readFileSync(file.replace(/\.js$/, '.wxml'), 'utf8');
      if (/appDialog\.showModal\(/.test(source) && !wxml.includes('id="app-dialog"')) {
        missing.push(`${path.relative(root, file)} 缺少 app-dialog`);
      }
      if (/appDialog\.showActionSheet\(/.test(source) && !wxml.includes('id="app-sheet"')) {
        missing.push(`${path.relative(root, file)} 缺少 app-sheet`);
      }
    });
    expect(missing).toEqual([]);
  });

  test('pages that trigger requireLogin also render the dialog host', () => {
    const missing = [];
    walk(path.join(root, 'pages')).forEach((file) => {
      const source = fs.readFileSync(file, 'utf8');
      if (!/utils\/require-login'/.test(source)) return;
      const wxml = fs.readFileSync(file.replace(/\.js$/, '.wxml'), 'utf8');
      if (!wxml.includes('id="app-dialog"')) missing.push(path.relative(root, file));
    });
    expect(missing).toEqual([]);
  });
});
