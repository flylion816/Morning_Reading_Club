import type {
  KnowledgeEntry,
  ObserverSession,
  PolishedSpeakerContent,
  SpeakerCard,
  SpeakerInsight,
  SummaryTemplateMode,
  Theme,
  TranscriptLine,
  TranscriptOrganizeResult,
  TranscriptWorkspace,
  WholeSessionSummary,
} from './types';

export const speakerContentPolishSchema = {
  name: 'speaker_content_polish',
  schema: {
    type: 'object',
    additionalProperties: false,
    required: ['polishedContent'],
    properties: {
      polishedContent: { type: 'string' },
    },
  },
};

export const transcriptOrganizeSchema = {
  name: 'transcript_organize',
  schema: {
    type: 'object',
    additionalProperties: false,
    required: ['entries'],
    properties: {
      entries: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['speakerName', 'time', 'text'],
          properties: {
            speakerName: { type: 'string' },
            time: { type: 'string' },
            text: { type: 'string' },
          },
        },
      },
      transcriptText: { type: 'string' },
    },
  },
};

export const speakerInsightSchema = {
  name: 'speaker_insight',
  schema: {
    type: 'object',
    additionalProperties: false,
    required: [
      'suggestedSpeakerName',
      'strongestPoint',
      'underlyingPattern',
      'themeConnection',
      'stuckType',
      'seenNeed',
      'suggestedObserverStory',
      'storyUseBoundary',
      'oneMinuteResponse',
      'deepResponse',
      'powerfulQuestion',
      'goldenSentence',
      'doNotSay',
    ],
    properties: {
      suggestedSpeakerName: { type: 'string' },
      strongestPoint: { type: 'string' },
      underlyingPattern: { type: 'string' },
      themeConnection: { type: 'string' },
      stuckType: { type: 'string' },
      seenNeed: { type: 'string' },
      suggestedObserverStory: { type: 'string' },
      storyUseBoundary: { type: 'string' },
      oneMinuteResponse: { type: 'string' },
      deepResponse: { type: 'string' },
      powerfulQuestion: { type: 'string' },
      goldenSentence: { type: 'string' },
      doNotSay: {
        type: 'array',
        items: { type: 'string' },
      },
    },
  },
};

export const wholeSessionSchema = {
  name: 'whole_session_summary',
  schema: {
    type: 'object',
    additionalProperties: false,
    required: [
      'templateDecision',
      'courseTheme',
      'commonTheme',
      'speakerLessons',
      'keyResponse',
      'structuredSections',
      'goldenSentences',
      'oneSentenceSummaries',
      'closingSentence',
      'missingSpeakers',
    ],
    properties: {
      templateDecision: {
        type: 'object',
        additionalProperties: false,
        required: ['template', 'templateName', 'reason', 'sceneSignals'],
        properties: {
          template: { type: 'string', enum: ['resonance', 'structure', 'hybrid'] },
          templateName: { type: 'string' },
          reason: { type: 'string' },
          sceneSignals: {
            type: 'array',
            items: { type: 'string' },
          },
        },
      },
      courseTheme: { type: 'string' },
      commonTheme: { type: 'string' },
      speakerLessons: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['speakerName', 'lesson', 'themeConnection'],
          properties: {
            speakerName: { type: 'string' },
            lesson: { type: 'string' },
            themeConnection: { type: 'string' },
          },
        },
      },
      keyResponse: { type: 'string' },
      structuredSections: {
        type: 'array',
        minItems: 5,
        maxItems: 8,
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['key', 'title', 'body'],
          properties: {
            key: { type: 'string' },
            title: { type: 'string' },
            body: { type: 'string' },
          },
        },
      },
      goldenSentences: {
        type: 'array',
        items: { type: 'string' },
      },
      oneSentenceSummaries: {
        type: 'array',
        minItems: 3,
        maxItems: 3,
        items: { type: 'string' },
      },
      closingSentence: { type: 'string' },
      missingSpeakers: {
        type: 'array',
        items: { type: 'string' },
      },
    },
  },
};

const summaryTemplateRules = {
  auto: {
    label: '自动推荐',
    instruction:
      '先判断整场内容更适合哪套模板：情绪浓度高、个人痛苦和生活细节多，用 resonance；概念观点多、内容分散、需要清晰梳理，用 structure；既有情绪又有明确课程主题，用 hybrid。',
  },
  resonance: {
    label: '共振型',
    instruction: '用户手动指定使用 resonance 共振型模板，不要再切到其他模板。',
  },
  structure: {
    label: '结构型',
    instruction: '用户手动指定使用 structure 结构型模板，不要再切到其他模板。',
  },
  hybrid: {
    label: '融合型',
    instruction: '用户手动指定使用 hybrid 融合型模板，不要再切到其他模板。',
  },
} satisfies Record<SummaryTemplateMode, { label: string; instruction: string }>;

const observerStyleRules = {
  resonance: [
    '珊珊型表达特征：先接住现场感受，再讲观点；多用“我听到”“我看到”“这让我想到”“我想轻轻回应”。',
    '从一个生活细节提炼核心词，不急着下判断，把人放在成长过程中看。',
    '重视心念、觉察、尊重、能量、生命状态；结尾要温柔但有力量。',
  ],
  structure: [
    '金玲型表达特征：先定义概念，再拆层次；多用“第一层、第二层、第三层”“表层是、本质是、落地是”。',
    '把很多人的分享整理成共同模式，从课程概念出发讲清楚原理、案例、方法。',
    '结尾给具体行动建议或清晰观点锚点，避免散文化漂浮。',
  ],
  hybrid: [
    '融合型表达特征：前半段像珊珊，先共振接住人；中段像金玲，讲清楚结构；后半段像观察者本人，用真实经历给方向。',
    '观察者的表达关键词是真诚、清醒、克制、有现场感；经历过真实崩塌，所以能陪别人重新看见选择权。',
  ],
};

export function cleanSourceText(text: string) {
  return text
    .replace(/^已上传图片：[^。\n]*(?:。请先识别图片中的会议转写、字幕、聊天或截图文字，再结合当天课程分析。)?\s*/gm, '')
    .replace(/^图片\s*OCR\s*识别结果（[^）]*）：\s*/gm, '')
    .replace(/^图片\s*OCR\s*识别结果\([^)]*\):\s*/gim, '')
    .replace(/^OCR\s*识别结果（[^）]*）：\s*/gm, '')
    .replace(/^OCR\s*识别结果\([^)]*\):\s*/gim, '')
    .replace(/回到\s*最新\s*位置/g, '')
    .trim();
}

export function speakerSourceText(speaker: SpeakerCard) {
  const polished = speaker.polishedContent?.trim();
  if (polished) {
    return polished;
  }
  return speaker.snippets
    .map((snippet) => cleanSourceText(snippet.text))
    .filter(Boolean)
    .join('\n');
}

export function createLocalPolishedSpeakerContent(speaker: SpeakerCard): PolishedSpeakerContent {
  const polishedContent =
    speaker.snippets
      .map((snippet) => cleanSourceText(snippet.text))
      .filter(Boolean)
      .join('\n')
      .replace(/[ \t]+/g, ' ')
      .replace(/\n{3,}/g, '\n\n')
      .trim() || '还没有可整理的 OCR 或转写文字。';
  return {
    polishedContent,
    generatedBy: 'local',
  };
}

function secondsFromTime(time: string) {
  const match = time.match(/(\d{1,2}):(\d{2})(?::(\d{2}))?/);
  if (!match) {
    return Number.MAX_SAFE_INTEGER;
  }
  const hours = Number(match[1] || 0);
  const minutes = Number(match[2] || 0);
  const seconds = Number(match[3] || 0);
  return hours * 3600 + minutes * 60 + seconds;
}

function normalizeTranscriptLineKey(entry: TranscriptLine) {
  return `${entry.speakerName}|${entry.time}|${entry.text}`.replace(/\s+/g, '').toLowerCase();
}

