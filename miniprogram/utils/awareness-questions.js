/**
 * 觉察日记的题库与小工具（静态内容，不接 AI，不发给任何人）。
 *
 * 八组问题：七个习惯各一组，加一组通用。每组有两种「一叩、再叩、三叩」的问题链：
 *   ladders（沉一点的心情：着急、委屈……）：看见自己在保护什么，真正想要的是什么
 *   seeds（亮一点的心情：开心、感动……）：顺着这份好心情，找到心里在意的那颗种子
 * 开心也好，难过也好，背后都藏着自己在意的东西，所以两种问题链最后都落到「我在意什么」：
 *   一叩：落在刚才发生的具体一件事上
 *   再叩：看进去一层（我在保护什么 / 它碰到了我在意的什么 / 对方经历了什么）
 *   三叩：回到真正想要的东西，或者心里的那颗种子
 * 问题里的 {feeling} 换成「感」里选的那个词；没选时换成「情绪」或「好心情」。
 * 「感」里找不到合适的词，可以自己加一个：加在哪一组，就按哪一组算明暗；自己加的词只放本机。
 * 保存时每条回答连同问题原文一起写入记录，之后改题库不影响历史。
 */

const HABITS = {
  habit1: {
    name: '积极主动',
    names: /积极主动|主动积极/,
    ordinal: 1,
    doors: [
      '今天有没有哪一刻，你的反应比念头还快？',
      '今天，你说了几次「我必须」「我没办法」？',
      '今天有哪一刻，你为自己的选择感到踏实？'
    ],
    ladders: [
      [
        '刚才发生的事里，哪一部分是我能决定的？',
        '那一刻，我是被事情推着走，还是自己选了回应？',
        '如果我在刺激与回应之间多停三秒，我会怎么选？'
      ],
      [
        '今天我把力气花在了哪里：关注圈，还是影响圈？',
        '这件事里，有哪一小块是我马上能动手的？',
        '做了这一小步，我会成为怎样的人？'
      ]
    ],
    seeds: [
      [
        '这份{feeling}里，哪一部分是我自己选、自己做到的？',
        '我为什么会这样选？那一刻，我看重的是什么？',
        '这份「我能选」的力量，是从哪里长出来的？'
      ]
    ]
  },
  habit2: {
    name: '以终为始',
    names: /以终为始/,
    ordinal: 2,
    doors: [
      '如果一年后回头看，今天这件事还重要吗？',
      '今天做的事，离你想成为的人近了一步吗？',
      '最近有哪一刻，你觉得「这就是我想过的日子」？'
    ],
    ladders: [
      [
        '今天最占用我的那件事，是为了什么？',
        '它和我真正想要的生活，是同一个方向吗？',
        '如果只保留一件，我想保留哪一件？'
      ],
      [
        '我希望身边的人，将来怎样谈起我？',
        '今天的我，离这个样子近了，还是远了？',
        '明天可以先调整哪一个小地方？'
      ]
    ],
    seeds: [
      [
        '这份{feeling}，和我想成为的样子有关系吗？',
        '它让我看见了自己真正在意的什么？',
        '如果它是一颗种子，我希望它将来长成什么样？'
      ]
    ]
  },
  habit3: {
    name: '要事第一',
    names: /要事第一|要事优先|重点优先/,
    ordinal: 3,
    doors: [
      '今天最重要的那件事，你做了吗？',
      '今天有哪件「紧急」的事，其实并不重要？',
      '今天有没有一件重要的事，你稳稳地做完了？'
    ],
    ladders: [
      [
        '今天我把时间给了什么？',
        '其中哪一件重要却不紧急，被挤掉了？',
        '明天我愿意先为它留出多长一段完整的时间？'
      ],
      [
        '今天我对哪件事说了「好」，心里其实想说「不」？',
        '我怕说「不」，是在担心什么？',
        '我可以怎样温和而清楚地说出来？'
      ]
    ],
    seeds: [
      [
        '这份{feeling}，和我今天把时间给了什么有关？',
        '这件事为什么对我这么重要？',
        '它在提醒我，什么才是我的「要事」？'
      ]
    ]
  },
  habit4: {
    name: '双赢思维',
    names: /双赢|利人利己/,
    ordinal: 4,
    doors: [
      '今天有哪一次，你把对话当成了输赢？',
      '最近有谁，你希望和 TA 彼此都好？',
      '今天有谁的好，让你也跟着高兴？'
    ],
    ladders: [
      [
        '刚才那件事里，我想要的是什么？',
        '对方想要的又是什么？',
        '有没有一种做法，让两个人都觉得被照顾到了？'
      ],
      [
        '今天有没有因为别人的好，我心里有点不是滋味？',
        '那份滋味，在提醒我缺了什么？',
        '我可以怎样真心替 TA 高兴一次？'
      ]
    ],
    seeds: [
      [
        '这份{feeling}里，还有谁？TA 也好吗？',
        '我们之间，是什么让彼此都觉得被照顾到了？',
        '这份「我们都好」，是我心里的哪一颗种子？'
      ]
    ]
  },
  habit5: {
    name: '知彼解己',
    names: /知彼解己|知彼|先理解|同理心/,
    ordinal: 5,
    doors: [
      '今天有没有一次，你急着给建议，却还没听完？',
      '今天有谁，值得你再多听一分钟？',
      '今天有谁，让你觉得被听懂了？'
    ],
    ladders: [
      [
        '那一刻，我有没有先听懂对方？',
        '如果我是 TA，那一刻我在经历什么？',
        '下一次，我可以先问的一句话是什么？'
      ],
      [
        '刚才的对话里，我是在听，还是在等着说？',
        '我急着说的那句话，是想解决问题，还是想被理解？',
        '我可以怎样先让 TA 觉得「被听见了」？'
      ]
    ],
    seeds: [
      [
        '这份{feeling}里，有没有一次「被听懂」，或者「听懂了别人」？',
        '那一刻，是什么让理解发生了？',
        '被听懂，或者听懂别人，为什么对我这么重要？'
      ]
    ]
  },
  habit6: {
    name: '统合综效',
    names: /统合综效|综合综效|协同增效|统合|综效/,
    ordinal: 6,
    doors: [
      '最近有谁和你想的不一样？那份不一样里有什么？',
      '今天有没有一次，别人的想法让你多看见了一点？',
      '今天有没有一次，和别人一起想出了更好的办法？'
    ],
    ladders: [
      [
        '和我意见不同的人，看到了什么是我没看到的？',
        '我的第一反应，是想说服，还是想了解？',
        '如果两种想法合在一起，会长出什么新的可能？'
      ],
      [
        '今天有没有一件事，我一个人扛了，其实可以一起做？',
        '我不开口求助，是在担心什么？',
        '我愿意先向谁开这个口？'
      ]
    ],
    seeds: [
      [
        '这份{feeling}，是我一个人得来的，还是和别人一起？',
        '别人的哪一点不同，让它比我想的更好？',
        '这让我看见了自己的哪一面？'
      ]
    ]
  },
  habit7: {
    name: '不断更新',
    names: /不断更新|持续更新|磨刀/,
    ordinal: 7,
    doors: [
      '最近一周，你给自己「磨刀」了吗？',
      '身体、头脑、心灵、关系，今天哪一块最需要被照顾？',
      '今天有什么事，让你觉得被滋养？'
    ],
    ladders: [
      [
        '这一周，我的身体、头脑、心灵、关系，哪一块被忽略了？',
        '是什么让我一直说「以后再说」？',
        '这周我愿意为它留出的一小段时间，是什么时候？'
      ],
      [
        '最近，有什么让我觉得被掏空了？',
        '我一直不肯停下来，是在担心什么？',
        '我可以先为自己补回哪一点点？'
      ]
    ],
    seeds: [
      [
        '这份{feeling}，照顾到了我的哪一块：身体、头脑、心灵，还是关系？',
        '它为什么能滋养我？',
        '被照顾到的这一块，平时是不是常被我忽略？'
      ]
    ]
  },
  general: {
    name: '',
    names: null,
    ordinal: 0,
    doors: [
      '今天，有没有哪一刻，你的反应比念头还快？',
      '此刻，你心里最重的一件事是什么？',
      '今天有哪一刻，想停下来看一看自己？',
      '今天有哪一刻，让你心里一亮？',
      '最近有什么好事，值得停下来再看一眼？'
    ],
    ladders: [
      [
        '那一刻，我最在意的是什么？',
        '我在保护什么，或者害怕失去什么？',
        '如果不被这份{feeling}推着走，我真正想要的是什么？'
      ],
      [
        '这件事里，哪一部分是我能做的？',
        '哪一部分，我其实在等别人先改变？',
        '我愿意先迈出的那一小步是什么？'
      ]
    ],
    seeds: [
      [
        '这份{feeling}，是从哪一刻开始的？',
        '为什么偏偏是这件事？它碰到了我心里在意的什么？',
        '这份在意，是我心里的哪一颗种子？'
      ],
      [
        '这份{feeling}里，我最想记住哪一个画面？',
        '那个画面里，我心里的哪一份需要被满足了？（被看见、被信任、被需要、在成长……）',
        '它让我看见了一个怎样的自己？'
      ]
    ]
  }
};

