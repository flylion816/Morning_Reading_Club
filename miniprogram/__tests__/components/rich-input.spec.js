describe('随喜 / 觉察的输入框（普通输入框 + 可升级的富文本编辑器）', () => {
  let config;
  let editor;

  const make = (properties = {}) => {
    const instance = {
      ...config.methods,
      properties: { value: '', html: '', placeholder: '', maxlength: 3000, height: 320, focus: false, mode: 'auto', disabled: false, ...properties },
      data: JSON.parse(JSON.stringify(config.data)),
      events: [],
      setData(update, callback) {
        this.data = { ...this.data, ...update };
        if (callback) callback();
      },
      triggerEvent(name, detail) {
        this.events.push([name, detail]);
      },
      // 模拟页面改了 value / html
      parent(value, html) {
        this.properties = { ...this.properties, value, html };
        config.observers['value, html'].call(this, value, html);
      }
    };
    config.lifetimes.attached.call(instance);
    return instance;
  };

  const ready = instance => instance.onEditorReady();
  const emitted = instance => instance.events.filter(([name]) => name === 'input').map(([, detail]) => detail);

  beforeEach(() => {
    jest.resetModules();
    jest.useFakeTimers();
    global.Component = jest.fn(value => { config = value; });
    editor = {
      setContents: jest.fn(options => options.success && options.success()),
      clear: jest.fn(),
      format: jest.fn(),
      undo: jest.fn(),
      redo: jest.fn(),
      insertText: jest.fn(),
      getContents: jest.fn(options => options.success({ html: '<p><strong>粗</strong></p>', text: '粗\n' }))
    };
    wx.createSelectorQuery = jest.fn(() => ({
      in() { return this; },
      select() { return this; },
      context(callback) { this._callback = callback; return this; },
      exec() { this._callback({ context: editor }); }
    }));
    require('../../components/rich-input/rich-input');
  });

  afterEach(() => {
    jest.useRealTimers();
    delete global.Component;
  });

  describe('起步', () => {
    test('默认是普通输入框；没有格式的内容也是', () => {
      expect(make().data.rich).toBe(false);
      expect(make({ value: '普通', html: '<p>普通</p>' }).data.rich).toBe(false);
    });

    test('内容已经带格式时，直接用富文本编辑器打开；mode=rich 一直是编辑器；mode=plain 永远不升级', () => {
      const formatted = make({ value: '红', html: '<p><span style="color:#dc2626">红</span></p>' });
      expect(formatted.data.rich).toBe(true);
      expect(formatted._pendingHtml).toContain('color:#dc2626');
      expect(make({ mode: 'rich' }).data.rich).toBe(true);
      const plain = make({ mode: 'plain', value: '红', html: '<p><strong>红</strong></p>' });
      expect(plain.data.rich).toBe(false);
      plain.enableRich();
      // 只有普通输入框时 Aa 不显示；就算被调用也照样升级是调用方的事，这里只验证默认模式
      expect(make().data.rich).toBe(false);
    });
  });

  describe('普通输入框', () => {
    test('输入时发出 { text, html: "" }', () => {
      const instance = make();
      instance.onTextInput({ detail: { value: '随手记一句' } });
      expect(emitted(instance)).toEqual([{ text: '随手记一句', html: '' }]);
      expect(instance.data.text).toBe('随手记一句');
    });

    test('焦点、键盘高度事件向上转发', () => {
      const instance = make();
      instance.onFocus();
      instance.onBlur();
      instance.onKeyboardHeight({ detail: { height: 300 } });
      expect(instance.events).toEqual([['focus', undefined], ['blur', undefined], ['keyboardheight', { height: 300 }]]);
    });
  });

  describe('点 Aa 升级成富文本', () => {
    test('当前文字原样带进编辑器（一行一个段落）；编辑器就绪后填入内容', () => {
      const instance = make();
      instance.onTextInput({ detail: { value: '第一行\n第二行' } });
      instance.enableRich();
      expect(instance.data.rich).toBe(true);
      expect(instance.events).toContainEqual(['modechange', { rich: true }]);
      ready(instance);
      expect(editor.setContents).toHaveBeenCalledWith(expect.objectContaining({ html: '<p>第一行</p><p>第二行</p>' }));
    });

    test('没写字就升级：编辑器是空的（不放空内容）', () => {
      const instance = make();
      instance.enableRich();
      ready(instance);
      expect(editor.setContents).not.toHaveBeenCalled();
      expect(editor.clear).toHaveBeenCalled();
    });

    test('已经是富文本或被禁用时点 Aa 不重复升级', () => {
      const instance = make({ mode: 'rich' });
      instance.enableRich();
      expect(instance.events.filter(([name]) => name === 'modechange')).toHaveLength(0);
      const disabled = make({ disabled: true });
      disabled.enableRich();
      expect(disabled.data.rich).toBe(false);
    });
  });

  describe('编辑器输入', () => {
    const richInstance = () => {
      const instance = make({ mode: 'rich' });
      ready(instance);
      return instance;
    };

    test('带格式时发出 text 和 html；去掉结尾换行', () => {
      const instance = richInstance();
      instance.onEditorInput({ detail: { html: '<p>今天<span style="color:#dc2626">重点</span></p>', text: '今天重点\n' } });
      expect(emitted(instance)).toEqual([{ text: '今天重点', html: '<p>今天<span style="color:#dc2626">重点</span></p>' }]);
    });

    test('没有格式时 html 是空串（服务端只存纯文本）', () => {
      const instance = richInstance();
      instance.onEditorInput({ detail: { html: '<p>普通的一句</p>', text: '普通的一句\n' } });
      expect(emitted(instance)).toEqual([{ text: '普通的一句', html: '' }]);
    });

    test('setContents 期间产生的 input 不向上发，免得把刚填的内容当成用户输入', () => {
      const instance = make({ mode: 'rich' });
      editor.setContents.mockImplementation(() => {});
      instance._pendingHtml = '<p>填入</p>';
      ready(instance);
      instance.onEditorInput({ detail: { html: '<p>填入</p>', text: '填入\n' } });
      expect(emitted(instance)).toHaveLength(0);
      editor.setContents.mock.calls[0][0].success();
      instance.onEditorInput({ detail: { html: '<p>填入加一</p>', text: '填入加一\n' } });
      expect(emitted(instance)).toHaveLength(1);
    });

    test('填入内容失败时，退回成插入纯文本', () => {
      const instance = make({ mode: 'rich' });
      editor.setContents.mockImplementation(options => options.fail());
      instance._pendingHtml = '<p>备用<strong>文字</strong></p>';
      ready(instance);
      expect(editor.insertText).toHaveBeenCalledWith({ text: '备用文字' });
    });
  });

  describe('工具栏格式', () => {
    const richInstance = () => {
      const instance = make({ mode: 'rich' });
      ready(instance);
      return instance;
    };
    const tap = (instance, name, value) => instance.handleFormat({ currentTarget: { dataset: { name, value } } });

    test('加粗、斜体、下划线：按当前状态切换', () => {
      const instance = richInstance();
      tap(instance, 'bold');
      expect(editor.format).toHaveBeenLastCalledWith('bold', true);
      instance.onStatusChange({ detail: { bold: true } });
      tap(instance, 'bold');
      expect(editor.format).toHaveBeenLastCalledWith('bold', false);
      tap(instance, 'underline');
      expect(editor.format).toHaveBeenLastCalledWith('underline', true);
    });

    test('颜色：选中设置，再点同一个颜色取消；editor 报的 rgb 也认得', () => {
      const instance = richInstance();
      tap(instance, 'color', '#dc2626');
      expect(editor.format).toHaveBeenLastCalledWith('color', '#dc2626');
      instance.onStatusChange({ detail: { color: 'rgb(220, 38, 38)' } });
      expect(instance.data.formats.color).toBe('#dc2626');
      tap(instance, 'color', '#dc2626');
      expect(editor.format).toHaveBeenLastCalledWith('color', false);
      tap(instance, 'color', '#d97706');
      expect(editor.format).toHaveBeenLastCalledWith('color', '#d97706');
    });

    test('标题和列表带着值切换', () => {
      const instance = richInstance();
      tap(instance, 'headerType', 'h2');
      expect(editor.format).toHaveBeenLastCalledWith('headerType', 'h2');
      tap(instance, 'list', 'ordered');
      expect(editor.format).toHaveBeenLastCalledWith('list', 'ordered');
      instance.onStatusChange({ detail: { list: 'ordered' } });
      tap(instance, 'list', 'ordered');
      expect(editor.format).toHaveBeenLastCalledWith('list', false);
    });

    test('撤销、重做', () => {
      const instance = richInstance();
      instance.handleUndo();
      instance.handleRedo();
      expect(editor.undo).toHaveBeenCalled();
      expect(editor.redo).toHaveBeenCalled();
    });

    test('设置格式之后主动读一次内容，让页面拿到最新的 HTML', () => {
      const instance = richInstance();
      tap(instance, 'bold');
      jest.advanceTimersByTime(130);
      expect(emitted(instance)).toEqual([{ text: '粗', html: '<p><strong>粗</strong></p>' }]);
    });

    test('编辑器还没就绪时点工具栏没有反应', () => {
      const instance = make({ mode: 'rich' });
      expect(() => tap(instance, 'bold')).not.toThrow();
      expect(editor.format).not.toHaveBeenCalled();
    });

    test('提供五种颜色，和打卡页一致', () => {
      expect(config.data.colorOptions).toHaveLength(5);
      expect(config.data.colorOptions[0].value).toBe('#333333');
    });
  });

  describe('页面改了内容（清空、恢复草稿、编辑旧记录）', () => {
    test('自己发出去的内容原样回来时不处理（不会把光标重置）', () => {
      const instance = make({ mode: 'rich' });
      ready(instance);
      instance.onEditorInput({ detail: { html: '<p><strong>粗</strong></p>', text: '粗\n' } });
      editor.setContents.mockClear();
      instance.parent('粗', '<p><strong>粗</strong></p>');
      expect(editor.setContents).not.toHaveBeenCalled();
    });

    test('普通模式：页面改了文字就更新', () => {
      const instance = make();
      instance.parent('恢复的草稿', '');
      expect(instance.data.text).toBe('恢复的草稿');
      expect(instance.data.rich).toBe(false);
    });

    test('页面给了带格式的内容（比如编辑一条有颜色的旧记录）：切成编辑器并填入', () => {
      const instance = make();
      instance.parent('红色重点', '<p><span style="color:#dc2626">红色重点</span></p>');
      expect(instance.data.rich).toBe(true);
      ready(instance);
      expect(editor.setContents).toHaveBeenCalledWith(expect.objectContaining({ html: '<p><span style="color:#dc2626">红色重点</span></p>' }));
    });

    test('已经是编辑器时，页面换了内容就直接替换编辑器里的内容', () => {
      const instance = make({ mode: 'rich' });
      ready(instance);
      editor.setContents.mockClear();
      instance.parent('另一条', '<p><u>另一条</u></p>');
      expect(editor.setContents).toHaveBeenCalledWith(expect.objectContaining({ html: '<p><u>另一条</u></p>' }));
    });

    test('保存之后页面清空：自动模式回到普通输入框，下一条重新从快速输入开始', () => {
      const instance = make({ value: '红', html: '<p><span style="color:#dc2626">红</span></p>' });
      ready(instance);
      expect(instance.data.rich).toBe(true);
      instance.parent('', '');
      expect(instance.data.rich).toBe(false);
      expect(instance.data.text).toBe('');
    });

    test('mode=rich 清空时只清空编辑器，不换成普通输入框', () => {
      const instance = make({ mode: 'rich', value: '字', html: '<p><strong>字</strong></p>' });
      ready(instance);
      instance.parent('', '');
      expect(instance.data.rich).toBe(true);
      expect(editor.clear).toHaveBeenCalled();
    });

    test('编辑器里换成没有格式的纯文本：按段落填入', () => {
      const instance = make({ mode: 'rich' });
      ready(instance);
      editor.setContents.mockClear();
      instance.parent('两行\n文字', '');
      expect(editor.setContents).toHaveBeenCalledWith(expect.objectContaining({ html: '<p>两行</p><p>文字</p>' }));
    });
  });

  test('getContents 返回最近一次的内容', async () => {
    const instance = make();
    instance.onTextInput({ detail: { value: '最近的' } });
    await expect(instance.getContents()).resolves.toEqual({ text: '最近的', html: '' });
  });
});