function normalizeTranscriptTextForDuplicate(text: string) {
  return cleanTranscriptUtterance(text)
    .replace(/[的地得]/g, '的')
    .replace(/\s+/g, '')
    .replace(/[，。！？、；;：:,.!?'"“”‘’（）()[\]【】《》<>《》\-—_]/g, '')
    .toLowerCase();
}

function transcriptTextSimilarity(a: string, b: string) {
  const left = normalizeTranscriptTextForDuplicate(a);
  const right = normalizeTranscriptTextForDuplicate(b);
  if (!left || !right) {
    return 0;
  }
  if (left === right) {
    return 1;
  }
  const shorter = left.length <= right.length ? left : right;
  const longer = left.length > right.length ? left : right;
  if (longer.includes(shorter) && shorter.length >= Math.min(12, longer.length)) {
    return shorter.length / longer.length;
  }
  const distance = transcriptSpeakerDistance(left, right);
  return 1 - distance / Math.max(left.length, right.length);
}

function transcriptTextOverlapRatio(a: string, b: string) {
  const left = Array.from(normalizeTranscriptTextForDuplicate(a));
  const right = Array.from(normalizeTranscriptTextForDuplicate(b));
  if (left.length === 0 || right.length === 0) {
    return 0;
  }
  let longest = 0;
  let previous = Array(right.length + 1).fill(0);
  for (let i = 1; i <= left.length; i += 1) {
    const current = Array(right.length + 1).fill(0);
    for (let j = 1; j <= right.length; j += 1) {
      if (left[i - 1] === right[j - 1]) {
        current[j] = previous[j - 1] + 1;
        longest = Math.max(longest, current[j]);
      }
    }
    previous = current;
  }
  return longest / Math.min(left.length, right.length);
}

function shouldMergeTranscriptEntries(a: TranscriptLine, b: TranscriptLine) {
  if (normalizeTranscriptSpeakerAlias(a.speakerName) !== normalizeTranscriptSpeakerAlias(b.speakerName)) {
    return false;
  }
  const timeDistance = Math.abs(secondsFromTime(a.time) - secondsFromTime(b.time));
  if (timeDistance > 1) {
    return false;
  }
  const left = normalizeTranscriptTextForDuplicate(a.text);
  const right = normalizeTranscriptTextForDuplicate(b.text);
  const shorterLength = Math.min(left.length, right.length);
  if (shorterLength < 8) {
    return left === right;
  }
  if (left.includes(right) || right.includes(left)) {
    return shorterLength >= 10;
  }
  if (transcriptTextOverlapRatio(a.text, b.text) >= 0.72) {
    return true;
  }
  return transcriptTextSimilarity(a.text, b.text) >= 0.78;
}

function transcriptEntryNoiseScore(entry: TranscriptLine) {
  const text = entry.text.trim();
  let score = 0;
  const speakerEcho = text.match(/(?:^|[\s，。！？、；;：:])([0-9]{1,2}号[-—–｜|]?[A-Za-z\u4e00-\u9fa5]{1,8}|[A-Za-z\u4e00-\u9fa5]{2,10})$/);
  if (speakerEcho && areLikelySameTranscriptSpeaker(speakerEcho[1], entry.speakerName)) {
    score += 8;
  }
  if (/^(.{2,8})\s+\1/.test(text)) {
    score += 4;
  }
  if (/(.)\1{4,}/.test(text)) {
    score += 2;
  }
  return score;
}

function preferTranscriptEntry(a: TranscriptLine, b: TranscriptLine) {
  const normalizedA = normalizeTranscriptTextForDuplicate(a.text);
  const normalizedB = normalizeTranscriptTextForDuplicate(b.text);
  const noiseDelta = transcriptEntryNoiseScore(a) - transcriptEntryNoiseScore(b);
  if (noiseDelta !== 0 && Math.abs(normalizedA.length - normalizedB.length) <= 16) {
    return noiseDelta < 0 ? a : b;
  }
  if (normalizedA.length !== normalizedB.length) {
    return normalizedA.length > normalizedB.length ? a : b;
  }
  if (a.text.length !== b.text.length) {
    return a.text.length > b.text.length ? a : b;
  }
  return secondsFromTime(a.time) <= secondsFromTime(b.time) ? a : b;
}

function maxTranscriptOverlapWithPrevious(entry: TranscriptLine, previousEntries: TranscriptLine[]) {
  return previousEntries.reduce((maxOverlap, previous) => Math.max(maxOverlap, transcriptTextOverlapRatio(entry.text, previous.text)), 0);
}

function transcriptEntrySelectionScore(entry: TranscriptLine, previousEntries: TranscriptLine[]) {
  const normalizedLength = normalizeTranscriptTextForDuplicate(entry.text).length;
  const previousOverlap = maxTranscriptOverlapWithPrevious(entry, previousEntries);
  const overlapPenalty = previousOverlap >= 0.88 ? 120 : previousOverlap >= 0.76 ? 70 : previousOverlap * 24;
  const speakerPenalty = isGenericTranscriptSpeakerName(entry.speakerName) ? 30 : 0;
  return Math.min(normalizedLength, 240) - transcriptEntryNoiseScore(entry) * 28 - overlapPenalty - speakerPenalty;
}

function chooseBestTranscriptEntryForSameTime(entries: TranscriptLine[], previousEntries: TranscriptLine[]) {
  return entries
    .slice()
    .sort((a, b) => {
      const scoreDelta = transcriptEntrySelectionScore(b, previousEntries) - transcriptEntrySelectionScore(a, previousEntries);
      if (Math.abs(scoreDelta) > 0.001) {
        return scoreDelta;
      }
      const lengthDelta = normalizeTranscriptTextForDuplicate(b.text).length - normalizeTranscriptTextForDuplicate(a.text).length;
      if (lengthDelta) {
        return lengthDelta;
      }
      return transcriptEntryNoiseScore(a) - transcriptEntryNoiseScore(b);
    })[0];
}

function dedupeTranscriptEntries(entries: TranscriptLine[]) {
  const result: TranscriptLine[] = [];
  const timeGroups = new Map<string, TranscriptLine[]>();
  entries.forEach((entry) => {
    const group = timeGroups.get(entry.time) || [];
    group.push(entry);
    timeGroups.set(entry.time, group);
  });
  Array.from(timeGroups.entries())
    .sort((a, b) => secondsFromTime(a[0]) - secondsFromTime(b[0]))
    .forEach(([, sameTimeEntries]) => {
      const entry = sameTimeEntries.length === 1 ? sameTimeEntries[0] : chooseBestTranscriptEntryForSameTime(sameTimeEntries, result);
    const duplicateIndex = result.findIndex((existing) => shouldMergeTranscriptEntries(existing, entry));
    if (duplicateIndex >= 0) {
      result[duplicateIndex] = preferTranscriptEntry(result[duplicateIndex], entry);
    } else {
      result.push(entry);
    }
    });
  return result;
}

function normalizeTranscriptSpeakerAlias(name: string) {
  return name
    .replace(/\s+/g, '')
    .replace(/[·•.,，。:：;；'"“”‘’()（）【】\[\]{}《》<>_\-—–｜|/\\]/g, '')
    .toLowerCase();
}

function normalizeTranscriptOcrSpeakerAlias(name: string) {
  const charMap: Record<string, string> = {
    注: '汪',
    江: '汪',
    汪: '汪',
    端: '瑞',
    瑞: '瑞',
    厉: '历',
    歷: '历',
  };
  return Array.from(normalizeTranscriptSpeakerAlias(name))
    .map((char) => charMap[char] || char)
    .join('');
}

function transcriptSpeakerDistance(a: string, b: string) {
  const left = Array.from(a);
  const right = Array.from(b);
  const matrix = Array.from({ length: left.length + 1 }, () => Array(right.length + 1).fill(0));
  for (let i = 0; i <= left.length; i += 1) {
    matrix[i][0] = i;
  }
  for (let j = 0; j <= right.length; j += 1) {
    matrix[0][j] = j;
  }
  for (let i = 1; i <= left.length; i += 1) {
    for (let j = 1; j <= right.length; j += 1) {
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + (left[i - 1] === right[j - 1] ? 0 : 1)
      );
    }
  }
  return matrix[left.length][right.length];
}

function shouldUseFullTranscriptSpeakerName(shortName: string, fullName: string) {
  if (!shortName || !fullName || shortName === fullName) {
    return false;
  }
  const shortAlias = normalizeTranscriptSpeakerAlias(shortName);
  const fullAlias = normalizeTranscriptSpeakerAlias(fullName);
  if (!shortAlias || !fullAlias || shortAlias === fullAlias || fullAlias.length <= shortAlias.length) {
    return false;
  }
  if (shortAlias.length < 3 || !fullAlias.startsWith(shortAlias)) {
    return false;
  }
  const hasFullNameSignal = /[-—–｜|]/.test(fullName) || fullAlias.length >= shortAlias.length + 2;
  return hasFullNameSignal;
}

function splitTranscriptSpeakerRole(name: string) {
  const compact = name.trim().replace(/\s+/g, '');
  const separated = compact.match(/^(.*[-—–｜|])([^—–｜|\-]+)$/);
  if (separated) {
    return {
      prefix: separated[1],
      tail: separated[2],
    };
  }
  const numbered = compact.match(/^(\d{1,2}号)(.+)$/);
  if (numbered) {
    return {
      prefix: `${numbered[1]}-`,
      tail: numbered[2],
    };
  }
  return {
    prefix: '',
    tail: compact,
  };
}

function isLikelyInvitedSpeakerName(name: string) {
  const normalized = normalizeTranscriptSpeakerAlias(name);
  if (normalized.length < 2 || normalized.length > 8) {
    return false;
  }
  if (/\d/.test(normalized) && !/号/.test(name)) {
    return false;
  }
  return !/(大家|各位|今天|现在|接下来|下面|老师|同学|伙伴|书友|主持人|发言人|分享|进行|邀请|会议|课程|时间|问题|屏幕|腾讯会议|谁|谁来|回应|回答|一下)/.test(normalized);
}

function extractInvitedTranscriptSpeakerNames(text: string) {
  const source = cleanSourceText(text);
  const candidates: string[] = [];
  const addCandidate = (value: string) => {
    const compact = value
      .trim()
      .replace(/\s+/g, '')
      .replace(/[，。！？；;：:、,.!？]+$/g, '')
      .replace(/(?:进行|来|做|分享|发言|讲话|讲|聊|谈|回应|回答|说|交流|一下)+$/g, '');
    if (isLikelyInvitedSpeakerName(compact)) {
      candidates.push(compact);
    }
  };
  const patterns = [
    /(?:邀请到?|有请|请|接下来(?:有请|请|邀请到?)?|下面(?:有请|请|邀请到?)?|下一位(?:有请|请|邀请到?)?|要邀请到?)\s*([0-9]{0,2}号?[-—–｜|]?[A-Za-z\u4e00-\u9fa5]{2,8})(?=\s*(?:进行|来|做|分享|发言|讲|聊|谈|回应|回答|说|交流|。|，|,|\.|！|!|\?|？|\s|$))/g,
    /(?:邀请到?|有请|请|接下来(?:有请|请|邀请到?)?|下面(?:有请|请|邀请到?)?|下一位(?:有请|请|邀请到?)?)[^，。！？\n]{0,16}?([0-9]{0,2}号?[-—–｜|]?[A-Za-z\u4e00-\u9fa5]{2,8})(?=\s*(?:进行|来|做|分享|发言|讲|聊|谈|回应|回答|说|交流))/g,
    /([0-9]{0,2}号?[-—–｜|]?[A-Za-z\u4e00-\u9fa5]{2,8})(?=\s*(?:进行)?(?:回应|回答|分享|发言|讲话|交流))/g,
  ];
  patterns.forEach((pattern) => {
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(source)) !== null) {
      const before = source.slice(Math.max(0, match.index - 24), match.index);
      if (pattern.source.startsWith('([0-9]') && !/(邀请|有请|请|下面|接下来|下一位|回应)/.test(before)) {
        continue;
      }
      addCandidate(match[1]);
    }
  });
  return Array.from(new Set(candidates));
}

function completeTranscriptSpeakerNameFromCandidate(shortName: string, candidate: string, strongCandidate = false) {
  const compactName = shortName.trim().replace(/\s+/g, '');
  const compactCandidate = candidate.trim().replace(/\s+/g, '');
  if (!compactName || !compactCandidate || compactName === compactCandidate || isGenericTranscriptSpeakerName(compactName)) {
    return '';
  }

  const nameRole = splitTranscriptSpeakerRole(compactName);
  const candidateRole = splitTranscriptSpeakerRole(compactCandidate);
  const nameTailAlias = normalizeTranscriptOcrSpeakerAlias(nameRole.tail);
  const candidateTailAlias = normalizeTranscriptOcrSpeakerAlias(candidateRole.tail);
  const nameAlias = normalizeTranscriptOcrSpeakerAlias(compactName);
  const candidateAlias = normalizeTranscriptOcrSpeakerAlias(compactCandidate);
  const canCompleteWholeName = candidateAlias.startsWith(nameAlias) && candidateAlias.length > nameAlias.length;
  const canCompleteTail = candidateTailAlias.startsWith(nameTailAlias) && candidateTailAlias.length > nameTailAlias.length;

  if (!canCompleteWholeName && !canCompleteTail) {
    return '';
  }

  const enoughSignal = strongCandidate || Boolean(nameRole.prefix) || Boolean(candidateRole.prefix) || nameTailAlias.length >= 2 || nameAlias.length >= 3;
  if (!enoughSignal) {
    return '';
  }

  if (canCompleteTail && nameRole.prefix) {
    return `${nameRole.prefix}${candidateRole.tail}`;
  }
  if (canCompleteWholeName) {
    return compactCandidate;
  }
  return candidateRole.prefix ? compactCandidate : candidateRole.tail;
}

function isGenericTranscriptSpeakerName(name: string) {
  const normalized = normalizeTranscriptSpeakerAlias(name);
  return !normalized || /^(发言人|分享人|讲者|未知|unknown|speaker|发言人[.．…]+)$/.test(normalized) || /^[.．…]+$/.test(normalized);
}

function areLikelySameTranscriptSpeaker(a: string, b: string) {
  if (!a || !b || a === b) {
    return false;
  }
  if (isGenericTranscriptSpeakerName(a) || isGenericTranscriptSpeakerName(b)) {
    return false;
  }
  if (shouldUseFullTranscriptSpeakerName(a, b) || shouldUseFullTranscriptSpeakerName(b, a)) {
    return true;
  }
  const aliasA = normalizeTranscriptSpeakerAlias(a);
  const aliasB = normalizeTranscriptSpeakerAlias(b);
  if (!aliasA || !aliasB) {
    return false;
  }
  if (normalizeTranscriptOcrSpeakerAlias(aliasA) === normalizeTranscriptOcrSpeakerAlias(aliasB)) {
    return true;
  }
  const roleA = splitTranscriptSpeakerRole(a);
  const roleB = splitTranscriptSpeakerRole(b);
  if (roleA.tail && roleB.tail && normalizeTranscriptOcrSpeakerAlias(roleA.tail) === normalizeTranscriptOcrSpeakerAlias(roleB.tail)) {
    return true;
  }
  const distance = transcriptSpeakerDistance(aliasA, aliasB);
  const maxLength = Math.max(aliasA.length, aliasB.length);
  if (maxLength >= 3 && distance <= 1) {
    return true;
  }
  return maxLength === 2 && distance <= 1 && (aliasA[0] === aliasB[0] || aliasA[1] === aliasB[1]);
}

function resolveGenericTranscriptSpeakers(entries: TranscriptLine[]) {
  return entries.map((entry, index) => {
    if (!isGenericTranscriptSpeakerName(entry.speakerName)) {
      return entry;
    }
    const currentSeconds = secondsFromTime(entry.time);
    const candidates = entries
      .map((candidate, candidateIndex) => ({
        candidate,
        distance: Math.abs(secondsFromTime(candidate.time) - currentSeconds),
        orderDistance: Math.abs(candidateIndex - index),
      }))
      .filter(({ candidate, distance }) => !isGenericTranscriptSpeakerName(candidate.speakerName) && distance <= 180)
      .sort((a, b) => a.distance - b.distance || a.orderDistance - b.orderDistance);
    return candidates[0] ? { ...entry, speakerName: candidates[0].candidate.speakerName } : entry;
  });
}

function areClearlyDifferentTranscriptSpeakers(a: string, b: string) {
  if (!a || !b || a === b) {
    return false;
  }
  if (isGenericTranscriptSpeakerName(a) || isGenericTranscriptSpeakerName(b)) {
    return false;
  }
  if (isTranscriptHostSpeakerName(a) !== isTranscriptHostSpeakerName(b)) {
    return true;
  }
  if (areLikelySameTranscriptSpeaker(a, b)) {
    return false;
  }
  const roleA = splitTranscriptSpeakerRole(a);
  const roleB = splitTranscriptSpeakerRole(b);
  const tailA = normalizeTranscriptOcrSpeakerAlias(roleA.tail);
  const tailB = normalizeTranscriptOcrSpeakerAlias(roleB.tail);
  if (!tailA || !tailB) {
    return false;
  }
  const sharedChars = Array.from(new Set(Array.from(tailA))).filter((char) => tailB.includes(char)).length;
  const shortTailLength = Math.min(tailA.length, tailB.length);
  if (shortTailLength <= 2 && sharedChars >= 1) {
    return false;
  }
  if (shortTailLength >= 3 && sharedChars >= 2) {
    return false;
  }
  return true;
}

function preferTranscriptSpeakerNameForContext(a: string, b: string) {
  const score = (name: string) => {
    const role = splitTranscriptSpeakerRole(name);
    let value = role.tail.length;
    if (role.prefix) value += 5;
    if (/[汪瑞勐心楠]/.test(role.tail)) value += 2;
    if (/[注江端]/.test(role.tail)) value -= 4;
    if (isTranscriptHostSpeakerName(name)) value += 2;
    return value;
  };
  return score(b) > score(a) ? b : a;
}

function adjacentTranscriptRunCount(entries: TranscriptLine[], index: number, direction: -1 | 1, anchorName: string, maxGapSeconds = 180) {
  let count = 0;
  let previousSeconds = secondsFromTime(entries[index].time);
  for (let cursor = index + direction; cursor >= 0 && cursor < entries.length; cursor += direction) {
    const entry = entries[cursor];
    const currentSeconds = secondsFromTime(entry.time);
    if (Math.abs(currentSeconds - previousSeconds) > maxGapSeconds) {
      break;
    }
    if (entry.speakerName !== anchorName && !areLikelySameTranscriptSpeaker(entry.speakerName, anchorName)) {
      break;
    }
    count += 1;
    previousSeconds = currentSeconds;
  }
  return count;
}

function normalizeTranscriptSpeakersByAdjacentContext(entries: TranscriptLine[]) {
  if (entries.length < 3) {
    return entries;
  }
  const sorted = entries
    .slice()
    .sort((a, b) => secondsFromTime(a.time) - secondsFromTime(b.time));
  return sorted.map((entry, index) => {
    if (isGenericTranscriptSpeakerName(entry.speakerName)) {
      return entry;
    }
    const previous = index > 0 ? sorted[index - 1] : undefined;
    const next = index < sorted.length - 1 ? sorted[index + 1] : undefined;
    const previousClose = previous && secondsFromTime(entry.time) - secondsFromTime(previous.time) <= 180;
    const nextClose = next && secondsFromTime(next.time) - secondsFromTime(entry.time) <= 180;
    const previousIsNear = Boolean(previousClose && previous && areLikelySameTranscriptSpeaker(entry.speakerName, previous.speakerName));
    const nextIsNear = Boolean(nextClose && next && areLikelySameTranscriptSpeaker(entry.speakerName, next.speakerName));
    const previousRun = previous ? adjacentTranscriptRunCount(sorted, index, -1, previous.speakerName) : 0;
    const nextRun = next ? adjacentTranscriptRunCount(sorted, index, 1, next.speakerName) : 0;

    if (previousIsNear && nextIsNear && previous && next && !areClearlyDifferentTranscriptSpeakers(previous.speakerName, next.speakerName)) {
      return {
        ...entry,
        speakerName: preferTranscriptSpeakerNameForContext(previous.speakerName, next.speakerName),
      };
    }

    if (
      previous &&
      previousIsNear &&
      previousRun >= 2 &&
      !(next && nextClose && areClearlyDifferentTranscriptSpeakers(previous.speakerName, next.speakerName))
    ) {
      return {
        ...entry,
        speakerName: preferTranscriptSpeakerNameForContext(previous.speakerName, entry.speakerName),
      };
    }

    if (
      next &&
      nextIsNear &&
      nextRun >= 2 &&
      !(previous && previousClose && areClearlyDifferentTranscriptSpeakers(previous.speakerName, next.speakerName))
    ) {
      return {
        ...entry,
        speakerName: preferTranscriptSpeakerNameForContext(next.speakerName, entry.speakerName),
      };
    }

    return entry;
  });
}

function isTranscriptSpeakerNameInSet(name: string, names: Set<string>) {
  const normalized = name.trim().replace(/\s+/g, '');
  const role = splitTranscriptSpeakerRole(normalized);
  return Array.from(names).some((candidate) => {
    const candidateRole = splitTranscriptSpeakerRole(candidate);
    return (
      candidate === normalized ||
      candidate === role.tail ||
      candidateRole.tail === normalized ||
      candidateRole.tail === role.tail ||
      areLikelySameTranscriptSpeaker(candidate, normalized)
    );
  });
}

function mergeTranscriptSpeakerRolePrefix(originalName: string, canonicalName: string) {
  const originalRole = splitTranscriptSpeakerRole(originalName);
  const canonicalRole = splitTranscriptSpeakerRole(canonicalName);
  if (originalRole.prefix && !canonicalRole.prefix) {
    return `${originalRole.prefix}${canonicalRole.tail}`;
  }
  return canonicalName;
}

function resolveInvitedTranscriptSpeakerName(invitedName: string, entries: TranscriptLine[], knownSpeakerNames: string[] = []) {
  const compact = invitedName.trim().replace(/\s+/g, '');
  if (!compact) {
    return '';
  }
  const candidates = Array.from(
    new Set([
      ...knownSpeakerNames.map((name) => name.trim().replace(/\s+/g, '')),
      ...entries.map((entry) => entry.speakerName.trim().replace(/\s+/g, '')),
    ])
  ).filter((name) => name && !isGenericTranscriptSpeakerName(name) && !isTranscriptHostSpeakerName(name));
  const role = splitTranscriptSpeakerRole(compact);
  const matched = candidates
    .filter((candidate) => {
      const candidateRole = splitTranscriptSpeakerRole(candidate);
      return (
        candidate === compact ||
        candidateRole.tail === role.tail ||
        completeTranscriptSpeakerNameFromCandidate(compact, candidate, true) ||
        areLikelySameTranscriptSpeaker(candidate, compact)
      );
    })
    .sort((a, b) => {
      const prefixDelta = Number(Boolean(splitTranscriptSpeakerRole(b).prefix)) - Number(Boolean(splitTranscriptSpeakerRole(a).prefix));
      if (prefixDelta) return prefixDelta;
      return b.length - a.length;
    })[0];
  return matched || compact;
}

function mergeInvitedTranscriptSpeakerName(originalName: string, invitedName: string) {
  if (areLikelySameTranscriptSpeaker(originalName, invitedName)) {
    return mergeTranscriptSpeakerRolePrefix(originalName, invitedName);
  }
  return invitedName;
}

function transcriptSpeakerDominanceScore(name: string, count: number, knownSet: Set<string>, invitedSet: Set<string>) {
  const role = splitTranscriptSpeakerRole(name);
  let score = count * 12 + role.tail.length;
  if (count >= 3) score += 24;
  if (isTranscriptSpeakerNameInSet(name, invitedSet)) score += 120;
  if (isTranscriptSpeakerNameInSet(name, knownSet)) score += 60;
  if (role.prefix) score += 6;
  if (/[汪瑞勐心楠]/.test(role.tail)) score += 3;
  if (/[注江端]/.test(role.tail)) score -= 8;
  return score;
}

function normalizeTranscriptSpeakersByLocalDominance(entries: TranscriptLine[], knownSpeakerNames: string[] = [], contextText = '') {
  if (entries.length < 2) {
    return entries;
  }
  const knownSet = new Set(knownSpeakerNames.map((name) => name.trim().replace(/\s+/g, '')).filter(Boolean));
  const invitedSet = new Set(extractInvitedTranscriptSpeakerNames(contextText));
  const trustedNames = Array.from(new Set([...knownSet, ...invitedSet])).filter((name) => !isGenericTranscriptSpeakerName(name));
  const sorted = entries
    .slice()
    .sort((a, b) => secondsFromTime(a.time) - secondsFromTime(b.time));
  const localWindowSeconds = 480;

  return sorted.map((entry) => {
    if (isGenericTranscriptSpeakerName(entry.speakerName)) {
      return entry;
    }
    const currentSeconds = secondsFromTime(entry.time);
    const localSimilarEntries = sorted.filter((candidate) => {
      if (isGenericTranscriptSpeakerName(candidate.speakerName)) {
        return false;
      }
      return Math.abs(secondsFromTime(candidate.time) - currentSeconds) <= localWindowSeconds && (
        candidate.speakerName === entry.speakerName || areLikelySameTranscriptSpeaker(candidate.speakerName, entry.speakerName)
      );
    });
    const similarCount = localSimilarEntries.length;
    const counts = new Map<string, number>();
    localSimilarEntries.forEach((candidate) => {
      counts.set(candidate.speakerName, (counts.get(candidate.speakerName) || 0) + 1);
    });
    trustedNames.forEach((name) => {
      if (name !== entry.speakerName && areLikelySameTranscriptSpeaker(name, entry.speakerName) && similarCount >= 3) {
        counts.set(name, counts.get(name) || 0);
      }
    });
    const candidates = Array.from(counts.entries())
      .map(([name, count]) => ({
        name,
        count,
        score: transcriptSpeakerDominanceScore(name, count, knownSet, invitedSet),
      }))
      .filter((candidate) => candidate.count >= 3 || (similarCount >= 3 && (isTranscriptSpeakerNameInSet(candidate.name, knownSet) || isTranscriptSpeakerNameInSet(candidate.name, invitedSet))))
      .sort((a, b) => b.score - a.score || b.count - a.count || b.name.length - a.name.length);
    const canonical = candidates[0]?.name;
    if (!canonical || canonical === entry.speakerName || !areLikelySameTranscriptSpeaker(canonical, entry.speakerName)) {
      return entry;
    }
    return {
      ...entry,
      speakerName: mergeTranscriptSpeakerRolePrefix(entry.speakerName, canonical),
    };
  });
}

function isTranscriptHostSpeakerName(name: string) {
  const normalized = normalizeTranscriptSpeakerAlias(name);
  return /^(主持人|主持|带读人|助教)/.test(normalized);
}

function extractTranscriptHostSpeakerNames(entries: TranscriptLine[], contextText = '') {
  const counts = new Map<string, number>();
  entries.forEach((entry) => {
    if (isTranscriptHostSpeakerName(entry.speakerName)) {
      counts.set(entry.speakerName, (counts.get(entry.speakerName) || 0) + 1);
    }
  });
  const source = cleanSourceText(contextText);
  const hostPattern = /(主持人|主持|导引员|内容导引员|带读人|助教)[-—–｜|]?[A-Za-z\u4e00-\u9fa5]{1,8}/g;
  let match: RegExpExecArray | null;
  while ((match = hostPattern.exec(source)) !== null) {
    const name = match[0].trim().replace(/\s+/g, '');
    if (name && !/(主持人$|主持$|导引员$|内容导引员$|带读人$|助教$)/.test(name)) {
      counts.set(name, (counts.get(name) || 0) + 1);
    }
  }
  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1] || b[0].length - a[0].length)
    .map(([name]) => name);
}