const HABIT_KEYS = Object.keys(HABITS);

// 「感」：情绪词，最多选三个。沉一点的、亮一点的各八个：开心的事和难受的事，一样值得看一看
const HEAVY_FEELINGS = ['着急', '焦虑', '生气', '委屈', '难过', '失落', '无力', '内疚'];
const BRIGHT_FEELINGS = ['开心', '感动', '温暖', '感恩', '平静', '踏实', '欣慰', '自豪'];
const FEELINGS = HEAVY_FEELINGS.concat(BRIGHT_FEELINGS);
const FEELING_GROUPS = [
  { key: 'heavy', label: '沉一点的', words: HEAVY_FEELINGS },
  { key: 'bright', label: '亮一点的', words: BRIGHT_FEELINGS }
];
// 「感」：身体哪里有感觉，最多选三处
const BODY_AREAS = ['头', '喉咙', '胸口', '肩颈', '胃', '手', '全身'];
const MAX_FEELINGS = 3;
const MAX_BODY_AREAS = 3;
const MAX_ASK_LEVEL = 3;

// 「感」里自己加的词：每个词最多 8 个字（与服务端一致），每组最多加 8 个；加在哪一组，就按哪一组算明暗
const MAX_FEELING_LENGTH = 8;
const MAX_CUSTOM_FEELINGS = 8;
const FEELING_GROUP_KEYS = FEELING_GROUPS.map(group => group.key);
// 加词输入框里举的例子：都是词表里没有的词
const FEELING_EXAMPLES = { heavy: '担心', bright: '期待' };

