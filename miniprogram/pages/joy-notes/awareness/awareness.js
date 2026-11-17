/**
 * 觉察静室：停 → 看 → 感 → 问 → 择 → 收。
 * 一屏只问一句，每一问都可以跳过，只答一问也能保存；背景从夜色一屏屏亮起来，写到「择」时天亮了。
 * 「问」跟着「感」里选的心情走：难受时看见自己在保护什么，开心时顺着这份好心情找到心里的种子。
 * 草稿只放在本机：中途退出，下次进门会问「接着上次写吗」。
 */
const service = require('../../../services/joy-note.service');
const appDialog = require('../../../utils/dialog');
const store = require('../../../utils/joy-note-store');
const { tenantStorage } = require('../../../utils/storage');
const { requireLogin } = require('../../../utils/require-login');
const q = require('../../../utils/awareness-questions');
const text = require('../awareness-text');
const sharePoster = require('../share-poster');
const { getDefaultShareTitle, getDefaultShareImage } = require('../../../utils/brand');

const STEPS = ['pause', 'see', 'feel', 'ask', 'choose'];
// 前四屏是夜色，「择」和「收」是晨光（状态栏文字颜色要跟着换）
const DARK_STEPS = ['pause', 'see', 'feel', 'ask'];
const STEP_NAMES = ['停', '看', '感', '问', '择'];
const BREATH_MS = 4000;
const BREATHS = 3;
const DRAFT_DELAY_MS = 600;
const SAVED_HINT_MS = 1800;
const SEED_MAX = 300;
const JOURNAL_ROUTE = 'pages/joy-notes/joy-notes';

function decode(value) {
  try {
    return decodeURIComponent(value || '');
  } catch (error) {
    return String(value || '');
  }
}

function chips(options, selected) {
  return options.map(name => ({ name, on: selected.indexOf(name) >= 0 }));
}

// 「感」的词分两组摆：沉一点的、亮一点的；每组后面接着用户自己加的词（custom 为 true，长按可以删掉）
function feelingGroups(selected, custom) {
  const mine = custom || q.emptyCustomFeelings();
  return q.FEELING_GROUPS.map(group => ({
    key: group.key,
    label: group.label,
    chips: chips(group.words, selected).concat(chips(mine[group.key] || [], selected).map(chip => ({ ...chip, custom: true })))
  }));
}

function addHintFor(group) {
  return `写一个词，比如：${q.FEELING_EXAMPLES[group] || ''}`;
}

// 草稿里的词表和本机的词表合在一起：草稿里选中的词，就算后来在词表里删掉了，恢复时也要还在
function mergeCustomFeelings(a, b) {
  const base = q.normalizeCustomFeelings(a);
  const extra = q.normalizeCustomFeelings(b);
  return q.normalizeCustomFeelings({ heavy: base.heavy.concat(extra.heavy), bright: base.bright.concat(extra.bright) });
}

function todayKey(date = new Date()) {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

// 草稿里记着「问」是按什么心情出的题，恢复后问题和回答对得上。旧草稿没有这一项，按没选心情出题
function contextFrom(draft) {
  const raw = draft && draft.ladderContext;
  if (raw && q.TONES.indexOf(raw.tone) >= 0) {
    return { tone: raw.tone, heavyWord: String(raw.heavyWord || ''), brightWord: String(raw.brightWord || '') };
  }
  return q.ladderContext([]);
}

const HEAVY_COPY = q.chooseCopy('heavy');

function toggleIn(list, name, max) {
  const next = list.slice();
  const index = next.indexOf(name);
  if (index >= 0) {
    next.splice(index, 1);
    return { list: next };
  }
  if (next.length >= max) return { list, full: true };
  next.push(name);
  return { list: next };
}

function hasContent(awareness) {
  return Boolean(
    awareness.facts ||
      awareness.feelingNote ||
      (awareness.feelings && awareness.feelings.length) ||
      (awareness.bodyAreas && awareness.bodyAreas.length) ||
      (awareness.asks && awareness.asks.length) ||
      awareness.choice
  );
}

function draftHasContent(draft) {
  if (!draft) return false;
  return Boolean(
    String(draft.facts || '').trim() ||
      String(draft.feelingNote || '').trim() ||
      (draft.feelings && draft.feelings.length) ||
      (draft.bodyAreas && draft.bodyAreas.length) ||
      (draft.answers || []).some(answer => String(answer || '').trim()) ||
      String(draft.choice || '').trim()
  );
}

function revisitDateLabel() {
  return text.monthDay(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000));
}