function isTranscriptShareEndingText(text: string) {
  const normalized = cleanSourceText(text).replace(/\s+/g, '');
  return /(谢谢大家|谢谢啊|谢谢啦|谢谢你们|谢谢主持人|我的分享(?:到此|就到|结束)|我(?:就|先)?分享到(?:这里|这|此)|分享(?:到此|结束)|今天(?:就|先)?分享到(?:这里|这|此)|我就先说到这)/.test(normalized);
}

function normalizeTranscriptHostHandoffs(entries: TranscriptLine[], contextText = '', knownSpeakerNames: string[] = []) {
  const hostName = extractTranscriptHostSpeakerNames(entries, contextText)[0];
  if (!hostName) {
    return entries;
  }
  let endedSpeakerName = '';
  let hostHandoffUntil = 0;
  let invitedSpeakerName = '';
  let invitedSpeakerUntil = 0;
  const handoffWindowSeconds = 300;
  const invitedWindowSeconds = 720;

  return entries
    .slice()
    .sort((a, b) => secondsFromTime(a.time) - secondsFromTime(b.time))
    .map((entry) => {
      const currentSeconds = secondsFromTime(entry.time);
      const isHost = isTranscriptHostSpeakerName(entry.speakerName);
      const isEnding = isTranscriptShareEndingText(entry.text);
      const invitedFromText = extractInvitedTranscriptSpeakerNames(entry.text)[0] || '';
      const shouldTreatAsHost =
        Boolean(endedSpeakerName) &&
        currentSeconds <= hostHandoffUntil &&
        !isHost &&
        (entry.speakerName === endedSpeakerName || areLikelySameTranscriptSpeaker(entry.speakerName, endedSpeakerName));
      const shouldTreatAsInvited = Boolean(invitedSpeakerName) && currentSeconds <= invitedSpeakerUntil && !isHost;

      if (invitedFromText && (isHost || shouldTreatAsHost || shouldTreatAsInvited)) {
        invitedSpeakerName = resolveInvitedTranscriptSpeakerName(invitedFromText, entries, knownSpeakerNames);
        invitedSpeakerUntil = currentSeconds + invitedWindowSeconds;
        endedSpeakerName = '';
        hostHandoffUntil = 0;
        return {
          ...entry,
          speakerName: hostName,
        };
      }

      if (shouldTreatAsInvited) {
        const nextEntry = {
          ...entry,
          speakerName: mergeInvitedTranscriptSpeakerName(entry.speakerName, invitedSpeakerName),
        };
        if (isEnding) {
          endedSpeakerName = nextEntry.speakerName;
          hostHandoffUntil = currentSeconds + handoffWindowSeconds;
          invitedSpeakerName = '';
          invitedSpeakerUntil = 0;
        }
        return nextEntry;
      }

      if (isEnding && !isHost) {
        endedSpeakerName = entry.speakerName;
        hostHandoffUntil = currentSeconds + handoffWindowSeconds;
        invitedSpeakerName = '';
        invitedSpeakerUntil = 0;
        return entry;
      }

      if (shouldTreatAsHost) {
        return {
          ...entry,
          speakerName: hostName,
        };
      }

      if (isHost && invitedFromText) {
        invitedSpeakerName = resolveInvitedTranscriptSpeakerName(invitedFromText, entries, knownSpeakerNames);
        invitedSpeakerUntil = currentSeconds + invitedWindowSeconds;
        endedSpeakerName = '';
        hostHandoffUntil = 0;
        return entry;
      }

      if (!isHost && endedSpeakerName && currentSeconds <= hostHandoffUntil && !areLikelySameTranscriptSpeaker(entry.speakerName, endedSpeakerName)) {
        endedSpeakerName = '';
        hostHandoffUntil = 0;
      }

      return entry;
    });
}

function completeTranscriptSpeakerNames(entries: TranscriptLine[], knownSpeakerNames: string[] = [], contextText = '') {
  const nameCounts = new Map<string, number>();
  entries.forEach((entry) => {
    if (!isGenericTranscriptSpeakerName(entry.speakerName)) {
      nameCounts.set(entry.speakerName, (nameCounts.get(entry.speakerName) || 0) + 1);
    }
  });
  const knownNames = knownSpeakerNames.map((name) => name.trim().replace(/\s+/g, '')).filter((name) => name && !isGenericTranscriptSpeakerName(name));
  const invitedNames = extractInvitedTranscriptSpeakerNames([
    contextText,
    ...entries.map((entry) => entry.text),
  ].join('\n'));
  const invitedSet = new Set(invitedNames);
  const names = Array.from(new Set([...Array.from(nameCounts.keys()), ...knownNames, ...invitedNames])).sort((a, b) => b.length - a.length);
  const knownSet = new Set(knownNames);
  const aliasMap = new Map<string, string>();

  Array.from(nameCounts.keys()).forEach((name) => {
    const completionCandidates = names
      .map((candidate) => ({
        candidate,
        completedName: completeTranscriptSpeakerNameFromCandidate(name, candidate, invitedSet.has(candidate)),
      }))
      .filter((item) => item.candidate !== name && item.completedName)
      .sort((a, b) => {
        const invitedDelta = Number(invitedSet.has(b.candidate)) - Number(invitedSet.has(a.candidate));
        if (invitedDelta) return invitedDelta;
        const knownDelta = Number(knownSet.has(b.candidate)) - Number(knownSet.has(a.candidate));
        if (knownDelta) return knownDelta;
        const countDelta = (nameCounts.get(b.candidate) || 0) - (nameCounts.get(a.candidate) || 0);
        if (countDelta) return countDelta;
        return b.completedName.length - a.completedName.length;
      });
    if (completionCandidates[0]) {
      aliasMap.set(name, completionCandidates[0].completedName);
      return;
    }

    const candidates = names
      .filter((candidate) => candidate !== name && areLikelySameTranscriptSpeaker(name, candidate))
      .filter((candidate) => !shouldUseFullTranscriptSpeakerName(candidate, name))
      .sort((a, b) => {
        const fullNameDelta = Number(shouldUseFullTranscriptSpeakerName(name, b)) - Number(shouldUseFullTranscriptSpeakerName(name, a));
        if (fullNameDelta) return fullNameDelta;
        const knownDelta = Number(knownSet.has(b)) - Number(knownSet.has(a));
        if (knownDelta) return knownDelta;
        const countDelta = (nameCounts.get(b) || 0) - (nameCounts.get(a) || 0);
        if (countDelta) return countDelta;
        return b.length - a.length;
      });
    if (candidates[0]) {
      aliasMap.set(name, candidates[0]);
    }
  });

  if (aliasMap.size === 0) {
    return entries;
  }

  return entries.map((entry) => ({
    ...entry,
    speakerName: aliasMap.get(entry.speakerName) || entry.speakerName,
  }));
}

function cleanTranscriptUtterance(text: string) {
  return text
    .replace(/\s+/g, ' ')
    .replace(/(^|[，。！？、；;：:\s])(?:嗯+|呃+|额+|啊+|呃呃|那个|这个)(?=$|[，。！？、；;：:\s])/g, '$1')
    .replace(/(^|[。！？；;\s])然后[。！？；;]+(?=\s|$)/g, '$1')
    .replace(/(^|[，。！？、；;：:\s])然后(?=$|[，。！？、；;：:\s])/g, '$1')
    .replace(/([，。！？、；;：:]){2,}/g, '$1')
    .replace(/\s+([，。！？、；;：:])/g, '$1')
    .replace(/([，。！？、；;：:])\s+/g, '$1')
    .replace(/^[，。！？、；;：:\s]+/, '')
    .trim();
}

function stripTrailingTranscriptSpeakerEcho(text: string, speakerName: string) {
  const cleaned = text.trim();
  const hostEcho = cleaned.match(/(?:^|[\s，。！？、；;：:])((?:主持人|主持|导引员|内容导引员|带读人|助教)[-—–｜|]?[A-Za-z\u4e00-\u9fa5]{1,8})$/);
  if (hostEcho?.index !== undefined) {
    return cleaned.slice(0, hostEcho.index).replace(/[，。！？、；;：:\s]+$/g, '').trim();
  }
  const trailing = cleaned.match(/(?:^|[\s，。！？、；;：:])([0-9]{1,2}号[-—–｜|]?[A-Za-z\u4e00-\u9fa5]{1,8}|[A-Za-z\u4e00-\u9fa5]{2,10})$/);
  if (!trailing || trailing.index === undefined) {
    return cleaned;
  }
  const candidate = trailing[1];
  const invitedEcho = extractInvitedTranscriptSpeakerNames(cleaned).some((invitedName) => areLikelySameTranscriptSpeaker(candidate, invitedName));
  if (invitedEcho) {
    return cleaned.slice(0, trailing.index).replace(/[，。！？、；;：:\s]+$/g, '').trim();
  }
  const candidateAlias = normalizeTranscriptSpeakerAlias(candidate);
  const speakerAlias = normalizeTranscriptSpeakerAlias(speakerName);
  const isSpeakerEcho =
    candidateAlias.length >= 2 &&
    speakerAlias.length >= 2 &&
    (speakerAlias.startsWith(candidateAlias) || candidateAlias.startsWith(speakerAlias) || areLikelySameTranscriptSpeaker(candidate, speakerName));
  return isSpeakerEcho ? cleaned.slice(0, trailing.index).replace(/[，。！？、；;：:\s]+$/g, '').trim() : cleaned;
}

function collapseRepeatedTranscriptFragments(text: string) {
  let cleaned = text.trim();
  let previous = '';
  while (cleaned !== previous) {
    previous = cleaned;
    cleaned = cleaned.replace(/^(.{2,8})\s+\1(?=\S)/, '$1');
  }
  return cleaned;
}

function cleanTranscriptEntryText(text: string, speakerName: string) {
  const cleaned = cleanTranscriptUtterance(text);
  return cleanTranscriptUtterance(collapseRepeatedTranscriptFragments(stripTrailingTranscriptSpeakerEcho(cleaned, speakerName)));
}

export function formatTranscriptEntries(entries: TranscriptLine[]) {
  return entries.map((entry) => `${entry.time} ${entry.speakerName}：${entry.text}`).join('\n');
}

function isClearlyContentAsSpeakerName(name: string) {
  const normalized = normalizeTranscriptSpeakerAlias(name);
  if (!normalized) {
    return true;
  }
  return (
    normalized.length > 12 ||
    /(进入到我们|要进入|非常感谢|感谢|大家|早上好|美好的一天|生活当中|有没有|为什么|就是说|然后|这个|那个|所以|因为|可以|时候|内容导引员|导引员)/.test(normalized)
  );
}

function isTrustedParsedSpeakerName(name: string) {
  const compact = name.trim().replace(/\s+/g, '');
  if (!compact || isClearlyContentAsSpeakerName(compact)) {
    return false;
  }
  if (/^(主持人|主持|带读人|助教)[-—–｜|一]?[A-Za-z\u4e00-\u9fa5]{1,8}$/.test(compact)) {
    return true;
  }
  if (/^\d{1,2}号[-—–｜|一]?[A-Za-z\u4e00-\u9fa5]{1,8}$/.test(compact)) {
    return true;
  }
  if (/^[A-Za-z][A-Za-z0-9_-]{1,20}$/.test(compact)) {
    return true;
  }
  if (/^[\u4e00-\u9fa5]{2,4}$/.test(compact) && !isGenericTranscriptSpeakerName(compact)) {
    return true;
  }
  return false;
}

function mergeRejectedSpeakerIntoText(candidateName: string, body: string) {
  const compact = candidateName.trim().replace(/\s+/g, '');
  if (!compact || /^(内容导引员|导引员)[-—–｜|一]?[A-Za-z\u4e00-\u9fa5]{1,8}$/.test(compact) || /(进入到我们|要进入)/.test(compact)) {
    return body.trim();
  }
  return `${candidateName.trim()}：${body.trim()}`;
}