// 心情的明暗：只选了亮的、只选了沉的、两种都有、没选
const TONES = ['heavy', 'bright', 'mixed', 'none'];
// 问题里的 {feeling} 没有词可换时用的说法
const HEAVY_FALLBACK = '情绪';
const SEED_FALLBACK = '好心情';

// 「择」的问题、输入框提示和「收」的那句话，跟着「问」用的那种问题链走
const CHOOSE_COPY = {
  heavy: { question: '下一次，我想怎样回应？', placeholder: '明天，我想先……', done: '看见，就是改变的开始。' },
  seed: { question: '我想怎样，让这颗种子再长一点？', placeholder: '明天，我想……', done: '被看见的种子，会慢慢长大。' }
};

// 随喜速记条里输入框的提示语，每天换一句
const JOY_PLACEHOLDERS = [
  '此刻有什么触动，或冒出来的想法？',
  '刚才哪句话，让你有些触动？',
  '听到了什么，想先记下来？'
];

// 「看」输入框里的例子：难受的事、开心的事轮着出现
const SEE_PLACEHOLDERS = [
  '例如：早上出门前，孩子磨蹭了十分钟…',
  '例如：下班进门，孩子跑过来抱了我一下…'
];

const CHINESE_DIGITS = { 一: 1, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7 };

function ordinalOf(text) {
  // 「第三个习惯」「习惯三」「习惯 3」。不匹配「七个习惯晨读营」里的「七个习惯」。
  const match = /第\s*([一二三四五六七1-7])\s*个\s*习惯|习惯\s*([一二三四五六七1-7])(?![个天期章节])/.exec(text);
  if (!match) return 0;
  const raw = match[1] || match[2];
  return CHINESE_DIGITS[raw] || Number(raw) || 0;
}

/**
 * 按课程标题识别是第几个习惯，识别不出就用通用组。
 * 只看课程标题：期次名里常有「七个习惯」，不能拿来判断。
 */
function detectHabit(...titles) {
  for (const raw of titles) {
    const text = String(raw || '');
    if (!text) continue;
    for (const key of HABIT_KEYS) {
      const habit = HABITS[key];
      if (habit.names && habit.names.test(text)) return key;
    }
    const ordinal = ordinalOf(text);
    if (ordinal) return `habit${ordinal}`;
  }
  return 'general';
}

function habitName(key) {
  return (HABITS[key] && HABITS[key].name) || '';
}

function hashOf(text) {
  let hash = 0;
  const value = String(text || '');
  for (let i = 0; i < value.length; i += 1) hash = (hash * 31 + value.charCodeAt(i)) % 1000003;
  return hash;
}