Page({
  data: {
    statusBarHeight: 20,
    stepNames: STEP_NAMES,
    step: 'pause',
    // 进度条上亮到第几个字（停 0、看 1、感 2、问 3、择 4）
    progress: 0,
    light: false,
    // 停：三次呼吸
    breaths: 0,
    breathDone: false,
    // 这一页的标题（选填，在「择」那一屏末尾起名）
    title: '',
    // 看、感
    facts: '',
    factsHtml: '',
    seePh: q.SEE_PLACEHOLDERS[0],
    feelings: [],
    feelingGroups: feelingGroups([]),
    bodyAreas: [],
    bodyChips: chips(q.BODY_AREAS, []),
    bodyOpen: false,
    feelingNote: '',
    // 感：找不到合适的词，自己加一个（只放本机，加在「沉一点的」还是「亮一点的」，问题就按哪一种出）
    customFeelings: q.emptyCustomFeelings(),
    hasCustom: false,
    addOpen: false,
    addText: '',
    addGroup: 'heavy',
    addHint: addHintFor('heavy'),
    // 问：一叩、再叩、三叩。问题跟着心情走：沉的看见自己在保护什么，亮的找心里的种子
    habitKey: 'general',
    habitName: '',
    ladderVariant: 0,
    ladderContext: q.ladderContext([]),
    ladderKind: 'heavy',
    askLead: '',
    ladder: [],
    askItems: [],
    canSwap: true,
    // 择（问题、提示和「收」的那句话跟着问题链走）
    chooseQ: HEAVY_COPY.question,
    choosePh: HEAVY_COPY.placeholder,
    doneLine: HEAVY_COPY.done,
    choice: '',
    choiceHtml: '',
    revisit: true,
    revisitDate: '',
    // 这一页有没有写到内容（决定「择」那一屏的完成按钮怎么放）
    hasContent: false,
    // 关联的课程（可选）
    periodId: '',
    sectionId: '',
    sourceLabel: '',
    // 保存
    saving: false,
    savedHint: '',
    noteId: '',
    summary: null,
    canCheckin: false
  },

  onLoad(options = {}) {
    try {
      const { statusBarHeight } = (wx.getWindowInfo && wx.getWindowInfo()) || {};
      this.setData({ statusBarHeight: statusBarHeight || 20 });
    } catch (error) {
      this.setData({ statusBarHeight: 20 });
    }
    // 这一页是私人的：右上角的转发菜单不转发它，只有分享面板里的按钮才能分享
    if (typeof wx.hideShareMenu === 'function') wx.hideShareMenu({ menus: ['shareAppMessage', 'shareTimeline'] });
    this._params = {
      periodId: decode(options.periodId),
      sectionId: decode(options.sectionId),
      source: decode(options.source),
      seed: decode(options.seed).slice(0, SEED_MAX)
    };
    if (!requireLogin('登录后可以坐下来，看一看自己')) return;
    this.applyChrome('pause');
    this.bootstrap();
  },

  onHide() {
    this.flushDraft();
  },

  onUnload() {
    this.stopBreathing();
    clearTimeout(this._savedTimer);
    this.flushDraft();
  },

  // ---- 起步：有没写完的草稿就先问一句（问的时候呼吸先不动）----
  bootstrap() {
    this.loadCustomFeelings();
    const draft = this.readDraft();
    if (!draft) {
      this.startFresh();
      return;
    }
    this._draftPaused = true;
    const hasSeed = Boolean(this._params.seed);
    appDialog.showModal({
      title: '接着上次写吗？',
      content: hasSeed ? '有一份没写完的觉察。接着写，还是从这句话重新开始？' : '有一份没写完的觉察。',
      confirmText: '接着写',
      cancelText: hasSeed ? '从这句开始' : '重新开始',
      success: result => {
        this._draftPaused = false;
        if (result && result.confirm) {
          this.restoreDraft(draft);
        } else {
          // 重新开始：旧草稿清掉，页面回到全新的状态（带着随喜进来的话，就从这句话开始）
          this.clearDraft();
          this.startFresh();
        }
      },
      fail: () => {
        // 弹窗被系统收掉（如来电）：按接着写处理，草稿不丢
        this._draftPaused = false;
        this.restoreDraft(draft);
      }
    });
  },

  startFresh() {
    const { periodId, sectionId, source, seed } = this._params;
    const habitKey = q.detectHabit(source);
    this.setData({
      step: 'pause',
      progress: 0,
      light: false,
      title: '',
      facts: seed || '',
      factsHtml: '',
      seePh: q.pickSeePlaceholder(todayKey()),
      feelings: [],
      feelingGroups: feelingGroups([], this.data.customFeelings),
      addOpen: false,
      addText: '',
      bodyAreas: [],
      bodyChips: chips(q.BODY_AREAS, []),
      bodyOpen: false,
      feelingNote: '',
      habitKey,
      habitName: q.habitName(habitKey),
      ladderVariant: 0,
      choice: '',
      choiceHtml: '',
      revisit: true,
      hasContent: false,
      periodId,
      sectionId: periodId ? sectionId : '',
      sourceLabel: periodId ? source : ''
    });
    this.buildAsks(0, [], [], q.ladderContext([]));
    this.startBreathing();
  },

  // ---- 停：跟着光呼吸三次。不自动跳走，什么时候开始由自己定 ----
  startBreathing() {
    this.stopBreathing();
    this.setData({ breaths: 0, breathDone: false });
    this._breathTimer = setInterval(() => {
      const breaths = this.data.breaths + 1;
      if (breaths >= BREATHS) {
        this.stopBreathing();
        this.setData({ breaths: BREATHS, breathDone: true });
        return;
      }
      this.setData({ breaths });
    }, BREATH_MS);
  },

  stopBreathing() {
    if (this._breathTimer) {
      clearInterval(this._breathTimer);
      this._breathTimer = null;
    }
  },

  // ---- 步骤 ----
  enter(step) {
    this.stopBreathing();
    if (step === 'ask') this.syncLadder();
    const patch = { step, progress: Math.max(STEPS.indexOf(step), 0), light: !DARK_STEPS.includes(step), addOpen: false };
    if (step === 'choose') patch.revisitDate = revisitDateLabel();
    this.setData(patch);
    this.applyChrome(step);
    this.scheduleDraft();
  },

  begin() {
    this.enter('see');
  },

  next() {
    const index = STEPS.indexOf(this.data.step);
    if (index < 0 || index >= STEPS.length - 1) return;
    this.enter(STEPS[index + 1]);
  },

  skip() {
    this.next();
  },

  back() {
    const index = STEPS.indexOf(this.data.step);
    if (index <= 1) return;
    this.enter(STEPS[index - 1]);
  },

  // ---- 键盘：交给系统避让 ----
  // 写作输入框都带 adjust-position + cursor-spacing，键盘弹起时由系统把整页顶上去，输入框底边留在键盘上方；
  // 点空白处（hold-keyboard 已关）键盘就收起，页面落回原位。
  // 这里不再自己监听键盘高度、撑高滚动区或手动滚 scroll-view：上一版这样接管后，真机上键盘弹不起来。

  // 夜色屏用白色状态栏文字，晨光屏用黑色
  applyChrome(step) {
    if (typeof wx.setNavigationBarColor !== 'function') return;
    const dark = DARK_STEPS.includes(step);
    try {
      wx.setNavigationBarColor({
        frontColor: dark ? '#ffffff' : '#000000',
        backgroundColor: dark ? '#171412' : '#fbe3c3',
        animation: { duration: 0 }
      });
    } catch (error) {
      // 不影响流程
    }
  },

  // 每次输入后同步「这一页有没有内容」，「择」那一屏的完成按钮跟着变
  refreshHasContent() {
    const hasContent = this.hasAnyContent();
    if (hasContent !== this.data.hasContent) this.setData({ hasContent });
  },

  // ---- 看 ----
  // 输入框（普通输入框或富文本编辑器）：普通输入给 { value }，输入框组件给 { text, html }
  onFacts(event) {
    const detail = event.detail || {};
    this.setData({ facts: detail.text !== undefined ? detail.text : detail.value || '', factsHtml: detail.html || '' });
    this.refreshHasContent();
    this.scheduleDraft();
  },

  onTitle(event) {
    this.setData({ title: event.detail.value || '' });
    this.scheduleDraft();
  },

  // ---- 感 ----
  toggleFeeling(event) {
    const result = toggleIn(this.data.feelings, event.currentTarget.dataset.name, q.MAX_FEELINGS);
    if (result.full) {
      wx.showToast({ title: `最多选 ${q.MAX_FEELINGS} 个`, icon: 'none' });
      return;
    }
    this.setData({ feelings: result.list, feelingGroups: feelingGroups(result.list, this.data.customFeelings) });
    this.refreshHasContent();
    this.scheduleDraft();
  },

  toggleBody() {
    this.setData({ bodyOpen: !this.data.bodyOpen });
  },

  toggleBodyArea(event) {
    const result = toggleIn(this.data.bodyAreas, event.currentTarget.dataset.name, q.MAX_BODY_AREAS);
    if (result.full) {
      wx.showToast({ title: `最多选 ${q.MAX_BODY_AREAS} 处`, icon: 'none' });
      return;
    }
    this.setData({ bodyAreas: result.list, bodyChips: chips(q.BODY_AREAS, result.list) });
    this.refreshHasContent();
    this.scheduleDraft();
  },

  onFeelingNote(event) {
    this.setData({ feelingNote: event.detail.value || '' });
    this.refreshHasContent();
    this.scheduleDraft();
  },

  // ---- 感：找不到合适的词，自己加一个（只放本机，按「沉一点的」「亮一点的」两组记）----
  loadCustomFeelings() {
    const custom = q.normalizeCustomFeelings(store.read(store.KEYS.customFeelings));
    this.setData({
      customFeelings: custom,
      hasCustom: q.customFeelingCount(custom) > 0,
      feelingGroups: feelingGroups(this.data.feelings, custom)
    });
  },

  saveCustomFeelings(custom) {
    store.write(store.KEYS.customFeelings, q.customFeelingCount(custom) > 0 ? custom : null);
  },

  toggleAddFeeling() {
    this.setData({ addOpen: !this.data.addOpen, addText: '' });
  },

  chooseAddGroup(event) {
    const group = event.currentTarget.dataset.group;
    if (q.FEELING_GROUP_KEYS.indexOf(group) < 0) return;
    this.setData({ addGroup: group, addHint: addHintFor(group) });
  },

  onAddInput(event) {
    this.setData({ addText: (event.detail && event.detail.value) || '' });
  },

  // 加上：这个词出现在所选那一组的末尾并被选中；词表里已经有了（不论在哪一组）就只帮忙选上，不重复加
  confirmAddFeeling() {
    const result = q.addCustomFeeling(this.data.customFeelings, this.data.addGroup, this.data.addText);
    if (!result.ok) {
      const messages = {
        empty: '先写一个词',
        long: `最多 ${q.MAX_FEELING_LENGTH} 个字`,
        full: `这一组最多加 ${q.MAX_CUSTOM_FEELINGS} 个，长按旧的可以删掉`
      };
      wx.showToast({ title: messages[result.reason] || '这个词加不上', icon: 'none' });
      return;
    }
    const { word, custom, existed } = result;
    if (!existed) this.saveCustomFeelings(custom);
    let feelings = this.data.feelings;
    let toast = '';
    if (feelings.indexOf(word) < 0) {
      if (feelings.length < q.MAX_FEELINGS) {
        feelings = feelings.concat([word]);
        if (existed) toast = `词表里已经有「${word}」，帮你选上了`;
      } else {
        toast = existed ? `词表里已经有「${word}」，先取消一个再选它` : '已加上，先取消一个再选它';
      }
    }
    this.setData({
      customFeelings: custom,
      hasCustom: q.customFeelingCount(custom) > 0,
      feelings,
      feelingGroups: feelingGroups(feelings, custom),
      addOpen: false,
      addText: ''
    });
    if (toast) wx.showToast({ title: toast, icon: 'none' });
    this.refreshHasContent();
    this.scheduleDraft();
  },

  // 长按自己加的词：问一句，确认后从词表里去掉（内置的词没有这个手势）
  removeCustomFeeling(event) {
    const { name, group } = event.currentTarget.dataset || {};
    const mine = this.data.customFeelings[group] || [];
    if (!name || mine.indexOf(name) < 0) return;
    appDialog.showModal({
      title: '删掉这个词？',
      content: `「${name}」会从你自己加的词里去掉，已经写过的觉察不受影响。`,
      confirmText: '删掉',
      cancelText: '留着',
      success: result => {
        if (!result || !result.confirm) return;
        const custom = q.removeCustomFeeling(this.data.customFeelings, group, name);
        const feelings = this.data.feelings.filter(word => word !== name);
        this.saveCustomFeelings(custom);
        this.setData({
          customFeelings: custom,
          hasCustom: q.customFeelingCount(custom) > 0,
          feelings,
          feelingGroups: feelingGroups(feelings, custom)
        });
        this.refreshHasContent();
        this.scheduleDraft();
      }
    });
  },

  // ---- 问：一叩、再叩、三叩 ----
  // answers 有几项，就展开到第几层。context 是出题时的心情，不传就沿用当前的
  buildAsks(variant, answers, htmls = [], context) {
    const ctx = context || this.data.ladderContext || q.ladderContext([]);
    const picked = q.pickLadder(this.data.habitKey, variant, ctx);
    const ladder = picked.questions;
    const levels = Math.min(Math.max(answers.length, 1), q.MAX_ASK_LEVEL);
    const askItems = [];
    for (let i = 0; i < levels; i += 1) {
      askItems.push({
        level: i + 1,
        label: text.LEVEL_LABELS[i],
        question: ladder[i],
        answer: answers[i] || '',
        answerHtml: htmls[i] || ''
      });
    }
    const copy = q.chooseCopy(picked.kind);
    this.setData({
      ladderVariant: variant,
      ladderContext: ctx,
      ladderKind: picked.kind,
      askLead: q.askLead(picked.kind, ctx),
      ladder,
      askItems,
      chooseQ: copy.question,
      choosePh: copy.placeholder,
      doneLine: copy.done,
      canSwap: this.swapAllowed(askItems, ctx)
    });
  },

  // 还有别的问题链可换、且一句回答都没写时，才能「换一问」
  swapAllowed(askItems, context) {
    const ctx = context || this.data.ladderContext || {};
    return q.ladderCount(this.data.habitKey, ctx.tone) > 1 && !askItems.some(item => item.answer.trim());
  },

  // 进入「问」时，问题跟着刚选的心情走。已经写了回答就不换，免得问题和回答对不上；
  // 明暗没变、只是换了个词，保留「换一问」换到的那一条
  syncLadder() {
    if (this.data.askItems.some(item => String(item.answer || '').trim())) return;
    const next = q.ladderContext(this.data.feelings, this.data.customFeelings);
    const current = this.data.ladderContext || {};
    if (next.tone === current.tone && next.heavyWord === current.heavyWord && next.brightWord === current.brightWord) return;
    this.buildAsks(next.tone === current.tone ? this.data.ladderVariant : 0, [], [], next);
  },

  onAnswer(event) {
    const index = Number(event.currentTarget.dataset.index);
    if (!this.data.askItems[index]) return;
    const detail = event.detail || {};
    const answer = detail.text !== undefined ? detail.text : detail.value || '';
    const askItems = this.data.askItems.map((item, i) => (i === index ? { ...item, answer, answerHtml: detail.html || '' } : item));
    this.setData({
      askItems,
      canSwap: this.swapAllowed(askItems)
    });
    this.refreshHasContent();
    this.scheduleDraft();
  },

  // 再往里一层（最多三层）：先写了这一层，才能往下一层
  deepen() {
    const items = this.data.askItems;
    if (items.length >= q.MAX_ASK_LEVEL) return;
    if (!items[items.length - 1].answer.trim()) {
      wx.showToast({ title: '先写一句，再往里一层', icon: 'none' });
      return;
    }
    const level = items.length + 1;
    this.setData({
      askItems: items.concat([
        { level, label: text.LEVEL_LABELS[level - 1], question: this.data.ladder[level - 1], answer: '', answerHtml: '' }
      ])
    });
    this.scheduleDraft();
  },

  // 换一条问题链：只在还没写任何回答时可以换，免得回答和问题对不上
  swapLadder() {
    if (!this.data.canSwap) return;
    this.buildAsks(this.data.ladderVariant + 1, []);
    this.scheduleDraft();
  },

  // ---- 择 ----
  onChoice(event) {
    const detail = event.detail || {};
    this.setData({ choice: detail.text !== undefined ? detail.text : detail.value || '', choiceHtml: detail.html || '' });
    this.refreshHasContent();
    this.scheduleDraft();
  },

  onRevisit(event) {
    this.setData({ revisit: Boolean(event.detail.value) });
    this.scheduleDraft();
  },

  // ---- 保存 ----
  // 现在有没有写到任何内容（决定「择」那一屏的完成按钮怎么放）
  hasAnyContent() {
    return hasContent(this.buildAwareness());
  },

  // 带格式的内容（颜色、加粗…）多带一份 HTML；没有格式就只有纯文本，请求内容和以前一样
  buildAwareness() {
    const { facts, factsHtml, feelings, bodyAreas, feelingNote, askItems, habitKey, choice, choiceHtml } = this.data;
    const awareness = {
      facts: facts.trim(),
      feelings,
      bodyAreas,
      feelingNote: feelingNote.trim(),
      asks: askItems
        .filter(item => item.answer.trim())
        .map(item => {
          const ask = { question: item.question, answer: item.answer.trim() };
          if (item.answerHtml) ask.answerHtml = item.answerHtml;
          return ask;
        }),
      habitKey,
      choice: choice.trim()
    };
    if (factsHtml) awareness.factsHtml = factsHtml;
    if (choiceHtml) awareness.choiceHtml = choiceHtml;
    return awareness;
  },

  async finish() {
    if (this.data.saving) return;
    const awareness = this.buildAwareness();
    if (!hasContent(awareness)) {
      wx.showToast({ title: '至少写一句，再完成', icon: 'none' });
      return;
    }
    this.setData({ saving: true });
    try {
      const withSource = Boolean(this.data.periodId);
      const payload = {
        kind: 'awareness',
        awareness,
        revisit: this.data.revisit && Boolean(awareness.choice),
        periodId: withSource ? this.data.periodId : null,
        sectionId: withSource ? this.data.sectionId || null : null
      };
      const title = this.data.title.trim();
      if (title) payload.title = title;
      const note = await service.create(payload);
      this._finished = true;
      clearTimeout(this._draftTimer);
      this.clearDraft();
      this.markJournalStale();
      this.setData({
        saving: false,
        step: 'done',
        progress: STEPS.length,
        light: true,
        noteId: String((note && (note.id || note._id)) || ''),
        summary: this.buildSummary(awareness),
        canCheckin: Boolean(withSource && this.data.sectionId)
      });
      this.applyChrome('done');
    } catch (error) {
      this.setData({ saving: false });
      const message = (error && error.message) || '';
      // 关联的期次或课程现在不能用了：问一句要不要不关联直接保存，文字不丢
      if (this.data.periodId && /期次|课程/.test(message)) {
        this.askDropAssociation(message);
        return;
      }
      wx.showToast({ title: message || '没存上，再试一次', icon: 'none' });
    }
  },

  askDropAssociation(message) {
    appDialog.showModal({
      title: '这一课现在不能关联',
      content: `${message}。不关联，直接保存吗？`,
      confirmText: '不关联保存',
      cancelText: '再想想',
      success: result => {
        if (result && result.confirm) {
          this.setData({ periodId: '', sectionId: '', sourceLabel: '' }, () => this.finish());
        }
      }
    });
  },

  buildSummary(awareness) {
    const asks = awareness.asks;
    return {
      title: this.data.title.trim(),
      dateLabel: text.dateWithDaypart(new Date()),
      facts: awareness.facts,
      feelings: awareness.feelings,
      keyAsk: asks.length ? asks[asks.length - 1].answer : '',
      choice: awareness.choice
    };
  },

  // 回到日记页时，让它重新读一遍列表（日记页 30 秒内不重复请求）
  markJournalStale() {
    try {
      const pages = typeof getCurrentPages === 'function' ? getCurrentPages() : [];
      const previous = pages[pages.length - 2];
      if (previous && previous.route === JOURNAL_ROUTE) previous._loadedAt = 0;
    } catch (error) {
      // 找不到上一页就算了
    }
  },

  // ---- 收：看我的日记 / 日签 / 打卡 ----
  goJournal() {
    this.leave();
  },

  leave() {
    const pages = typeof getCurrentPages === 'function' ? getCurrentPages() : [];
    if (pages.length > 1) {
      wx.navigateBack();
      return;
    }
    wx.redirectTo({ url: `/${JOURNAL_ROUTE}` });
  },

  makeCard() {
    const choice = (this.data.summary && this.data.summary.choice) || '';
    if (!choice) return;
    if (Array.from(choice).length > 120) {
      wx.showToast({ title: '这句有点长，在日记里编辑到 120 字以内再做日签', icon: 'none' });
      return;
    }
    wx.navigateTo({ url: `/pages/daily-card/daily-card?quote=${encodeURIComponent(choice)}` });
  },

  // 分享这一页：用刚保存的内容打开分享面板（转发、长图、谁能看、停止分享）
  shareNote() {
    const sheet = this.selectComponent && this.selectComponent('#joy-share');
    if (!sheet || !this.data.noteId) return;
    const awareness = this.buildAwareness();
    const note = {
      id: this.data.noteId,
      kind: 'awareness',
      title: this.data.title.trim(),
      createdAt: new Date().toISOString(),
      periodId: this.data.periodId,
      content: '',
      awareness: {
        ...awareness,
        asks: awareness.asks.map((ask, index) => ({ level: index + 1, ...ask })),
        followUps: []
      }
    };
    sheet.open(sharePoster.payloadFromNote(note, { authorName: text.authorName(), sourceLabel: this.data.sourceLabel }));
  },

  onShareAppMessage() {
    const sheet = this.selectComponent && this.selectComponent('#joy-share');
    const config = sheet && sheet.getShareConfig && sheet.getShareConfig();
    return config || { title: getDefaultShareTitle(), path: '/pages/index/index', imageUrl: getDefaultShareImage() };
  },

  // 发成打卡：把觉察写进这一课的打卡草稿再打开打卡页。默认「仅自己可见」，要不要公开到打卡页再选
  postAsCheckin() {
    const { sectionId, periodId, summary } = this.data;
    if (!sectionId) return;
    const body = text.composeText({
      ...this.buildAwareness(),
      choice: summary ? summary.choice : ''
    });
    const composed = summary && summary.title ? `${summary.title}\n${body}` : body;
    const app = typeof getApp === 'function' ? getApp() : null;
    const user = (app && app.globalData && app.globalData.userInfo) || {};
    const userId = user._id || user.id;
    if (!userId) {
      wx.showToast({ title: '请先登录', icon: 'none' });
      return;
    }
    const key = `checkin_draft_${userId}_${sectionId}`;
    // 只跳去打卡页：不带觉察内容过去，也不动打卡里已有的草稿
    const goCheckin = () => {
      wx.navigateTo({
        url: `/pages/checkin/checkin?sectionId=${encodeURIComponent(sectionId)}${periodId ? `&periodId=${encodeURIComponent(periodId)}` : ''}`
      });
    };
    const open = existing => {
      const content = existing && existing.content ? `${existing.content}\n\n${composed}` : composed;
      tenantStorage.set(key, {
        content,
        contentHtml: '',
        images: (existing && existing.images) || [],
        visibility: (existing && existing.visibility) || 'admin',
        mood: (existing && existing.mood) || '',
        savedAt: Date.now()
      });
      goCheckin();
    };
    let existing = null;
    try {
      existing = tenantStorage.get(key);
    } catch (error) {
      existing = null;
    }
    if (existing && existing.content) {
      appDialog.showModal({
        title: '打卡里已经有一份草稿',
        content: '把觉察接在草稿后面，还是不带过去？',
        confirmText: '接在后面',
        cancelText: '不带过去',
        success: result => {
          if (result && result.confirm) open(existing);
          else goCheckin();
        }
      });
      return;
    }
    open(null);
  },

  // ---- 退出 ----
  close() {
    this.flushDraft();
    this.leave();
  },

  // ---- 草稿（只放本机）----
  snapshot() {
    const d = this.data;
    return {
      version: 1,
      step: d.step === 'pause' ? 'see' : d.step,
      title: d.title,
      facts: d.facts,
      factsHtml: d.factsHtml,
      feelings: d.feelings,
      customFeelings: d.customFeelings,
      bodyAreas: d.bodyAreas,
      feelingNote: d.feelingNote,
      answers: d.askItems.map(item => item.answer),
      answerHtmls: d.askItems.map(item => item.answerHtml || ''),
      ladderVariant: d.ladderVariant,
      ladderContext: d.ladderContext,
      habitKey: d.habitKey,
      choice: d.choice,
      choiceHtml: d.choiceHtml,
      revisit: d.revisit,
      periodId: d.periodId,
      sectionId: d.sectionId,
      sourceLabel: d.sourceLabel,
      savedAt: Date.now()
    };
  },

  readDraft() {
    const draft = store.read(store.KEYS.awarenessDraft);
    return draft && draft.version === 1 && draftHasContent(draft) ? draft : null;
  },

  clearDraft() {
    store.write(store.KEYS.awarenessDraft, null);
  },

  scheduleDraft() {
    clearTimeout(this._draftTimer);
    this._draftTimer = setTimeout(() => this.flushDraft(), DRAFT_DELAY_MS);
  },

  flushDraft() {
    clearTimeout(this._draftTimer);
    // 已经保存成功、或正在等用户决定要不要接着上次写时，不动草稿
    if (this._finished || this._draftPaused || this.data.step === 'done') return;
    const draft = this.snapshot();
    if (!draftHasContent(draft)) return;
    store.write(store.KEYS.awarenessDraft, draft);
    this.setData({ savedHint: '已自动保存' });
    clearTimeout(this._savedTimer);
    this._savedTimer = setTimeout(() => this.setData({ savedHint: '' }), SAVED_HINT_MS);
  },

  restoreDraft(draft) {
    this.stopBreathing();
    const step = STEPS.includes(draft.step) && draft.step !== 'pause' ? draft.step : 'see';
    const answers = Array.isArray(draft.answers) ? draft.answers : [];
    const habitKey = q.HABIT_KEYS.includes(draft.habitKey) ? draft.habitKey : 'general';
    // 自己加的词：本机的词表和草稿里带的合在一起；认不出在哪一组的词（比如旧版本里的词）不带回来，免得选了却没处取消
    const custom = mergeCustomFeelings(this.data.customFeelings, draft.customFeelings);
    const feelings = (Array.isArray(draft.feelings) ? draft.feelings : []).filter(word => q.feelingGroupOf(word, custom));
    this.setData({
      step,
      progress: STEPS.indexOf(step),
      light: !DARK_STEPS.includes(step),
      breathDone: true,
      title: draft.title || '',
      facts: draft.facts || '',
      factsHtml: draft.factsHtml || '',
      seePh: q.pickSeePlaceholder(todayKey()),
      feelings,
      feelingGroups: feelingGroups(feelings, custom),
      customFeelings: custom,
      hasCustom: q.customFeelingCount(custom) > 0,
      addOpen: false,
      addText: '',
      bodyAreas: draft.bodyAreas || [],
      bodyChips: chips(q.BODY_AREAS, draft.bodyAreas || []),
      feelingNote: draft.feelingNote || '',
      habitKey,
      habitName: q.habitName(habitKey),
      choice: draft.choice || '',
      choiceHtml: draft.choiceHtml || '',
      revisit: draft.revisit !== false,
      revisitDate: revisitDateLabel(),
      periodId: draft.periodId || '',
      sectionId: draft.periodId ? draft.sectionId || '' : '',
      sourceLabel: draft.periodId ? draft.sourceLabel || '' : ''
    });
    this.buildAsks(Number(draft.ladderVariant) || 0, answers, Array.isArray(draft.answerHtmls) ? draft.answerHtmls : [], contextFrom(draft));
    this.refreshHasContent();
    this.applyChrome(step);
  },

  noop() {}
});