export function parseTranscriptEntries(text: string): TranscriptLine[] {
  const lines = String(text || '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
  const entries: TranscriptLine[] = [];
  let current: { speakerName: string; time: string; parts: string[] } | null = null;
  let pendingSpeakerName = '';

  const looseSpeakerNameFromLine = (line: string) => {
    const compact = line.replace(/\s+/g, '').replace(/[（(].*?[）)]/g, '');
    const numbered = compact.match(/(\d{1,2}号[-—–｜|]?[A-Za-z\u4e00-\u9fa5]{1,8})/);
    if (numbered) {
      return numbered[1].replace(/号(?![-—–｜|])/g, '号-');
    }
    if (/^[A-Za-z\u4e00-\u9fa5]{2,10}$/.test(compact) && !/(然后|就是|如果|这个|那个|谢谢|大家|时候|事情|自己|我们|他们|可以|但是|因为|所以)/.test(compact)) {
      return compact;
    }
    return '';
  };

  const flush = () => {
    if (!current) {
      return;
    }
    const body = current.parts.join(' ').replace(/\s+/g, ' ').trim();
    if (body) {
      entries.push({
        speakerName: current.speakerName.trim(),
        time: current.time,
        text: body,
      });
    }
    current = null;
  };

  for (const line of lines) {
    const formatted = line.match(/^(\d{1,2}:\d{2}(?::\d{2})?)\s+(.{1,32}?)[：:]\s*(.+)$/);
    if (formatted) {
      flush();
      const parsedSpeakerName = formatted[2].trim();
      const speakerName = isTrustedParsedSpeakerName(parsedSpeakerName) ? parsedSpeakerName : pendingSpeakerName || '发言人';
      const body = isTrustedParsedSpeakerName(parsedSpeakerName) ? formatted[3].trim() : mergeRejectedSpeakerIntoText(parsedSpeakerName, formatted[3]);
      pendingSpeakerName = speakerName;
      entries.push({
        time: formatted[1],
        speakerName,
        text: body,
      });
      continue;
    }

    const timeSpeakerInline = line.match(/^(\d{1,2}:\d{2}(?::\d{2})?)\s+(\d{1,2}号[-—–｜|一]?[A-Za-z\u4e00-\u9fa5]{1,8}|(?:主持人|主持|带读人|助教)[-—–｜|一]?[A-Za-z\u4e00-\u9fa5]{1,8}|[A-Za-z][A-Za-z0-9_-]{1,20}|[\u4e00-\u9fa5]{2,4})\s+(.+)$/);
    if (timeSpeakerInline) {
      flush();
      const parsedSpeakerName = timeSpeakerInline[2].trim();
      const speakerName = isTrustedParsedSpeakerName(parsedSpeakerName) ? parsedSpeakerName : pendingSpeakerName || '发言人';
      const body = isTrustedParsedSpeakerName(parsedSpeakerName) ? timeSpeakerInline[3].trim() : `${parsedSpeakerName} ${timeSpeakerInline[3].trim()}`;
      pendingSpeakerName = speakerName;
      entries.push({
        time: timeSpeakerInline[1],
        speakerName,
        text: body,
      });
      continue;
    }

    const header = line.match(/^(.{1,32}?)\s+(\d{1,2}:\d{2}(?::\d{2})?)$/);
    if (header) {
      flush();
      current = { speakerName: header[1].trim(), time: header[2], parts: [] };
      pendingSpeakerName = header[1].trim();
      continue;
    }

    const inline = line.match(/^(.{1,32}?)\s+(\d{1,2}:\d{2}(?::\d{2})?)\s+(.+)$/);
    if (inline) {
      flush();
      const parsedSpeakerName = inline[1].trim();
      const speakerName = isTrustedParsedSpeakerName(parsedSpeakerName) ? parsedSpeakerName : pendingSpeakerName || '发言人';
      const body = isTrustedParsedSpeakerName(parsedSpeakerName) ? inline[3].trim() : `${parsedSpeakerName} ${inline[3].trim()}`;
      pendingSpeakerName = speakerName;
      entries.push({
        speakerName,
        time: inline[2],
        text: body,
      });
      continue;
    }

    const timeHeader = line.match(/^(\d{1,2}:\d{2}(?::\d{2})?)$/);
    if (timeHeader) {
      flush();
      current = { speakerName: pendingSpeakerName || '发言人', time: timeHeader[1], parts: [] };
      continue;
    }

    const timeOnly = line.match(/^(\d{1,2}:\d{2}(?::\d{2})?)\s+(.+)$/);
    if (timeOnly) {
      flush();
      entries.push({
        time: timeOnly[1],
        speakerName: pendingSpeakerName || '发言人',
        text: timeOnly[2].trim(),
      });
      continue;
    }

    if (current) {
      const looseSpeaker = looseSpeakerNameFromLine(line);
      if (looseSpeaker && current.parts.length === 0 && isGenericTranscriptSpeakerName(current.speakerName)) {
        current.speakerName = looseSpeaker;
        pendingSpeakerName = looseSpeaker;
        continue;
      }
      current.parts.push(line);
    } else {
      const looseSpeaker = looseSpeakerNameFromLine(line);
      if (looseSpeaker) {
        pendingSpeakerName = looseSpeaker;
      }
    }
  }

  flush();
  return entries;
}

export function normalizeTranscriptEntries(entries: TranscriptLine[], knownSpeakerNames: string[] = [], contextText = '') {
  const seen = new Set<string>();
  const baseEntries = entries
    .map((entry) => ({
      speakerName: entry.speakerName.trim().replace(/\s+/g, ''),
      time: entry.time.trim(),
      text: cleanTranscriptEntryText(entry.text, entry.speakerName),
    }))
    .filter((entry) => entry.speakerName && entry.time && entry.text)
    .sort((a, b) => secondsFromTime(a.time) - secondsFromTime(b.time) || a.speakerName.localeCompare(b.speakerName, 'zh-CN'));
  const locallyNormalizedEntries = normalizeTranscriptSpeakersByLocalDominance(
    normalizeTranscriptSpeakersByAdjacentContext(resolveGenericTranscriptSpeakers(baseEntries)),
    knownSpeakerNames,
    contextText
  );
  const namedEntries = completeTranscriptSpeakerNames(locallyNormalizedEntries, knownSpeakerNames, contextText);
  const normalized = normalizeTranscriptHostHandoffs(namedEntries, contextText, knownSpeakerNames)
    .sort((a, b) => secondsFromTime(a.time) - secondsFromTime(b.time) || a.speakerName.localeCompare(b.speakerName, 'zh-CN'))
    .filter((entry) => {
      const key = normalizeTranscriptLineKey(entry);
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });
  return dedupeTranscriptEntries(normalized).sort((a, b) => secondsFromTime(a.time) - secondsFromTime(b.time) || a.speakerName.localeCompare(b.speakerName, 'zh-CN'));
}

export function createLocalTranscriptOrganizeResult(workspace: TranscriptWorkspace, knownSpeakerNames: string[] = []): TranscriptOrganizeResult {
  const rawText = workspace.ocrSnippets.map((snippet) => cleanSourceText(snippet.text)).filter(Boolean).join('\n');
  const contextText = [workspace.transcriptText, rawText].filter(Boolean).join('\n');
  const entries = normalizeTranscriptEntries([
    ...parseTranscriptEntries(workspace.transcriptText),
    ...parseTranscriptEntries(rawText),
  ], knownSpeakerNames, contextText);
  return {
    entries,
    transcriptText: formatTranscriptEntries(entries),
  };
}

export function buildTranscriptOrganizePrompt(workspace: TranscriptWorkspace, knownSpeakerNames: string[] = []) {
  return {
    instructions: [
      '你是晨读营聊天截图转写整理助手。用户会持续上传腾讯会议或聊天截图，截图 OCR 里包含姓名、时间和气泡内容。',
      '你的任务是把已有大文本框内容和新增 OCR 片段合并，去重，按时间顺序输出完整发言脚本。',
      '只整理转写脚本，不做观察、不做总结、不评论任何人。',
      '必须保留发言人姓名、时间和原话意思；可以修正明显 OCR 错别字、删除头像/空行/重复识别噪声。',
      '可以删除不承载信息的口头填充词和独立短句，例如“嗯”“嗯嗯”“呃”“啊”“那个”“这个”“然后。”，让脚本更连贯；但不要改变发言人的真实意思和重要语气。',
      '如果 OCR 中同一角色有完整名和不完整名，必须统一为完整名，例如“主持人小”应按同批出现的“主持人-小楠”补全；“4号王可”应按“4号-王可心”补全。',
      '如果主持人、导引员或前一位书友在正文里介绍了下一位分享人，例如“接下来有请张勐分享”“邀请张勐进行今天的分享”，后续 OCR 角色只识别为“张”或“5号-张”时，必须结合邀请上下文补全为“张勐”或“5号-张勐”。',
      '如果某个连续时间段内同一角色名重复出现 3 次以上，说明这一段基本都是该角色在发言；在切换到明显不同角色之前，必须把中间少量近似错名统一到这个高频角色名，例如“张勐”发言段里的“张动”应统一为“张勐”。',
      '判断角色时必须结合前后时间戳：如果前后连续几条明显是同一位，只是当前条少一个字、错一个字或一个字相同，应归一到前后更稳定的角色名；如果前后已经出现完全不同的新角色，说明可能真的换人，不要强行合并到上一位。',
      '如果发言内容出现“谢谢大家”“谢谢”“我的分享到这里/到此结束”等结束语，后面通常切回主持人或导引员；结束语后如果 OCR 仍把主持人串场识别成刚才的书友，必须改回主持人，例如“非常感谢张勐”“下面想邀请谁回应一下”应归到主持人。',
      '如果主持人说“有请 xxx”“邀请 xxx”“下面请 xxx”“请 xxx 回应/分享/发言”等类似意思，后续内容应切换到 xxx，直到 xxx 说“谢谢/分享结束”或主持人再次接回。',
      '如果 OCR 角色名明显是同一个人的错字或近似字，必须归并到已有发言人角色或出现次数最多的角色名，例如“汪注”“注注”“注江”应归到“汪汪”，“历端男”应归到“历瑞男”。',
      '如果已有发言人角色列表里有接近名称，优先使用已有角色名；不要新建“发言人…”这类无法识别的角色，除非上下文完全无法判断。',
      '如果同一句话在不同截图中重复出现，只保留一条；如果同一时间同一人有更完整版本，保留更完整版本。',
    ].join('\n'),
    input: JSON.stringify(
      {
        已有发言人角色: knownSpeakerNames,
        已有整理脚本: workspace.transcriptText || '',
        新增OCR片段: workspace.ocrSnippets.map((snippet, index) => ({
          index: index + 1,
          fileName: snippet.fileName || '',
          createdAt: snippet.createdAt,
          text: cleanSourceText(snippet.text),
        })),
        输出格式要求: [
          'entries 按时间升序排列，每条包含 speakerName、time、text。',
          '优先完整输出 entries；transcriptText 可以省略或留空，系统会根据 entries 自动拼接。',
          '不要输出 Markdown，不要解释。',
        ],
      },
      null,
      2
    ),
    schema: transcriptOrganizeSchema,
  };
}

export function buildSpeakerContentPolishPrompt(speaker: SpeakerCard) {
  const rawSnippets = speaker.snippets
    .map((snippet, index) => ({
      index: index + 1,
      sourceType: snippet.sourceType,
      fileName: snippet.fileName,
      text: cleanSourceText(snippet.text),
      createdAt: snippet.createdAt,
    }))
    .filter((snippet) => snippet.text);

  return {
    instructions: [
      '你是晨读营会议转写整理助手。你的任务是把同一位书友的多段 OCR / 会议转写 / 手动速记拼接后，整理成一段顺畅、可读、尽量接近原意的发言内容。',
      '只整理“这个人说了什么”，不要做观察、不要回应、不要评价、不要加入课程分析、不要补充原文没有的信息。',
      '可以做的事：去掉 OCR 元信息、时间戳、重复片段、明显断行；修正明显 OCR 错别字；补上基础标点；把被切碎的句子顺成自然段。',
      '不能做的事：改变发言人的立场；把口语改成过度正式文章；美化、扩写、归纳成观点；加入“我认为/你应该/课程提醒”等分析性语言。',
      '如果有发言人姓名，只保留正文里自然出现的称呼，不要在开头强行加标题。',
    ].join('\n'),
    input: JSON.stringify(
      {
        发言人: speaker.name,
        原始片段: rawSnippets,
        输出要求: [
          'polishedContent：输出整理后的完整发言内容，按自然段组织。',
          '尽量保留第一人称、语气和真实表达。',
          '如果原始片段很短，就只做轻微清理，不要扩写。',
          '如果有多段片段，按时间顺序拼接，删除重复内容。',
        ],
      },
      null,
      2
    ),
    schema: speakerContentPolishSchema,
  };
}

const summaryTemplateSections = {
  resonance: [
    {
      key: 'opening_hold',
      title: '开场接住',
      prompt: '先不要分析对错，也不要急着给方法。用观察者口吻接住大家今天的真实表达，表达“我听见了你们的不容易，也看见了你们愿意面对自己的勇气”。语气温柔、真诚、口语化。',
    },
    {
      key: 'touching_line',
      title: '今天最触动我的一条线',
      prompt: '从全场发言中提炼一个最有生命感的核心词，不要抽象成大道理。这个词要能从生活细节通向内在状态，例如尊重、觉察、选择、承担、能量、信任。',
    },
    {
      key: 'what_i_see',
      title: '我看见了什么',
      prompt: '不要诊断每个人的问题，而是描述大家共同处在什么成长过程中。用“我看见”“也许背后是”“这让我想到”的表达，让对方感到被理解，而不是被评价。',
    },
    {
      key: 'life_lessons',
      title: '几位发言人的问题线索',
      prompt: '逐个回应发言人。每个人只抓一个最值得被看见的点：他/她正在承受什么、渴望什么、哪里已经开始有力量。只说“我看见/我感受到的线索”，避免贴标签，避免说教。',
    },
    {
      key: 'experience_mirror',
      title: '我的经历映照',
      prompt: '结合观察者公司破产、债务、限高、重新站起来的经历。重点不是比较谁更痛，而是说“我也经历过系统崩塌后，如何重新找回一点点选择权”。表达要克制、真诚。',
    },
    {
      key: 'course_return',
      title: '回到今天课程',
      prompt: '把前面的共振轻轻收回到当天课程，不硬套概念。说明今天课程给我们的不是答案，而是一个重新看待自己处境的角度。',
    },
    {
      key: 'closing_line',
      title: '带走一句话',
      prompt: '生成一段温柔但有力量的收束，适合现场最后说出口。不要鸡汤，不要口号，要像从真实经历里长出来的话。',
    },
  ],
  structure: [
    {
      key: 'opening_position',
      title: '开场定位',
      prompt: '用一段话指出今天大家其实共同讨论了一个什么问题。表达要清晰，不要铺垫太长。',
    },
    {
      key: 'course_deconstruction',
      title: '课程概念拆解',
      prompt: '把当天课程拆成 2-3 个关键点。每个点都要解释它和现实生活的关系，像金玲一样把课程概念“解压缩”。',
    },
    {
      key: 'shared_pattern',
      title: '全场共同模式',
      prompt: '从多位发言中提炼共同模式。不要重复原文，要指出大家分别落在同一个大主题的不同侧面。',
    },
    {
      key: 'three_layers',
      title: '三层理解',
      prompt: '按三层输出：第一层是表层事件，第二层是内在状态，第三层是成长方向。每层都要清楚、简洁、有递进。',
    },
    {
      key: 'speaker_topics',
      title: '每人的问题线索',
      prompt: '每位发言人对应一个温和的问题线索，用“某某今天让我看到的是……”的方式表达。要具体，但不要像裁判一样下判断。',
    },
    {
      key: 'observer_experience',
      title: '我的经验补充',
      prompt: '用观察者经历补充这套结构为什么不是空道理。重点放在：现实崩塌时，如何区分承担责任和否定自己。',
    },
    {
      key: 'action_practice',
      title: '可带走的行动',
      prompt: '给出 2-3 个今天可以立刻练习的问题或动作。要小、具体、能执行。',
    },
    {
      key: 'summary_anchor',
      title: '一句话总结',
      prompt: '生成一段清楚有力的总结，像一个观点锚点，让大家记得今天的核心。',
    },
  ],
  hybrid: [
    {
      key: 'opening_hold',
      title: '开场接住',
      prompt: '先像珊珊一样接住人，不急着分析。表达今天听到大家分享后的真实触动，让人感到被看见。',
    },
    {
      key: 'common_theme',
      title: '共同主题',
      prompt: '再像金玲一样提炼结构。指出全场共同暗线是什么，例如失控感、自责、选择权、关系里的消耗、重新承担。',
    },
    {
      key: 'course_connection',
      title: '课程连接',
      prompt: '把共同主题和当天课程连接起来。不要硬套课程词，要说明课程如何帮助我们重新理解这些分享。',
    },
    {
      key: 'speaker_lessons',
      title: '每人的问题线索',
      prompt: '每个人一小段，既要有温度，也要有结构：先看见状态，再说出你观察到的问题线索，再给一个温和方向。不要评判对错。',
    },
    {
      key: 'key_response',
      title: '重点回应',
      prompt: '从全场挑 1-2 个最值得观察者现场展开的点。要说明为什么值得回应，以及怎么回应才不伤人。',
    },
    {
      key: 'experience_connection',
      title: '我的经历连接',
      prompt: '调用观察者知识库中最贴近的经历，尤其是破产、债务、起诉、限高、重建。输出要像亲身分享，不像案例分析。避免“我当年比你更惨”。',
    },
    {
      key: 'takeaway_action',
      title: '带走的行动',
      prompt: '把洞察落成 2-3 个可以马上实践的小问题、小动作。不要要求大家立刻改变人生，只给下一步。',
    },
    {
      key: 'one_sentence_summary',
      title: '一句话总结',
      prompt: '给出一段收束，呼应 oneSentenceSummaries 里的三句备选。第一句偏温柔，第二句偏有力量，第三句偏课程主题。',
    },
  ],
};

export const knowledgeEntriesSchema = {
  name: 'knowledge_entries',
  schema: {
    type: 'object',
    additionalProperties: false,
    required: ['entries'],
    properties: {
      entries: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          required: [
            'title',
            'type',
            'tags',
            'sourceTitle',
            'sourceDate',
            'relatedCourses',
            'applicableScenes',
            'summary',
            'originalExcerpt',
            'reusableLines',
            'speakingBoundary',
            'avoidDetails',
          ],
          properties: {
            title: { type: 'string' },
            type: { type: 'string', enum: ['core_experience', 'morning_speech', 'response_style', 'quote'] },
            tags: { type: 'array', items: { type: 'string' } },
            sourceTitle: { type: 'string' },
            sourceDate: { type: 'string' },
            relatedCourses: { type: 'array', items: { type: 'string' } },
            applicableScenes: { type: 'string' },
            summary: { type: 'string' },
            originalExcerpt: { type: 'string' },
            reusableLines: { type: 'array', items: { type: 'string' } },
            speakingBoundary: { type: 'string' },
            avoidDetails: { type: 'array', items: { type: 'string' } },
          },
        },
      },
    },
  },
};

function serializeKnowledge(entries: KnowledgeEntry[]) {
  return entries.map((entry) => ({
    title: entry.title,
    type: entry.type,
    tags: entry.tags,
    relatedCourses: entry.relatedCourses,
    applicableScenes: entry.applicableScenes,
    summary: entry.summary,
    originalExcerpt: entry.originalExcerpt,
    reusableLines: entry.reusableLines,
    speakingBoundary: entry.speakingBoundary,
    avoidDetails: entry.avoidDetails,
  }));
}