/**
 * 觉察日记页「门」上的那句话：同一天固定，隔天换。
 * 有习惯时，一半的日子用习惯组的话，另一半用通用组，不会天天只有同一类。
 * 每组都有问难受那一刻的，也有问心里一亮那一刻的。
 */
function pickDoorLine(habitKey, dayKey) {
  const key = HABITS[habitKey] ? habitKey : 'general';
  const pool = key === 'general' ? HABITS.general.doors : HABITS[key].doors.concat(HABITS.general.doors);
  return pool[hashOf(`${dayKey}:${key}`) % pool.length];
}

/** 整理一个自己加的情绪词：空白折叠、去掉首尾空白，最多 8 个字。返回 { ok, word, reason }，reason 是 empty 或 long */
function cleanFeelingWord(value) {
  const word = String(value === undefined || value === null ? '' : value).replace(/\s+/g, ' ').trim();
  if (!word) return { ok: false, reason: 'empty', word: '' };
  if (Array.from(word).length > MAX_FEELING_LENGTH) return { ok: false, reason: 'long', word };
  return { ok: true, word };
}

function emptyCustomFeelings() {
  return { heavy: [], bright: [] };
}

/**
 * 读出自己加的词（本机存的，或草稿里带的）：只认「沉一点的」「亮一点的」两组，
 * 去掉空的、太长的、重复的，以及和内置词重复的，每组最多 8 个。
 */
function normalizeCustomFeelings(raw) {
  const source = raw && typeof raw === 'object' ? raw : {};
  const result = emptyCustomFeelings();
  const taken = new Set(FEELINGS);
  FEELING_GROUP_KEYS.forEach(key => {
    const list = Array.isArray(source[key]) ? source[key] : [];
    list.forEach(item => {
      if (typeof item !== 'string' || result[key].length >= MAX_CUSTOM_FEELINGS) return;
      const cleaned = cleanFeelingWord(item);
      if (!cleaned.ok || taken.has(cleaned.word)) return;
      taken.add(cleaned.word);
      result[key].push(cleaned.word);
    });
  });
  return result;
}

function customFeelingCount(custom) {
  const list = normalizeCustomFeelings(custom);
  return list.heavy.length + list.bright.length;
}

/** 这个词在哪一组（内置的和自己加的都算）：'heavy'、'bright'；不认识的词返回 '' */
function feelingGroupOf(word, custom) {
  if (HEAVY_FEELINGS.indexOf(word) >= 0) return 'heavy';
  if (BRIGHT_FEELINGS.indexOf(word) >= 0) return 'bright';
  const mine = custom && typeof custom === 'object' ? custom : {};
  if (Array.isArray(mine.heavy) && mine.heavy.indexOf(word) >= 0) return 'heavy';
  if (Array.isArray(mine.bright) && mine.bright.indexOf(word) >= 0) return 'bright';
  return '';
}

/**
 * 加一个自己的词到某一组。词表里已经有这个词（内置的、自己加过的，不论在哪一组）就不重复加，
 * 告诉调用方它在哪一组，方便直接帮用户选上。
 * 返回 { ok: true, word, group, existed, custom } 或 { ok: false, reason }，reason 是 group、empty、long、full。
 */
function addCustomFeeling(custom, group, value) {
  if (FEELING_GROUP_KEYS.indexOf(group) < 0) return { ok: false, reason: 'group' };
  const cleaned = cleanFeelingWord(value);
  if (!cleaned.ok) return { ok: false, reason: cleaned.reason };
  const current = normalizeCustomFeelings(custom);
  const existing = feelingGroupOf(cleaned.word, current);
  if (existing) return { ok: true, word: cleaned.word, group: existing, existed: true, custom: current };
  if (current[group].length >= MAX_CUSTOM_FEELINGS) return { ok: false, reason: 'full' };
  current[group].push(cleaned.word);
  return { ok: true, word: cleaned.word, group, existed: false, custom: current };
}

function removeCustomFeeling(custom, group, word) {
  const current = normalizeCustomFeelings(custom);
  if (FEELING_GROUP_KEYS.indexOf(group) >= 0) current[group] = current[group].filter(item => item !== word);
  return current;
}

/**
 * 从「感」里选的词看心情的明暗。不认识的词（比如旧版本里的词）不算；
 * 自己加的词（custom）加在哪一组，就按哪一组算。
 * 返回 { tone, heavyWord, brightWord }：两个词分别是选的第一个沉的、第一个亮的，用来换进问题里。
 */