function serializeDailyObservation(session?: Partial<ObserverSession>) {
  const material = session?.dailyObservation;
  return {
    content: material?.content?.trim() || '',
    usageGuide:
      '这是一段观察者准备单独分享的完整素材。单人回应时按相关性轻轻引用；尝试总结或整场观察需要把它作为观察者表达主心骨，尽量保留主体原意、原句、情绪转折和关键表达，再自然连接当天课程与书友分享。',
  };
}

function clipDailyObservation(content: string, fallback: string, maxLength = 220) {
  const text = content.trim();
  if (!text) {
    return fallback;
  }
  return text.length > maxLength ? `${text.slice(0, maxLength - 1)}…` : text;
}

function preserveDailyObservationCore(content: string, fallback: string, keepRatio = 0.76) {
  const text = content.trim();
  if (!text) {
    return fallback;
  }
  if (text.length <= 900) {
    return text;
  }

  const target = Math.max(900, Math.floor(text.length * keepRatio));
  const nextBoundary = text.slice(target, target + 180).search(/[。！？\n]/);
  if (nextBoundary >= 0) {
    return text.slice(0, target + nextBoundary + 1).trim();
  }
  const previousBoundary = Math.max(text.lastIndexOf('。', target), text.lastIndexOf('！', target), text.lastIndexOf('？', target), text.lastIndexOf('\n', target));
  const end = previousBoundary > target - 260 ? previousBoundary + 1 : target;
  return `${text.slice(0, end).trim()}…`;
}

export function buildKnowledgePrompt(source: { title: string; text: string; targetDescription?: string }) {
  return {
    instructions: [
      '你是观察者个人知识库整理助手。你的任务是把用户过去的晨读营发言、文章或大段文字，提炼成可复用的观察者素材条目。',
      '这些条目未来会用于帮助用户回应晨读营成员，因此必须保留真实经历、表达风格、适用场景和讲述边界。',
      '不要编造原文没有的经历。可以归纳，但必须保守。特别是破产、债务、关系、家庭等内容，要标清哪些适合讲、哪些不应展开。',
      source.targetDescription || '请根据内容长度决定提炼数量：短文 1-3 条，中等文本 3-6 条，长文或合集片段 5-10 条。',
      '每条知识要能独立被检索和复用。不要把多个不同经历强行合并成一条，也不要把同一个观点拆成重复条目。',
      '输出要精炼。每个字段写够用即可，不要长篇发挥，避免拖慢批量导入。',
    ].join('\n'),
    input: JSON.stringify(
      {
        来源标题: source.title,
        原文: source.text,
        数量要求: source.targetDescription || '按内容长度决定提炼数量',
        提炼要求: [
          'title：用一句话概括这条素材，例如“破产后最难的是身份崩塌”',
          'type：核心经历用 core_experience；过去晨读发言用 morning_speech；表达风格用 response_style；金句片段用 quote',
          'tags：给 3-8 个标签，例如 破产、身份绑定、羞耻感、关系内耗、行动瘫痪、接纳、重新开始',
          'sourceTitle/sourceDate：能识别就填写，不能识别 sourceDate 留空字符串',
          'relatedCourses：适合关联的课程名或主题名，不能确定可留空数组',
          'applicableScenes：用 60-120 字说明遇到什么样的分享状态或问题线索时适合调用',
          'summary：用 80-160 字总结这条素材真正能提供的洞察',
          'originalExcerpt：保留最有用户本人味道的一小段原话，60-180 字',
          'reusableLines：提炼 1-3 句未来回应时可复用或改写的话',
          'speakingBoundary：用 40-100 字说明这段经历现场可以讲到什么程度',
          'avoidDetails：列出 2-5 个不适合展开的细节，例如具体金额、人名、责怪、比较苦难',
        ],
      },
      null,
      2
    ),
    schema: knowledgeEntriesSchema,
  };
}

export function buildSpeakerPrompt(session: ObserverSession, theme: Theme, speaker: SpeakerCard, relevantKnowledge: KnowledgeEntry[] = []) {
  const images = speaker.snippets
    .filter((snippet) => snippet.imageDataUrl)
    .map((snippet, index) => ({
      id: snippet.id,
      label: `图片 ${index + 1}`,
      dataUrl: snippet.imageDataUrl,
      mimeType: snippet.mimeType,
      fileName: snippet.fileName,
    }));

  return {
    instructions:
      [
        '你是韧性之树晨读营的观察者副驾驶。你的任务不是写一篇漂亮文章，而是帮助观察者在现场快速看见发言人表达里值得回应的问题线索和真实状态，并生成可以直接口播、真诚、克制、具体的回应。',
        '你要像一个有经验的带营观察者：先接住人，再连接课程；先看见痛苦，再提出选择；先尊重对方处境，再给出一点照亮。',
        '不要把自己放在评判者位置，不要用评判式标签定义对方。请用“我看到的问题”“可能正在经历的状态”“需要被看见的地方”来表达。',
        '禁止心理诊断、审判、鸡汤、道德绑架、因果论、居高临下，也不要把观察者的破产经历讲成“我比你惨”。',
        '分析必须连接用户选择的当天课程内容，不能泛泛连接七个习惯。课程连接要落到发言人的具体语言和处境。',
        '发言内容里可能包含来源、文件名、图片 OCR 识别结果、截图时间等系统元信息，这些不是发言人的表达，必须忽略，不能作为 strongestPoint 或任何洞察的内容。',
        '“我的当日观察素材”是一段观察者准备单独分享的完整素材。你要先理解它，再抽取其中与当前书友分享和当天课程真正相关的部分；不要整段硬塞，也不要为了用素材而用素材。',
        '“本次匹配到的观察者知识素材”已经按优先级排序，靠前的素材尤其要优先参考；如果素材适配，要把它转化成观察者自己的现场表达。',
        '如果内容中能识别出真实姓名，请输出 suggestedSpeakerName，只输出姓名本身，不要带“发言人”前缀；识别不到就保持空字符串。',
      ].join('\n'),
    input: JSON.stringify(
      {
        当天课程: theme,
        观察者立场: session.observerStance,
        我的当日观察素材: serializeDailyObservation(session),
        个人故事库: session.stories,
        本次匹配到的观察者知识素材: serializeKnowledge(relevantKnowledge),
        发言人: speaker.name,
        整理后的发言内容: speaker.polishedContent?.trim() || '',
        发言内容片段: speaker.snippets.map((snippet, index) => ({
          id: snippet.id,
          sourceType: snippet.sourceType,
          text: cleanSourceText(snippet.text),
          createdAt: snippet.createdAt,
          imageRef: snippet.imageDataUrl ? `图片 ${index + 1}` : undefined,
          fileName: snippet.fileName,
        })),
        输出要求: [
          '如果“整理后的发言内容”不为空，必须优先基于它分析；原始片段只作为校对和补充，不要被 OCR 噪声带偏',
          '如果内容中出现明确发言人姓名，提取姓名，suggestedSpeakerName 只填姓名本身',
          'strongestPoint：抓一个最值得回应的点，必须来自发言人的具体表达，不要泛泛总结',
          'underlyingPattern：说清背后的本质，约 120-180 字，说明你看见的深层问题或状态，不要把它写成对人的定性',
          'themeConnection：必须连接所选当天课程内容，约 220-320 字，要引用课程核心意思，并落回发言人的真实处境',
          'stuckType：字段名保留是为了兼容旧数据，但内容要写成“看到的问题/可能状态”，例如“身份和结果绑得太紧 / 选择权暂时变窄”，不要使用评判式标签，不要超过两个',
          'seenNeed：写出这个人真正需要被看见的地方，约 80-140 字，语气要温柔但不含糊',
          'suggestedObserverStory：从个人故事库里选一个最适合轻轻关联的经历；如果不适合就写“不建议关联个人故事”',
          '如果“我的当日观察素材”里有与这位书友相关的真实经历、表达句子或边界提醒，可以轻轻融合；如果不相关，就只参考语气和边界，不要强行引用',
          '如果“本次匹配到的观察者知识素材”里有合适素材，优先使用这些素材；必须遵守 speakingBoundary 和 avoidDetails',
          'storyUseBoundary：说明这个故事只能讲到什么程度，哪些细节不要展开',
          'oneMinuteResponse：生成 450-650 字现场口播回应，结构为“我听见了什么 -> 这和课程怎么连接 -> 观察者轻轻关联自己的经历 -> 给对方一个可带走的小支点”',
          'deepResponse：生成 900-1300 字深度回应稿，适合观察者重点展开，要更有层次，但仍然口语化',
          'powerfulQuestion：给一个不冒犯、不审问、能帮助对方回到自己的问题',
          'goldenSentence：给一句可以现场收束的金句，不要鸡汤',
          'doNotSay：必须给 5-8 条不要说的话，避免伤人、说教、比较苦难',
        ],
      },
      null,
      2
    ),
    schema: speakerInsightSchema,
    images,
  };
}

export function buildSessionPrompt(
  session: ObserverSession,
  theme: Theme,
  relevantKnowledge: KnowledgeEntry[] = [],
  userRequirement = '',
  templateMode: SummaryTemplateMode = 'auto'
) {
  const safeTemplateMode = summaryTemplateRules[templateMode] ? templateMode : 'auto';
  return {
    instructions:
      [
        '你是韧性之树晨读营观察者副驾驶。你的任务是帮助观察者在多位发言人分享之后，形成一段有温度、有洞察、有课程连接、可直接口播的全场观察。',
        '这不是会议纪要，也不是短摘要。你要把“当天课程 -> 多位发言人共同呈现的问题线索 -> 每个人需要被看见的状态 -> 观察者可以如何回应 -> 最后如何收束”串成一条清楚的线。',
        '观察者经历过公司破产、债务、银行起诉、限高和重新站起来，但他的经历只能作为温柔的参照，不能压过发言人，不能比较谁更惨。',
        '不要把观察写成评判，不要用评判式标签定义大家。请用“我看到的问题”“共同呈现的状态”“每个人需要被看见的地方”来表达。',
        '发言内容里可能包含来源、文件名、图片 OCR 识别结果、截图时间等系统元信息，这些不是发言人的表达，必须忽略，不能写进共同主题、每人的问题线索或重点回应。',
        '“我的当日观察素材”是一段观察者准备单独分享的完整素材。必须先拆解它：哪些是核心经历，哪些是课程理解，哪些是可复用表达，哪些是不适合展开的边界；再与当天课程和书友分享自然融合。',
        '“本次匹配到的观察者知识素材”已经按优先级排序，靠前的素材尤其要优先参考；如果包含观察者破产、债务、限高、重建相关经历，要优先判断是否适合作为现场分享的真实切面。',
        '如果“用户补充要求”不为空，必须优先满足用户补充要求；如果同时提供“当前已有全场总结”，请在已有总结基础上重写和调整，而不是完全无视已有内容。',
        '语气要求：真诚、克制、口语化、有人味；不要心理诊断，不要审判，不要鸡汤，不要讲玄，不要给廉价建议。',
        '输出必须是结构化 JSON，但每个字段都要写足内容，不要用一句话敷衍。不要输出 unifiedResponseAngle、finalSummary、sharingSections；最后要说的话统一放进 structuredSections。',
        summaryTemplateRules[safeTemplateMode].instruction,
        '三套模板的表达特征必须严格遵守：',
        `resonance 共振型：${observerStyleRules.resonance.join('')}`,
        `structure 结构型：${observerStyleRules.structure.join('')}`,
        `hybrid 融合型：${observerStyleRules.hybrid.join('')}`,
      ].join('\n'),
    input: JSON.stringify(
      {
        当天课程: theme,
        观察者立场: session.observerStance,
        我的当日观察素材: serializeDailyObservation(session),
        模板选择: {
          mode: safeTemplateMode,
          label: summaryTemplateRules[safeTemplateMode].label,
          instruction: summaryTemplateRules[safeTemplateMode].instruction,
        },
        可用模板板块与每块提示词: summaryTemplateSections,
        用户补充要求: userRequirement.trim(),
        当前已有全场总结: session.summary || null,
        当前已有全场总结版本:
          session.summaryVersions?.map((version) => ({
            label: version.label,
            source: version.source,
            templateMode: version.templateMode,
            requirement: version.requirement,
            summary: version.summary,
          })) || [],
        本次最后发言草稿: session.finalSpeechDraft || '',
        本次匹配到的观察者知识素材: serializeKnowledge(relevantKnowledge),
        整场发言脚本: session.transcriptWorkspace?.transcriptText || '',
        发言人卡片: session.speakers.map((speaker) => ({
          name: speaker.name,
          status: speaker.status,
          polishedContent: speaker.polishedContent || '',
          snippets: speaker.snippets.map((snippet) => ({
            sourceType: snippet.sourceType,
            text: cleanSourceText(snippet.text),
            createdAt: snippet.createdAt,
            fileName: snippet.fileName,
            hasImage: Boolean(snippet.imageDataUrl),
          })),
          insight: speaker.insight,
          actualResponse: speaker.actualResponse,
        })),
        输出要求: [
          '如果某位发言人的 polishedContent 不为空，必须优先使用 polishedContent 理解该发言人；原始 snippets 只作为补充',
          '如果“整场发言脚本”不为空，必须把它作为全场上下文使用；它代表用户已经梳理并可能手工删改过的准数据源。发言人卡片和单人观察用于深化理解，整场脚本用于补足顺序、语境和未归人的真实发言',
          'templateDecision：必须先判断或确认使用的模板。template 只能是 resonance、structure、hybrid；templateName 写中文名“共振型 / 结构型 / 融合型”；reason 用 80-160 字说明为什么这场适合这个模板；sceneSignals 列 3-5 个判断依据',
          'courseTheme：用 220-340 字总结当天课程内容要点，只回答“今天课程提醒了我们什么”，不要提前总结发言人，也不要和 commonTheme/keyResponse 重复',
          'commonTheme：用 220-340 字提炼几位发言人背后的共同关联主题，只回答“我看到大家共同呈现了什么问题或状态”，要承接 courseTheme，但不要复述课程定义',
          'speakerLessons：每位已经有内容或已观察的发言人都要写；lesson 约 120-220 字，用“我看到/我感受到/这里可能有一个问题线索”的口吻；themeConnection 约 100-180 字',
          'keyResponse：用 350-550 字写最值得重点展开回应的部分，只回答“现场最应该抓住哪里回应、边界是什么”，不要再重复课程主题和共同主题',
          'structuredSections：必须按 templateDecision.template 对应的“可用模板板块与每块提示词”输出同名同序板块；key 和 title 必须完全匹配该模板；每个 body 180-360 字，必须能直接口播，板块之间有自然衔接，但不要互相重复',
          '如果使用 resonance：语言要更有现场温度和共振感，少用第一第二第三；如果使用 structure：层次要非常清楚，可以使用第一层第二层第三层；如果使用 hybrid：先共振、再结构、最后用观察者经历落地',
          '融合“我的当日观察素材”时按这个顺序：先保留书友分享里的真实问题线索，再选择观察者素材中最相关的一小段经历或表达作为映照，最后落到当天课程和可带走的行动。不要照抄整段素材，不要让观察者素材压过书友分享',
          '如果知识素材里有用户过去晨读营发言或破产经历，优先提炼其中适合现场讲的切面；禁止展开 avoidDetails',
          'goldenSentences：给 6-8 句，句子要有现场感，不能空泛鸡汤',
          'oneSentenceSummaries：最后增加“一句话总结”，必须给 3 句。每句都要能单独作为观察者收束表达，短、准、有现场感，不要空泛口号',
          'closingSentence：给一句最后可直接说出口的收束句',
          'missingSpeakers：列出有内容但尚未观察、或内容明显不足的人',
          '如果输入里有人没有观察但有原始片段，也要基于原始片段做保守判断，并在 missingSpeakers 提醒',
          '如果用户补充要求改变了字数、语气、重点人物、案例使用方式或结构，以用户补充要求为准，同时保持内容真诚、克制、可口播',
        ],
      },
      null,
      2
    ),
    schema: wholeSessionSchema,
  };
}

export function buildTranscriptObservationPrompt(session: ObserverSession, theme: Theme, relevantKnowledge: KnowledgeEntry[] = []) {
  return {
    instructions: [
      '你是韧性之树晨读营观察者副驾驶。你要基于当天课程、整场发言脚本和观察者自己的完整分享素材，融合生成一篇可以直接上场说的“全场观察者分享稿”。',
      '这不是会议纪要，不是逐人点评，不是把素材拼接起来，也不是高高在上的评判。你要先找到今天全场最有穿透力的共同母题，再把大家的发言、当天课程和观察者自己的经历都串到这条主线上。',
      '必须避免心理诊断、审判、鸡汤、因果论、比较苦难。不要说谁的卡点，不要给人贴标签。',
      '“我的当日观察素材”是观察者已经准备好的主心骨，不是普通背景材料。如果它本身是一篇完整分享稿，要保留它的主论证链、关键转折、关键句和约 70%-80% 的语义内容；这不是机械照抄字数，而是不能把它压缩成几句“我的素材连接”。允许重组顺序，但不能改到失去观察者原本要表达的意思。',
      '必须从整场发言脚本里抽出书友分享中和当天课程相关的具体线索。输出要让人看得出：你真的听见了大家说了什么，而不是只讲观察者自己的故事。',
      '融合顺序必须是：先找全场共同母题 -> 用当天课程解释这条母题 -> 把每位或几位代表性发言放到这条母题的不同位置 -> 选择观察者素材中最能照亮母题的一段经历 -> 升华成对全场的鼓励。',
      '优秀稿件的标准：像“从谁为我兜底到我们彼此成就”这种表达，有一个贯穿全文的核心词或核心句；大家的分享和观察者自己的经历都服务这条主线；结构自然推进，不是板块堆叠。',
      '开头要像现场观察者的真实表达：先用一句“今天听完大家的分享，我脑子里反复出现一个词/一句话：……”抓住全场母题；紧接着用 3-5 个具体发言线索把大家串起来，例如“某某说……，某某说……，某某说……”。不要一上来讲定义或课程概念。',
      '主体要有递进感：先把当天课程重新理解成今天真实发生的问题，再深描几位书友的具体画面和转折，然后让观察者自己的素材自然进入，最后把课程、大家和自己共同升华。不要写成“课程主题/共同主题/我的素材/总结”的机械拼接。',
      '不要直接把大家归类为“依赖期/独立期/互赖期”。必须先打破简单分类：真实的人可能在工作里独立，在关系里依赖，也可能以为自己独立，却一直被关系托举。',
      '写到每个核心人物时，必须按“具体画面 -> 关键转折 -> 本质观察 -> 对全场的提醒”来展开。不要只写“某某落在某阶段”。',
      '观察者自己的素材必须具体，不要只写“我经历过困境”。必须优先提取找工作、破产、进入享佳、价值匹配、共创关系等具体案例或等价具体经历，并说明它如何解释全场母题。',
      '必须生成一条“二级主线”或“升级表达”，例如：依赖是被托举，独立是自己站稳，互赖是彼此成就。全文要围绕这个升级表达推进。',
      '完整分享稿要舒展，不要压缩成摘要。必须有可被记住的句子，例如“善意不是即时结算的”“最低层是找饭碗，中间层是找匹配，最高层是找共创”这种二次提炼。',
      '禁止低质量写法：不要写“张三处在独立期/李四处在互赖期”这种阶段判定；不要用“这个人的卡点是”这种评判；不要把观察者素材写成“这也让我想到我的素材”这种生硬转场；不要平均点评每个人，优先抓最能照亮主线的人。',
      '“本次匹配到的观察者知识素材”已经按优先级排序，尤其要优先判断破产、债务、起诉、限高、重建相关经历是否适合轻轻带入；必须遵守 speakingBoundary 和 avoidDetails。',
      '整场脚本中主持人的串场话只作为顺序参考，不作为重点观察对象；重点放在书友真实分享。',
      '输出必须是结构化 JSON。structuredSections 只输出 3 个板块：主线判断、结构提纲、完整分享稿。完整分享稿必须是一篇可直接口播的连续稿。',
    ].join('\n'),
    input: JSON.stringify(
      {
        当天课程: theme,
        观察者立场: session.observerStance,
        我的当日观察素材: serializeDailyObservation(session),
        我的素材融合要求: [
          '先拆解我的素材：它原本想表达的主线是什么、核心经历是什么、关键观点是什么、最有力量的原句是什么、哪些细节不适合展开。',
          '如果我的素材超过 800 字，把它当作一篇待融合的主稿处理：保留主要论证链、关键句和情绪推进，再用书友分享去呼应、补强或照亮它。',
          '不要把我的素材单独做成一个“我的故事”板块；它必须被放进全场母题的推进里。',
          '如果我的素材很长，保留最能照亮全场母题的 1-3 个关键切面，同时保留它原本的表达方向；不要为了保留字数破坏整篇稿子的主线，也不要把它压缩到失真。',
        ],
        本次匹配到的观察者知识素材: serializeKnowledge(relevantKnowledge),
        整场发言脚本: session.transcriptWorkspace?.transcriptText || '',
        输出要求: [
          'templateDecision.template 固定为 hybrid，templateName 写“融合分享稿”。reason 用 100-180 字说明你选择的全场母题是什么，以及为什么它能串起课程、大家发言和观察者素材。',
          'courseTheme：用 120-220 字写当天课程如何被重新理解，不要讲定义，要写“这节课今天在大家身上呈现成了什么问题”。',
          'commonTheme：用 180-320 字写全场共同母题。必须给出一个核心词或核心句，例如“兜底”“选择权”“从被托举到彼此成就”“从外境牵动到内在站稳”。',
          'speakerLessons：只写有实质分享的人；lesson 用 100-180 字写“这个人的分享落在全场母题的哪个位置”，themeConnection 用 60-120 字连接当天课程。不要逐人点评优劣。',
          'keyResponse：用 220-380 字说明这篇分享稿的主线：开头怎么切入、中间怎么展开、我的素材放在哪里、最后怎么收束。',
          'structuredSections 必须正好 3 个：',
          '1. key=mainline_decision, title=主线判断, body=写清楚今天全场母题、为什么选它、它如何连接课程/书友/我的素材，300-500 字。',
          '2. key=outline, title=结构提纲, body=用 6-8 行列出完整分享稿的段落结构，每行格式为“第X段：作用 + 要点”，不要太长。',
          '3. key=full_speech, title=完整分享稿, body=输出 1800-2400 字连续口播稿。必须有自然小标题或段落换行；不要写成表格；不要像提示词说明；可以直接复制上场讲。',
          '完整分享稿开头要求：第一段必须先出现全场核心词或核心句；第二段必须用至少 3 个具体书友线索串起全场，形成类似“某某说……，某某说……，某某说……”的现场感。',
          '完整分享稿建议结构：开场总感受 -> 反简单分类地重述课程模型/主题 -> 3-5 个层次深描大家的分享 -> 观察者自己的具体案例自然进入 -> 二级主线升级 -> 全场共同升华 -> 有力量的收束。',
          '完整分享稿必须把大家的具体发言和我的素材都串入同一条主线；不要先总结大家、再硬插我的素材。',
          '人物深描要求：至少选择 3-5 位代表性发言人，每个人必须写到具体画面、关键转折、本质观察和全场提醒；不要平均用力，也不要流水账。',
          '我的素材要求：必须使用我的完整分享素材或知识素材中的具体案例；如果“我的当日观察素材”超过 800 字，完整分享稿里至少 45%-60% 的篇幅应围绕这份素材的原义、关键句和经历展开，并让书友分享进入其中形成呼应。如果素材不足，也要在 missingSpeakers 或主线判断里说明“观察者素材缺少具体案例”，不要编造。',
          '金句密度要求：完整分享稿中至少出现 4 句可以单独摘出来的表达，且这些表达要自然嵌在正文中。',
          '语言风格：真诚、克制、口语化、有洞察，有一点文学性但不煽情；多用“我听到/我看到/这让我想到/我很有感触”。',
          'goldenSentences：给 6-8 句有现场感的金句，优先来自完整分享稿。',
          'oneSentenceSummaries：给 3 句一句话总结，必须能概括整篇分享稿的主线。',
          'closingSentence：给一句最后可以直接说出口的收束句，要和 full_speech 的结尾一致或高度接近。',
          'missingSpeakers：如果脚本信息不足或无法识别发言人，列出提示；否则为空数组。',
        ],
      },
      null,
      2
    ),
    schema: wholeSessionSchema,
  };
}

export function createLocalTranscriptObservationSummary(session: ObserverSession, theme: Theme): WholeSessionSummary {
  const transcriptText = session.transcriptWorkspace?.transcriptText || '';
  const entries = normalizeTranscriptEntries(parseTranscriptEntries(transcriptText), [], transcriptText);
  const nonHost = entries.filter((entry) => !/^主持人/.test(entry.speakerName));
  const speakers = Array.from(new Map(nonHost.map((entry) => [entry.speakerName, entry])).values()).slice(0, 8);
  const daily = serializeDailyObservation(session);
  const mainline = /依赖|独立|互赖|成熟模式|兜底/.test(transcriptText + daily.content)
    ? '从谁为我兜底，到我能站起来，再到我们彼此托举'
    : /选择|主动|影响圈|关注圈|回应/.test(transcriptText + daily.content)
      ? '从被外境牵动，到重新拿回一点选择权'
      : '从真实说出来，到在关系里重新看见自己的力量';
  const secondLine = /依赖|独立|互赖|成熟模式|兜底/.test(transcriptText + daily.content)
    ? '依赖是曾经被托举，独立是自己站稳，互赖是彼此成就'
    : /选择|主动|影响圈|关注圈|回应/.test(transcriptText + daily.content)
      ? '关注圈让人被外境带走，影响圈让人重新拿回回应'
      : '真实是入口，看见是转折，回应是力量';
  const dailyCore = clipDailyObservation(
    daily.content,
    '我自己的经历可以作为一面镜子：不是比较谁更难，而是看见人在真实压力里怎样重新找回一点选择。',
    980
  );
  const speakerSignals =
    speakers.length > 0
      ? speakers
          .slice(0, 5)
          .map((speaker) => `${speaker.speakerName}提到：“${clipDailyObservation(speaker.text, speaker.text, 90)}”`)
          .join('；')
      : '还没有识别到可用于观察的书友分享。';
  const openingSignals =
    speakers.length > 0
      ? speakers
          .slice(0, 4)
          .map((speaker) => `${speaker.speakerName}提到“${clipDailyObservation(speaker.text, speaker.text, 56)}”`)
          .join('，')
      : '';
  const outline = [
    `第1段：用一句总感受切入，说明今天不是在讨论概念，而是在看见“${mainline}”。`,
    `第2段：先打破“${theme.name}”的简单分类，说明真实的人往往同时有不同面向。`,
    '第3段：选 3-5 位书友深描：具体画面、关键转折、本质观察、给全场的提醒。',
    '第4段：引入我的具体经历，不是单独讲故事，而是解释这条主线为什么对我也成立。',
    `第5段：提炼二级主线：“${secondLine}”，把课程、大家和我的经历合在一起。`,
    '第6段：升华为对全场的鼓励，说明成长不是评价自己，而是照见自己。',
    '第7段：用一句有力量的话收束，让大家带走一个可感受、可行动的方向。',
  ].join('\n');
  const speakerDeepDive =
    speakers.length > 0
      ? speakers
          .slice(0, 5)
          .map((speaker) => {
            const text = clipDailyObservation(speaker.text, speaker.text, 150);
            return `${speaker.speakerName} 的分享里，我先听到的是一个具体画面：${text}。这个画面重要的地方，不是它能被简单归到哪个阶段，而是它让我们看见一个人在真实处境里，怎样一点点意识到自己和关系的边界，怎样在被托举、自己站稳和走向他人之间来回学习。`;
          })
          .join('\n\n')
      : '如果现在还没有足够完整的书友发言，我会先把这部分留白，等整场脚本更完整后再展开。因为真正好的观察，不应该凭空替大家下结论。';
  const fullSpeech = `今天听完大家的分享，我脑子里反复出现的一句话是：${mainline}。\n\n${
    openingSignals
      ? `${openingSignals}。这些内容放在一起，我听到的不是几段孤立的故事，而是一条人怎样站起来、又怎样走向彼此的生命线。`
      : '如果整场脚本还不完整，我会先把这句话放在这里：真正好的观察，应该从大家真实讲出来的内容里长出来。'
  }\n\n今天的课程是“${theme.name}”。如果只从概念上看，它很容易变成一张分类表：谁在依赖，谁已经独立，谁进入互赖。可是今天大家的分享提醒我，真实的人不是这样被简单分类的。\n\n我们可能在工作里已经很独立，在亲密关系里却仍然需要被托举；我们可能在经济上告诉自己无人兜底，在情感上却一直被很多人默默支持；我们也可能以为自己很依赖别人，但那份关系里其实已经有信任、滋养和彼此成就。所以我今天听到的，不是几个阶段的标签，而是一条更真实的生命线：${mainline}。\n\n如果再往前提炼一层，我会把它说成：${secondLine}。\n\n${speakerDeepDive}\n\n这些分享串在一起，不像一份会议纪要，更像一条生命线。每个人讲的事情不一样，但它们都在问一个共同的问题：当生活真的落到自己身上时，我到底把安全感、选择权和责任放在哪里？我是在等别人替我兜底，还是开始学习自己站稳？我是不是已经被很多关系托举，却因为太用力、太焦虑、太想证明自己，而没有看见？\n\n沿着这条线，我也会把自己的经历放进来。\n\n${dailyCore}\n\n我把这段经历放在这里，不是为了比较谁更难，也不是为了证明自己已经走出来了，而是因为它让我很深地体会到：一个人真正的成熟，不是从此不需要别人，也不是永远一个人硬扛。成熟更像是在现实里慢慢分清楚，哪些责任我要拿回来，哪些帮助我可以真诚接受，哪些关系不是依赖，而是彼此成就。\n\n所以回到今天这门课，我觉得“${theme.name}”真正想提醒我们的，不是把自己放进某一个正确阶段，而是让我们多一次照见自己：我现在是不是把本该自己承担的责任交给别人了？我是不是明明需要帮助，却假装自己很强？我是不是已经收到很多托举，却因为过去的盔甲太厚，而没有看见其中的爱和信任？\n\n好的课程不是拿来评价自己的，而是拿来照见自己的。今天这张图也不是要告诉我们谁成熟、谁不成熟，而是提醒我们：成长不是一条笔直的路。我们会在依赖、独立和互赖之间来回练习，也会在不同关系、不同处境里不断切换。\n\n所以今天我最想带走的，不是“我要赶快变得更独立”或者“我要马上进入互赖”。我更想带走的是一种清醒：当我被托举时，我能不能看见感恩；当我需要站起来时，我能不能拿回责任；当我已经有力量时，我能不能走向共创。\n\n如果用一句话总结今天大家给我的启发，我会说：成长不是从弱变强，而是从等别人兜底，到自己站起来，再到我们彼此托举、共同成就。\n\n愿我们都能在今天的分享里，看见自己曾经被爱过，也看见自己可以站起来，更看见人生真正大的成果，从来不是一个人完成的。`;

  return {
    templateDecision: {
      template: 'hybrid',
      templateName: '融合分享稿',
      reason: `这是一版基于整场脚本、当天课程和观察者当日素材生成的本地融合稿。它优先选择“${mainline}”作为全场主线，再把书友表达和观察者素材串到这条线上。`,
      sceneSignals: ['先找全场母题', '再融合个人素材', '输出完整口播稿'],
    },
    courseTheme: `今天课程“${theme.name}”提醒我们的不是一个抽象定义，而是：${theme.core}`,
    commonTheme: transcriptText
      ? `今天全场共同呈现的主线是“${mainline}”。比如：${speakerSignals}。这些具体表达背后共同呈现的是：人在真实处境里既需要被看见，也需要慢慢找到自己可以站稳、可以回应、也可以和别人彼此支持的位置。`
      : '还没有整场脚本，建议先贴截图并点击“梳理”。',
    speakerLessons: speakers.map((speaker) => ({
      speakerName: speaker.speakerName,
      lesson: `${speaker.speakerName} 的分享可以放在“${mainline}”这条主线里看：${clipDailyObservation(speaker.text, speaker.text, 130)}。这里重要的不是评价他/她在哪个阶段，而是看见这段表达让全场多了一层真实。`,
      themeConnection: `这可以连接到“${theme.name}”：课程不是急着给人分类，而是帮助我们在生活里照见自己此刻的位置。`,
    })),
    keyResponse: `这篇稿子的主线是“${mainline}”。开头先说明今天不是讨论概念，而是在看见人的真实状态；中间用几位书友的分享展开这条生命线；随后把我的素材作为一个映照放进去；最后回到“${theme.name}”，收束成对全场的鼓励。`,
    structuredSections: [
      { key: 'mainline_decision', title: '主线判断', body: `今天这场分享最适合用“${mainline}”来串起来。但不能直接把大家简单分类成依赖、独立或互赖。更好的看法是：真实的人会在不同关系和不同处境里，同时呈现不同面向。所以这篇稿子的二级主线是：“${secondLine}”。它能接住当天课程“${theme.name}”，也能把大家的不同发言放到同一条成长线上：有人在讲被托举，有人在讲自己站起来，也有人在讲彼此成就。观察者自己的素材不应该单独贴上去，而应该作为这条主线里的一个真实映照。` },
      { key: 'outline', title: '结构提纲', body: outline },
      { key: 'full_speech', title: '完整分享稿', body: fullSpeech },
    ],
    goldenSentences: [
      `今天我们不是在讨论一个概念，而是在看见“${mainline}”。`,
      '真正的成熟，不是越来越不需要别人，而是既能站住自己，也能走向彼此。',
      '课程不是拿来评价自己的，而是拿来照见自己的。',
      '成长不是突然从弱变强，而是在同样的处境里多一点清醒和选择。',
      '好的关系不是永远替你扛，而是在合适的时候扶你一把，也把责任还给你。',
      '我们不是来证明自己懂了多少，而是来练习把知道的东西一点点活出来。',
    ],
    oneSentenceSummaries: [
      `今天全场最打动我的主线是：${mainline}。`,
      '成熟不是给自己分类，而是在生活里一次次照见自己。',
      '真正大的成长，从来不是一个人完成的。',
    ],
    closingSentence: '成长不是从弱变强，而是从等别人托举，到自己站起来，再到我们彼此托举、共同成就。',
    missingSpeakers: transcriptText ? [] : ['整场脚本为空'],
    generatedBy: 'local',
  };
}