function ladderContext(feelings, custom) {
  const list = Array.isArray(feelings) ? feelings : [];
  const bright = list.filter(word => feelingGroupOf(word, custom) === 'bright');
  const heavy = list.filter(word => feelingGroupOf(word, custom) === 'heavy');
  let tone = 'none';
  if (bright.length && heavy.length) tone = 'mixed';
  else if (bright.length) tone = 'bright';
  else if (heavy.length) tone = 'heavy';
  return { tone, heavyWord: heavy[0] || '', brightWord: bright[0] || '' };
}

/**
 * 按心情排好可以选的问题链（「换一问」就在这里面循环）：
 *   只选了亮的：这个习惯的种子问题，再是通用的两条
 *   只选了沉的：这个习惯原来的两条
 *   两种都有、或者没选：先给沉的两条，「换一问」能换到种子
 * 不传心情时按沉的算，和改版前一样。
 */
function poolOf(habitKey, tone = 'heavy') {
  const key = HABITS[habitKey] ? habitKey : 'general';
  const heavy = HABITS[key].ladders.map(questions => ({ kind: 'heavy', questions }));
  const seedLadders = key === 'general' ? HABITS.general.seeds : HABITS[key].seeds.concat(HABITS.general.seeds);
  const seeds = seedLadders.map(questions => ({ kind: 'seed', questions }));
  if (tone === 'bright') return seeds;
  if (tone === 'mixed' || tone === 'none') return heavy.concat(seeds);
  return heavy;
}

function fill(question, word) {
  return String(question).split('{feeling}').join(word);
}

/**
 * 一条「一叩、再叩、三叩」的问题链；variant 从 0 起，超出后循环（「换一问」用）。
 * 返回 { kind: 'heavy' | 'seed', questions }，问题里的 {feeling} 已经换成选的那个词。
 */
function pickLadder(habitKey, variant = 0, context = {}) {
  const ctx = context || {};
  const pool = poolOf(habitKey, ctx.tone);
  const count = pool.length;
  const index = (((Number(variant) || 0) % count) + count) % count;
  const entry = pool[index];
  const word = entry.kind === 'seed' ? ctx.brightWord || SEED_FALLBACK : ctx.heavyWord || HEAVY_FALLBACK;
  return { kind: entry.kind, questions: entry.questions.map(question => fill(question, word)) };
}

function getLadder(habitKey, variant = 0, context = {}) {
  return pickLadder(habitKey, variant, context).questions;
}

function ladderCount(habitKey, tone) {
  return poolOf(habitKey, tone).length;
}

/** 「问」那一屏上面的一句引子：顺着刚选的心情往里看 */
function askLead(kind, context = {}) {
  const ctx = context || {};
  if (kind === 'seed') return `顺着这份${ctx.brightWord || SEED_FALLBACK}，找一找心里的种子`;
  return ctx.heavyWord ? `顺着这份${ctx.heavyWord}，往里看一看` : '';
}

function chooseCopy(kind) {
  return { ...CHOOSE_COPY[kind === 'seed' ? 'seed' : 'heavy'] };
}

function pickJoyPlaceholder(dayKey) {
  return JOY_PLACEHOLDERS[hashOf(dayKey) % JOY_PLACEHOLDERS.length];
}

function pickSeePlaceholder(dayKey) {
  return SEE_PLACEHOLDERS[hashOf(`see:${dayKey}`) % SEE_PLACEHOLDERS.length];
}

module.exports = {
  HABITS,
  HABIT_KEYS,
  FEELINGS,
  HEAVY_FEELINGS,
  BRIGHT_FEELINGS,
  FEELING_GROUPS,
  BODY_AREAS,
  MAX_FEELINGS,
  MAX_BODY_AREAS,
  MAX_ASK_LEVEL,
  MAX_FEELING_LENGTH,
  MAX_CUSTOM_FEELINGS,
  FEELING_GROUP_KEYS,
  FEELING_EXAMPLES,
  TONES,
  JOY_PLACEHOLDERS,
  SEE_PLACEHOLDERS,
  detectHabit,
  habitName,
  pickDoorLine,
  cleanFeelingWord,
  emptyCustomFeelings,
  normalizeCustomFeelings,
  customFeelingCount,
  feelingGroupOf,
  addCustomFeeling,
  removeCustomFeeling,
  ladderContext,
  pickLadder,
  getLadder,
  ladderCount,
  askLead,
  chooseCopy,
  pickJoyPlaceholder,
  pickSeePlaceholder
};