function groupTranscriptEntriesForEncouragement(transcriptText: string) {
  const entries = normalizeTranscriptEntries(parseTranscriptEntries(transcriptText), [], transcriptText);
  const groups = new Map<string, TranscriptLine[]>();
  entries.forEach((entry) => {
    if (/^(系统消息|系统)$/i.test(entry.speakerName.trim())) {
      return;
    }
    groups.set(entry.speakerName, [...(groups.get(entry.speakerName) || []), entry]);
  });
  return Array.from(groups.entries()).map(([speakerName, items]) => ({
    speakerName,
    content: items.map((item) => `${item.time} ${item.text}`).join('\n'),
  }));
}

function extractLocalTranscriptQuotes(transcriptText: string) {
  const entries = normalizeTranscriptEntries(parseTranscriptEntries(transcriptText), [], transcriptText);
  const quoteCandidates: Array<{ speakerName: string; quote: string; score: number }> = [];
  const seen = new Set<string>();

  const addQuote = (speakerName: string, quote: string, score = 0) => {
    const cleaned = quote.replace(/\s+/g, ' ').replace(/^[“"']|[”"']$/g, '').trim();
    if (cleaned.length < 4 || cleaned.length > 48) {
      return;
    }
    if (/^(嗯+|啊+|呃+|然后|这个|那个|好的|谢谢|大家好)$/.test(cleaned)) {
      return;
    }
    const key = `${speakerName}|${normalizeTranscriptTextForDuplicate(cleaned)}`;
    if (seen.has(key)) {
      return;
    }
    seen.add(key);
    const expressionScore =
      (/[我你他她我们自己人生关系家庭喜欢相信选择兜底醒身看见力量成长焦虑消耗平静]/.test(cleaned) ? 2 : 0) +
      (/[，。！？、]/.test(cleaned) ? 1 : 0) +
      (cleaned.length >= 8 && cleaned.length <= 26 ? 2 : 0);
    quoteCandidates.push({ speakerName, quote: cleaned, score: score + expressionScore });
  };

  entries.forEach((entry) => {
    const text = entry.text.trim();
    const quotedMatches = Array.from(text.matchAll(/[“"]([^“”"]{4,48})[”"]/g));
    quotedMatches.forEach((match) => addQuote(entry.speakerName, match[1], 5));

    text
      .split(/[。！？；;]/)
      .map((sentence) => sentence.trim())
      .filter(Boolean)
      .forEach((sentence) => {
        if (/(我觉得|我好像|我看到|我感受|我醒|醒身|兜底|喜欢|相信|选择|消耗|平静|力量|成长)/.test(sentence)) {
          addQuote(entry.speakerName, sentence, 2);
        }
      });
  });

  return quoteCandidates
    .sort((a, b) => b.score - a.score || a.quote.length - b.quote.length)
    .slice(0, 6);
}

const encouragementModePrompts = [
  {
    key: 'field_state_review',
    title: '模式一：整体场域状态复盘',
    focus: '先讲整体状态，再讲主题连接。观察大家今天表达出来的松动、真实、打开、紧绷或共同变化，不要急着逐个点评。',
    structure: '承接全场 -> 场域状态 -> 共同生命课题 -> 主题连接 -> 生活落点 -> 金句收束',
  },
  {
    key: 'individual_turning_points',
    title: '模式二：每个人的转变点复盘',
    focus: '逐个或分组看见分享者身上最值得被看见的一个微小转变。人数多时只抓 3-4 个代表性转变点，避免流水账。',
    structure: '开场承接 -> 代表性转变点 A/B/C -> 群体共性 -> 主题连接 -> 收束提醒',
  },
  {
    key: 'seven_habits_connection',
    title: '模式三：连接七个习惯主题复盘',
    focus: '不要讲书本定义，而是找到书中的原则如何在大家的真实生活里呈现。最多选择 3 个最贴近现场的概念。',
    structure: '开场定位 -> 核心概念 1/2/3 与具体分享 -> 整合洞察 -> 小行动落点',
  },
  {
    key: 'gentle_powerful_observer',
    title: '模式四：温柔但有力量的观察者发言',
    focus: '最适合直接上场。放低姿态，不点评，只讲听完后的真实感受，抓 2-3 个最有代表性的生命状态或变化。',
    structure: '感谢与定位 -> 最有感观察一/二/三 -> 落回主题 -> 克制收尾',
  },
  {
    key: 'outside_in_to_inside_out',
    title: '模式五：由外而内到由内而外的变化复盘',
    focus: '适合家庭、关系、情绪、外境牵动较多的场次。重点不是说外界不重要，而是看见大家如何开始回到选择权。',
    structure: '外境牵动 -> 内在转折 -> 具体案例 -> 连接主题 -> 当下练习 -> 收束金句',
  },
  {
    key: 'group_quotes_insight',
    title: '大家的金句与洞察',
    focus: '从大家原话里挑出最打动人心、最有现场生命力的句子。不是每个人都必须有；宁可少而准，也不要为了凑数摘普通句子。',
    structure: '金句原话 -> 这句话为什么打动人 -> 它照见的生命状态或课程连接 -> 观察者自己的感悟',
  },
];

export function buildTranscriptEncouragementPrompt(session: ObserverSession, theme: Theme, relevantKnowledge: KnowledgeEntry[] = []) {
  return {
    instructions: [
      '你是韧性之树晨读营观察者副驾驶。你要基于整场脚本文本，生成一版“五种模式”的全场鼓励输出。',
      '这篇不是问题分析，不是点评优劣，也不是会议纪要。重点是在分享中看见人的状态、转变、主题落点，以及整个场域值得被鼓励的地方。',
      '你要像一个温暖而清醒的观察者：具体听见大家说了什么，从中看见变化、真诚、勇气、觉察、承担、边界、柔软或重新选择的力量。',
      '必须避免高高在上的评判、心理诊断、鸡汤、比较苦难。不要说“你应该”，少说概念，多说具体看见。',
      '如果“我的当日观察素材”有内容，可以作为观察者收获和自我连接的参考，但不要压过对大家和场域的看见。',
      '输出必须是结构化 JSON。structuredSections 必须正好 6 个板块：五种鼓励模式 + 大家的金句与洞察。每个板块都要能直接口播，内部用自然换行组织成好读的短段落。',
    ].join('\n'),
    input: JSON.stringify(
      {
        当天课程: theme,
        观察者立场: session.observerStance,
        我的当日观察素材: serializeDailyObservation(session),
        本次匹配到的观察者知识素材: serializeKnowledge(relevantKnowledge),
        整场发言脚本: session.transcriptWorkspace?.transcriptText || '',
        五种鼓励模式: encouragementModePrompts,
        输出要求: [
          'templateDecision.template 固定为 resonance，templateName 写“全场鼓励 · 五种模式”。reason 说明这版一次给出五种可选复盘说法，并额外摘取大家的金句做洞察。',
          'courseTheme：用 120-200 字说明今天课程给全场鼓励提供了什么视角，不展开成课程讲解。',
          'commonTheme：用 180-300 字提炼今天全场共同呈现的真实状态或变化，要基于脚本具体内容。',
          'speakerLessons：覆盖有实质发言的人，每人 lesson 用 80-160 字写“我听见的具体表达 + 值得被鼓励的变化/力量”；themeConnection 用 60-120 字连接当天课程。',
          'keyResponse：用 300-500 字写一段总括说明：这五种模式分别适合从哪几个角度回应今天这场分享，以及“大家的金句与洞察”适合如何作为现场补充。',
          'structuredSections 必须正好 6 个，key/title 必须沿用“五种鼓励模式”里的 key/title。',
          '每个 structuredSections.body 控制在 450-750 字，可以直接口播。每个 body 内部必须用 4-6 个短段落换行，建议格式为“开场：...\\n\\n我看到：...\\n\\n连接课程：...\\n\\n带走：...”。',
          '前五个板块不要互相重复：模式一讲整体场域，模式二讲代表性转变点，模式三讲课程概念落地，模式四讲直接上场的温柔发言，模式五讲由外而内到由内而外。',
          '第六个“大家的金句与洞察”：从整场脚本中摘 3-6 句最打动人心的原话，尽量保留原句和发言人姓名；不是每个人都必须有。每句后面写 80-140 字洞察和感悟，说明这句话为什么有力量、照见了什么状态、和当天课程有什么连接。',
          '六个板块都要真诚、克制、柔软、有洞察；必须多用“我听到 / 我看到 / 我感受到”。',
          'goldenSentences：给 6-8 句鼓舞人心但不鸡汤的句子。',
          'oneSentenceSummaries：给 3 句一句话总结，适合最后收束。',
          'closingSentence：给一句温暖有力量的最后一句。',
          'missingSpeakers：如果脚本里有人名字无法识别或内容太少无法具体鼓励，列出；否则为空数组。',
        ],
      },
      null,
      2
    ),
    schema: wholeSessionSchema,
  };
}

export function createLocalTranscriptEncouragementSummary(session: ObserverSession, theme: Theme): WholeSessionSummary {
  const transcriptText = session.transcriptWorkspace?.transcriptText || '';
  const groups = groupTranscriptEntriesForEncouragement(transcriptText).filter((group) => !/^主持人/.test(group.speakerName) || group.content.length > 40);
  const speakerLine =
    groups.length > 0
      ? groups
          .slice(0, 12)
          .map((group) => `${group.speakerName}：${clipDailyObservation(group.content, group.content, 120)}`)
          .join('；')
      : '还没有识别到可鼓励的具体发言。';
  const daily = serializeDailyObservation(session);
  const dailyGain = daily.content
    ? `结合我自己的素材，我会把今天的收获放在这里：我不是只从自己的经历里找答案，也是在大家的表达里重新看见，真实说出来本身就能带动一个场域。`
    : '我自己的收获是：观察不是站在旁边评价，而是在大家真实表达的时候，也让自己被这个场域重新提醒。';
  const representativePeople = groups.slice(0, 4);
  const representativeLines =
    representativePeople.length > 0
      ? representativePeople.map((group) => `${group.speakerName}说到：“${clipDailyObservation(group.content, group.content, 90)}”`).join('；')
      : '目前还没有足够的具体发言可以展开。';
  const peoplePraise =
    representativePeople.length > 0
      ? representativePeople
          .map((group) => `我看到 ${group.speakerName}：${clipDailyObservation(group.content, group.content, 110)}。这里值得被鼓励的，是他/她愿意把真实状态带到场域里。`)
          .join('\n\n')
      : '还没有足够的发言脚本来逐个看见。';
  const localQuotes = extractLocalTranscriptQuotes(transcriptText);
  const quotesInsightBody =
    localQuotes.length > 0
      ? localQuotes
          .map(
            (item, index) =>
              `金句 ${index + 1}｜${item.speakerName}：“${item.quote}”\n\n这句话打动我的地方，是它不是一个漂亮表达，而是一个真实状态被说出来了。它让我们看到，一个人开始把生活里的细微感受、关系里的牵动、内在的选择或正在发生的变化讲清楚。放回“${theme.name}”，这句话提醒我们：课程真正进入生活的时候，往往不是一句大道理，而是这样一句从真实经验里长出来的话。`
          )
          .join('\n\n')
      : `今天的脚本里暂时没有抓到特别适合单独摘出的金句。这里我会先保留一个观察：真正打动人的话，不一定华丽，但一定来自真实经验。等后续脚本文本更完整时，可以从大家的原话里挑出 3-6 句最有生命力的表达，再围绕它们展开洞察。`;

  return {
    templateDecision: {
      template: 'resonance',
      templateName: '全场鼓励 · 五种模式',
      reason: '这是一版基于整场脚本生成的五种鼓励复盘方式，并额外摘取大家原话里的金句做洞察，方便你按现场需要选择整体场域、个人转变、课程连接、直接发言、由内而外或金句回应的角度。',
      sceneSignals: ['整体场域', '个人转变点', '七个习惯连接', '温柔有力量', '由内而外', '大家的金句'],
    },
    courseTheme: `今天课程“${theme.name}”提供了一个看见大家的角度：${theme.core}`,
    commonTheme: transcriptText
      ? `今天全场最值得鼓励的地方，是大家都愿意把自己的真实状态放进这个场域。${speakerLine}。这些表达让人看到，成长不是把话说得多漂亮，而是愿意把自己正在经历的部分拿出来，被看见，也被彼此照见。`
      : '还没有整场脚本，建议先贴截图并点击“梳理”。',
    speakerLessons: groups.map((group) => ({
      speakerName: group.speakerName,
      lesson: `我想鼓励 ${group.speakerName} 的地方是：你今天愿意把这部分表达出来。你说到“${clipDailyObservation(group.content, group.content, 120)}”，这里面有真实，也有正在觉察自己的力量。能把它放到场域里，本身就很珍贵。`,
      themeConnection: `这和“${theme.name}”的连接是：成长不是一下子抵达某个标准，而是在每一次真实表达里，看见自己正在往哪里走。`,
    })),
    keyResponse: `这版全场鼓励可以从六个角度使用：先看整体场域，再看每个人的转变点，再把这些变化放回“${theme.name}”，也可以选择一版最适合现场直接说出口的表达。如果今天大家更多是在讲家庭、关系、情绪和外境牵动，就可以优先使用“由外而内到由内而外”的模式；如果今天有人说出了特别打动人的原话，就可以使用“大家的金句与洞察”作为更有现场温度的回应。`,
    structuredSections: [
      {
        key: 'field_state_review',
        title: '模式一：整体场域状态复盘',
        body: `开场：今天听完大家的分享，我最先感受到的不是某一个答案，而是这个场域里有一种更真实的流动。大家不是只在讲书里的概念，而是把自己的生活现场带了进来。\n\n我看到：${speakerLine}。这些表达让今天的场域变得很实，也让彼此之间多了一点照见。\n\n共同状态：大家说的事情不同，但背后都在练习一件事：在真实处境里看见自己的状态，而不是被状态完全带走。\n\n连接课程：回到“${theme.name}”，课程真正落到生活里，不是我们会讲概念，而是我们在具体关系、情绪和选择里，多了一点清醒。\n\n收束：今天这个场域让我看到，成长不是从脆弱变成强硬，而是在脆弱中仍然愿意真实。`,
      },
      {
        key: 'individual_turning_points',
        title: '模式二：每个人的转变点复盘',
        body: `开场：如果逐个回应大家，我不想把每个人讲过的话重新复述一遍，而是想抓住每个人身上一个微小但重要的转变。\n\n代表性转变：${peoplePraise}\n\n我感受到：这些转变可能都不大，但很珍贵。因为成长很多时候不是突然换了一个人，而是在同样的处境里，开始多一点觉察、多一点选择。\n\n连接课程：放回“${theme.name}”，这些转变让我看到，书里的原则不是停在纸面上，而是在大家今天的表达里一点点发生。\n\n收束：我想鼓励的是，今天每个人真实说出来的那一点变化，本身就已经是在往前走。`,
      },
      {
        key: 'seven_habits_connection',
        title: '模式三：连接七个习惯主题复盘',
        body: `开场：今天我不想把“${theme.name}”讲成课程解释，而是想看它在大家生活里长什么样。\n\n概念落地：我听到的具体线索是：${representativeLines}。这些不是概念的例子，而是一个人在生活里真实练习的现场。\n\n整合洞察：从这些分享里，我看到七个习惯最有力量的地方，是帮助我们把注意力从外面的结果，慢慢带回自己可以回应的地方。\n\n小行动：今天可以带走一个很小的练习：遇到一个让自己被牵动的场景时，先停一下，问自己“我现在真正能选择的一步是什么”。\n\n收束：晨读营的价值，不是让我们证明自己懂了多少，而是让我们把知道的东西一点点活出来。`,
      },
      {
        key: 'gentle_powerful_observer',
        title: '模式四：温柔但有力量的观察者发言',
        body: `感谢：我想先谢谢今天每一位分享的人。你们带来的不是标准答案，而是自己的真实现场。\n\n我最有感的是：今天大家都在用自己的方式，把生活里不容易讲清楚的部分讲出来。${speakerLine}\n\n我看到的力量：这些表达里有脆弱，也有勇气；有困惑，也有正在看见自己的清醒。它们不一定立刻解决问题，但会让人开始不再一个人扛着。\n\n回到主题：如果连接到“${theme.name}”，我觉得今天不是大家“做到了什么”，而是大家开始更真实地看见自己在哪里。\n\n克制收尾：愿我们今天都带走一点更柔软也更有力量的自己，不急着变完美，只诚实地往前一步。`,
      },
      {
        key: 'outside_in_to_inside_out',
        title: '模式五：由外而内到由内而外的变化复盘',
        body: `外境牵动：今天大家的分享里，我听到很多真实的外境：关系、家庭、情绪、现实压力，以及那些会把人带走的瞬间。\n\n内在转折：但我也看到，大家并没有只停在“外面发生了什么”。有人开始看见自己的反应，有人开始承认自己的需要，有人开始从被牵动里慢慢回到选择。\n\n具体看见：${representativeLines}。这些片段让我看到，真正的改变往往不是外在马上变好，而是我们内在先多了一点稳定和负责。\n\n连接课程：这和“${theme.name}”很贴近。由内而外不是否定外界，而是在外界还没有完全改变时，先把自己带回可以回应的位置。\n\n带走：下一次被外境牵动时，可以先停一下，看见自己的反应，再问一句：我现在能不能做一个更靠近自己价值的选择？`,
      },
      {
        key: 'group_quotes_insight',
        title: '大家的金句与洞察',
        body: quotesInsightBody,
      },
    ],
    goldenSentences: [
      '真实说出来，本身就是一种力量。',
      '一个人被看见的时候，场域也会被照亮。',
      '成长不是马上变好，而是愿意更真实地面对自己。',
      '今天每一段表达，都在为这个场域增加温度。',
      '鼓励不是夸奖表面，而是看见一个人正在往前走。',
      '我们彼此的真实，会成为彼此继续走的力量。',
      '真正的成长，不是突然变成另一个人，而是在同样的处境里多了一点清醒和选择。',
    ],
    oneSentenceSummaries: [
      '今天最值得被鼓励的，是大家都把真实带进了场域。',
      '每个人的表达都在提醒我们：成长正在具体生活里发生。',
      '我从大家身上收到的，是继续真实、继续面对、继续生长的力量。',
    ],
    closingSentence: '愿我们都带着今天被彼此照亮的这一点力量，继续往前走。',
    missingSpeakers: transcriptText ? [] : ['整场脚本为空'],
    generatedBy: 'local',
  };
}

export function createLocalSpeakerInsight(speaker: SpeakerCard, theme: Theme, session?: ObserverSession): SpeakerInsight {
  const text =
    speakerSourceText(speaker) ||
    speaker.snippets
      .map((snippet) => (snippet.imageDataUrl ? `已上传图片：${snippet.fileName || '截图'}` : ''))
      .join('\n')
      .trim();
  const firstLine = text.split(/[。！？\n]/).find(Boolean)?.trim() || '他这段分享里有一个还没有被真正接住的点';
  const daily = serializeDailyObservation(session);
  const dailyMaterial = clipDailyObservation(daily.content, '公司破产');
  const dailyDirection = daily.content ? '从我的完整分享素材里挑出和对方处境真正相关的一小段，作为轻轻映照' : '先接住对方，再把课程落到一个可带走的小选择上';
  const dailyBoundary = '不要比较谁更惨，不要让自己的经历压过对方；如果素材里写了不想展开的部分，要优先避开。';
  return {
    suggestedSpeakerName: '',
    strongestPoint: firstLine,
    underlyingPattern: `这更像是在面对“${theme.name}”时，现实压力让人的选择感暂时变窄了。这里不需要急着判断对错，而是先看见他正在经历的状态，再陪他分辨自己还可以怎样回应。`,
    themeConnection: `如果连接到当天课程“${theme.name}”，这段分享可以从“${theme.core}”切入。回应时不要把课程变成概念解释，而是先承认他当下真实的压力，再帮他看见课程里最重要的一点：人在困难里并不是立刻拥有全部答案，而是先重新分辨哪些是已经发生的现实，哪些是自己仍然可以选择的回应。这样课程就不是道理，而是帮他回到自己的一个支点。`,
    stuckType: '选择感暂时变窄 / 自我价值容易被结果牵动',
    seenNeed: '他需要先被看见的是：痛苦不是软弱，暂时没有找到入口也不代表没有能力。回应时要先接住这个状态，再谈一点点选择。',
    suggestedObserverStory: dailyMaterial,
    storyUseBoundary: `可以结合“${dailyMaterial}”里与选择、承担或重新站稳有关的部分，但要遵守边界：${dailyBoundary}`,
    oneMinuteResponse: `我听到你刚才最打动我的点是：${firstLine}。如果放到今天“${theme.name}”这个主题里，我会觉得这不是简单要你更积极一点，而是先看见：哪些确实已经发生，哪些仍然在你的影响圈里。结合我自己的经历，我今天更想把方向放在：${dailyDirection}。我也经历过现实突然很重的时候，后来慢慢发现，真正让我重新站起来的，不是马上解决所有问题，而是先承认现实，然后抓住一个我还能选择的回应。`,
    deepResponse: `这段分享里，我会抓住“${firstLine}”。它背后像是在说：现实已经很重，但更重的是人会把现实的压力变成对自己的判断。今天的主题如果是“${theme.name}”，我不想把它讲成一句“你要积极主动”，那样太轻了。我更想说，积极主动有时候只是一个很小的动作：先把已经发生的事情和“我这个人是谁”分开，再从混乱里找到一个自己还能负责的小部分。结合今天我自己的准备，我会把“${dailyMaterial}”里真正相关的一小段轻轻作为参照，但不把它讲成比较，只讲它如何帮助我重新看见选择。`,
    powerfulQuestion: '如果不急着解决全部问题，你现在最能拿回来的一个小选择是什么？',
    goldenSentence: '真正的积极主动，不是把所有痛苦扛住，而是在痛苦里重新看见自己还可以怎样回应。',
    doNotSay: ['你应该积极主动一点', '我当年比你还惨', '这都是因果', '你就是还没放下', '你要感谢苦难'],
    generatedBy: 'local',
  };
}

export function inferLocalSummaryTemplate(session: ObserverSession, templateMode: SummaryTemplateMode) {
  if (templateMode !== 'auto') {
    return templateMode;
  }
  const text = session.speakers.map((speaker) => speakerSourceText(speaker)).join('\n');
  const emotionMatches = (text.match(/痛|难受|焦虑|害怕|崩溃|不容易|压力|自责|委屈|失控|破产|债务|关系/g) || []).length;
  const structureMatches = (text.match(/第一|第二|第三|概念|原则|方法|逻辑|模型|步骤|定义|系统|认知/g) || []).length;
  if (emotionMatches >= structureMatches + 2) {
    return 'resonance';
  }
  if (structureMatches >= emotionMatches + 2) {
    return 'structure';
  }
  return 'hybrid';
}

function createLocalStructuredSections(
  template: 'resonance' | 'structure' | 'hybrid',
  session: ObserverSession,
  theme: Theme,
  analyzed: SpeakerCard[]
) {
  const daily = serializeDailyObservation(session);
  const dailyCase = clipDailyObservation(
    daily.content,
    '我自己经历破产、债务和限高时，也很熟悉那种系统突然崩塌的感觉。后来真正帮助我的，不是证明自己没有失败，而是先承认现实，再一点点把自己能负责、能选择的那一小部分拿回来。'
  );
  const dailyDirection = daily.content ? '先从大家的分享里找到共同问题线索，再从我的完整分享素材里选一小段最贴近的经历或表达来映照，最后落回课程和行动。' : '先接住一个人最真实的压力，再把课程主题落到他还能做出的一个小选择上。';
  const dailyAction = daily.content
    ? `如果结合我今天准备的分享素材，可以先不急着整段讲完，而是选择其中最贴近大家处境的一小段。大家可以带走一个小练习：把已经发生的现实、自己产生的感受、今天还能做出的一个回应分开写下来。`
    : '今天大家可以先带走一个小练习：把已经发生的现实、自己产生的感受、今天还能做出的一个回应分开写下来。这个动作很小，但能帮人从混乱里重新回到自己。';
  const seenSpeakers =
    analyzed.length > 0
      ? analyzed.map((speaker) => `${speaker.name}呈现的是：${speaker.insight?.seenNeed || speaker.insight?.strongestPoint || '还需要被更具体地看见'}`).join('；')
      : '每个人呈现出来的问题线索都不完全一样，但都值得被具体地看见，而不是被一句道理概括。';

  const byTemplate = {
    resonance: [
      {
        key: 'opening_hold',
        title: '开场接住',
        body: '今天听完大家的分享，我最先感受到的不是谁讲得更完整，而是每个人都在很真实地把自己的处境拿出来。这里面有压力、有不确定，也有一种愿意面对自己的勇气。能把这些说出来，本身就已经是在往光下走了一步。',
      },
      {
        key: 'touching_line',
        title: '今天最触动我的一条线',
        body: `今天最触动我的一条线，是“重新看见自己还有选择”。如果放在“${theme.name}”里，它不是一句口号，而是当现实很重的时候，我们还能不能先把事情、感受和自我价值慢慢分开。`,
      },
      {
        key: 'what_i_see',
        title: '我看见了什么',
        body: '我看见大家不是没有力量，而是在一些真实的人事物境里，暂时被结果、关系或责任感压住了。也许我们最需要的不是马上被要求改变，而是先被允许承认：我现在确实很不容易，但我仍然可以一点点回到自己。',
      },
      {
        key: 'life_lessons',
        title: '几位发言人的问题线索',
        body: seenSpeakers,
      },
      {
        key: 'experience_mirror',
        title: '我的经历映照',
        body: dailyCase,
      },
      {
        key: 'course_return',
        title: '回到今天课程',
        body: `回到今天“${theme.name}”这节课，它给我们的不是一个立刻解决所有问题的答案，而是一个重新看待处境的角度。课程真正有力量的地方，是让我们在现实还没变好之前，先调整自己回应现实的方式。`,
      },
      {
        key: 'closing_line',
        title: '带走一句话',
        body: '愿我们今天都先不急着把问题解决完，而是在问题里先找回一点点自己。只要这一点选择还在，生命就还有重新生长的地方。',
      },
    ],
    structure: [
      {
        key: 'opening_position',
        title: '开场定位',
        body: `今天大家其实共同讨论的是：当现实和期待不一致时，我们如何用“${theme.name}”重新整理自己的反应，而不是继续被事件、情绪或关系推着走。`,
      },
      {
        key: 'course_deconstruction',
        title: '课程概念拆解',
        body: `这节课可以拆成三点来看：第一，它提醒我们看见自己的反应模式；第二，它要求我们区分现实、感受和选择；第三，它最终要落到行动里，不只是知道“${theme.core}”，而是能在具体处境中做出新的回应。`,
      },
      {
        key: 'shared_pattern',
        title: '全场共同模式',
        body: '全场共同模式是：每个人讲的事件不同，但背后都在处理同一个问题，外在结果尚未稳定时，内在如何不跟着全部失序。有人在责任里用力，有人在关系里消耗，有人的自我价值被结果牵动，但底层都在寻找新的支点。',
      },
      {
        key: 'three_layers',
        title: '三层理解',
        body: '第一层是表层事件：现实里发生了让人不舒服的事情。第二层是内在状态：人把事件变成了对自己的判断。第三层是成长方向：把事情和自己分开，把能回应的部分重新拿回来。',
      },
      {
        key: 'speaker_topics',
        title: '每人的问题线索',
        body: seenSpeakers,
      },
      {
        key: 'observer_experience',
        title: '我的经验补充',
        body: dailyCase,
      },
      {
        key: 'action_practice',
        title: '可带走的行动',
        body: dailyAction,
      },
      {
        key: 'summary_anchor',
        title: '一句话总结',
        body: '今天的核心不是让问题马上消失，而是让我们在问题还在的时候，先恢复看见、选择和行动的能力。',
      },
    ],
    hybrid: [
      {
        key: 'opening_hold',
        title: '开场接住',
        body: '今天听完大家的分享，我首先感受到的是一种真实。大家不是在讲漂亮答案，而是在讲自己正在经历的生活现场。这样的表达很珍贵，因为只有真实被说出来，我们才有机会真正看见它、回应它。',
      },
      {
        key: 'common_theme',
        title: '共同主题',
        body: '今天共同的暗线，是在压力和不确定里重新拿回选择权。几位发言看似讲的是不同事情，但背后都在问：当现实没有按照我期待的方式发生时，我还能不能不把自己完全交给情绪和结果？',
      },
      {
        key: 'course_connection',
        title: '课程连接',
        body: `连接到“${theme.name}”，我觉得课程不是要我们立刻变得强大，而是提醒我们先看见自己的回应模式。${theme.core}真正落地的时候，往往就是在一个具体处境里，重新分辨我还能影响什么。`,
      },
      {
        key: 'speaker_lessons',
        title: '每人的问题线索',
        body: seenSpeakers,
      },
      {
        key: 'key_response',
        title: '重点回应',
        body: analyzed[0]?.insight?.deepResponse || `最值得重点回应的是：${dailyDirection}回应时要避免站在高处给答案，而是陪他看见已经出现的力量。`,
      },
      {
        key: 'experience_connection',
        title: '我的经历连接',
        body: dailyCase,
      },
      {
        key: 'takeaway_action',
        title: '带走的行动',
        body: '今天大家可以先带走一个小练习：遇到难以推进的事时，问自己三个问题：这是已经发生的现实，还是我对现实的解释？这里面我最强烈的感受是什么？今天我还能做出的一个小回应是什么？',
      },
      {
        key: 'one_sentence_summary',
        title: '一句话总结',
        body: '如果用一句话收束，就是：真正的成长，不是等风浪过去才开始，而是在风浪里先找回那个还能选择的自己。',
      },
    ],
  };

  return byTemplate[template];
}

export function createLocalWholeSummary(session: ObserverSession, theme: Theme, templateMode: SummaryTemplateMode = 'auto'): WholeSessionSummary {
  const analyzed = session.speakers.filter((speaker) => speaker.insight);
  const missing = session.speakers.filter((speaker) => speaker.snippets.length > 0 && !speaker.insight).map((speaker) => speaker.name);
  const template = inferLocalSummaryTemplate(session, templateMode);
  const templateName = template === 'resonance' ? '共振型' : template === 'structure' ? '结构型' : '融合型';

  return {
    templateDecision: {
      template,
      templateName,
      reason:
        templateMode === 'auto'
          ? `本地演练根据全场内容的情绪词、概念词和课程连接度做了粗略判断，推荐使用${templateName}。真实 AI 会结合完整语境做更细的判断。`
          : `你手动指定使用${templateName}，本次按该模板输出。`,
      sceneSignals: ['发言内容的情绪浓度', '课程概念的分散程度', '是否需要先接住再梳理', '是否适合结合观察者经历'],
    },
    courseTheme: `今天课程“${theme.name}”的核心，是${theme.core}`,
    commonTheme: `大家都在围绕“${theme.name}”呈现出一个共同问题：现实很重，但仍然要找到自己还可以选择的回应。`,
    speakerLessons: analyzed.map((speaker) => ({
      speakerName: speaker.name,
      lesson: speaker.insight?.underlyingPattern || '还需要进一步观察',
      themeConnection: speaker.insight?.themeConnection || theme.core,
    })),
    keyResponse: analyzed[0]?.insight?.deepResponse || '最值得重点回应的是：先接住一个人最真实的压力，再把课程主题落到他还能做出的一个小选择上。',
    structuredSections: createLocalStructuredSections(template, session, theme, analyzed),
    goldenSentences: [
      '痛苦需要先被看见，然后才谈得上选择。',
      '积极主动不是硬扛，而是重新找到自己的影响圈。',
      '事情失败，不等于人失败。',
      '回应不是给答案，而是帮对方看见自己。',
      '真正的收束，是让每个人带走一个可以行动的小选择。',
    ],
    closingSentence: '愿我们都能在还没完全解决的现实里，先拿回一点点可以选择的自己。',
    oneSentenceSummaries: [
      '今天大家共同面对的不是问题本身，而是如何在问题里重新站回自己。',
      '真正的韧性，不是马上解决一切，而是在现实很重时仍然保留一点选择。',
      '课程最后落回到一个地方：把事情和自己分开，把能回应的部分拿回来。',
    ],
    missingSpeakers: missing,
    generatedBy: 'local',
  };
}
