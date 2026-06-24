import { useEffect, useMemo, useRef, useState, type ClipboardEvent } from 'react';
import { createDefaultSession, createEmptyDailyObservation, createEmptyTranscriptWorkspace, themes } from './data';
import { getObserverAPI } from './observerApi';
import {
  buildTranscriptEncouragementPrompt,
  buildTranscriptObservationPrompt,
  buildTranscriptOrganizePrompt,
  buildKnowledgePrompt,
  buildSessionPrompt,
  buildSpeakerContentPolishPrompt,
  buildSpeakerPrompt,
  cleanSourceText,
  createLocalPolishedSpeakerContent,
  createLocalSpeakerInsight,
  createLocalTranscriptEncouragementSummary,
  createLocalTranscriptObservationSummary,
  createLocalTranscriptOrganizeResult,
  createLocalWholeSummary,
  formatTranscriptEntries,
  inferLocalSummaryTemplate,
  normalizeTranscriptEntries,
  parseTranscriptEntries,
  speakerSourceText,
} from './prompts';
import type {
  AIProvider,
  AppSettings,
  ContentSnippet,
  DailyObservationMaterial,
  KnowledgeEntry,
  KnowledgeType,
  ObserverSession,
  SourceType,
  SpeakerCard,
  SpeakerInsight,
  SummaryTemplateMode,
  SummaryTemplateType,
  SummaryVersion,
  Theme,
  TranscriptLine,
  TranscriptWorkspace,
  WholeSessionSummary,
} from './types';

const STORAGE_KEY = 'morning-observer-session-v1';
const SESSION_MAP_KEY = 'morning-observer-sessions-by-course-v2';
const ACTIVE_COURSE_KEY = 'morning-observer-active-course-v2';
const KNOWLEDGE_KEY = 'morning-observer-knowledge-v1';
const PINNED_KNOWLEDGE_KEY = 'morning-observer-pinned-knowledge-v1';
const KNOWLEDGE_BATCH_SIZE = 2;
const KNOWLEDGE_CHUNK_TIMEOUT_MS = 90000;
const DISPLAY_IMAGE_MAX_SIDE = 1200;
const OCR_IMAGE_MAX_SIDE = 3200;
const OCR_ORIGINAL_MAX_BYTES = 8 * 1024 * 1024;

const sourceLabels: Record<SourceType, string> = {
  manual_paste: '手动',
  clipboard: '剪贴板',
  ocr_text: 'OCR',
  meeting_transcript: '会议转写',
  future_asr: '语音',
  image_upload: '图片',
};

type NoticeType = 'info' | 'error';

const statusLabels: Record<SpeakerCard['status'], string> = {
  empty: '待粘贴',
  captured: '已采集',
  analyzed: '已观察',
  response_ready: '回应已备',
  responded: '已回应',
};

const knowledgeTypeLabels: Record<KnowledgeType, string> = {
  core_experience: '核心经历',
  morning_speech: '晨读发言',
  response_style: '回应风格',
  quote: '金句片段',
};

const summaryTemplateOptions: Array<{ value: SummaryTemplateMode; label: string; description: string }> = [
  { value: 'auto', label: '自动推荐', description: '先判断今天整场更适合哪种观察方式' },
  { value: 'resonance', label: '共振型', description: '像珊珊：先接住人、讲生命感和现场温度' },
  { value: 'structure', label: '结构型', description: '像金玲：先拆概念、分层梳理、给行动' },
  { value: 'hybrid', label: '融合型', description: '先共振，再结构，最后连接你的经历' },
];

const summaryTemplateNames: Record<SummaryTemplateType, string> = {
  resonance: '共振型',
  structure: '结构型',
  hybrid: '融合型',
};

const summaryTemplateTypes: SummaryTemplateType[] = ['resonance', 'structure', 'hybrid'];

type LegacyDailyObservationMaterial = Partial<DailyObservationMaterial> & {
  courseUnderstanding?: string;
  personalCases?: string;
  responseDirection?: string;
  boundaries?: string;
};

const legacyDailyObservationFields: Array<{ key: keyof LegacyDailyObservationMaterial; label: string }> = [
  { key: 'courseUnderstanding', label: '我对今天课程的理解' },
  { key: 'personalCases', label: '我想带入的个人经历/案例' },
  { key: 'responseDirection', label: '这次特别想回应的方向' },
  { key: 'boundaries', label: '表达边界提醒' },
];

type KnowledgeDraftSource = {
  id: string;
  title: string;
  text: string;
  fileName?: string;
};

function isSummaryTemplateType(value: unknown): value is SummaryTemplateType {
  return typeof value === 'string' && value in summaryTemplateNames;
}

function resolveSummaryTemplate(summary: WholeSessionSummary | undefined, fallback: SummaryTemplateType = 'hybrid') {
  return isSummaryTemplateType(summary?.templateDecision?.template) ? summary.templateDecision.template : fallback;
}

function normalizeWholeSessionSummary(value?: Partial<WholeSessionSummary>): WholeSessionSummary | undefined {
  if (!value) {
    return undefined;
  }
  const template = resolveSummaryTemplate(value as WholeSessionSummary, 'hybrid');
  const templateDecision = value.templateDecision
    ? {
        template,
        templateName: value.templateDecision.templateName || summaryTemplateNames[template],
        reason: value.templateDecision.reason || '',
        sceneSignals: Array.isArray(value.templateDecision.sceneSignals) ? value.templateDecision.sceneSignals.filter(Boolean) : [],
      }
    : undefined;

  return {
    ...value,
    templateDecision,
    courseTheme: value.courseTheme || '',
    commonTheme: value.commonTheme || '',
    speakerLessons: Array.isArray(value.speakerLessons) ? value.speakerLessons : [],
    keyResponse: value.keyResponse || '',
    structuredSections: Array.isArray(value.structuredSections) ? value.structuredSections : undefined,
    sharingSections: Array.isArray(value.sharingSections) ? value.sharingSections : undefined,
    goldenSentences: Array.isArray(value.goldenSentences) ? value.goldenSentences : [],
    oneSentenceSummaries: Array.isArray(value.oneSentenceSummaries) ? value.oneSentenceSummaries : [],
    closingSentence: value.closingSentence || '',
    missingSpeakers: Array.isArray(value.missingSpeakers) ? value.missingSpeakers : [],
  };
}

function normalizeDailyObservation(value?: LegacyDailyObservationMaterial): DailyObservationMaterial {
  const fallback = createEmptyDailyObservation();
  const directContent = value?.content?.trim();
  if (directContent) {
    return { content: directContent };
  }
  const legacyContent = legacyDailyObservationFields
    .map((field) => {
      const body = value?.[field.key]?.trim();
      return body ? `${field.label}\n${body}` : '';
    })
    .filter(Boolean)
    .join('\n\n');
  return {
    content: legacyContent || fallback.content,
  };
}

function normalizeTranscriptWorkspace(value?: Partial<TranscriptWorkspace>): TranscriptWorkspace {
  const fallback = createEmptyTranscriptWorkspace();
  const ocrSnippets = Array.isArray(value?.ocrSnippets)
    ? value.ocrSnippets
        .map((snippet) => ({
          id: snippet.id || crypto.randomUUID(),
          text: String(snippet.text || '').trim(),
          createdAt: snippet.createdAt || new Date().toISOString(),
          fileName: snippet.fileName || '',
        }))
        .filter((snippet) => snippet.text)
    : [];
  const ocrIdSet = new Set(ocrSnippets.map((snippet) => snippet.id));
  const legacyOrganizedIds =
    value && !Array.isArray(value.organizedOcrSnippetIds) && typeof value.transcriptText === 'string' && value.transcriptText.trim()
      ? ocrSnippets.map((snippet) => snippet.id)
      : fallback.organizedOcrSnippetIds;
  return {
    ...fallback,
    ...value,
    ocrSnippets,
    transcriptText: typeof value?.transcriptText === 'string' ? value.transcriptText : fallback.transcriptText,
    organizedOcrSnippetIds: Array.isArray(value?.organizedOcrSnippetIds) ? value.organizedOcrSnippetIds.filter((id) => ocrIdSet.has(id)) : legacyOrganizedIds,
    updatedAt: typeof value?.updatedAt === 'string' ? value.updatedAt : undefined,
  };
}

function dailyObservationToText(value?: LegacyDailyObservationMaterial) {
  return normalizeDailyObservation(value).content.trim();
}

function hasDailyObservation(value?: LegacyDailyObservationMaterial) {
  return Boolean(dailyObservationToText(value).trim());
}

function normalizeSummaryVersions(session: ObserverSession): SummaryVersion[] | undefined {
  if (Array.isArray(session.summaryVersions) && session.summaryVersions.length > 0) {
    return session.summaryVersions
      .filter((version) => version?.summary)
      .map((version, index) => {
        const summary = normalizeWholeSessionSummary(version.summary) || version.summary;
        return {
          ...version,
          id: version.id || crypto.randomUUID(),
          label: version.label || `全场观察 ${index + 1}`,
          source: version.source || 'generated',
          templateMode: resolveSummaryTemplate(summary, version.templateMode || 'hybrid'),
          summary,
          createdAt: version.createdAt || new Date().toISOString(),
        };
      });
  }

  const versions: SummaryVersion[] = [];
  const summary = normalizeWholeSessionSummary(session.summary);
  if (summary) {
    const template = resolveSummaryTemplate(summary);
    versions.push({
      id: crypto.randomUUID(),
      label: `历史全场观察 · ${summaryTemplateNames[template]}`,
      source: 'generated',
      templateMode: template,
      summary,
      createdAt: session.updatedAt || new Date().toISOString(),
    });
  }
  const refinedSummary = normalizeWholeSessionSummary(session.refinedSummary);
  if (refinedSummary) {
    const template = resolveSummaryTemplate(refinedSummary, versions[0]?.templateMode || 'hybrid');
    versions.push({
      id: crypto.randomUUID(),
      label: `历史优化版 · ${summaryTemplateNames[template]}`,
      source: 'refined',
      templateMode: template,
      summary: refinedSummary,
      requirement: session.refinedSummaryRequirement,
      createdAt: session.updatedAt || new Date().toISOString(),
    });
  }
  return versions.length > 0 ? versions : undefined;
}

function getSessionSummaryVersions(session: ObserverSession) {
  return normalizeSummaryVersions(session) || [];
}

function syncSessionSummaries(current: ObserverSession, versions: SummaryVersion[]): ObserverSession {
  const nextVersions = versions.length > 0 ? versions : undefined;
  const latestRefined = [...versions].reverse().find((version) => version.source === 'refined');
  return {
    ...current,
    summaryVersions: nextVersions,
    summary: versions[0]?.summary,
    refinedSummary: latestRefined?.summary,
    refinedSummaryRequirement: latestRefined?.requirement || '',
  };
}

function createSummaryVersion(params: {
  label: string;
  source: SummaryVersion['source'];
  templateMode: SummaryTemplateType;
  summary: WholeSessionSummary;
  requirement?: string;
  collapsed?: boolean;
}): SummaryVersion {
  return {
    id: crypto.randomUUID(),
    label: params.label,
    source: params.source,
    templateMode: params.templateMode,
    summary: normalizeWholeSessionSummary(params.summary) || params.summary,
    requirement: params.requirement,
    collapsed: params.collapsed,
    createdAt: new Date().toISOString(),
  };
}

function getOrderedSummaryTemplates(mode: SummaryTemplateMode, predicted: SummaryTemplateType) {
  const first = mode === 'auto' ? predicted : mode;
  return [first, ...summaryTemplateTypes.filter((template) => template !== first)];
}

function createGeneratedVersionLabel(mode: SummaryTemplateMode, template: SummaryTemplateType, index: number) {
  if (index === 0) {
    return `${mode === 'auto' ? '推荐版' : '指定版'} · ${summaryTemplateNames[template]}`;
  }
  return `对照版 · ${summaryTemplateNames[template]}`;
}

function getSummaryOutputButtonLabel(outputCount = 0) {
  const nextCount = outputCount + 1;
  if (nextCount === 1) {
    return '输出全场观察';
  }
  if (nextCount === 2) {
    return '再次输出全场观察';
  }
  if (nextCount === 3) {
    return '三次输出全场观察';
  }
  return `${nextCount} 次输出全场观察`;
}

function inferTemplateFromRequirement(requirement: string, fallback: SummaryTemplateType) {
  if (/共振|珊珊|温度|共情|接住/.test(requirement)) {
    return 'resonance';
  }
  if (/结构|金玲|层次|分层|框架|第一层|第二层|第三层/.test(requirement)) {
    return 'structure';
  }
  if (/融合|折中|先共振|再结构|两者/.test(requirement)) {
    return 'hybrid';
  }
  return fallback;
}

const providerPresets: Record<AIProvider, { label: string; keyLabel: string; baseUrl: string; model: string; help: string }> = {
  openai_responses: {
    label: 'OpenAI Responses',
    keyLabel: 'OpenAI API Key',
    baseUrl: '',
    model: 'gpt-4.1-mini',
    help: '适合已有 OpenAI API Key 的情况，使用结构化输出更稳定。',
  },
  xiaomi_mimo: {
    label: '小米 MiMo Token Plan',
    keyLabel: '小米 API Key',
    baseUrl: 'https://token-plan-cn.xiaomimimo.com/v1',
    model: 'mimo-v2.5-pro',
    help: '适合 tp- 开头的订阅 key；如果是 sk- 开头的按量 key，把 Base URL 改成 https://api.xiaomimimo.com/v1。',
  },
  openai_compatible: {
    label: 'OpenAI 兼容接口',
    keyLabel: 'API Key',
    baseUrl: 'https://api.openai.com/v1',
    model: 'gpt-4.1-mini',
    help: '适合其他支持 /chat/completions 的模型服务，Base URL 和模型都可以手填。',
  },
};

const xiaomiTokenPlan = {
  title: 'Lite 月度套餐',
  quota: '4,100,000,000 Credits',
  openAIBaseUrl: 'https://token-plan-cn.xiaomimimo.com/v1',
  anthropicBaseUrl: 'https://token-plan-cn.xiaomimimo.com/anthropic',
  primaryModel: 'mimo-v2.5-pro',
  models: ['mimo-v2.5-pro', 'mimo-v2.5', 'mimo-v2.5-asr', 'mimo-v2-pro', 'mimo-v2-omni', 'mimo-v2-tts'],
};

function normalizeSession(session: ObserverSession, themeId = session.themeId): ObserverSession {
  const safeThemeId = themes.some((theme) => theme.id === themeId) ? themeId : themes[0].id;
  const fallback = createDefaultSession(safeThemeId);
  const summaryVersions = normalizeSummaryVersions(session);
  const speakers =
    Array.isArray(session.speakers) && session.speakers.length > 0
      ? mergeDuplicateSpeakersByName(
          session.speakers.map((speaker) => ({
            ...speaker,
            name: normalizeSpeakerDisplayName(speaker.name),
            polishedContent: typeof speaker.polishedContent === 'string' ? speaker.polishedContent : '',
            polishedAt: typeof speaker.polishedAt === 'string' ? speaker.polishedAt : undefined,
          }))
        ).speakers
      : fallback.speakers;

  return {
    ...fallback,
    ...session,
    stories: Array.isArray(session.stories) && session.stories.length > 0 ? session.stories : fallback.stories,
    speakers,
    summaryVersions,
    summary: summaryVersions?.[0]?.summary || session.summary,
    summaryOutputCount:
      typeof session.summaryOutputCount === 'number'
        ? session.summaryOutputCount
        : summaryVersions && summaryVersions.length > 0
          ? 1
          : 0,
    refinedSummary: [...(summaryVersions || [])].reverse().find((version) => version.source === 'refined')?.summary || session.refinedSummary,
    refinedSummaryRequirement: [...(summaryVersions || [])].reverse().find((version) => version.source === 'refined')?.requirement || session.refinedSummaryRequirement || '',
    finalSpeechDraft: session.finalSpeechDraft || '',
    dailyObservation: normalizeDailyObservation(session.dailyObservation),
    transcriptWorkspace: normalizeTranscriptWorkspace(session.transcriptWorkspace),
    title: session.title === '下一期晨读营观察' ? '韧性之树晨读营·观察者视角' : session.title,
    themeId: safeThemeId,
    updatedAt: session.updatedAt || fallback.updatedAt,
  };
}

function loadSessionMap(): Record<string, ObserverSession> {
  try {
    return JSON.parse(localStorage.getItem(SESSION_MAP_KEY) || '{}') as Record<string, ObserverSession>;
  } catch {
    return {};
  }
}

function compactSessionForStorage(session: ObserverSession): ObserverSession {
  return {
    ...session,
    speakers: session.speakers.map((speaker) => ({
      ...speaker,
      snippets: speaker.snippets.map(stripTransientOcrImage),
    })),
  };
}

function safeSetStorage(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}

function loadKnowledgeEntries(): KnowledgeEntry[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(KNOWLEDGE_KEY) || '[]') as KnowledgeEntry[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveKnowledgeEntries(entries: KnowledgeEntry[]) {
  safeSetStorage(KNOWLEDGE_KEY, JSON.stringify(entries));
}

function loadPinnedKnowledgeIds(): string[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(PINNED_KNOWLEDGE_KEY) || '[]') as string[];
    return Array.isArray(parsed) ? parsed.filter((id) => typeof id === 'string') : [];
  } catch {
    return [];
  }
}

function normalizeKnowledgeEntry(entry: Partial<KnowledgeEntry>): KnowledgeEntry {
  const now = new Date().toISOString();
  return {
    id: entry.id || crypto.randomUUID(),
    title: entry.title?.trim() || '未命名知识',
    type: entry.type || 'morning_speech',
    tags: Array.isArray(entry.tags) ? entry.tags.map((tag) => tag.trim()).filter(Boolean) : [],
    sourceTitle: entry.sourceTitle || '',
    sourceDate: entry.sourceDate || '',
    relatedCourses: Array.isArray(entry.relatedCourses) ? entry.relatedCourses.map((course) => course.trim()).filter(Boolean) : [],
    applicableScenes: limitText(entry.applicableScenes || '', 500),
    summary: limitText(entry.summary || '', 900),
    originalExcerpt: limitText(entry.originalExcerpt || '', 500),
    reusableLines: Array.isArray(entry.reusableLines) ? entry.reusableLines.map((line) => limitText(line, 220)).filter(Boolean) : [],
    speakingBoundary: limitText(entry.speakingBoundary || '', 400),
    avoidDetails: Array.isArray(entry.avoidDetails) ? entry.avoidDetails.map((line) => limitText(line, 180)).filter(Boolean) : [],
    createdAt: entry.createdAt || now,
    updatedAt: now,
  };
}

function limitText(value: string, maxLength: number) {
  const trimmed = value.trim();
  return trimmed.length > maxLength ? `${trimmed.slice(0, maxLength - 1)}…` : trimmed;
}

function clipKnowledgeSourceText(text: string) {
  const trimmed = text.trim();
  const maxLength = 60000;
  if (trimmed.length <= maxLength) {
    return trimmed;
  }
  return [
    trimmed.slice(0, 45000),
    '\n\n【中间过长内容已省略；请优先基于保留的原文提炼可复用素材】\n\n',
    trimmed.slice(-12000),
  ].join('');
}

function getKnowledgeTargetDescription(textLength: number) {
  if (textLength < 1500) {
    return '这是一段较短素材，提炼 1-3 条高质量知识即可，不要为了凑数拆碎。';
  }
  if (textLength < 6000) {
    return '这是一篇中等长度素材，通常提炼 3-6 条知识。';
  }
  return '这是一篇较长素材或合集片段，请尽量提炼 5-10 条知识，覆盖不同经历、观点、表达风格、可复用句子和讲述边界。不要把多个不同观点压缩成一条。';
}

function splitKnowledgeSource(source: KnowledgeDraftSource): KnowledgeDraftSource[] {
  const text = source.text.trim();
  const chunkSize = 6000;
  if (text.length <= chunkSize) {
    return [{ ...source, text }];
  }

  const paragraphs = text.split(/\n{2,}/);
  const chunks: string[] = [];
  let current = '';

  for (const paragraph of paragraphs) {
    const normalized = paragraph.trim();
    if (!normalized) {
      continue;
    }
    if (normalized.length > chunkSize) {
      if (current.trim()) {
        chunks.push(current.trim());
        current = '';
      }
      for (let index = 0; index < normalized.length; index += chunkSize) {
        chunks.push(normalized.slice(index, index + chunkSize).trim());
      }
      continue;
    }
    const next = current ? `${current}\n\n${normalized}` : normalized;
    if (next.length > chunkSize && current.trim()) {
      chunks.push(current.trim());
      current = normalized;
    } else {
      current = next;
    }
  }

  if (current.trim()) {
    chunks.push(current.trim());
  }

  return chunks.map((chunk, index) => ({
    ...source,
    id: `${source.id}-${index + 1}`,
    title: `${source.title}（第 ${index + 1}/${chunks.length} 段）`,
    text: chunk,
  }));
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, label: string) {
  return new Promise<T>((resolve, reject) => {
    const timer = window.setTimeout(() => reject(new Error(`${label} 超过 ${Math.round(timeoutMs / 1000)} 秒未返回，已跳过这一段。`)), timeoutMs);
    promise
      .then(resolve)
      .catch(reject)
      .finally(() => window.clearTimeout(timer));
  });
}

function splitListText(value: string) {
  return value
    .split(/[,，、\n]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function joinListText(value: string[]) {
  return value.join('、');
}

function compactKnowledgeSourceTitle(value?: string) {
  const title = (value || '未标来源').trim() || '未标来源';
  return title.replace(/（第\s*\d+\s*\/\s*\d+\s*段）$/, '').trim();
}

function normalizeKnowledgeDuplicateKey(entry: KnowledgeEntry) {
  return entry.title
    .trim()
    .toLowerCase()
    .replace(/[《》“”"'\s,，、。！？；;：:（）()[\]【】\-—_]/g, '');
}

function uniqueList(values: string[]) {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));
}

function preferLongerText(first: string, second: string) {
  return first.trim().length >= second.trim().length ? first : second;
}

function mergeKnowledgeEntries(base: KnowledgeEntry, duplicate: KnowledgeEntry): KnowledgeEntry {
  return normalizeKnowledgeEntry({
    ...base,
    type: base.type === 'core_experience' || duplicate.type !== 'core_experience' ? base.type : duplicate.type,
    tags: uniqueList([...base.tags, ...duplicate.tags]),
    relatedCourses: uniqueList([...(base.relatedCourses || []), ...(duplicate.relatedCourses || [])]),
    sourceTitle: uniqueList([compactKnowledgeSourceTitle(base.sourceTitle), compactKnowledgeSourceTitle(duplicate.sourceTitle)]).join(' / '),
    sourceDate: base.sourceDate || duplicate.sourceDate || '',
    applicableScenes: preferLongerText(base.applicableScenes, duplicate.applicableScenes),
    summary: preferLongerText(base.summary, duplicate.summary),
    originalExcerpt: preferLongerText(base.originalExcerpt, duplicate.originalExcerpt),
    reusableLines: uniqueList([...base.reusableLines, ...duplicate.reusableLines]).slice(0, 8),
    speakingBoundary: preferLongerText(base.speakingBoundary, duplicate.speakingBoundary),
    avoidDetails: uniqueList([...base.avoidDetails, ...duplicate.avoidDetails]).slice(0, 8),
    createdAt: base.createdAt < duplicate.createdAt ? base.createdAt : duplicate.createdAt,
  });
}

function scoreKnowledgeEntry(entry: KnowledgeEntry, text: string, themeName: string) {
  const haystack = `${text} ${themeName}`.toLowerCase();
  const terms = [
    entry.title,
    entry.summary,
    entry.applicableScenes,
    entry.sourceTitle || '',
    ...entry.tags,
    ...(entry.relatedCourses || []),
  ]
    .join(' ')
    .toLowerCase()
    .split(/\s+|[,，、。！？；;：:（）()《》"“”'‘’]/)
    .filter((term) => term.length >= 2);
  let score = 0;
  for (const term of new Set(terms)) {
    if (haystack.includes(term)) {
      score += entry.tags.includes(term) ? 4 : 2;
    }
  }
  if ((entry.relatedCourses || []).some((course) => themeName.includes(course) || course.includes(themeName))) {
    score += 8;
  }
  if (entry.tags.some((tag) => ['破产', '债务', '银行起诉', '限高', '身份绑定', '羞耻感'].includes(tag))) {
    score += 1;
  }
  return score;
}

function selectRelevantKnowledge(entries: KnowledgeEntry[], text: string, themeName: string, limit = 5) {
  return entries
    .map((entry) => ({ entry, score: scoreKnowledgeEntry(entry, text, themeName) }))
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(({ entry }) => entry);
}

function selectKnowledgeForRun(entries: KnowledgeEntry[], text: string, themeName: string, pinnedIds: string[], limit = 8, excludedIds: string[] = []) {
  const excludedSet = new Set(excludedIds);
  const pinned = pinnedIds
    .map((id) => entries.find((entry) => entry.id === id))
    .filter((entry): entry is KnowledgeEntry => Boolean(entry))
    .filter((entry) => !excludedSet.has(entry.id));
  const pinnedSet = new Set(pinned.map((entry) => entry.id));
  const autoMatched = selectRelevantKnowledge(
    entries.filter((entry) => !pinnedSet.has(entry.id) && !excludedSet.has(entry.id)),
    text,
    themeName,
    limit
  );
  return [...pinned, ...autoMatched].slice(0, limit);
}

function saveSessionToMap(session: ObserverSession) {
  const map = loadSessionMap();
  const compactMap = Object.fromEntries(
    Object.entries(map).map(([themeId, item]) => [themeId, compactSessionForStorage(item)])
  ) as Record<string, ObserverSession>;
  compactMap[session.themeId] = compactSessionForStorage(session);

  if (!safeSetStorage(SESSION_MAP_KEY, JSON.stringify(compactMap))) {
    safeSetStorage(SESSION_MAP_KEY, JSON.stringify({ [session.themeId]: compactMap[session.themeId] }));
  }
  safeSetStorage(ACTIVE_COURSE_KEY, session.themeId);
}

function createSessionForTheme(themeId: string, base?: ObserverSession) {
  const session = createDefaultSession(themeId);
  if (!base) {
    return session;
  }
  return {
    ...session,
    title: base.title,
    observerStance: base.observerStance,
    stories: base.stories,
  };
}

function loadSession(): ObserverSession {
  const savedThemeId = localStorage.getItem(ACTIVE_COURSE_KEY) || 'day-01';
  const activeThemeId = themes.some((theme) => theme.id === savedThemeId) ? savedThemeId : 'day-01';
  const sessionMap = loadSessionMap();
  if (sessionMap[activeThemeId]) {
    return normalizeSession(sessionMap[activeThemeId], activeThemeId);
  }

  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    return createDefaultSession(activeThemeId);
  }

  try {
    const parsed = JSON.parse(raw) as ObserverSession;
    return normalizeSession(parsed);
  } catch {
    return normalizeSession(createDefaultSession(activeThemeId), activeThemeId);
  }
}

function nowLabel(value: string) {
  return new Intl.DateTimeFormat('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).format(new Date(value));
}

function compactText(text: string, max = 92) {
  const trimmed = text.replace(/\s+/g, ' ').trim();
  return trimmed.length > max ? `${trimmed.slice(0, max)}...` : trimmed;
}

function compactTailText(text: string, max = 420) {
  const normalized = text
    .split('\n')
    .map((line) => line.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .join('\n');
  return normalized.length > max ? `...${normalized.slice(-max)}` : normalized;
}

function formatOcrTextByTime(text: string) {
  const source = cleanSourceText(text)
    .replace(/\s+/g, ' ')
    .replace(/\s*(\d{1,2}:\d{2}(?::\d{2})?)\s*/g, '\n$1 ')
    .replace(/\n+/g, '\n')
    .trim();
  const rawLines = source.split('\n').map((line) => line.trim()).filter(Boolean);
  const lines = rawLines.map((line) => {
    const timeFirst = line.match(/^(\d{1,2}:\d{2}(?::\d{2})?)\s+(.+)$/);
    if (timeFirst) {
      return `${timeFirst[1]} ${timeFirst[2].replace(/\s+/g, ' ').trim()}`;
    }
    const speakerBeforeTime = line.match(/^(.{1,32}?)\s+(\d{1,2}:\d{2}(?::\d{2})?)\s+(.+)$/);
    if (speakerBeforeTime) {
      const speaker = speakerBeforeTime[1].replace(/^[.。…\s]+/, '').trim();
      const body = speakerBeforeTime[3].replace(/\s+/g, ' ').trim();
      return speaker ? `${speakerBeforeTime[2]} ${speaker}：${body}` : `${speakerBeforeTime[2]} ${body}`;
    }
    return line;
  });
  return lines.join('\n');
}

function compactOcrPreviewText(text: string, max = 420) {
  const formatted = formatOcrTextByTime(text);
  if (formatted.length <= max) {
    return formatted;
  }
  const tail = formatted.slice(-max);
  const firstLineBreak = tail.indexOf('\n');
  return `...\n${firstLineBreak >= 0 ? tail.slice(firstLineBreak + 1) : tail}`;
}

function compactTranscriptContextForIncremental(text: string, maxLines = 60, maxChars = 16000) {
  const entries = parseTranscriptEntries(text);
  const formatted = formatTranscriptEntries(entries.slice(-maxLines));
  return formatted.length > maxChars ? formatted.slice(-maxChars) : formatted;
}

function normalizeTranscriptComparableText(text: string) {
  return cleanSourceText(text)
    .replace(/[的地得]/g, '的')
    .replace(/\s+/g, '')
    .replace(/[，。！？、；;：:,.!?'"“”‘’（）()[\]【】《》<>《》\-—_]/g, '')
    .toLowerCase();
}

function normalizeTranscriptComparableSpeaker(name: string) {
  return String(name || '')
    .replace(/\s+/g, '')
    .replace(/[·•.,，。:：;；'"“”‘’()（）【】\[\]{}《》<>_\-—–｜|/\\]/g, '')
    .toLowerCase();
}

function isTranscriptEntryCovered(candidate: TranscriptLine, transcriptEntries: TranscriptLine[]) {
  const candidateText = normalizeTranscriptComparableText(candidate.text);
  const candidateSpeaker = normalizeTranscriptComparableSpeaker(candidate.speakerName);
  if (!candidate.time || !candidateText) {
    return true;
  }
  return transcriptEntries.some((entry) => {
    if (entry.time !== candidate.time) {
      return false;
    }
    const entrySpeaker = normalizeTranscriptComparableSpeaker(entry.speakerName);
    const speakerMatches =
      !candidateSpeaker ||
      !entrySpeaker ||
      candidateSpeaker === entrySpeaker ||
      candidateSpeaker.includes(entrySpeaker) ||
      entrySpeaker.includes(candidateSpeaker);
    if (!speakerMatches) {
      return false;
    }
    const entryText = normalizeTranscriptComparableText(entry.text);
    if (!entryText) {
      return false;
    }
    const shorterLength = Math.min(candidateText.length, entryText.length);
    if (candidateText === entryText) {
      return true;
    }
    return shorterLength >= 10 && (candidateText.includes(entryText) || entryText.includes(candidateText));
  });
}

function getOcrSnippetTranscriptEntries(snippetText: string, contextText = '') {
  const formattedText = formatOcrTextByTime(snippetText);
  return normalizeTranscriptEntries(parseTranscriptEntries(formattedText), [], [contextText, formattedText].filter(Boolean).join('\n'));
}

function getTranscriptCoverage(workspace: TranscriptWorkspace) {
  const transcriptEntries = normalizeTranscriptEntries(parseTranscriptEntries(workspace.transcriptText), [], workspace.transcriptText);
  const coveredIds = new Set<string>();
  const missingIds = new Set<string>();
  workspace.ocrSnippets.forEach((snippet) => {
    const snippetEntries = getOcrSnippetTranscriptEntries(snippet.text, workspace.transcriptText);
    if (snippetEntries.length > 0 && snippetEntries.every((entry) => isTranscriptEntryCovered(entry, transcriptEntries))) {
      coveredIds.add(snippet.id);
    } else {
      missingIds.add(snippet.id);
    }
  });
  return { coveredIds, missingIds };
}

function countEffectiveChars(text: string) {
  return String(text || '').replace(/\s/g, '').length;
}

function TextCount({ value }: { value: string }) {
  return <small className="text-count">{countEffectiveChars(value)} 字</small>;
}

function getSummaryStructuredSections(summary: WholeSessionSummary) {
  return summary.structuredSections && summary.structuredSections.length > 0
    ? summary.structuredSections
    : summary.sharingSections && summary.sharingSections.length > 0
      ? summary.sharingSections.map((section, index) => ({ key: `legacy_${index}`, title: section.title, body: section.body }))
      : summary.finalSummary
        ? [{ key: 'legacy_final', title: '分享内容', body: summary.finalSummary }]
        : [];
}

function summaryToShareText(summary: WholeSessionSummary) {
  const structuredSections = getSummaryStructuredSections(summary);
  return [
    summary.templateDecision ? `推荐模板：${summary.templateDecision.templateName}` : '',
    summary.templateDecision ? `判断原因：${summary.templateDecision.reason}` : '',
    '',
    ...structuredSections.flatMap((section) => [`## ${section.title}`, section.body, '']),
    '',
    '金句：',
    ...summary.goldenSentences.map((sentence) => `- ${sentence}`),
    '',
    '一句话总结：',
    ...(summary.oneSentenceSummaries || []).map((sentence) => `- ${sentence}`),
    '',
    `收束：${summary.closingSentence}`,
  ]
    .filter((line, index, list) => line || list[index - 1])
    .join('\n')
    .trim();
}

function summarySectionToText(title: string, body: string) {
  return [`## ${title}`, body].join('\n\n').trim();
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function plainTextToEditorHtml(text: string) {
  const blocks = text
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean);
  return blocks
    .map((block) => blockToEditorHtml(block))
    .join('');
}

function blockToEditorHtml(block: string) {
  if (block.startsWith('## ')) {
    return `<h3>${escapeHtml(block.replace(/^##\s*/, ''))}</h3>`;
  }
  return bodyTextToEditorHtml(block);
}

function splitChineseOrderedItems(text: string) {
  const matches = Array.from(text.matchAll(/(第[一二三四五六七八九十]+(?:层|点|部分|步|个)?)(?:\s*(?:是|为)\s*|\s*[，、,：:]\s*)/g));
  if (matches.length < 2) {
    return null;
  }

  const intro = text.slice(0, matches[0].index).trim();
  const items = matches
    .map((match, index) => {
      const start = (match.index || 0) + match[0].length;
      const end = index + 1 < matches.length ? matches[index + 1].index || text.length : text.length;
      return {
        marker: match[1],
        body: text.slice(start, end).trim().replace(/[；;]\s*$/, ''),
      };
    })
    .filter((item) => item.body);

  return items.length >= 2 ? { intro, items } : null;
}

function structuredItemBodyToEditorHtml(text: string) {
  const trimmed = text.trim();
  const labelMatch = trimmed.match(/^([^：:]{2,18}[：:])\s*(.+)$/);
  if (labelMatch) {
    return `<span class="final-list-lead">${highlightEditorText(escapeHtml(labelMatch[1]))}</span>${highlightEditorText(escapeHtml(labelMatch[2]))}`;
  }
  return highlightEditorText(escapeHtml(trimmed));
}

function bodyTextToEditorHtml(text: string) {
  const trimmed = text.trim();
  if (!trimmed) {
    return '';
  }

  const lines = trimmed.split('\n').map((line) => line.trim()).filter(Boolean);
  const numberedLines = lines.filter((line) => /^(\d+[\.\)、]|[一二三四五六七八九十]+[、.])\s*/.test(line));
  if (numberedLines.length >= 2 && numberedLines.length === lines.length) {
    return `<ol class="final-structured-list">${lines.map((line) => `<li>${structuredItemBodyToEditorHtml(line.replace(/^(\d+[\.\)、]|[一二三四五六七八九十]+[、.])\s*/, ''))}</li>`).join('')}</ol>`;
  }

  const chineseOrdered = splitChineseOrderedItems(trimmed);
  if (chineseOrdered) {
    const intro = chineseOrdered.intro ? `<p>${highlightEditorText(escapeHtml(chineseOrdered.intro))}</p>` : '';
    const list = `<ol class="final-structured-list">${chineseOrdered.items.map((item) => `<li><span class="final-list-marker">${escapeHtml(item.marker)}</span>${structuredItemBodyToEditorHtml(item.body)}</li>`).join('')}</ol>`;
    return `${intro}${list}`;
  }

  return lines.map((line) => `<p>${highlightEditorText(escapeHtml(line))}</p>`).join('');
}

function highlightEditorText(escapedText: string) {
  return escapedText
    .replace(/(课程|共同主题|重点回应|我的经历|行动|选择|影响圈|关注圈|破产|债务|重建|责任|边界|看见|回应)/g, '<strong class="final-keyword">$1</strong>')
    .replace(/(不是[^，。；;]*，而是[^，。；;]*)/g, '<em>$1</em>');
}

function summaryToEditorHtml(summary: WholeSessionSummary) {
  const parts: string[] = [];
  if (summary.templateDecision) {
    parts.push('<section class="final-summary-meta">');
    parts.push(`<p><span>推荐模板</span>${escapeHtml(summary.templateDecision.templateName)}</p>`);
    parts.push(`<p><span>判断原因</span>${highlightEditorText(escapeHtml(summary.templateDecision.reason))}</p>`);
    if (summary.templateDecision.sceneSignals.length > 0) {
      parts.push(`<div class="final-chip-row">${summary.templateDecision.sceneSignals.map((signal) => `<small>${escapeHtml(signal)}</small>`).join('')}</div>`);
    }
    parts.push('</section>');
  }

  getSummaryStructuredSections(summary).forEach((section) => {
    parts.push('<section class="final-speech-section">');
    parts.push(`<h3>${escapeHtml(section.title)}</h3>`);
    parts.push(bodyTextToEditorHtml(section.body));
    parts.push('</section>');
  });

  if (summary.goldenSentences.length > 0) {
    parts.push('<section class="final-speech-section">');
    parts.push('<h3>金句</h3>');
    parts.push(`<ul class="final-quote-list">${summary.goldenSentences.map((sentence) => `<li>${highlightEditorText(escapeHtml(sentence))}</li>`).join('')}</ul>`);
    parts.push('</section>');
  }

  if ((summary.oneSentenceSummaries || []).length > 0) {
    parts.push('<section class="final-speech-section">');
    parts.push('<h3>一句话总结</h3>');
    parts.push(`<ul class="final-quote-list">${(summary.oneSentenceSummaries || []).map((sentence) => `<li>${highlightEditorText(escapeHtml(sentence))}</li>`).join('')}</ul>`);
    parts.push('</section>');
  }

  if (summary.closingSentence) {
    parts.push('<blockquote>');
    parts.push(highlightEditorText(escapeHtml(summary.closingSentence)));
    parts.push('</blockquote>');
  }

  return parts.join('');
}

function appendEditorHtml(currentHtml: string | undefined, nextHtml: string, separator = '<p><br></p><p><br></p>') {
  const current = currentHtml?.trim() || '';
  return current ? `${current}${separator}${nextHtml}` : nextHtml;
}

function htmlToPlainText(html: string) {
  const container = document.createElement('div');
  container.innerHTML = html;
  return container.innerText.trim();
}

function createSnippet(text: string, sourceType: SourceType): ContentSnippet {
  return {
    id: crypto.randomUUID(),
    sourceType,
    text: text.trim(),
    createdAt: new Date().toISOString(),
  };
}

function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function readFileAsText(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(reader.error);
    reader.readAsText(file);
  });
}

function estimateDataUrlBytes(dataUrl: string) {
  const base64 = dataUrl.split(',')[1] || '';
  return Math.ceil((base64.length * 3) / 4);
}

function imageDataUrlMimeType(dataUrl: string, fallback = 'image/png') {
  return dataUrl.slice(5, dataUrl.indexOf(';')) || fallback;
}

function renderImageDataUrl(image: HTMLImageElement, maxSide: number, outputType: 'image/jpeg' | 'image/png', quality?: number) {
  const scale = Math.min(1, maxSide / Math.max(image.width, image.height));
  const width = Math.max(1, Math.round(image.width * scale));
  const height = Math.max(1, Math.round(image.height * scale));
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  if (!context) {
    throw new Error('图片处理失败。');
  }
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = 'high';
  if (outputType === 'image/jpeg') {
    context.fillStyle = '#fff';
    context.fillRect(0, 0, width, height);
  }
  context.drawImage(image, 0, 0, width, height);
  return outputType === 'image/jpeg' ? canvas.toDataURL(outputType, quality) : canvas.toDataURL(outputType);
}

function createOcrImageDataUrl(image: HTMLImageElement, originalDataUrl: string) {
  const maxOriginalSide = Math.max(image.width, image.height);
  if (maxOriginalSide <= OCR_IMAGE_MAX_SIDE && estimateDataUrlBytes(originalDataUrl) <= OCR_ORIGINAL_MAX_BYTES) {
    return originalDataUrl;
  }

  const pngDataUrl = renderImageDataUrl(image, OCR_IMAGE_MAX_SIDE, 'image/png');
  if (estimateDataUrlBytes(pngDataUrl) <= OCR_ORIGINAL_MAX_BYTES) {
    return pngDataUrl;
  }
  return renderImageDataUrl(image, OCR_IMAGE_MAX_SIDE, 'image/jpeg', 0.94);
}

function getSnippetOcrImageDataUrl(snippet: ContentSnippet) {
  return snippet.ocrImageDataUrl || snippet.imageDataUrl || '';
}

function stripTransientOcrImage(snippet: ContentSnippet): ContentSnippet {
  if (!snippet.ocrImageDataUrl) {
    return snippet;
  }
  const storedSnippet = { ...snippet };
  delete storedSnippet.ocrImageDataUrl;
  return storedSnippet;
}

async function createImageSnippet(file: File): Promise<ContentSnippet> {
  const originalDataUrl = await readFileAsDataUrl(file);
  return createImageSnippetFromDataUrl(originalDataUrl, file.name, file.type);
}

async function createImageSnippetFromDataUrl(originalDataUrl: string, fileName = '截图.png', mimeType = 'image/png'): Promise<ContentSnippet> {
  const image = await new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('图片读取失败。'));
    img.src = originalDataUrl;
  });

  const outputType = 'image/jpeg';
  const dataUrl = renderImageDataUrl(image, DISPLAY_IMAGE_MAX_SIDE, outputType, 0.78);
  const ocrImageDataUrl = createOcrImageDataUrl(image, originalDataUrl);

  return {
    id: crypto.randomUUID(),
    sourceType: 'image_upload',
    text: '',
    createdAt: new Date().toISOString(),
    imageDataUrl: dataUrl,
    ocrImageDataUrl,
    mimeType: imageDataUrlMimeType(dataUrl, mimeType || outputType),
    fileName,
  };
}

function getCurrentSpeaker(session: ObserverSession, selectedSpeakerId: string) {
  return session.speakers.find((speaker) => speaker.id === selectedSpeakerId) || session.speakers[0];
}

function isDefaultSpeakerName(name: string) {
  return /^发言人\s*([A-Z]|\d+)$/i.test(name.trim());
}

function shouldAutoRenameSpeaker(name: string) {
  return /^发言人/i.test(name.trim());
}

function normalizeRecognizedSpeakerName(name: string) {
  if (isDefaultSpeakerName(name)) {
    return name.trim();
  }
  const trimmed = name
    .trim()
    .replace(/^(?:发言人|分享人|讲者|姓名|内容导引员)[-—:：\s]*/, '')
    .replace(/[，。；;:：].*$/, '')
    .trim();
  const parts = trimmed.split(/[-—–｜|]/).map((part) => part.trim()).filter(Boolean);
  return parts[parts.length - 1] || trimmed;
}

function normalizeNamedRoleSpeakerName(name: string) {
  const compact = name
    .trim()
    .replace(/\s+/g, '')
    .replace(/[，。；;:：]+$/g, '');
  const match = compact.match(/^(主持人|主持|助教|导引员|带读人)[-—–｜|:：]?([\u4e00-\u9fa5A-Za-z]{1,12})$/);
  if (!match) {
    return '';
  }
  const role = match[1] === '主持' ? '主持人' : match[1];
  const personName = match[2].replace(/^(老师|同学|书友)$/, '');
  if (!personName || personName === role || /^(大家|各位|今天|现在|接下来)$/.test(personName)) {
    return '';
  }
  return `${role}-${personName}`;
}

function normalizeSpeakerDisplayName(name: string) {
  const roleName = normalizeNamedRoleSpeakerName(name);
  if (roleName) {
    return roleName;
  }
  const normalized = normalizeRecognizedSpeakerName(name).replace(/\s+/g, '');
  const alias = normalizeSpeakerOcrAlias(normalized);
  if (alias === '汪汪' && /^[汪注江]{2,3}$/.test(normalized)) {
    return '汪汪';
  }
  if (alias === '历瑞男' && /^[厉歷历][端瑞]男$/.test(normalized)) {
    return '历瑞男';
  }
  return normalized || normalizeRecognizedSpeakerName(name);
}

function normalizeSpeakerNameCandidate(value: string) {
  const normalized = normalizeSpeakerDisplayName(value);
  if (!normalized || shouldAutoRenameSpeaker(normalized)) {
    return '';
  }
  if (normalized.length < 2 || normalized.length > 12) {
    return '';
  }
  if (/^(图片|截图|OCR|腾讯会议|会议转写|转写|来源|内容|上午|下午|今天|昨天|第四天|第三天|第二天|第一天)$/.test(normalized)) {
    return '';
  }
  return normalized;
}

function detectSpeakerName(text: string) {
  const cleaned = cleanSourceText(text);
  const labelled = cleaned.match(/(?:发言人|分享人|讲者|姓名|内容导引员)[-—:：\s]*([^\n，。；;:：]{2,18})/);
  if (labelled) {
    const candidate = normalizeSpeakerNameCandidate(labelled[1]);
    if (candidate) {
      return candidate;
    }
  }

  for (const line of cleaned.split('\n').map((item) => item.trim()).filter(Boolean)) {
    const timestampLine = line.match(/^(.{2,22}?)\s+\d{1,2}:\d{2}(?::\d{2})?\b/);
    if (timestampLine) {
      const candidate = normalizeSpeakerNameCandidate(timestampLine[1]);
      if (candidate) {
        return candidate;
      }
    }
  }

  return '';
}

function detectSpeakerNameFromSnippets(snippets: ContentSnippet[]) {
  return snippets.map((snippet) => detectSpeakerName(snippet.text)).find(Boolean) || '';
}

function resolveAutoSpeakerName(currentName: string, suggestedName: string | undefined, snippets: ContentSnippet[]) {
  if (!shouldAutoRenameSpeaker(currentName)) {
    return normalizeSpeakerDisplayName(currentName);
  }
  const suggested = suggestedName ? normalizeSpeakerNameCandidate(suggestedName) : '';
  const detected = detectSpeakerNameFromSnippets(snippets);
  return normalizeSpeakerDisplayName(suggested || detected || currentName);
}

function snippetDisplayText(snippet: ContentSnippet) {
  const text = cleanSourceText(snippet.text);
  if (text) {
    return text;
  }
  return snippet.imageDataUrl || snippet.fileName ? '图片未识别出文字。请换更清晰的截图，或手动粘贴腾讯会议转写文字。' : '';
}

function renderInlineMarkdown(text: string) {
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, index) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={`${part}-${index}`}>{part.slice(2, -2)}</strong>;
    }
    return part;
  });
}

function courseReadingContentText(theme: Theme) {
  return [`# ${theme.name}`, String(theme.content || theme.core || '').trim()].filter(Boolean).join('\n\n');
}

function CourseContentView({ theme, onCopyReading }: { theme: Theme; onCopyReading: () => void }) {
  const lines = String(theme.content || theme.core || '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
  const blocks: Array<{ type: 'heading' | 'paragraph' | 'image'; text: string } | { type: 'list'; items: Array<{ number: number; body: string }> }> = [];
  let listItems: Array<{ number: number; body: string }> = [];

  const flushList = () => {
    if (listItems.length > 0) {
      blocks.push({ type: 'list', items: listItems });
      listItems = [];
    }
  };

  lines.forEach((line, index) => {
    const numbered = line.match(/^(\d+)[.．]\s*(.+)$/);
    if (numbered) {
      listItems.push({
        number: Number(numbered[1]),
        body: numbered[2],
      });
      return;
    }

    flushList();
    if (line === '[图片]') {
      blocks.push({ type: 'image', text: line });
      return;
    }
    const isHeading = index < 2 || /^第[一二三四五六七八九十\d]+[天课节篇]|.+[:：]$/.test(line);
    blocks.push({ type: isHeading ? 'heading' : 'paragraph', text: line });
  });
  flushList();

  return (
    <>
      <div className="course-content-main">
        <div className="course-content-title-row">
          <h2>{theme.name}</h2>
          <button className="plain-button" onClick={onCopyReading} type="button">
            复制课程晨读内容
          </button>
        </div>
        <div className="course-content-body">
          {blocks.map((block, index) => {
            if (block.type === 'list') {
              return (
                <ol key={`list-${index}`} className="course-numbered-list">
                  {block.items.map((item) => (
                    <li key={`${item.number}-${item.body}`}>
                      <span className="course-list-number">{item.number}.</span>
                      <span>{renderInlineMarkdown(item.body)}</span>
                    </li>
                  ))}
                </ol>
              );
            }
            if (block.type === 'image') {
              return (
                <div key={`image-${index}`} className="course-image-placeholder">
                  图片
                </div>
              );
            }
            if (block.type === 'heading') {
              return <h3 key={`heading-${index}`}>{renderInlineMarkdown(block.text)}</h3>;
            }
            return <p key={`paragraph-${index}`}>{renderInlineMarkdown(block.text)}</p>;
          })}
        </div>
      </div>
      <div className="course-questions">
        <h3>观察问题</h3>
        <ul>
          {theme.observationQuestions.map((question) => (
            <li key={question}>{question}</li>
          ))}
        </ul>
      </div>
    </>
  );
}

function isHostTranscriptSpeaker(name: string) {
  const normalized = normalizeSpeakerDisplayName(name);
  return /^(主持人|主持|助教|导引员|带读人|系统消息|系统)$/i.test(normalized);
}

function normalizeTextForCompare(value: string) {
  return value
    .replace(/\d{1,2}:\d{2}(?::\d{2})?/g, '')
    .replace(/\s+/g, '')
    .replace(/[，。！？、；;：:,.!?'"“”‘’（）()[\]【】《》\-—_]/g, '')
    .toLowerCase();
}

function hasMaterialTranscriptIncrease(oldText: string, newText: string) {
  const oldNormalized = normalizeTextForCompare(oldText);
  const newNormalized = normalizeTextForCompare(newText);
  if (!newNormalized) {
    return false;
  }
  if (!oldNormalized) {
    return true;
  }
  if (oldNormalized.includes(newNormalized)) {
    return false;
  }
  if (newNormalized.length > oldNormalized.length + 24) {
    return true;
  }
  const oldLines = new Set(
    oldText
      .split('\n')
      .map(normalizeTextForCompare)
      .filter((line) => line.length > 6)
  );
  const addedLength = newText
    .split('\n')
    .map(normalizeTextForCompare)
    .filter((line) => line.length > 6 && !oldLines.has(line))
    .join('').length;
  return addedLength > 24;
}

function createTranscriptSpeakerContent(entries: TranscriptLine[]) {
  return entries.map((entry) => `${entry.time} ${entry.speakerName}：${entry.text}`).join('\n').trim();
}

function normalizeSpeakerOcrAlias(name: string) {
  const charMap: Record<string, string> = {
    注: '汪',
    江: '汪',
    汪: '汪',
    端: '瑞',
    瑞: '瑞',
    厉: '历',
    歷: '历',
  };
  return Array.from(normalizeRecognizedSpeakerName(name).replace(/\s+/g, '').toLowerCase())
    .map((char) => charMap[char] || char)
    .join('');
}

function speakerMergeKey(name: string) {
  if (isDefaultSpeakerName(name)) {
    return '';
  }
  const key = normalizeSpeakerOcrAlias(normalizeSpeakerDisplayName(name));
  return /^(发言人|分享人|讲者|未知|[.．…]+)$/.test(key) ? '' : key;
}

function speakerStatusRank(status: SpeakerCard['status']) {
  const ranks: Record<SpeakerCard['status'], number> = {
    empty: 0,
    captured: 1,
    analyzed: 2,
    response_ready: 3,
    responded: 4,
  };
  return ranks[status] ?? 0;
}

function mergeSpeakerSnippets(base: ContentSnippet[], incoming: ContentSnippet[]) {
  const seen = new Set<string>();
  return [...base, ...incoming].filter((snippet) => {
    const key = [snippet.sourceType, snippet.fileName || '', cleanSourceText(snippet.text)].join('|').replace(/\s+/g, '');
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

function preferLongerSpeakerText(base = '', incoming = '') {
  return countEffectiveChars(incoming) > countEffectiveChars(base) ? incoming : base;
}

function mergeSpeakerCards(base: SpeakerCard, incoming: SpeakerCard): SpeakerCard {
  const baseStatusRank = speakerStatusRank(base.status);
  const incomingStatusRank = speakerStatusRank(incoming.status);
  const pickName = () => {
    const score = (name: string) => {
      let value = normalizeRecognizedSpeakerName(name).length;
      if (!shouldAutoRenameSpeaker(name)) value += 20;
      if (/[-—–｜|]/.test(name)) value += 8;
      if (/[汪瑞]/.test(name)) value += 4;
      if (/[注江端]/.test(name)) value -= 5;
      return value;
    };
    return score(incoming.name) > score(base.name) ? incoming.name : base.name;
  };
  return {
    ...base,
    name: normalizeSpeakerDisplayName(pickName()),
    status: incomingStatusRank > baseStatusRank ? incoming.status : base.status,
    snippets: mergeSpeakerSnippets(base.snippets, incoming.snippets),
    polishedContent: preferLongerSpeakerText(base.polishedContent, incoming.polishedContent) || undefined,
    polishedAt:
      incoming.polishedAt && (!base.polishedAt || new Date(incoming.polishedAt).getTime() > new Date(base.polishedAt).getTime())
        ? incoming.polishedAt
        : base.polishedAt,
    insight: base.insight || incoming.insight,
    actualResponse: base.actualResponse || incoming.actualResponse,
  };
}

function mergeDuplicateSpeakersByName(speakers: SpeakerCard[]) {
  const merged: SpeakerCard[] = [];
  const keyToIndex = new Map<string, number>();
  const idMap = new Map<string, string>();
  let mergedCount = 0;

  speakers.forEach((speaker) => {
    const normalizedSpeaker = {
      ...speaker,
      name: normalizeSpeakerDisplayName(speaker.name),
    };
    const key = speakerMergeKey(normalizedSpeaker.name);
    if (!key) {
      merged.push(normalizedSpeaker);
      return;
    }

    const existingIndex = keyToIndex.get(key);
    if (existingIndex === undefined) {
      keyToIndex.set(key, merged.length);
      merged.push(normalizedSpeaker);
      return;
    }

    const target = merged[existingIndex];
    merged[existingIndex] = mergeSpeakerCards(target, normalizedSpeaker);
    idMap.set(normalizedSpeaker.id, target.id);
    mergedCount += 1;
  });

  return { speakers: merged, idMap, mergedCount };
}

function groupTranscriptBySpeaker(transcriptText: string, knownSpeakerNames: string[] = []) {
  const groups = new Map<string, { speakerName: string; entries: TranscriptLine[] }>();
  normalizeTranscriptEntries(parseTranscriptEntries(transcriptText), knownSpeakerNames, transcriptText).forEach((entry) => {
    const speakerName = normalizeSpeakerNameCandidate(entry.speakerName) || normalizeSpeakerDisplayName(entry.speakerName);
    if (!speakerName || isHostTranscriptSpeaker(speakerName)) {
      return;
    }
    const key = speakerMergeKey(speakerName) || speakerName;
    const existing = groups.get(key);
    if (existing) {
      const displayName = normalizeSpeakerDisplayName(mergeSpeakerCards(
        { id: 'existing', name: existing.speakerName, status: 'empty', snippets: [] },
        { id: 'incoming', name: speakerName, status: 'empty', snippets: [] }
      ).name);
      groups.set(key, {
        speakerName: displayName,
        entries: [...existing.entries, { ...entry, speakerName: displayName }],
      });
      return;
    }
    groups.set(key, { speakerName, entries: [{ ...entry, speakerName }] });
  });
  return Array.from(groups.values()).map((group) => ({
    speakerName: group.speakerName,
    entries: group.entries.map((entry) => ({ ...entry, speakerName: group.speakerName })),
    content: createTranscriptSpeakerContent(group.entries.map((entry) => ({ ...entry, speakerName: group.speakerName }))),
  }));
}

export default function App() {
  const [session, setSession] = useState<ObserverSession>(() => loadSession());
  const [selectedSpeakerId, setSelectedSpeakerId] = useState(() => loadSession().speakers[0]?.id || '');
  const [draftText, setDraftText] = useState('');
  const [sourceType, setSourceType] = useState<SourceType>('clipboard');
  const [busy, setBusy] = useState<string | null>(null);
  const [analyzingSpeakerIds, setAnalyzingSpeakerIds] = useState<string[]>([]);
  const [polishingSpeakerIds, setPolishingSpeakerIds] = useState<string[]>([]);
  const [notice, setNoticeValue] = useState('');
  const [noticeVersion, setNoticeVersion] = useState(0);
  const [noticePersistent, setNoticePersistent] = useState(false);
  const [noticeType, setNoticeType] = useState<NoticeType>('info');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settings, setSettings] = useState<AppSettings>({
    provider: 'openai_responses',
    apiKey: '',
    hasApiKey: false,
    baseUrl: '',
    model: 'gpt-4.1-mini',
  });
  const [providerInput, setProviderInput] = useState<AIProvider>('openai_responses');
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [baseUrlInput, setBaseUrlInput] = useState('');
  const [modelInput, setModelInput] = useState('gpt-4.1-mini');
  const [courseOpen, setCourseOpen] = useState(false);
  const [courseChangeOpen, setCourseChangeOpen] = useState(false);
  const [courseChangeTarget, setCourseChangeTarget] = useState(session.themeId);
  const [collectionCollapsed, setCollectionCollapsed] = useState(false);
  const [dailyObservationCollapsed, setDailyObservationCollapsed] = useState(false);
  const [transcriptCollapsed, setTranscriptCollapsed] = useState(false);
  const [transcriptOcrCollapsed, setTranscriptOcrCollapsed] = useState(false);
  const suppressNextOcrToggleClick = useRef(false);
  const [transcriptAssigning, setTranscriptAssigning] = useState(false);
  const [transcriptOrganizeForce, setTranscriptOrganizeForce] = useState(false);
  const [knowledgeOpen, setKnowledgeOpen] = useState(false);
  const [knowledgeEntries, setKnowledgeEntries] = useState<KnowledgeEntry[]>(() => loadKnowledgeEntries());
  const [selectedKnowledgeId, setSelectedKnowledgeId] = useState('');
  const [knowledgeDraftTitle, setKnowledgeDraftTitle] = useState('');
  const [knowledgeDraftText, setKnowledgeDraftText] = useState('');
  const [knowledgeDraftSources, setKnowledgeDraftSources] = useState<KnowledgeDraftSource[]>([]);
  const [selectedKnowledgeSource, setSelectedKnowledgeSource] = useState('');
  const [pinnedKnowledgeIds, setPinnedKnowledgeIds] = useState<string[]>(() => loadPinnedKnowledgeIds());
  const [speakerKnowledgeUse, setSpeakerKnowledgeUse] = useState<Record<string, string[]>>({});
  const [summaryKnowledgeIds, setSummaryKnowledgeIds] = useState<string[]>([]);
  const [summaryRequirement, setSummaryRequirement] = useState('');
  const [summaryTemplateMode, setSummaryTemplateMode] = useState<SummaryTemplateMode>('auto');
  const [pendingAutoAnalyzeIds, setPendingAutoAnalyzeIds] = useState<string[]>([]);
  const imageInputRef = useRef<HTMLInputElement | null>(null);
  const transcriptImageInputRef = useRef<HTMLInputElement | null>(null);
  const knowledgeFileRef = useRef<HTMLInputElement | null>(null);
  const knowledgeCancelRef = useRef(false);
  const autoAnalyzeRunningRef = useRef(false);

  function isErrorNotice(message: string) {
    return /(失败|报错|错误|无法|请求失败|HTTP\s*\d{3})/i.test(message);
  }

  function isAbortOrTimeoutMessage(message: string) {
    return /(aborted|abort|timed?\s*out|timeout|超时|中断)/i.test(message);
  }

  function showNotice(message: string, options: { persistent?: boolean; type?: NoticeType } = {}) {
    const error = options.type === 'error' || isErrorNotice(message);
    setNoticeValue(message);
    setNoticeType(options.type || (error ? 'error' : 'info'));
    setNoticePersistent(Boolean(message) && (options.persistent ?? error));
    setNoticeVersion((version) => version + 1);
  }

  function setNotice(message: string) {
    showNotice(message);
  }

  const currentSpeaker = getCurrentSpeaker(session, selectedSpeakerId);
  const selectedTheme = useMemo(() => themes.find((theme) => theme.id === session.themeId) || themes[0], [session.themeId]);
  const selectedKnowledge = knowledgeEntries.find((entry) => entry.id === selectedKnowledgeId) || knowledgeEntries[0];
  const knowledgeSourceOptions = useMemo(() => {
    const counts = new Map<string, number>();
    knowledgeEntries.forEach((entry) => {
      const source = compactKnowledgeSourceTitle(entry.sourceTitle);
      counts.set(source, (counts.get(source) || 0) + 1);
    });
    return Array.from(counts.entries())
      .map(([source, count]) => ({ source, count }))
      .sort((a, b) => b.count - a.count || a.source.localeCompare(b.source, 'zh-CN'));
  }, [knowledgeEntries]);
  const analyzedCount = session.speakers.filter((speaker) => speaker.insight).length;
  const capturedCount = session.speakers.filter((speaker) => speaker.snippets.length > 0 || Boolean(speaker.polishedContent?.trim())).length;
  const currentSpeakerAnalyzing = currentSpeaker ? analyzingSpeakerIds.includes(currentSpeaker.id) : false;
  const dailyObservationText = dailyObservationToText(session.dailyObservation);
  const dailyObservationFilled = hasDailyObservation(session.dailyObservation);
  const currentSpeakerPolishing = currentSpeaker ? polishingSpeakerIds.includes(currentSpeaker.id) : false;
  const currentSpeakerText = currentSpeaker ? speakerSourceText(currentSpeaker) : '';
  const transcriptWorkspace = normalizeTranscriptWorkspace(session.transcriptWorkspace);
  const transcriptEntryCount = useMemo(() => normalizeTranscriptEntries(parseTranscriptEntries(transcriptWorkspace.transcriptText), [], transcriptWorkspace.transcriptText).length, [transcriptWorkspace.transcriptText]);
  const transcriptCoverage = useMemo(() => getTranscriptCoverage(transcriptWorkspace), [transcriptWorkspace.ocrSnippets, transcriptWorkspace.transcriptText]);
  const pendingTranscriptOcrCount = useMemo(() => {
    return transcriptWorkspace.ocrSnippets.filter((snippet) => !transcriptCoverage.coveredIds.has(snippet.id)).length;
  }, [transcriptWorkspace.ocrSnippets, transcriptCoverage]);
  const currentSpeakerKnowledgePreview = useMemo(
    () => {
      const text = [currentSpeakerText, dailyObservationText].filter(Boolean).join('\n');
      return text.trim() ? selectKnowledgeForRun(knowledgeEntries, text, selectedTheme.name, pinnedKnowledgeIds, 8) : [];
    },
    [currentSpeakerText, dailyObservationText, knowledgeEntries, pinnedKnowledgeIds, selectedTheme.name]
  );
  const currentSpeakerUsedKnowledge = useMemo(
    () => (currentSpeaker ? (speakerKnowledgeUse[currentSpeaker.id] || []).map((id) => knowledgeEntries.find((entry) => entry.id === id)).filter((entry): entry is KnowledgeEntry => Boolean(entry)) : []),
    [currentSpeaker, knowledgeEntries, speakerKnowledgeUse]
  );
  const sessionTextForKnowledge = useMemo(
    () => [session.speakers.map((speaker) => speakerSourceText(speaker)).join('\n'), transcriptWorkspace.transcriptText, dailyObservationText].filter(Boolean).join('\n'),
    [dailyObservationText, session.speakers, transcriptWorkspace.transcriptText]
  );
  const excludedSummaryKnowledgeIds = session.excludedSummaryKnowledgeIds || [];
  const activeSummaryKnowledgeIds = session.summaryKnowledgeIds || summaryKnowledgeIds;
  const summaryKnowledgePreview = useMemo(
    () => (sessionTextForKnowledge.trim() ? selectKnowledgeForRun(knowledgeEntries, sessionTextForKnowledge, selectedTheme.name, pinnedKnowledgeIds, 12, excludedSummaryKnowledgeIds) : []),
    [excludedSummaryKnowledgeIds, knowledgeEntries, pinnedKnowledgeIds, selectedTheme.name, sessionTextForKnowledge]
  );
  const summaryUsedKnowledge = useMemo(
    () => activeSummaryKnowledgeIds.map((id) => knowledgeEntries.find((entry) => entry.id === id)).filter((entry): entry is KnowledgeEntry => Boolean(entry)),
    [activeSummaryKnowledgeIds, knowledgeEntries]
  );
  const summaryVersions = useMemo(() => getSessionSummaryVersions(session), [session]);
  const primarySummaryVersion = summaryVersions[0];
  const predictedSummaryTemplate = useMemo(() => inferLocalSummaryTemplate(session, 'auto'), [session]);
  const predictedSummaryTemplateName = summaryTemplateNames[predictedSummaryTemplate];
  const summaryOutputButtonLabel = getSummaryOutputButtonLabel(session.summaryOutputCount || 0);

  useEffect(() => {
    if (!notice || noticePersistent) {
      return;
    }
    const timer = window.setTimeout(() => showNotice(''), 2000);
    return () => window.clearTimeout(timer);
  }, [notice, noticePersistent, noticeVersion]);

  useEffect(() => {
    safeSetStorage(STORAGE_KEY, JSON.stringify(compactSessionForStorage(session)));
    saveSessionToMap(session);
  }, [session]);

  useEffect(() => {
    saveKnowledgeEntries(knowledgeEntries);
    if (knowledgeEntries.length > 0 && !knowledgeEntries.some((entry) => entry.id === selectedKnowledgeId)) {
      setSelectedKnowledgeId(knowledgeEntries[0].id);
    }
  }, [knowledgeEntries, selectedKnowledgeId]);

  useEffect(() => {
    const validIds = pinnedKnowledgeIds.filter((id) => knowledgeEntries.some((entry) => entry.id === id));
    if (validIds.length !== pinnedKnowledgeIds.length) {
      setPinnedKnowledgeIds(validIds);
      return;
    }
    safeSetStorage(PINNED_KNOWLEDGE_KEY, JSON.stringify(validIds));
  }, [knowledgeEntries, pinnedKnowledgeIds]);

  useEffect(() => {
    if (!session.speakers.some((speaker) => speaker.id === selectedSpeakerId)) {
      setSelectedSpeakerId(session.speakers[0]?.id || '');
    }
  }, [selectedSpeakerId, session.speakers]);

  useEffect(() => {
    const result = mergeDuplicateSpeakersByName(session.speakers);
    const changed =
      result.mergedCount > 0 ||
      result.speakers.length !== session.speakers.length ||
      result.speakers.some((speaker, index) => speaker.name !== session.speakers[index]?.name);
    if (!changed) {
      return;
    }
    updateSession((current) => ({
      ...current,
      speakers: result.speakers,
    }));
    const nextSelectedId = result.idMap.get(selectedSpeakerId);
    if (nextSelectedId) {
      setSelectedSpeakerId(nextSelectedId);
    }
  }, [selectedSpeakerId, session.speakers]);

  useEffect(() => {
    getObserverAPI().loadSettings().then((loaded) => {
      setSettings(loaded);
      setProviderInput(loaded.provider || 'openai_responses');
      setBaseUrlInput(loaded.baseUrl || providerPresets[loaded.provider || 'openai_responses'].baseUrl);
      setModelInput(loaded.model || 'gpt-4.1-mini');
    }).catch(() => undefined);
  }, []);

  useEffect(() => {
    return getObserverAPI().onGlobalPaste(() => {
      void pasteFromClipboard();
    });
  }, []);

  useEffect(() => {
    if (autoAnalyzeRunningRef.current || pendingAutoAnalyzeIds.length === 0) {
      return;
    }
    const nextId = pendingAutoAnalyzeIds[0];
    const target = session.speakers.find((speaker) => speaker.id === nextId);
    if (!target) {
      setPendingAutoAnalyzeIds((current) => current.filter((id) => id !== nextId));
      return;
    }

    autoAnalyzeRunningRef.current = true;
    void analyzeSpeaker(nextId).finally(() => {
      autoAnalyzeRunningRef.current = false;
      setPendingAutoAnalyzeIds((current) => current.filter((id) => id !== nextId));
    });
  }, [pendingAutoAnalyzeIds, session.speakers]);

  function updateSession(updater: (current: ObserverSession) => ObserverSession) {
    setSession((current) => ({ ...updater(current), updatedAt: new Date().toISOString() }));
  }

  function updateSpeaker(speakerId: string, updater: (speaker: SpeakerCard) => SpeakerCard) {
    updateSession((current) => ({
      ...current,
      speakers: current.speakers.map((speaker) => (speaker.id === speakerId ? updater(speaker) : speaker)),
    }));
  }

  function updateDailyObservationContent(value: string) {
    updateSession((current) => ({
      ...current,
      dailyObservation: {
        content: value,
      },
    }));
  }

  function clearDailyObservation() {
    if (!dailyObservationFilled || window.confirm('确认清空我的当日观察素材吗？')) {
      updateSession((current) => ({
        ...current,
        dailyObservation: createEmptyDailyObservation(),
      }));
      showNotice('已清空我的当日观察素材。');
    }
  }

  function updateTranscriptWorkspace(updater: (workspace: TranscriptWorkspace) => TranscriptWorkspace) {
    updateSession((current) => ({
      ...current,
      transcriptWorkspace: {
        ...updater(normalizeTranscriptWorkspace(current.transcriptWorkspace)),
        updatedAt: new Date().toISOString(),
      },
    }));
  }

  function updateTranscriptText(value: string) {
    updateTranscriptWorkspace((workspace) => ({
      ...workspace,
      transcriptText: value,
    }));
  }

  function clearTranscriptWorkspace() {
    const hasContent = transcriptWorkspace.ocrSnippets.length > 0 || transcriptWorkspace.transcriptText.trim();
    if (!hasContent || window.confirm('确认清空整场截图脚本和已采集 OCR 吗？不会删除下面发言人卡片。')) {
      updateSession((current) => ({
        ...current,
        transcriptWorkspace: createEmptyTranscriptWorkspace(),
      }));
      if (transcriptImageInputRef.current) {
        transcriptImageInputRef.current.value = '';
      }
      showNotice('已清空整场截图脚本。');
    }
  }

  function deleteTranscriptOcrSnippet(snippetId: string) {
    updateTranscriptWorkspace((workspace) => ({
      ...workspace,
      ocrSnippets: workspace.ocrSnippets.filter((snippet) => snippet.id !== snippetId),
      organizedOcrSnippetIds: (workspace.organizedOcrSnippetIds || []).filter((id) => id !== snippetId),
    }));
    showNotice('已删除这段 OCR 原文。');
  }

  async function appendTranscriptImages(snippets: ContentSnippet[], successPrefix = '已采集') {
    if (snippets.length === 0) {
      return;
    }

    setBusy('transcript-image');
    try {
      const createdAt = new Date().toISOString();
      const ocrSnippets = await Promise.all(
        snippets.map(async (snippet) => {
          try {
            const result = await getObserverAPI().ocrImage(getSnippetOcrImageDataUrl(snippet), snippet.fileName);
            const text = cleanSourceText(result.text || '');
            if (!text) {
              return null;
            }
            return {
              id: crypto.randomUUID(),
              text,
              createdAt,
              fileName: snippet.fileName || '截图.png',
            };
          } catch {
            return null;
          }
        })
      );
      const validSnippets = ocrSnippets.filter(Boolean) as TranscriptWorkspace['ocrSnippets'];
      if (validSnippets.length === 0) {
        showNotice('截图已读取，但没有识别出可用文字。我已优先使用高清图识别；如果仍失败，可以换更清晰截图，或手动粘贴到脚本文本框。');
        return;
      }
      updateTranscriptWorkspace((workspace) => ({
        ...workspace,
        ocrSnippets: [...workspace.ocrSnippets, ...validSnippets],
      }));
      showNotice(`${successPrefix} ${snippets.length} 张截图，其中 ${validSnippets.length} 张识别到文字。点击“梳理”会合并去重排序。`);
    } catch (error) {
      showNotice(error instanceof Error ? error.message : '整场截图 OCR 失败。');
    } finally {
      setBusy(null);
    }
  }

  async function pasteTranscriptScreenshot() {
    const clipboardImage = await getObserverAPI().readClipboardImage().catch(() => null);
    if (!clipboardImage?.imageDataUrl) {
      showNotice('剪贴板里没有截图。');
      return;
    }
    const snippet = await createImageSnippetFromDataUrl(clipboardImage.imageDataUrl, clipboardImage.fileName || '整场截图.png');
    await appendTranscriptImages([snippet], '粘贴成功，已采集');
  }

  async function uploadTranscriptScreenshots(files: FileList | null) {
    if (!files || files.length === 0) {
      return;
    }
    const imageFiles = Array.from(files).filter((file) => file.type.startsWith('image/'));
    if (imageFiles.length === 0) {
      showNotice('请选择图片文件。');
      return;
    }
    try {
      const snippets = await Promise.all(imageFiles.map((file) => createImageSnippet(file)));
      await appendTranscriptImages(snippets, '已上传并采集');
    } catch (error) {
      showNotice(error instanceof Error ? error.message : '整场截图上传失败。');
    } finally {
      if (transcriptImageInputRef.current) {
        transcriptImageInputRef.current.value = '';
      }
    }
  }

  function toggleTranscriptOcrPreview() {
    setTranscriptOcrCollapsed((collapsed) => !collapsed);
  }

  function handleTranscriptPaste(event: ClipboardEvent<HTMLTextAreaElement>) {
    const files = Array.from(event.clipboardData.files).filter((file) => file.type.startsWith('image/'));
    if (files.length === 0) {
      return;
    }
    event.preventDefault();
    void (async () => {
      const snippets = await Promise.all(files.map((file) => createImageSnippet(file)));
      await appendTranscriptImages(snippets, '粘贴成功，已采集');
    })();
  }

  async function organizeTranscriptWorkspace(force = false) {
    const originalWorkspace = normalizeTranscriptWorkspace(session.transcriptWorkspace);
    const originalCoverage = getTranscriptCoverage(originalWorkspace);
    const pendingOcrSnippets = force ? originalWorkspace.ocrSnippets : originalWorkspace.ocrSnippets.filter((snippet) => !originalCoverage.coveredIds.has(snippet.id));
    const incrementalTranscriptContext = compactTranscriptContextForIncremental(originalWorkspace.transcriptText);
    const workspace = force
      ? { ...originalWorkspace, transcriptText: '' }
      : { ...originalWorkspace, transcriptText: incrementalTranscriptContext, ocrSnippets: pendingOcrSnippets };
    if (!originalWorkspace.transcriptText.trim() && originalWorkspace.ocrSnippets.length === 0) {
      showNotice('先粘贴或上传几张整场聊天截图，或手动粘贴脚本文字。');
      return;
    }
    if (force && !window.confirm('强制梳理会清空当前“整场脚本文本”，只基于已采集 OCR 重新梳理；不会删除截图/OCR 原文。确认继续吗？')) {
      return;
    }

    setTranscriptOrganizeForce(force);
    setBusy('transcript-organize');
    setNotice('');
    try {
      const knownSpeakerNames = session.speakers
        .map((speaker) => speaker.name)
        .filter((name) => !shouldAutoRenameSpeaker(name) && !isDefaultSpeakerName(name));
      if (!force && pendingOcrSnippets.length === 0) {
        const entries = normalizeTranscriptEntries(parseTranscriptEntries(originalWorkspace.transcriptText), knownSpeakerNames, originalWorkspace.transcriptText);
        const allOcrText = originalWorkspace.ocrSnippets.map((snippet) => formatOcrTextByTime(snippet.text)).join('\n');
        const recoveredEntries = normalizeTranscriptEntries(
          [...parseTranscriptEntries(originalWorkspace.transcriptText), ...parseTranscriptEntries(allOcrText)],
          knownSpeakerNames,
          [originalWorkspace.transcriptText, allOcrText].filter(Boolean).join('\n')
        );
        const nextEntries = recoveredEntries.length > entries.length ? recoveredEntries : entries;
        const transcriptText = formatTranscriptEntries(nextEntries);
        updateTranscriptWorkspace((current) => ({
          ...current,
          transcriptText,
          organizedOcrSnippetIds: Array.from(getTranscriptCoverage({ ...current, transcriptText }).coveredIds),
        }));
        showNotice(
          recoveredEntries.length > entries.length
            ? `没有新增 OCR，但已从历史 OCR 里补回 ${recoveredEntries.length - entries.length} 条，当前脚本 ${nextEntries.length} 条。`
            : `没有新增 OCR，已快速去重整理现有脚本 ${nextEntries.length} 条。`
        );
        return;
      }
      if (!force) {
        const pendingOcrText = pendingOcrSnippets.map((snippet) => formatOcrTextByTime(snippet.text)).join('\n');
        const pendingEntries = parseTranscriptEntries(pendingOcrText);
        const entries = normalizeTranscriptEntries(
          [...parseTranscriptEntries(originalWorkspace.transcriptText), ...pendingEntries],
          knownSpeakerNames,
          [originalWorkspace.transcriptText, pendingOcrText].filter(Boolean).join('\n')
        );
        const transcriptText = formatTranscriptEntries(entries);
        updateTranscriptWorkspace((current) => ({
          ...current,
          transcriptText,
          organizedOcrSnippetIds: Array.from(getTranscriptCoverage({ ...current, transcriptText }).coveredIds),
        }));
        showNotice(`已本地增量梳理 ${pendingOcrSnippets.length} 段新增 OCR，当前脚本 ${entries.length} 条。`);
        return;
      }
      const result = settings.hasApiKey
        ? await getObserverAPI().organizeTranscript(buildTranscriptOrganizePrompt(workspace, knownSpeakerNames))
        : createLocalTranscriptOrganizeResult(workspace, knownSpeakerNames);
      const contextText = [
        force ? '' : originalWorkspace.transcriptText,
        workspace.ocrSnippets.map((snippet) => snippet.text).join('\n'),
        result.transcriptText || '',
        result.entries?.map((entry) => entry.text).join('\n') || '',
      ]
        .filter(Boolean)
        .join('\n');
      const localPendingEntries = parseTranscriptEntries(workspace.ocrSnippets.map((snippet) => formatOcrTextByTime(snippet.text)).join('\n'));
      const resultEntries = [
        ...(result.entries?.length ? result.entries : parseTranscriptEntries(result.transcriptText || workspace.transcriptText)),
        ...localPendingEntries,
      ];
      const entries = normalizeTranscriptEntries(
        [...(force ? [] : parseTranscriptEntries(originalWorkspace.transcriptText)), ...resultEntries],
        knownSpeakerNames,
        contextText
      );
      const transcriptText = formatTranscriptEntries(entries);
      updateTranscriptWorkspace((current) => ({
        ...current,
        transcriptText,
        organizedOcrSnippetIds: Array.from(getTranscriptCoverage({ ...current, transcriptText }).coveredIds),
      }));
      showNotice(
        settings.hasApiKey
          ? `${force ? '已强制梳理' : `已增量梳理 ${pendingOcrSnippets.length} 段新增 OCR，共整理`} ${entries.length} 条发言脚本，并完成去重排序。`
          : `已用本地规则${force ? '强制梳理' : `增量梳理 ${pendingOcrSnippets.length} 段新增 OCR，整理`} ${entries.length} 条脚本；设置 API Key 后可更好修正 OCR。`
      );
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '未知错误';
      const knownSpeakerNames = session.speakers
        .map((speaker) => speaker.name)
        .filter((name) => !shouldAutoRenameSpeaker(name) && !isDefaultSpeakerName(name));
      const fallback = createLocalTranscriptOrganizeResult(workspace, knownSpeakerNames);
      const localPendingEntries = parseTranscriptEntries(workspace.ocrSnippets.map((snippet) => formatOcrTextByTime(snippet.text)).join('\n'));
      const fallbackEntries = [
        ...(force ? [] : parseTranscriptEntries(originalWorkspace.transcriptText)),
        ...(fallback.entries?.length ? fallback.entries : parseTranscriptEntries(fallback.transcriptText || workspace.transcriptText)),
        ...localPendingEntries,
      ];
      const fallbackTranscriptText = formatTranscriptEntries(normalizeTranscriptEntries(fallbackEntries, knownSpeakerNames, originalWorkspace.transcriptText));
      updateTranscriptWorkspace((current) => ({
        ...current,
        transcriptText: fallbackTranscriptText,
        organizedOcrSnippetIds: Array.from(getTranscriptCoverage({ ...current, transcriptText: fallbackTranscriptText }).coveredIds),
      }));
      if (isAbortOrTimeoutMessage(errorMessage)) {
        showNotice(`AI ${force ? '强制梳理' : '梳理'}超时，已用本地规则完成梳理。截图较多时可以继续使用当前结果，或分批补充后再梳理。`);
      } else {
        showNotice(`AI ${force ? '强制梳理' : '梳理'}失败，已用本地规则梳理：${errorMessage}`, {
          type: 'error',
          persistent: true,
        });
      }
    } finally {
      setBusy(null);
      setTranscriptOrganizeForce(false);
    }
  }

  function upsertTranscriptSnippet(snippets: ContentSnippet[], content: string) {
    const existing = snippets.find((snippet) => snippet.sourceType === 'meeting_transcript' && snippet.fileName === '整场脚本归人');
    if (existing) {
      return snippets.map((snippet) =>
        snippet.id === existing.id
          ? {
              ...snippet,
              text: content,
              createdAt: new Date().toISOString(),
            }
          : snippet
      );
    }
    return [
      ...snippets,
      {
        ...createSnippet(content, 'meeting_transcript'),
        fileName: '整场脚本归人',
      },
    ];
  }

  async function assignTranscriptToSpeakers(force = false) {
    if (transcriptAssigning) {
      return;
    }
    if (
      force &&
      !window.confirm('强制归人会清空当前书友卡片和已有单人观察，并按当前整场脚本文本重新生成。确认继续吗？')
    ) {
      return;
    }
    const knownSpeakerNames = session.speakers
      .map((speaker) => speaker.name)
      .filter((name) => !shouldAutoRenameSpeaker(name) && !isDefaultSpeakerName(name));
    const grouped = groupTranscriptBySpeaker(transcriptWorkspace.transcriptText, knownSpeakerNames);
    if (grouped.length === 0) {
      showNotice('还没有能归人的脚本。先点击“梳理”，或把脚本按“时间 姓名：内容”的格式放进文本框。');
      return;
    }

    setTranscriptAssigning(true);
    await new Promise<void>((resolve) => window.requestAnimationFrame(() => resolve()));

    try {
      if (force) {
        const generatedAt = new Date().toISOString();
        const generatedSpeakers: SpeakerCard[] = grouped.map((group) => ({
          id: crypto.randomUUID(),
          name: normalizeSpeakerDisplayName(group.speakerName),
          status: 'captured',
          snippets: upsertTranscriptSnippet([], group.content),
          polishedContent: group.content,
          polishedAt: generatedAt,
        }));
        const forceMergeResult = mergeDuplicateSpeakersByName(generatedSpeakers);
        const speakers = forceMergeResult.speakers;
        const speakerIds = speakers.map((speaker) => speaker.id);

        updateSession((current) => ({
          ...current,
          speakers,
        }));
        setSelectedSpeakerId(speakerIds[0] || '');
        setPendingAutoAnalyzeIds(speakerIds);
        showNotice(`已强制归人 ${speakers.length} 位书友，已清空旧卡片并将全部重新观察。${forceMergeResult.mergedCount > 0 ? `已合并 ${forceMergeResult.mergedCount} 个同名发言人。` : ''}`);
        return;
      }

      const changedSpeakerIds: string[] = [];
      let firstChangedOrCreatedId = '';
      const mergedResult = mergeDuplicateSpeakersByName(session.speakers);
      const speakers = [...mergedResult.speakers];
      const usedSpeakerIds = new Set<string>();

      grouped.forEach((group) => {
        const displayName = normalizeSpeakerDisplayName(group.speakerName);
        const nameKey = speakerMergeKey(displayName) || displayName;
        let index = speakers.findIndex((speaker) => (speakerMergeKey(speaker.name) || normalizeSpeakerDisplayName(speaker.name)) === nameKey);
        if (index < 0) {
          index = speakers.findIndex((speaker) => shouldAutoRenameSpeaker(speaker.name) && !speakerSourceText(speaker).trim() && !usedSpeakerIds.has(speaker.id));
        }
        const existingSpeaker =
          index >= 0
            ? speakers[index]
            : {
                id: crypto.randomUUID(),
                name: displayName,
                status: 'empty' as SpeakerCard['status'],
                snippets: [],
              };

        const nextName = (speakerMergeKey(existingSpeaker.name) || normalizeSpeakerDisplayName(existingSpeaker.name)) === nameKey ? normalizeSpeakerDisplayName(existingSpeaker.name) : displayName;
        const nextSnippets = upsertTranscriptSnippet(existingSpeaker.snippets, group.content);
        const hasIncrease = hasMaterialTranscriptIncrease(existingSpeaker.polishedContent || speakerSourceText(existingSpeaker), group.content);
        const nextSpeaker: SpeakerCard = {
          ...existingSpeaker,
          name: normalizeSpeakerDisplayName(nextName),
          status: hasIncrease ? 'captured' : existingSpeaker.status === 'empty' ? 'captured' : existingSpeaker.status,
          snippets: nextSnippets,
          polishedContent: group.content,
          polishedAt: new Date().toISOString(),
          insight: hasIncrease ? undefined : existingSpeaker.insight,
        };

        if (index >= 0) {
          speakers[index] = nextSpeaker;
        } else {
          speakers.push(nextSpeaker);
        }
        usedSpeakerIds.add(nextSpeaker.id);
        if (hasIncrease) {
          changedSpeakerIds.push(nextSpeaker.id);
          firstChangedOrCreatedId ||= nextSpeaker.id;
        }
      });

      const finalMergeResult = mergeDuplicateSpeakersByName(speakers);
      const finalIdMap = new Map([...Array.from(mergedResult.idMap.entries()), ...Array.from(finalMergeResult.idMap.entries())]);
      const finalSpeakers = finalMergeResult.speakers;
      const finalChangedSpeakerIds = Array.from(new Set(changedSpeakerIds.map((id) => finalIdMap.get(id) || id))).filter((id) => finalSpeakers.some((speaker) => speaker.id === id));
      const finalFirstChangedOrCreatedId = firstChangedOrCreatedId ? finalIdMap.get(firstChangedOrCreatedId) || firstChangedOrCreatedId : '';

      updateSession((current) => {
        return {
          ...current,
          speakers: finalSpeakers,
        };
      });

      const nextSelectedSpeakerId = finalIdMap.get(selectedSpeakerId) || selectedSpeakerId;
      if (finalFirstChangedOrCreatedId) {
        setSelectedSpeakerId(finalFirstChangedOrCreatedId);
      } else if (nextSelectedSpeakerId !== selectedSpeakerId) {
        setSelectedSpeakerId(nextSelectedSpeakerId);
      }
      const totalMergedCount = mergedResult.mergedCount + finalMergeResult.mergedCount;
      if (finalChangedSpeakerIds.length > 0) {
        setPendingAutoAnalyzeIds((current) => Array.from(new Set([...current, ...finalChangedSpeakerIds])));
        showNotice(
          `已归人 ${grouped.length} 位书友，其中 ${finalChangedSpeakerIds.length} 位有新增内容，将自动观察。${
            totalMergedCount > 0 ? `已合并 ${totalMergedCount} 个同名发言人。` : ''
          }`
        );
      } else {
        showNotice(
          `已归人 ${grouped.length} 位书友，没有发现需要重新观察的新增内容。${
            totalMergedCount > 0 ? `已合并 ${totalMergedCount} 个同名发言人。` : ''
          }`
        );
      }
    } finally {
      window.setTimeout(() => setTranscriptAssigning(false), 120);
    }
  }

  async function tryTranscriptSummary() {
    const workspace = normalizeTranscriptWorkspace(session.transcriptWorkspace);
    if (!workspace.transcriptText.trim()) {
      showNotice('先点击“梳理”，生成整场发言脚本后再融合成分享稿。');
      return;
    }

    setBusy('transcript-summary');
    setNotice('');
    try {
      const knowledgeText = [workspace.transcriptText, dailyObservationText].filter(Boolean).join('\n');
      const relevantKnowledge = selectKnowledgeForRun(knowledgeEntries, knowledgeText, selectedTheme.name, pinnedKnowledgeIds, 12, session.excludedSummaryKnowledgeIds || []);
      const relevantKnowledgeIds = relevantKnowledge.map((entry) => entry.id);
      const summary = settings.hasApiKey
        ? await getObserverAPI().summarizeSession(buildTranscriptObservationPrompt(session, selectedTheme, relevantKnowledge))
        : createLocalTranscriptObservationSummary(session, selectedTheme);
      summary.generatedBy = settings.hasApiKey ? settings.provider : 'local';
      const index = summaryVersions.filter((version) => version.label.startsWith('融合分享稿')).length + 1;
      const version = createSummaryVersion({
        label: `融合分享稿 ${index} · 主线稿`,
        source: 'refined',
        templateMode: resolveSummaryTemplate(summary, 'hybrid'),
        summary,
        requirement: '基于整场截图脚本、我的当日观察素材和当天课程，先判断全场主线，再融合成完整观察者分享稿',
      });
      setSummaryKnowledgeIds(relevantKnowledgeIds);
      updateSession((current) =>
        syncSessionSummaries(
          {
            ...current,
            summaryKnowledgeIds: relevantKnowledgeIds,
          },
          [...getSessionSummaryVersions(current), version]
        )
      );
      showNotice(settings.hasApiKey ? '已新增一版融合分享稿。' : '已新增一版本地融合分享稿；设置 API Key 后可获得真实 AI 输出。');
    } catch (error) {
      setNotice(`融合分享稿失败：${error instanceof Error ? error.message : '未知错误'}`);
    } finally {
      setBusy(null);
    }
  }

  async function createWholeSessionEncouragement() {
    const workspace = normalizeTranscriptWorkspace(session.transcriptWorkspace);
    if (!workspace.transcriptText.trim()) {
      showNotice('先点击“梳理”，生成整场发言脚本后再输出全场鼓励。');
      return;
    }

    setBusy('transcript-encouragement');
    setNotice('');
    try {
      const knowledgeText = [workspace.transcriptText, dailyObservationText].filter(Boolean).join('\n');
      const relevantKnowledge = selectKnowledgeForRun(knowledgeEntries, knowledgeText, selectedTheme.name, pinnedKnowledgeIds, 8, session.excludedSummaryKnowledgeIds || []);
      const relevantKnowledgeIds = relevantKnowledge.map((entry) => entry.id);
      const summary = settings.hasApiKey
        ? await getObserverAPI().summarizeSession(buildTranscriptEncouragementPrompt(session, selectedTheme, relevantKnowledge))
        : createLocalTranscriptEncouragementSummary(session, selectedTheme);
      summary.generatedBy = settings.hasApiKey ? settings.provider : 'local';
      const index = summaryVersions.filter((version) => version.label.startsWith('全场鼓励')).length + 1;
      const version = createSummaryVersion({
        label: `全场鼓励 ${index} · 五种模式 + 金句`,
        source: 'refined',
        templateMode: resolveSummaryTemplate(summary, 'resonance'),
        summary,
        requirement: '基于整场截图脚本，按整体场域、个人转变、课程连接、温柔发言、由内而外五种模式输出全场鼓励，并增加大家的金句与洞察',
      });
      setSummaryKnowledgeIds(relevantKnowledgeIds);
      updateSession((current) =>
        syncSessionSummaries(
          {
            ...current,
            summaryKnowledgeIds: relevantKnowledgeIds,
          },
          [...getSessionSummaryVersions(current), version]
        )
      );
      showNotice(settings.hasApiKey ? '已新增一版全场鼓励，并包含大家的金句与洞察。' : '已新增一版本地全场鼓励，并包含大家的金句与洞察；设置 API Key 后可获得真实 AI 输出。');
    } catch (error) {
      setNotice(`全场鼓励失败：${error instanceof Error ? error.message : '未知错误'}`);
    } finally {
      setBusy(null);
    }
  }

  function switchCourse(themeId: string) {
    saveSessionToMap(session);
    const sessionMap = loadSessionMap();
    const nextSession = sessionMap[themeId] ? normalizeSession(sessionMap[themeId], themeId) : createSessionForTheme(themeId, session);
    setSession(nextSession);
    setSelectedSpeakerId(nextSession.speakers[0]?.id || '');
    setCourseChangeTarget(themeId);
    setNotice(`已切换到 ${themes.find((theme) => theme.id === themeId)?.name || '课程'}。`);
  }

  function openCourseChange() {
    setCourseChangeTarget(session.themeId);
    setCourseChangeOpen(true);
  }

  function migrateCurrentSessionCourse() {
    if (courseChangeTarget === session.themeId) {
      setCourseChangeOpen(false);
      return;
    }

    const fromTheme = selectedTheme;
    const toTheme = themes.find((theme) => theme.id === courseChangeTarget) || themes[0];
    const hasGeneratedContent = session.speakers.some((speaker) => speaker.insight) || Boolean(session.summary) || summaryVersions.length > 0 || Boolean(session.finalSpeechDraft?.trim());
    const message = [
      `确认把当前这场观察从「${fromTheme.name}」更换到「${toTheme.name}」吗？`,
      '',
      '会保留：发言人、内容片段、我的实际回应。',
      hasGeneratedContent ? '会清空：旧课程下生成的单人观察、现场回应、全场观察。' : '当前还没有 AI 观察，可以直接更换。',
    ].join('\n');

    if (!window.confirm(message)) {
      return;
    }

    const sessionMap = loadSessionMap();
    delete sessionMap[session.themeId];
    safeSetStorage(SESSION_MAP_KEY, JSON.stringify(sessionMap));

    updateSession((current) => ({
      ...current,
      themeId: toTheme.id,
      summary: undefined,
      summaryVersions: undefined,
      summaryOutputCount: 0,
      summaryKnowledgeIds: [],
      excludedSummaryKnowledgeIds: [],
      refinedSummary: undefined,
      refinedSummaryRequirement: '',
      finalSpeechDraft: '',
      speakers: current.speakers.map((speaker) => ({
        ...speaker,
        insight: undefined,
        status: speaker.snippets.length > 0 ? 'captured' : 'empty',
      })),
    }));
    safeSetStorage(ACTIVE_COURSE_KEY, toTheme.id);
    setCourseChangeOpen(false);
    setNotice(`已更换为「${toTheme.name}」，请重新观察书友分享。`);
  }

  function clearCurrentCourse() {
    if (!window.confirm('确认清空当前课程下的所有发言人、内容片段、单人观察、全场观察、当日观察素材和本场必用案例吗？')) {
      return;
    }
    const nextSession = createSessionForTheme(session.themeId, session);
    const sessionMap = loadSessionMap();
    sessionMap[session.themeId] = nextSession;
    localStorage.setItem(SESSION_MAP_KEY, JSON.stringify(sessionMap));
    setSession(nextSession);
    setSelectedSpeakerId(nextSession.speakers[0]?.id || '');
      setDraftText('');
    setSpeakerKnowledgeUse({});
    setSummaryKnowledgeIds([]);
    setSummaryRequirement('');
      setPinnedKnowledgeIds([]);
      safeSetStorage(PINNED_KNOWLEDGE_KEY, JSON.stringify([]));
    setNotice('已清空当天内容。');
  }

  function appendSnippet(text: string, snippetSource: SourceType, successMessage?: string) {
    const trimmed = text.trim();
    if (!trimmed || !currentSpeaker) {
      return;
    }

    const snippet = createSnippet(trimmed, snippetSource);
    updateSpeaker(currentSpeaker.id, (speaker) => ({
      ...speaker,
      name: resolveAutoSpeakerName(speaker.name, undefined, [...speaker.snippets, snippet]),
      status: speaker.status === 'empty' ? 'captured' : speaker.status,
      snippets: [...speaker.snippets, snippet],
      polishedContent: undefined,
      polishedAt: undefined,
    }));
    setDraftText('');
    showNotice(successMessage || `已加入 ${currentSpeaker.name}`);
  }

  async function pasteFromClipboard() {
    const clipboardImage = await getObserverAPI().readClipboardImage().catch(() => null);
    if (clipboardImage?.imageDataUrl) {
      await appendImageSnippets([
        await createImageSnippetFromDataUrl(clipboardImage.imageDataUrl, clipboardImage.fileName || '剪贴板截图.png'),
      ], '粘贴成功，已将剪贴板截图加入');
      return;
    }

    const text = await getObserverAPI().readClipboardText();
    if (!text.trim()) {
      showNotice('剪贴板里没有可粘贴的文字或截图。');
      return;
    }
    appendSnippet(text, 'clipboard', `粘贴成功，已将剪贴板文字加入 ${currentSpeaker?.name || '当前发言人'}。`);
  }

  async function pasteImageFromClipboard() {
    const clipboardImage = await getObserverAPI().readClipboardImage().catch(() => null);
    if (!clipboardImage?.imageDataUrl) {
      showNotice('剪贴板里没有截图。也可以点进输入框后直接 Cmd+V。');
      return;
    }
    await appendImageSnippets([
      await createImageSnippetFromDataUrl(clipboardImage.imageDataUrl, clipboardImage.fileName || '剪贴板截图.png'),
    ], '粘贴截图成功，已加入');
  }

  function handleDraftPaste(event: ClipboardEvent<HTMLTextAreaElement>) {
    const files = Array.from(event.clipboardData.files).filter((file) => file.type.startsWith('image/'));
    if (files.length === 0) {
      return;
    }

    event.preventDefault();
    void (async () => {
      const snippets = await Promise.all(files.map((file) => createImageSnippet(file)));
      await appendImageSnippets(snippets, '粘贴成功，已加入');
    })();
  }

  async function appendImageSnippets(snippets: ContentSnippet[], successPrefix = '已上传') {
    if (!currentSpeaker || snippets.length === 0) {
      return;
    }

    setBusy('image');
    try {
      const ocrSnippets = await Promise.all(
        snippets.map(async (snippet) => {
          try {
            const result = await getObserverAPI().ocrImage(getSnippetOcrImageDataUrl(snippet), snippet.fileName);
            const ocrText = result.text.trim();
            if (ocrText) {
              return {
                ...snippet,
                sourceType: 'ocr_text' as SourceType,
                text: ocrText,
              };
            }
          } catch {
            return snippet;
          }
          return snippet;
        })
      );
      const storedOcrSnippets = ocrSnippets.map(stripTransientOcrImage);
      updateSpeaker(currentSpeaker.id, (speaker) => ({
        ...speaker,
        name: resolveAutoSpeakerName(speaker.name, undefined, [...speaker.snippets, ...storedOcrSnippets]),
        status: speaker.status === 'empty' ? 'captured' : speaker.status,
        snippets: [...speaker.snippets, ...storedOcrSnippets],
        polishedContent: undefined,
        polishedAt: undefined,
      }));
      const recognizedCount = storedOcrSnippets.filter((snippet) => cleanSourceText(snippet.text)).length;
      const missedCount = snippets.length - recognizedCount;
      showNotice(
        missedCount > 0
          ? `${successPrefix} ${snippets.length} 张图片到 ${currentSpeaker.name}，其中 ${recognizedCount} 张识别到文字，${missedCount} 张未识别到。`
          : `${successPrefix} ${snippets.length} 张图片到 ${currentSpeaker.name}，已识别文字。`
      );
    } catch (error) {
      showNotice(error instanceof Error ? error.message : '图片处理失败。');
    } finally {
      setBusy(null);
    }
  }

  async function fillMissingOcrForSpeaker(speaker: SpeakerCard) {
    let changed = false;
    let failedCount = 0;
    const snippets = await Promise.all(
      speaker.snippets.map(async (snippet) => {
        const ocrImageDataUrl = getSnippetOcrImageDataUrl(snippet);
        if (cleanSourceText(snippet.text) || !ocrImageDataUrl) {
          return stripTransientOcrImage(snippet);
        }
        try {
          const result = await getObserverAPI().ocrImage(ocrImageDataUrl, snippet.fileName);
          const ocrText = result.text.trim();
          if (!ocrText) {
            failedCount += 1;
            return stripTransientOcrImage(snippet);
          }
          changed = true;
          return stripTransientOcrImage({
            ...snippet,
            sourceType: 'ocr_text' as SourceType,
            text: ocrText,
          });
        } catch {
          failedCount += 1;
          return stripTransientOcrImage(snippet);
        }
      })
    );

    const nextSpeaker = {
      ...speaker,
      snippets,
    };

    if (changed) {
      updateSpeaker(speaker.id, (current) => ({
        ...current,
        name: resolveAutoSpeakerName(current.name, undefined, snippets),
        snippets: current.snippets.map((snippet) => snippets.find((item) => item.id === snippet.id) || snippet),
      }));
    }

    return { speaker: nextSpeaker, changed, failedCount };
  }

  async function uploadImages(files: FileList | null) {
    if (!files || !currentSpeaker) {
      return;
    }

    const imageFiles = Array.from(files).filter((file) => file.type.startsWith('image/'));
    if (imageFiles.length === 0) {
      setNotice('请选择图片文件。');
      return;
    }

    setBusy('image');
    try {
      const snippets = await Promise.all(imageFiles.map((file) => createImageSnippet(file)));
      await appendImageSnippets(snippets, '已上传');
    } catch (error) {
      setNotice(error instanceof Error ? error.message : '图片上传失败。');
    } finally {
      setBusy(null);
      if (imageInputRef.current) {
        imageInputRef.current.value = '';
      }
    }
  }

  function addSpeaker() {
    const speaker: SpeakerCard = {
      id: crypto.randomUUID(),
      name: `发言人 ${session.speakers.length + 1}`,
      status: 'empty',
      snippets: [],
    };
    updateSession((current) => ({
      ...current,
      speakers: [...current.speakers, speaker],
    }));
    setSelectedSpeakerId(speaker.id);
  }

  function deleteSpeaker(speakerId: string) {
    const target = session.speakers.find((speaker) => speaker.id === speakerId);
    if (target && !window.confirm(`确认删除 ${target.name} 及其全部内容吗？`)) {
      return;
    }
    updateSession((current) => {
      if (current.speakers.length <= 1) {
        setNotice('至少保留一位发言人。');
        return current;
      }
      const speakers = current.speakers.filter((speaker) => speaker.id !== speakerId);
      if (selectedSpeakerId === speakerId) {
        setSelectedSpeakerId(speakers[0]?.id || '');
      }
      return { ...current, speakers };
    });
  }

  function renameSpeaker(speakerId: string, name: string) {
    updateSpeaker(speakerId, (speaker) => ({ ...speaker, name }));
  }

  function moveSpeaker(speakerId: string, direction: -1 | 1) {
    updateSession((current) => {
      const index = current.speakers.findIndex((speaker) => speaker.id === speakerId);
      const targetIndex = index + direction;
      if (index < 0 || targetIndex < 0 || targetIndex >= current.speakers.length) {
        return current;
      }

      const speakers = [...current.speakers];
      const [speaker] = speakers.splice(index, 1);
      speakers.splice(targetIndex, 0, speaker);
      return { ...current, speakers };
    });
  }

  function deleteSnippet(snippetId: string) {
    if (!currentSpeaker) {
      return;
    }
    updateSpeaker(currentSpeaker.id, (speaker) => {
      const snippets = speaker.snippets.filter((snippet) => snippet.id !== snippetId);
      return {
        ...speaker,
        snippets,
        polishedContent: undefined,
        polishedAt: undefined,
        status: snippets.length === 0 ? 'empty' : speaker.status,
      };
    });
  }

  function markResponded() {
    if (!currentSpeaker) {
      return;
    }
    updateSpeaker(currentSpeaker.id, (speaker) => ({
      ...speaker,
      status: 'responded',
    }));
  }

  function updateActualResponse(value: string) {
    if (!currentSpeaker) {
      return;
    }
    updateSpeaker(currentSpeaker.id, (speaker) => ({
      ...speaker,
      actualResponse: value,
    }));
  }

  async function copyText(text: string, label: string) {
    if (!text) {
      return;
    }
    await getObserverAPI().writeClipboardText(text);
    setNotice(`已复制：${label}`);
  }

  async function copyImageDataUrl(imageDataUrl: string, label: string) {
    try {
      const response = await fetch(imageDataUrl);
      const blob = await response.blob();
      if (!navigator.clipboard || !('write' in navigator.clipboard) || typeof ClipboardItem === 'undefined') {
        setNotice('当前浏览器不支持直接复制图片。可以右键图片复制，或重新粘贴原截图测试。');
        return;
      }
      await navigator.clipboard.write([
        new ClipboardItem({
          [blob.type || 'image/jpeg']: blob,
        }),
      ]);
      setNotice(`已复制图片：${label}`);
    } catch (error) {
      setNotice(error instanceof Error ? `复制图片失败：${error.message}` : '复制图片失败，可以右键图片复制。');
    }
  }

  function toggleSummaryVersion(versionId: string) {
    updateSession((current) => {
      const versions = getSessionSummaryVersions(current).map((version) =>
        version.id === versionId ? { ...version, collapsed: !version.collapsed } : version
      );
      return syncSessionSummaries(current, versions);
    });
  }

  function deleteSummaryVersion(versionId: string) {
    const target = summaryVersions.find((version) => version.id === versionId);
    if (target && !window.confirm(`确认删除「${target.label}」吗？`)) {
      return;
    }
    updateSession((current) => {
      const versions = getSessionSummaryVersions(current).filter((version) => version.id !== versionId);
      return syncSessionSummaries(current, versions);
    });
    setNotice('已删除这版输出。');
  }

  function appendVersionToFinalSpeech(versionId: string) {
    const target = summaryVersions.find((version) => version.id === versionId);
    if (!target) {
      return;
    }
    const html = summaryToEditorHtml(target.summary);
    updateSession((current) => ({
      ...current,
      finalSpeechDraft: appendEditorHtml(current.finalSpeechDraft, html, '<hr>'),
    }));
    setNotice(`已加入最终发言：${target.label}`);
  }

  function appendSectionToFinalSpeech(title: string, body: string) {
    const text = summarySectionToText(title, body);
    const html = plainTextToEditorHtml(text);
    updateSession((current) => ({
      ...current,
      finalSpeechDraft: appendEditorHtml(current.finalSpeechDraft, html, '<p><br></p>'),
    }));
    setNotice(`已插入正文：${title}`);
  }

  function updateFinalSpeechDraft(value: string) {
    updateSession((current) => ({
      ...current,
      finalSpeechDraft: value,
    }));
  }

  function saveFinalSpeechDraft() {
    setNotice('本次最后的发言已保存到当前课程。');
  }

  async function copyFinalSpeechDraft() {
    const text = htmlToPlainText(session.finalSpeechDraft || '');
    if (!text) {
      setNotice('最终发言还是空的。');
      return;
    }
    await copyText(text, '本次最后的发言');
  }

  function clearFinalSpeechDraft() {
    if (!session.finalSpeechDraft?.trim() || window.confirm('确认清空本次最后的发言吗？')) {
      updateFinalSpeechDraft('');
      setNotice('已清空本次最后的发言。');
    }
  }

  function removeSummaryKnowledge(entryId: string) {
    const target = knowledgeEntries.find((entry) => entry.id === entryId);
    setSummaryKnowledgeIds((current) => current.filter((id) => id !== entryId));
    updateSession((current) => ({
      ...current,
      summaryKnowledgeIds: (current.summaryKnowledgeIds || summaryKnowledgeIds).filter((id) => id !== entryId),
      excludedSummaryKnowledgeIds: Array.from(new Set([...(current.excludedSummaryKnowledgeIds || []), entryId])),
    }));
    setNotice(`已从本场全场观察素材中移除${target ? `：${target.title}` : ''}。重新输出全场观察后生效。`);
  }

  function setSpeakerAnalyzing(speakerId: string, analyzing: boolean) {
    setAnalyzingSpeakerIds((current) => {
      if (analyzing) {
        return current.includes(speakerId) ? current : [...current, speakerId];
      }
      return current.filter((id) => id !== speakerId);
    });
  }

  function setSpeakerPolishing(speakerId: string, polishing: boolean) {
    setPolishingSpeakerIds((current) => {
      if (polishing) {
        return current.includes(speakerId) ? current : [...current, speakerId];
      }
      return current.filter((id) => id !== speakerId);
    });
  }

  function updatePolishedContent(value: string) {
    if (!currentSpeaker) {
      return;
    }
    updateSpeaker(currentSpeaker.id, (speaker) => ({
      ...speaker,
      polishedContent: value,
      polishedAt: value.trim() ? new Date().toISOString() : undefined,
    }));
  }

  async function polishSpeakerContent(speakerId = currentSpeaker?.id || '') {
    const targetSpeaker = session.speakers.find((speaker) => speaker.id === speakerId);
    if (!targetSpeaker || targetSpeaker.snippets.length === 0) {
      showNotice('先给当前发言人粘贴或上传内容。');
      return;
    }
    if (polishingSpeakerIds.includes(targetSpeaker.id)) {
      return;
    }

    setSpeakerPolishing(targetSpeaker.id, true);
    setNotice('');
    let speakerForFallback = targetSpeaker;
    try {
      const ocrResult = await fillMissingOcrForSpeaker(targetSpeaker);
      const sourceSpeaker = ocrResult.speaker;
      speakerForFallback = sourceSpeaker;
      const sourceText = sourceSpeaker.snippets.map((snippet) => cleanSourceText(snippet.text)).filter(Boolean).join('\n');
      if (!sourceText.trim()) {
        showNotice(`${targetSpeaker.name} 还没有可整理的 OCR 或转写文字。请换更清晰截图，或手动粘贴文字。`);
        return;
      }

      const result = settings.hasApiKey
        ? await getObserverAPI().polishSpeakerContent(buildSpeakerContentPolishPrompt(sourceSpeaker))
        : createLocalPolishedSpeakerContent(sourceSpeaker);
      const polishedContent = result.polishedContent?.trim() || createLocalPolishedSpeakerContent(sourceSpeaker).polishedContent;

      updateSpeaker(targetSpeaker.id, (speaker) => ({
        ...speaker,
        name: resolveAutoSpeakerName(speaker.name, undefined, sourceSpeaker.snippets),
        snippets: speaker.snippets.map((snippet) => sourceSpeaker.snippets.find((item) => item.id === snippet.id) || snippet),
        polishedContent,
        polishedAt: new Date().toISOString(),
      }));
      showNotice(settings.hasApiKey ? `已整理 ${targetSpeaker.name} 的发言内容。` : `已拼接 ${targetSpeaker.name} 的发言内容；设置 API Key 后可自动顺稿。`);
    } catch (error) {
      const fallback = createLocalPolishedSpeakerContent(speakerForFallback);
      updateSpeaker(targetSpeaker.id, (speaker) => ({
        ...speaker,
        polishedContent: fallback.polishedContent,
        polishedAt: new Date().toISOString(),
      }));
      showNotice(`AI 整理失败，已用本地拼接稿代替：${error instanceof Error ? error.message : '未知错误'}`);
    } finally {
      setSpeakerPolishing(targetSpeaker.id, false);
    }
  }

  async function analyzeSpeaker(speakerId = currentSpeaker?.id || '') {
    const targetSpeaker = session.speakers.find((speaker) => speaker.id === speakerId);
    if (!targetSpeaker || (targetSpeaker.snippets.length === 0 && !targetSpeaker.polishedContent?.trim())) {
      setNotice('先给当前发言人粘贴内容。');
      return;
    }
    if (analyzingSpeakerIds.includes(targetSpeaker.id)) {
      return;
    }

    setSpeakerAnalyzing(targetSpeaker.id, true);
    setNotice('');
    const sessionSnapshot = session;
    const themeSnapshot = selectedTheme;
    const settingsSnapshot = settings;
    let analysisSpeakerForFallback = targetSpeaker;
    try {
      let insight: SpeakerInsight;
      const ocrResult = await fillMissingOcrForSpeaker(targetSpeaker);
      const analysisSpeaker = ocrResult.speaker;
      analysisSpeakerForFallback = analysisSpeaker;
      const speakerText = speakerSourceText(analysisSpeaker);
      const hasText = Boolean(speakerText.trim());
      const hasAnalyzableImage = settingsSnapshot.provider !== 'xiaomi_mimo' && analysisSpeaker.snippets.some((snippet) => snippet.imageDataUrl);
      if (!hasText && !hasAnalyzableImage) {
        setNotice(
          settingsSnapshot.provider === 'xiaomi_mimo'
            ? `${targetSpeaker.name} 的截图没有 OCR 出可分析文字。MiMo 当前不能直接看图，请换更清晰截图，或粘贴腾讯会议转写文字。`
            : `${targetSpeaker.name} 的内容里没有可分析文字，图片数据也不可用。请重新粘贴截图或转写文字。`
        );
        return;
      }
      const speakerKnowledgeText = [speakerText, dailyObservationToText(sessionSnapshot.dailyObservation)].filter(Boolean).join('\n');
      const relevantKnowledge = selectKnowledgeForRun(knowledgeEntries, speakerKnowledgeText, themeSnapshot.name, pinnedKnowledgeIds, 8);
      setSpeakerKnowledgeUse((current) => ({ ...current, [targetSpeaker.id]: relevantKnowledge.map((entry) => entry.id) }));
      if (settingsSnapshot.hasApiKey) {
        const promptSpeaker =
          settingsSnapshot.provider === 'xiaomi_mimo'
            ? {
                ...analysisSpeaker,
                snippets: analysisSpeaker.snippets.filter((snippet) => cleanSourceText(snippet.text)),
              }
            : analysisSpeaker;
        const sessionForPrompt = {
          ...sessionSnapshot,
          speakers: sessionSnapshot.speakers.map((speaker) => (speaker.id === promptSpeaker.id ? promptSpeaker : speaker)),
        };
        const payload = buildSpeakerPrompt(sessionForPrompt, themeSnapshot, promptSpeaker, relevantKnowledge);
        insight = await getObserverAPI().analyzeSpeaker(payload);
        insight.generatedBy = settingsSnapshot.provider;
      } else {
        insight = createLocalSpeakerInsight(analysisSpeaker, themeSnapshot, sessionSnapshot);
      }

      updateSpeaker(targetSpeaker.id, (speaker) => ({
        ...speaker,
        name: resolveAutoSpeakerName(speaker.name, insight.suggestedSpeakerName, analysisSpeaker.snippets),
        insight,
        status: 'response_ready',
      }));
      setNotice(settingsSnapshot.hasApiKey ? `已生成 ${targetSpeaker.name} 的 AI 单人观察。` : `已生成 ${targetSpeaker.name} 的本地演练稿；设置 API Key 后可获得真实 AI 观察。`);
    } catch (error) {
      const fallback = createLocalSpeakerInsight(analysisSpeakerForFallback, themeSnapshot, sessionSnapshot);
      updateSpeaker(targetSpeaker.id, (speaker) => ({
        ...speaker,
        name: resolveAutoSpeakerName(speaker.name, fallback.suggestedSpeakerName, analysisSpeakerForFallback.snippets),
        insight: fallback,
        status: 'response_ready',
      }));
      setNotice(`${targetSpeaker.name} 的 AI 请求失败，已用本地演练稿代替：${error instanceof Error ? error.message : '未知错误'}`);
    } finally {
      setSpeakerAnalyzing(targetSpeaker.id, false);
    }
  }

  async function generateSummaryForTemplate(template: SummaryTemplateType, baseSession: ObserverSession, relevantKnowledge: KnowledgeEntry[], requirement = '') {
    if (settings.hasApiKey) {
      const payload = buildSessionPrompt(baseSession, selectedTheme, relevantKnowledge, requirement, template);
      const summary = await getObserverAPI().summarizeSession(payload);
      summary.generatedBy = settings.provider;
      return summary;
    }
    const summary = createLocalWholeSummary(baseSession, selectedTheme, template);
    if (requirement.trim()) {
      summary.structuredSections = [
        ...(summary.structuredSections || []),
        {
          key: 'custom_requirement',
          title: '我的优化要求',
          body: requirement.trim(),
        },
      ];
    }
    return summary;
  }

  async function summarizeSession() {
    setBusy('summary');
    setNotice('');
    const sessionText = [
      session.speakers.map((speaker) => speakerSourceText(speaker)).join('\n'),
      transcriptWorkspace.transcriptText,
      dailyObservationText,
    ]
      .filter(Boolean)
      .join('\n');
    const relevantKnowledge = selectKnowledgeForRun(knowledgeEntries, sessionText, selectedTheme.name, pinnedKnowledgeIds, 12, session.excludedSummaryKnowledgeIds || []);
    const relevantKnowledgeIds = relevantKnowledge.map((entry) => entry.id);
    const orderedTemplates = getOrderedSummaryTemplates(summaryTemplateMode, predictedSummaryTemplate);
    const baseSession: ObserverSession = {
      ...session,
      summary: undefined,
      summaryVersions: undefined,
      refinedSummary: undefined,
      refinedSummaryRequirement: '',
    };

    setSummaryKnowledgeIds(relevantKnowledgeIds);
    try {
      const results = await Promise.all(
        orderedTemplates.map(async (template, index) => {
          try {
            const summary = await generateSummaryForTemplate(template, baseSession, relevantKnowledge);
            return {
              error: '',
              version: createSummaryVersion({
                label: createGeneratedVersionLabel(summaryTemplateMode, template, index),
                source: 'generated',
                templateMode: resolveSummaryTemplate(summary, template),
                summary,
                collapsed: index > 0,
              }),
            };
          } catch (error) {
            const summary = createLocalWholeSummary(baseSession, selectedTheme, template);
            return {
              error: error instanceof Error ? error.message : '未知错误',
              version: createSummaryVersion({
                label: createGeneratedVersionLabel(summaryTemplateMode, template, index),
                source: 'generated',
                templateMode: template,
                summary,
                collapsed: index > 0,
              }),
            };
          }
        })
      );
      const nextVersions = results.map((result) => result.version);
      const failedCount = results.filter((result) => result.error).length;

      updateSession((current) =>
        syncSessionSummaries(
          {
            ...current,
            summaryOutputCount: (current.summaryOutputCount || 0) + 1,
            summaryKnowledgeIds: relevantKnowledgeIds,
            refinedSummary: undefined,
            refinedSummaryRequirement: '',
          },
          nextVersions
        )
      );
      setNotice(
        settings.hasApiKey
          ? failedCount > 0
            ? `已替换 3 个全场观察版本，其中 ${failedCount} 个版本使用本地演练稿补位。`
            : '已替换为新的 3 个全场观察版本。'
          : '已替换为 3 个本地全场观察草稿；设置 API Key 后可获得真实 AI 输出。'
      );
    } finally {
      setBusy(null);
    }
  }

  async function refineSessionSummary() {
    if (summaryVersions.length === 0) {
      setNotice('先输出全场观察，再按你的要求新增优化版。');
      return;
    }
    const requirement = summaryRequirement.trim();
    if (!requirement) {
      setNotice('先写下你的优化要求。');
      return;
    }

    setBusy('summary-refine');
    setNotice('');
    try {
      const sessionText = [
        session.speakers.map((speaker) => speakerSourceText(speaker)).join('\n'),
        transcriptWorkspace.transcriptText,
        dailyObservationText,
      ]
        .filter(Boolean)
        .join('\n');
      const relevantKnowledge = selectKnowledgeForRun(knowledgeEntries, sessionText, selectedTheme.name, pinnedKnowledgeIds, 12, session.excludedSummaryKnowledgeIds || []);
      const relevantKnowledgeIds = relevantKnowledge.map((entry) => entry.id);
      const fallbackTemplate =
        summaryTemplateMode === 'auto'
          ? primarySummaryVersion?.templateMode || predictedSummaryTemplate
          : summaryTemplateMode;
      const targetTemplate = inferTemplateFromRequirement(requirement, fallbackTemplate);
      const baseSession: ObserverSession = {
        ...session,
        summary: primarySummaryVersion?.summary || session.summary,
        summaryVersions,
      };
      setSummaryKnowledgeIds(relevantKnowledgeIds);
      const refinedSummary = await generateSummaryForTemplate(targetTemplate, baseSession, relevantKnowledge, requirement);
      const refinedIndex = summaryVersions.filter((version) => version.source === 'refined').length + 1;
      const refinedVersion = createSummaryVersion({
        label: `优化版 ${refinedIndex} · ${summaryTemplateNames[resolveSummaryTemplate(refinedSummary, targetTemplate)]}`,
        source: 'refined',
        templateMode: resolveSummaryTemplate(refinedSummary, targetTemplate),
        summary: refinedSummary,
        requirement,
      });

      updateSession((current) =>
        syncSessionSummaries(
          {
            ...current,
            summaryKnowledgeIds: relevantKnowledgeIds,
          },
          [...getSessionSummaryVersions(current), refinedVersion]
        )
      );
      setNotice(settings.hasApiKey ? '已新增一版优化输出。' : '已新增一版本地优化草稿；设置 API Key 后可获得真实 AI 输出。');
    } catch (error) {
      setNotice(`优化版生成失败：${error instanceof Error ? error.message : '未知错误'}`);
    } finally {
      setBusy(null);
    }
  }

  function changeProvider(nextProvider: AIProvider) {
    const currentPreset = providerPresets[providerInput];
    const nextPreset = providerPresets[nextProvider];
    setProviderInput(nextProvider);

    if (!modelInput.trim() || modelInput.trim() === currentPreset.model) {
      setModelInput(nextPreset.model);
    }
    if (!baseUrlInput.trim() || baseUrlInput.trim() === currentPreset.baseUrl) {
      setBaseUrlInput(nextPreset.baseUrl);
    }
  }

  function applyXiaomiTokenPlan() {
    setProviderInput('xiaomi_mimo');
    setBaseUrlInput(xiaomiTokenPlan.openAIBaseUrl);
    setModelInput(xiaomiTokenPlan.primaryModel);
    setNotice('已套用小米 Token Plan 配置。');
  }

  async function saveSettings() {
    const saved = await getObserverAPI().saveSettings({
      provider: providerInput,
      apiKey: apiKeyInput.trim() || '__KEEP__',
      baseUrl: baseUrlInput.trim(),
      model: modelInput.trim() || providerPresets[providerInput].model,
    });
    setSettings(saved);
    setProviderInput(saved.provider);
    setBaseUrlInput(saved.baseUrl);
    setModelInput(saved.model);
    setApiKeyInput('');
    setSettingsOpen(false);
    setNotice(saved.hasApiKey ? `设置已保存：${providerPresets[saved.provider].label}。` : '模型已保存，API Key 仍为空。');
  }

  function buildMarkdownReview() {
    const versions = getSessionSummaryVersions(session);
    const appendSummaryMarkdown = (heading: string, item: WholeSessionSummary) => {
      lines.push(`## ${heading}`);
      lines.push('');
      if (item.templateDecision) {
        lines.push(`### 推荐模板`);
        lines.push(`${item.templateDecision.templateName}：${item.templateDecision.reason}`);
        if (item.templateDecision.sceneSignals.length > 0) {
          item.templateDecision.sceneSignals.forEach((signal) => lines.push(`- ${signal}`));
        }
        lines.push('');
      }
      lines.push(`### 课程主题`);
      lines.push(item.courseTheme);
      lines.push('');
      lines.push(`### 共同主题`);
      lines.push(item.commonTheme);
      lines.push('');
      lines.push('### 每人的问题线索');
      lines.push('');
      item.speakerLessons.forEach((lesson) => {
        lines.push(`- **${lesson.speakerName}**：${lesson.lesson}（${lesson.themeConnection}）`);
      });
      lines.push('');
      lines.push('### 重点回应');
      lines.push(item.keyResponse);
      lines.push('');
      const structuredSections = getSummaryStructuredSections(item);
      if (structuredSections.length > 0) {
        structuredSections.forEach((section) => {
          lines.push(`### ${section.title}`);
          lines.push('');
          lines.push(section.body);
          lines.push('');
        });
      }
      lines.push('### 金句');
      item.goldenSentences.forEach((sentence) => lines.push(`- ${sentence}`));
      lines.push('');
      const oneSentenceSummaries = item.oneSentenceSummaries || [];
      if (oneSentenceSummaries.length > 0) {
        lines.push('### 一句话总结');
        oneSentenceSummaries.forEach((sentence) => lines.push(`- ${sentence}`));
        lines.push('');
      }
      lines.push(`### 收束`);
      lines.push(item.closingSentence);
      lines.push('');
    };
    const lines = [
      `# ${session.title}`,
      '',
      `- 当天课程：${selectedTheme.name}`,
      `- 主题核心：${selectedTheme.core}`,
      `- 观察者立场：${session.observerStance}`,
      `- 更新时间：${new Date(session.updatedAt).toLocaleString('zh-CN')}`,
      '',
      '## 我的当日观察素材',
      '',
      dailyObservationText || '未填写',
      '',
      '## 书友复盘',
      '',
    ];

    for (const speaker of session.speakers) {
      lines.push(`### ${speaker.name}`);
      lines.push('');
      lines.push(`- 状态：${statusLabels[speaker.status]}`);
      lines.push(`- 内容片段：${speaker.snippets.length} 段`);
      lines.push('');

      if (speaker.snippets.length > 0) {
        lines.push('#### 原始内容');
        lines.push('');
        speaker.snippets.forEach((snippet, index) => {
          lines.push(`**片段 ${index + 1}（${sourceLabels[snippet.sourceType]}，${nowLabel(snippet.createdAt)}）**`);
          lines.push('');
          lines.push(cleanSourceText(snippet.text));
          lines.push('');
        });
      }

      if (speaker.polishedContent?.trim()) {
        lines.push('#### 整理后的发言内容');
        lines.push('');
        lines.push(speaker.polishedContent.trim());
        lines.push('');
      }

      if (speaker.insight) {
        lines.push('#### AI 观察');
        lines.push('');
        lines.push(`- 最值得抓的点：${speaker.insight.strongestPoint}`);
        lines.push(`- 背后的本质：${speaker.insight.underlyingPattern}`);
        lines.push(`- 课程连接：${speaker.insight.themeConnection}`);
        lines.push(`- 看到的问题：${speaker.insight.stuckType}`);
        lines.push(`- 需要被看见：${speaker.insight.seenNeed}`);
        lines.push(`- 适合关联经历：${speaker.insight.suggestedObserverStory}`);
        lines.push('');
        lines.push('#### 现场回应稿');
        lines.push('');
        lines.push(speaker.insight.oneMinuteResponse);
        lines.push('');
        lines.push(`追问：${speaker.insight.powerfulQuestion}`);
        lines.push('');
        lines.push('#### 不要说的话');
        lines.push('');
        speaker.insight.doNotSay.forEach((item) => lines.push(`- ${item}`));
        lines.push('');
      }

      if (speaker.actualResponse?.trim()) {
        lines.push('#### 我的实际回应');
        lines.push('');
        lines.push(speaker.actualResponse.trim());
        lines.push('');
      }
    }

    if (versions.length > 0) {
      versions.forEach((version) => {
        if (version.requirement) {
          lines.push(`## ${version.label}的优化要求`);
          lines.push('');
          lines.push(version.requirement);
          lines.push('');
        }
        appendSummaryMarkdown(`全场洞察 - ${version.label}`, version.summary);
      });
    } else if (session.summary) {
      appendSummaryMarkdown('全场统一观察', session.summary);
    }

    if (versions.length === 0 && session.refinedSummary) {
      if (session.refinedSummaryRequirement) {
        lines.push('## 我的优化要求');
        lines.push('');
        lines.push(session.refinedSummaryRequirement);
        lines.push('');
      }
      appendSummaryMarkdown('按我的要求优化版', session.refinedSummary);
    }

    const finalSpeech = htmlToPlainText(session.finalSpeechDraft || '');
    if (finalSpeech) {
      lines.push('## 本次最后的发言');
      lines.push('');
      lines.push(finalSpeech);
      lines.push('');
    }

    return lines.join('\n');
  }

  async function copyMarkdownReview() {
    await copyText(buildMarkdownReview(), 'Markdown 复盘');
  }

  function downloadMarkdownReview() {
    const markdown = buildMarkdownReview();
    const blob = new Blob([markdown], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const safeTitle = session.title.replace(/[\\/:*?"<>|]/g, '-');
    link.href = url;
    link.download = `${safeTitle || '晨读观察台复盘'}.md`;
    link.click();
    URL.revokeObjectURL(url);
    setNotice('Markdown 复盘已下载。');
  }

  function upsertKnowledgeEntry(entry: KnowledgeEntry) {
    setKnowledgeEntries((current) => {
      const normalized = normalizeKnowledgeEntry(entry);
      const exists = current.some((item) => item.id === normalized.id);
      return exists ? current.map((item) => (item.id === normalized.id ? normalized : item)) : [normalized, ...current];
    });
    setSelectedKnowledgeId(entry.id);
  }

  function updateKnowledgeField<K extends keyof KnowledgeEntry>(entryId: string, field: K, value: KnowledgeEntry[K]) {
    setKnowledgeEntries((current) =>
      current.map((entry) =>
        entry.id === entryId
          ? {
              ...entry,
              [field]: value,
              updatedAt: new Date().toISOString(),
            }
          : entry
      )
    );
  }

  function deleteKnowledgeEntry(entryId: string) {
    const target = knowledgeEntries.find((entry) => entry.id === entryId);
    if (target && !window.confirm(`确认删除知识条目「${target.title}」吗？`)) {
      return;
    }
    setKnowledgeEntries((current) => current.filter((entry) => entry.id !== entryId));
    if (selectedKnowledgeId === entryId) {
      setSelectedKnowledgeId('');
    }
  }

  function deleteKnowledgeBySource() {
    if (!selectedKnowledgeSource) {
      setNotice('先选择要删除的来源。');
      return;
    }
    const targets = knowledgeEntries.filter((entry) => compactKnowledgeSourceTitle(entry.sourceTitle) === selectedKnowledgeSource);
    if (targets.length === 0) {
      setNotice('这个来源下没有可删除的知识。');
      return;
    }
    if (!window.confirm(`确认删除来源「${selectedKnowledgeSource}」下的 ${targets.length} 条知识吗？这个操作不会影响其他来源。`)) {
      return;
    }
    const targetIds = new Set(targets.map((entry) => entry.id));
    setKnowledgeEntries((current) => current.filter((entry) => !targetIds.has(entry.id)));
    setPinnedKnowledgeIds((current) => current.filter((id) => !targetIds.has(id)));
    setSpeakerKnowledgeUse((current) =>
      Object.fromEntries(Object.entries(current).map(([speakerId, ids]) => [speakerId, ids.filter((id) => !targetIds.has(id))]))
    );
    setSummaryKnowledgeIds((current) => current.filter((id) => !targetIds.has(id)));
    if (selectedKnowledge && targetIds.has(selectedKnowledge.id)) {
      setSelectedKnowledgeId('');
    }
    setSelectedKnowledgeSource('');
    setNotice(`已删除来源「${selectedKnowledgeSource}」下的 ${targets.length} 条知识。`);
  }

  function mergeDuplicateKnowledgeEntries() {
    const groups = new Map<string, KnowledgeEntry[]>();
    knowledgeEntries.forEach((entry) => {
      const key = normalizeKnowledgeDuplicateKey(entry);
      if (key.length < 6) {
        return;
      }
      groups.set(key, [...(groups.get(key) || []), entry]);
    });
    const duplicateGroups = Array.from(groups.values()).filter((group) => group.length > 1);
    const duplicateCount = duplicateGroups.reduce((count, group) => count + group.length - 1, 0);
    if (duplicateCount === 0) {
      setNotice('没有发现标题重复的知识条目。');
      return;
    }
    if (!window.confirm(`发现 ${duplicateGroups.length} 组标题重复知识，将合并并减少 ${duplicateCount} 条。确认继续吗？`)) {
      return;
    }

    const replaceIdMap = new Map<string, string>();
    const mergedById = new Map<string, KnowledgeEntry>();
    duplicateGroups.forEach((group) => {
      const [first, ...rest] = group;
      const merged = rest.reduce((current, duplicate) => {
        replaceIdMap.set(duplicate.id, first.id);
        return mergeKnowledgeEntries(current, duplicate);
      }, first);
      mergedById.set(first.id, merged);
    });

    const removedIds = new Set(replaceIdMap.keys());
    setKnowledgeEntries((current) =>
      current
        .filter((entry) => !removedIds.has(entry.id))
        .map((entry) => mergedById.get(entry.id) || entry)
    );
    const remapIds = (ids: string[]) => uniqueList(ids.map((id) => replaceIdMap.get(id) || id));
    setPinnedKnowledgeIds((current) => remapIds(current));
    setSpeakerKnowledgeUse((current) => Object.fromEntries(Object.entries(current).map(([speakerId, ids]) => [speakerId, remapIds(ids)])));
    setSummaryKnowledgeIds((current) => remapIds(current));
    if (selectedKnowledgeId && removedIds.has(selectedKnowledgeId)) {
      setSelectedKnowledgeId(replaceIdMap.get(selectedKnowledgeId) || '');
    }
    setNotice(`已合并 ${duplicateGroups.length} 组重复知识，减少 ${duplicateCount} 条。`);
  }

  function togglePinnedKnowledge(entryId: string) {
    setPinnedKnowledgeIds((current) => (current.includes(entryId) ? current.filter((id) => id !== entryId) : [...current, entryId]));
  }

  function createManualKnowledgeEntry() {
    const entry = normalizeKnowledgeEntry({
      title: '新的知识条目',
      type: 'morning_speech',
      tags: [],
      applicableScenes: '',
      summary: '',
      originalExcerpt: '',
      reusableLines: [],
      speakingBoundary: '',
      avoidDetails: [],
    });
    setKnowledgeEntries((current) => [entry, ...current]);
    setSelectedKnowledgeId(entry.id);
  }

  async function importKnowledgeFiles(files: FileList | null) {
    if (!files || files.length === 0) {
      return;
    }
    setBusy('knowledge-file');
    try {
      const sources: KnowledgeDraftSource[] = [];
      for (const file of Array.from(files)) {
        const ext = file.name.split('.').pop()?.toLowerCase();
        if (ext === 'txt' || ext === 'md') {
          sources.push({
            id: crypto.randomUUID(),
            title: file.name,
            fileName: file.name,
            text: await readFileAsText(file),
          });
          continue;
        }
        if (ext === 'docx') {
          const dataUrl = await readFileAsDataUrl(file);
          const result = await getObserverAPI().extractDocumentText({ fileName: file.name, dataUrl });
          sources.push({
            id: crypto.randomUUID(),
            title: file.name,
            fileName: file.name,
            text: result.text,
          });
          continue;
        }
        setNotice(`暂不支持 ${file.name}，请上传 txt、md 或 docx。`);
      }
      const merged = sources.map((source) => `【${source.title}】\n${source.text}`).join('\n\n');
      if (merged.trim()) {
        setKnowledgeDraftSources((current) => [...current, ...sources]);
        setKnowledgeDraftTitle(Array.from(files)[0]?.name || '导入文档');
        setKnowledgeDraftText((current) => [current, merged].filter(Boolean).join('\n\n'));
        setKnowledgeOpen(true);
        setNotice(`已导入 ${sources.length} 篇文档；提炼时会按内容长度自动分段。`);
      }
    } catch (error) {
      setNotice(error instanceof Error ? error.message : '文档导入失败。');
    } finally {
      setBusy(null);
      if (knowledgeFileRef.current) {
        knowledgeFileRef.current.value = '';
      }
    }
  }

  function createLocalKnowledgeEntries(title: string, text: string): KnowledgeEntry[] {
    const clipped = text.trim().slice(0, 900);
    const tags = ['晨读发言'];
    if (/破产|债务|银行|限高|欠薪/.test(text)) {
      tags.push('破产', '身份绑定', '重新开始');
    }
    if (/羞耻|丢脸|失败|输了|不行/.test(text)) {
      tags.push('羞耻感', '身份绑定');
    }
    if (/关系|合伙|伴侣|孩子|父亲|家庭/.test(text)) {
      tags.push('关系');
    }
    return [
      normalizeKnowledgeEntry({
        title: title.trim() || '过去晨读发言素材',
        type: /破产|债务|银行|限高|欠薪/.test(text) ? 'core_experience' : 'morning_speech',
        tags: Array.from(new Set(tags)),
        sourceTitle: title.trim(),
        applicableScenes: '当发言人分享失败、压力、关系内耗或重新开始相关内容时，可作为观察者自身经历的参照。',
        summary: clipped || '这是一段待进一步整理的过去发言素材。',
        originalExcerpt: clipped,
        reusableLines: ['事情失败，不等于人失败。', '真正能带走的，不是答案，而是重新看见自己还能怎样回应。'],
        speakingBoundary: '只讲自己的体会和转化，不比较谁更惨，不替对方下结论。',
        avoidDetails: ['具体金额', '具体人名', '责怪他人', '比较苦难'],
      }),
    ];
  }

  async function extractKnowledgeFromDraft() {
    const manualText = knowledgeDraftText.trim();
    const sources =
      knowledgeDraftSources.length > 0
        ? knowledgeDraftSources
        : manualText
          ? [
              {
                id: crypto.randomUUID(),
                title: knowledgeDraftTitle || '粘贴素材',
                text: manualText,
              },
            ]
          : [];

    if (sources.length === 0) {
      setNotice('先粘贴文字或上传文档。');
      return;
    }
    knowledgeCancelRef.current = false;
    setBusy('knowledge');
    try {
      const chunks = sources.flatMap(splitKnowledgeSource).filter((source) => source.text.trim());
      const entries: KnowledgeEntry[] = [];
      let completed = 0;

      for (let index = 0; index < chunks.length; index += KNOWLEDGE_BATCH_SIZE) {
        if (knowledgeCancelRef.current) {
          setNotice(`已停止提炼；本次已完成 ${completed}/${chunks.length} 段，新增 ${entries.length} 条知识。导入区内容已保留。`);
          break;
        }

        const batch = chunks.slice(index, index + KNOWLEDGE_BATCH_SIZE);
        setNotice(`正在提炼知识 ${index + 1}-${Math.min(index + batch.length, chunks.length)}/${chunks.length}，已新增 ${entries.length} 条。`);
        const batchResults = await Promise.all(
          batch.map(async (source) => {
            if (!settings.hasApiKey) {
              return createLocalKnowledgeEntries(source.title, source.text);
            }
            try {
              const payload = buildKnowledgePrompt({
                title: source.title || '未命名素材',
                text: clipKnowledgeSourceText(source.text),
                targetDescription: getKnowledgeTargetDescription(source.text.length),
              });
              const result = await withTimeout(getObserverAPI().extractKnowledge(payload), KNOWLEDGE_CHUNK_TIMEOUT_MS, source.title);
              return (result.entries || []).map((entry) => normalizeKnowledgeEntry({ ...entry, sourceTitle: entry.sourceTitle || source.fileName || source.title }));
            } catch (error) {
              console.warn('Knowledge extraction fallback:', source.title, error);
              return createLocalKnowledgeEntries(source.title, source.text);
            }
          })
        );

        const newEntries = batchResults.flat();
        completed += batch.length;
        entries.push(...newEntries);
        if (newEntries.length > 0) {
          setKnowledgeEntries((current) => [...newEntries, ...current]);
          setSelectedKnowledgeId((current) => current || newEntries[0]?.id || '');
        }
      }

      if (!knowledgeCancelRef.current) {
        setKnowledgeDraftText('');
        setKnowledgeDraftTitle('');
        setKnowledgeDraftSources([]);
        setNotice(settings.hasApiKey ? `已追加 ${entries.length} 条知识；当前共 ${knowledgeEntries.length + entries.length} 条。来源：${sources.length} 篇素材、${chunks.length} 个内容段。` : '已生成本地知识条目；设置 API Key 后可获得更精准提炼。');
      }
    } catch (error) {
      const fallbackSource = sources[0];
      const entries = createLocalKnowledgeEntries(fallbackSource?.title || knowledgeDraftTitle, fallbackSource?.text || manualText);
      setKnowledgeEntries((current) => [...entries, ...current]);
      setSelectedKnowledgeId(entries[0]?.id || '');
      setNotice(`AI 提炼失败，已生成本地条目：${error instanceof Error ? error.message : '未知错误'}`);
    } finally {
      setBusy(null);
    }
  }

  return (
    <main className="app-shell">
      <div className="sticky-header">
        <header className="topbar">
          <div className="title-group">
            <input
              className="session-title"
              value={session.title}
              onChange={(event) => updateSession((current) => ({ ...current, title: event.target.value }))}
            />
            <span className="session-meta">
              已采集 {capturedCount}/{session.speakers.length} · 已观察 {analyzedCount}/{session.speakers.length}
            </span>
          </div>

          <label className="theme-control">
            <span>当天课程</span>
            <select value={session.themeId} onChange={(event) => switchCourse(event.target.value)}>
              {themes.map((theme) => (
                <option key={theme.id} value={theme.id}>
                  {theme.name}
                </option>
              ))}
            </select>
          </label>

          <button className="plain-button" onClick={openCourseChange}>
            更换本场课程
          </button>

          <button className="plain-button" onClick={() => setCourseOpen((open) => !open)}>
            课程内容
          </button>

          <button className="plain-button" onClick={() => setKnowledgeOpen(true)}>
            我的知识库
          </button>

          <button className="plain-button danger-button" onClick={clearCurrentCourse}>
            清空当天
          </button>

          <button className="plain-button" onClick={() => setSettingsOpen(true)}>
            设置
          </button>
        </header>

        <section className="theme-strip">
          <strong>{selectedTheme.name}</strong>
          <span>{selectedTheme.core}</span>
          <small>
            {settings.hasApiKey
              ? `${providerPresets[settings.provider].label} · ${settings.model}`
              : '当前为本地演练稿模式'}
          </small>
        </section>
      </div>

      <section className={`collection-panel ${collectionCollapsed ? 'collapsed' : ''}`}>
        <div className="panel-heading split collection-heading">
          <div>
            <div className="collection-title-row">
              <h2>书友分享内容</h2>
              <button className="paste-title-button" onClick={pasteFromClipboard} title="粘贴剪贴板" aria-label="粘贴剪贴板" type="button">
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M9 4.75h6a2 2 0 0 1 2 2V8h1.25A1.75 1.75 0 0 1 20 9.75v9.5A1.75 1.75 0 0 1 18.25 21H5.75A1.75 1.75 0 0 1 4 19.25v-9.5A1.75 1.75 0 0 1 5.75 8H7V6.75a2 2 0 0 1 2-2Z" />
                  <path d="M9 8h6V6.75a.5.5 0 0 0-.5-.5h-5a.5.5 0 0 0-.5.5V8Z" />
                  <path d="M8 12h8M8 15.5h6" />
                </svg>
                <span>粘贴</span>
              </button>
            </div>
            <p>
              已采集 {capturedCount}/{session.speakers.length} · 已观察 {analyzedCount}/{session.speakers.length}
              {currentSpeaker ? ` · 当前：${currentSpeaker.name}` : ''}
            </p>
          </div>
          <button className="plain-button" onClick={() => setCollectionCollapsed((collapsed) => !collapsed)}>
            {collectionCollapsed ? '展开' : '收起'}
          </button>
        </div>

        {collectionCollapsed ? null : (
          <>
            {courseOpen ? (
              <section className="course-panel">
                <button className="plain-button course-collapse-button" onClick={() => setCourseOpen(false)} type="button">
                  收起
                </button>
                <CourseContentView theme={selectedTheme} onCopyReading={() => void copyText(courseReadingContentText(selectedTheme), '课程晨读内容')} />
              </section>
            ) : null}

            <section className={`daily-observation-panel ${dailyObservationCollapsed ? 'collapsed' : ''}`}>
              <div className="panel-heading split daily-observation-heading">
                <div>
                  <h2>我的当日观察素材</h2>
                  <p>把你准备单独分享的一整段放这里。生成书友观察和全场观察时，会作为你的个人表达素材来融合。</p>
                </div>
                <div className="daily-observation-actions">
                  <span>{dailyObservationFilled ? '已填写' : '未填写'}</span>
                  <button className="plain-button" onClick={() => setDailyObservationCollapsed((collapsed) => !collapsed)} type="button">
                    {dailyObservationCollapsed ? '展开' : '收起'}
                  </button>
                  <button className="plain-button danger-button" onClick={clearDailyObservation} type="button">
                    清空
                  </button>
                </div>
              </div>
              {dailyObservationCollapsed ? null : (
                <label className="daily-observation-field daily-observation-field-full">
                  <div className="textarea-label-row">
                    <span>我的完整分享素材</span>
                    <TextCount value={session.dailyObservation.content} />
                  </div>
                  <textarea
                    value={session.dailyObservation.content}
                    onChange={(event) => updateDailyObservationContent(event.target.value)}
                    placeholder="可以直接粘贴你准备单独分享的一整段内容，例如：今天这节课让我想到什么、我经历破产/债务/重建时的真实感受、我想对大家说的话、哪些部分不想展开。后续输出会结合书友分享和当天课程，只抽取真正相关的部分来融合，不会整段硬塞。"
                  />
                </label>
              )}
            </section>

            <section className={`transcript-panel ${transcriptCollapsed ? 'collapsed' : ''}`}>
              <div className="panel-heading split transcript-heading">
                <div>
                  <h2>整场截图脚本</h2>
                  <p>连续粘贴聊天截图，梳理成带时间、姓名和内容的完整脚本；再归人到下面的发言人卡片。</p>
                </div>
                <div className="transcript-actions">
                  <input
                    ref={transcriptImageInputRef}
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={(event) => void uploadTranscriptScreenshots(event.target.files)}
                  />
                  <button className="plain-button" disabled={busy === 'transcript-image'} onClick={() => void pasteTranscriptScreenshot()} type="button">
                    {busy === 'transcript-image' ? '识别中...' : '粘贴截图'}
                  </button>
                  <button className="plain-button" disabled={busy === 'transcript-image'} onClick={() => transcriptImageInputRef.current?.click()} type="button">
                    上传截图
                  </button>
                  <div className="transcript-text-summary" aria-label="整场脚本文本字数">
                    <span>整场脚本文本</span>
                    <TextCount value={transcriptWorkspace.transcriptText} />
                  </div>
                  <button className="plain-button" onClick={() => setTranscriptCollapsed((collapsed) => !collapsed)} type="button">
                    {transcriptCollapsed ? '展开' : '收起'}
                  </button>
                  <button className="plain-button danger-button" onClick={clearTranscriptWorkspace} type="button">
                    清空
                  </button>
                </div>
              </div>
              <div className="transcript-meta">
                <span>已采集 OCR {transcriptWorkspace.ocrSnippets.length} 段</span>
                <span>待梳理 OCR {pendingTranscriptOcrCount} 段</span>
                <span>已整理脚本 {transcriptEntryCount} 条</span>
                {transcriptWorkspace.updatedAt ? <span>更新于 {nowLabel(transcriptWorkspace.updatedAt)}</span> : null}
              </div>
              {transcriptCollapsed ? null : (
                <>
                  {transcriptWorkspace.ocrSnippets.length > 0 ? (
                    <div className={`transcript-ocr-preview ${transcriptOcrCollapsed ? 'collapsed' : ''}`}>
                      <div className="transcript-ocr-preview-head">
                        <strong>已识别 OCR 原文</strong>
                        <div className="transcript-ocr-head-actions">
                          <small>按采集顺序显示，默认预览每段末尾</small>
                          <button
                            aria-controls="transcript-ocr-list"
                            aria-expanded={!transcriptOcrCollapsed}
                            className="plain-button"
                            onPointerDown={(event) => {
                              if (event.pointerType !== 'touch') {
                                event.preventDefault();
                                event.stopPropagation();
                                suppressNextOcrToggleClick.current = true;
                                toggleTranscriptOcrPreview();
                              }
                            }}
                            onClick={(event) => {
                              event.preventDefault();
                              event.stopPropagation();
                              if (suppressNextOcrToggleClick.current) {
                                suppressNextOcrToggleClick.current = false;
                                return;
                              }
                              toggleTranscriptOcrPreview();
                            }}
                            type="button"
                          >
                            {transcriptOcrCollapsed ? '展开' : '收起'}
                          </button>
                        </div>
                      </div>
                      <div id="transcript-ocr-list" className="transcript-ocr-list" hidden={transcriptOcrCollapsed}>
                        {transcriptWorkspace.ocrSnippets.map((snippet, index) => (
                          <article key={snippet.id} className="transcript-ocr-item">
                            <div className="transcript-ocr-meta">
                              <span>#{index + 1}</span>
                              {snippet.fileName ? <span>{snippet.fileName}</span> : null}
                              <span>{nowLabel(snippet.createdAt)}</span>
                              <TextCount value={snippet.text} />
                              <button className="plain-button" onClick={() => void copyText(formatOcrTextByTime(snippet.text), '整场截图 OCR 原文')} type="button">
                                复制 OCR
                              </button>
                              <button className="plain-button danger-button" onClick={() => deleteTranscriptOcrSnippet(snippet.id)} type="button">
                                删除
                              </button>
                            </div>
                            <pre>{compactOcrPreviewText(snippet.text)}</pre>
                          </article>
                        ))}
                      </div>
                    </div>
                  ) : null}
                  <div className="transcript-workflow-row">
                    <div className="transcript-workflow-actions">
                      <button className="primary-button" disabled={busy === 'transcript-organize'} onClick={() => void organizeTranscriptWorkspace()} type="button">
                        {busy === 'transcript-organize' && !transcriptOrganizeForce ? '梳理中...' : '梳理'}
                      </button>
                      <button className="plain-button danger-button" disabled={busy === 'transcript-organize' || transcriptWorkspace.ocrSnippets.length === 0} onClick={() => void organizeTranscriptWorkspace(true)} type="button">
                        {busy === 'transcript-organize' && transcriptOrganizeForce ? '强制梳理中...' : '强制梳理'}
                      </button>
                      <button className="primary-button" disabled={!transcriptWorkspace.transcriptText.trim() || transcriptAssigning} onClick={() => void assignTranscriptToSpeakers()} type="button">
                        {transcriptAssigning ? '归人中...' : '归人'}
                      </button>
                      <button className="plain-button danger-button" disabled={!transcriptWorkspace.transcriptText.trim() || transcriptAssigning} onClick={() => void assignTranscriptToSpeakers(true)} type="button">
                        {transcriptAssigning ? '处理中...' : '强制归人'}
                      </button>
                    </div>
                  </div>
                  <textarea
                    className="transcript-textarea"
                    value={transcriptWorkspace.transcriptText}
                    onChange={(event) => updateTranscriptText(event.target.value)}
                    onPaste={handleTranscriptPaste}
                    placeholder="脚本格式示例：07:29:13 狮子：好，我今天的一句话是... 也可以在这里直接粘贴已整理好的整场转写。"
                  />
                </>
              )}
            </section>

            <section className="workspace">
              <aside className="speaker-list" aria-label="发言人列表">
                <div className="panel-heading">
                  <h2>发言人</h2>
                  <button className="icon-button" onClick={addSpeaker} title="新增发言人">
                    +
                  </button>
                </div>

                <div className="speaker-items">
                  {session.speakers.map((speaker, index) => {
                    const speakerAnalyzing = analyzingSpeakerIds.includes(speaker.id);
                    return (
                      <div
                        key={speaker.id}
                        className={`speaker-item ${speaker.id === currentSpeaker?.id ? 'active' : ''}`}
                      >
                        <button className="speaker-select" onClick={() => setSelectedSpeakerId(speaker.id)}>
                          <span className="speaker-name">{speaker.name}</span>
                          <span className={`status-badge ${speakerAnalyzing ? 'status-analyzing' : `status-${speaker.status}`}`}>
                            {speakerAnalyzing ? '观察中' : statusLabels[speaker.status]}
                          </span>
                          <span className="speaker-stats">{speaker.snippets.length} 段内容</span>
                        </button>
                        <div className="speaker-order">
                          <button title="上移" disabled={index === 0} onClick={() => moveSpeaker(speaker.id, -1)}>
                            ↑
                          </button>
                          <button title="下移" disabled={index === session.speakers.length - 1} onClick={() => moveSpeaker(speaker.id, 1)}>
                            ↓
                          </button>
                          <button title="删除发言人" disabled={session.speakers.length <= 1} onClick={() => deleteSpeaker(speaker.id)}>
                            ×
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </aside>

              <section className="content-panel" aria-label="当前发言人内容">
                <div className="panel-heading split">
                  <div>
                    <label className="speaker-name-field">
                      <span>发言人名称（可手动修改）</span>
                      <input
                        className="speaker-title-input"
                        value={currentSpeaker?.name || ''}
                        placeholder="输入发言人姓名"
                        onChange={(event) => currentSpeaker && renameSpeaker(currentSpeaker.id, event.target.value)}
                      />
                    </label>
                    <p>可以多次粘贴，系统会按此人的全部内容做观察。桌面版可用 Cmd+Shift+V 直接加入当前发言人。</p>
                  </div>
                  <button className="primary-button" onClick={pasteFromClipboard}>
                    粘贴剪贴板
                  </button>
                </div>

                <div className="paste-box">
                  <div className="paste-toolbar">
                    <label>
                      来源
                      <select value={sourceType} onChange={(event) => setSourceType(event.target.value as SourceType)}>
                        {Object.entries(sourceLabels).filter(([value]) => value !== 'image_upload').map(([value, label]) => (
                          <option key={value} value={value}>
                            {label}
                          </option>
                        ))}
                      </select>
                    </label>
                    <div className="paste-actions">
                      <input
                        ref={imageInputRef}
                        type="file"
                        accept="image/*"
                        multiple
                        onChange={(event) => void uploadImages(event.target.files)}
                      />
                      <button className="plain-button" disabled={busy === 'image'} onClick={() => imageInputRef.current?.click()}>
                        {busy === 'image' ? '上传中...' : '上传图片'}
                      </button>
                      <button className="plain-button" disabled={busy === 'image'} onClick={() => void pasteImageFromClipboard()}>
                        粘贴截图
                      </button>
                      <button className="plain-button" onClick={() => appendSnippet(draftText, sourceType)}>
                        加入当前发言人
                      </button>
                    </div>
                  </div>
                  <div className="textarea-label-row paste-textarea-head">
                    <span>当前输入</span>
                    <TextCount value={draftText} />
                  </div>
                  <textarea
                    value={draftText}
                    onChange={(event) => setDraftText(event.target.value)}
                    onPaste={handleDraftPaste}
                    placeholder="粘贴腾讯会议转写、截图，或你的现场速记..."
                  />
                </div>

                <section className="polished-content-box">
                  <div className="subheading">
                    <div>
                      <div className="textarea-label-row heading-count-row">
                        <h3>整理后的发言内容</h3>
                        <TextCount value={currentSpeaker?.polishedContent || ''} />
                      </div>
                      <p>一键拼接当前发言人的全部 OCR / 转写片段，并顺成一段可观察的原始发言。</p>
                    </div>
                    <div className="polished-actions">
                      <button className="plain-button" disabled={!currentSpeaker || currentSpeaker.snippets.length === 0 || currentSpeakerPolishing} onClick={() => void polishSpeakerContent(currentSpeaker?.id)}>
                        {currentSpeakerPolishing ? '整理中...' : '整理发言内容'}
                      </button>
                      <button className="plain-button" disabled={!currentSpeaker?.polishedContent?.trim()} onClick={() => currentSpeaker?.polishedContent && void copyText(currentSpeaker.polishedContent, '整理后的发言内容')}>
                        复制
                      </button>
                    </div>
                  </div>
                  <textarea
                    value={currentSpeaker?.polishedContent || ''}
                    onChange={(event) => updatePolishedContent(event.target.value)}
                    placeholder="点击“整理发言内容”后，会把这个人的所有 OCR / 转写片段拼接并顺成一段。你也可以在这里手动修改；后续观察书友分享和全场观察会优先使用这段内容。"
                  />
                  {currentSpeaker?.polishedAt ? <p className="polished-meta">上次整理：{nowLabel(currentSpeaker.polishedAt)}</p> : null}
                </section>

                <div className="snippet-list">
                  <div className="subheading">
                    <h3>内容片段</h3>
                    <button className="analysis-button" disabled={currentSpeakerAnalyzing} onClick={() => void analyzeSpeaker(currentSpeaker?.id)}>
                      {currentSpeakerAnalyzing ? '观察中...' : '观察书友分享'}
                    </button>
                  </div>

                  <KnowledgeUsePanel
                    title={currentSpeaker?.insight ? '本次已带入的知识素材' : '观察书友分享时会带入'}
                    entries={currentSpeaker?.insight ? currentSpeakerUsedKnowledge : currentSpeakerKnowledgePreview}
                    pinnedIds={pinnedKnowledgeIds}
                    emptyText="还没有匹配到知识素材。可以在“我的知识库”里勾选本次必用案例。"
                  />

                  {!currentSpeaker || currentSpeaker.snippets.length === 0 ? (
                    <div className="empty-state">还没有内容。现场可以先粘速记，后面再补完整转写。</div>
                  ) : (
                    currentSpeaker.snippets.map((snippet) => (
                      <article key={snippet.id} className="snippet-item">
                        <div className="snippet-meta">
                          <span>{sourceLabels[snippet.sourceType]}</span>
                          {snippet.fileName ? <span>{snippet.fileName}</span> : null}
                          <span>{nowLabel(snippet.createdAt)}</span>
                          <button onClick={() => deleteSnippet(snippet.id)}>删除</button>
                        </div>
                        {snippet.imageDataUrl ? (
                          <div className="snippet-image-box">
                            <img className="snippet-image" src={snippet.imageDataUrl} alt={snippet.fileName || '上传图片'} />
                            <button className="plain-button" onClick={() => void copyImageDataUrl(snippet.imageDataUrl || '', snippet.fileName || 'OCR 截图')} type="button">
                              复制图片
                            </button>
                          </div>
                        ) : snippet.sourceType === 'ocr_text' || snippet.sourceType === 'image_upload' ? (
                          <div className="snippet-image-missing">这条旧 OCR 片段没有保存原图；后续新粘贴或上传的截图会在这里显示。</div>
                        ) : null}
                        <p>{compactText(snippetDisplayText(snippet), 260)}</p>
                      </article>
                    ))
                  )}
                </div>
              </section>

              <aside className="response-panel" aria-label="现场回应">
                <div className="panel-heading">
                  <h2>现场回应</h2>
                  <button className="plain-button" onClick={markResponded} disabled={!currentSpeaker?.insight}>
                    标记已回应
                  </button>
                </div>

                {!currentSpeaker?.insight ? (
                  <div className="empty-state">观察当前书友分享后，这里会出现回应入口。</div>
                ) : (
                  <InsightView insight={currentSpeaker.insight} onCopy={copyText} />
                )}

                {currentSpeaker?.insight ? (
                  <section className="actual-response">
                    <div className="textarea-label-row heading-count-row">
                      <h3>我的实际回应</h3>
                      <TextCount value={currentSpeaker.actualResponse || ''} />
                    </div>
                    <textarea
                      value={currentSpeaker.actualResponse || ''}
                      onChange={(event) => updateActualResponse(event.target.value)}
                      placeholder="会后补上你现场实际说了什么，方便复盘沉淀..."
                    />
                  </section>
                ) : null}
              </aside>
            </section>
          </>
        )}
      </section>

      <section className="summary-panel">
        <div className="panel-heading split">
          <div>
            <h2>全场统一观察</h2>
            <p>一次生成三套模板，后面再按你的要求新增优化版。</p>
          </div>
          <div className="summary-heading-controls">
            <div className="template-toggle" role="group" aria-label="全场观察输出模板">
              {summaryTemplateOptions.map((option) => {
                let label = option.label;
                if (option.value === 'auto' && summaryTemplateMode === 'auto') {
                  if (primarySummaryVersion?.summary.templateDecision?.templateName) {
                    label = `${option.label}（首位：${primarySummaryVersion.summary.templateDecision.templateName}）`;
                  } else {
                    label = `${option.label}（预计：${predictedSummaryTemplateName}）`;
                  }
                }
                return (
                  <button
                    key={option.value}
                    className={summaryTemplateMode === option.value ? 'active' : ''}
                    onClick={() => setSummaryTemplateMode(option.value)}
                    type="button"
                  >
                    {label}
                  </button>
                );
              })}
            </div>
            <div className="summary-actions">
              <button className="plain-button" onClick={copyMarkdownReview}>
                复制复盘 Markdown
              </button>
              <button className="plain-button" onClick={downloadMarkdownReview}>
                下载 Markdown
              </button>
              <button className="primary-button" disabled={busy === 'summary' || busy === 'summary-refine'} onClick={summarizeSession}>
                {busy === 'summary' ? '输出中...' : summaryOutputButtonLabel}
              </button>
              <button className="plain-button" disabled={busy === 'transcript-summary' || !transcriptWorkspace.transcriptText.trim()} onClick={() => void tryTranscriptSummary()} type="button">
                {busy === 'transcript-summary' ? '融合中...' : '融合成分享稿'}
              </button>
              <button className="plain-button" disabled={busy === 'transcript-encouragement' || !transcriptWorkspace.transcriptText.trim()} onClick={() => void createWholeSessionEncouragement()} type="button">
                {busy === 'transcript-encouragement' ? '鼓励中...' : '全场鼓励'}
              </button>
            </div>
          </div>
        </div>

        <section className="summary-requirement">
          <div>
            <h3>我的优化要求</h3>
            <p>可以写基于哪一版调整；每次点击都会新增一版。</p>
          </div>
          <div className="textarea-with-count">
            <div className="textarea-label-row">
              <span>优化要求内容</span>
              <TextCount value={summaryRequirement} />
            </div>
            <textarea
              value={summaryRequirement}
              onChange={(event) => setSummaryRequirement(event.target.value)}
              placeholder="例如：基于共振型改得更像我自己；多结合破产经历但不要比较苦难；重点回应张敏；减少概念，增加现场口播感。"
            />
          </div>
          <button className="primary-button" disabled={busy === 'summary' || busy === 'summary-refine' || summaryVersions.length === 0} onClick={refineSessionSummary}>
            {busy === 'summary-refine' ? '优化中...' : '新增优化版'}
          </button>
        </section>

        <KnowledgeUsePanel
          title={summaryVersions.length > 0 ? '全场观察已带入的知识素材' : '输出全场观察时会带入'}
          entries={summaryVersions.length > 0 ? summaryUsedKnowledge : summaryKnowledgePreview}
          pinnedIds={pinnedKnowledgeIds}
          emptyText="还没有匹配到知识素材。可以先在知识库里勾选本次必用案例。"
          defaultCollapsed
          excludedCount={excludedSummaryKnowledgeIds.length}
          onRemove={removeSummaryKnowledge}
          removeLabel="移除本次"
        />

        {summaryVersions.length > 0 ? (
          <section className="summary-version-list">
            {summaryVersions.map((version) => (
              <SummaryVersionCard
                key={version.id}
                version={version}
                onCopy={copyText}
                onToggle={() => toggleSummaryVersion(version.id)}
                onDelete={() => deleteSummaryVersion(version.id)}
                onAppendToFinal={() => appendVersionToFinalSpeech(version.id)}
                onAppendSectionToFinal={appendSectionToFinalSpeech}
              />
            ))}
          </section>
        ) : (
          <div className="empty-state">等至少一位书友被观察后输出全场草稿。</div>
        )}

        <FinalSpeechEditor
          value={session.finalSpeechDraft || ''}
          onChange={updateFinalSpeechDraft}
          onSave={saveFinalSpeechDraft}
          onCopy={copyFinalSpeechDraft}
          onClear={clearFinalSpeechDraft}
        />
      </section>

      {notice ? (
        <div className={`notice ${noticeType === 'error' ? 'notice-error' : ''}`}>
          <span>{notice}</span>
          {noticePersistent ? (
            <button className="notice-close" onClick={() => showNotice('')} type="button" aria-label="关闭提示">
              关闭
            </button>
          ) : null}
        </div>
      ) : null}

      {knowledgeOpen ? (
        <div className="modal-backdrop" role="dialog" aria-modal="true">
          <section className="settings-modal knowledge-modal">
            <div className="panel-heading split">
              <div>
                <h2>我的知识库</h2>
                <p>导入过去发言和真实经历，让回应更像你。知识只保存在本机浏览器。</p>
              </div>
              <button className="plain-button" onClick={() => setKnowledgeOpen(false)}>
                关闭
              </button>
            </div>

            <section className="knowledge-import">
              <div className="knowledge-import-fields">
                <input
                  value={knowledgeDraftTitle}
                  onChange={(event) => setKnowledgeDraftTitle(event.target.value)}
                  placeholder="素材标题，例如：第 8 天关于破产后的重新开始"
                />
                <div className="textarea-label-row">
                  <span>待提炼素材正文</span>
                  <TextCount value={knowledgeDraftText} />
                </div>
                <textarea
                  value={knowledgeDraftText}
                  onChange={(event) => {
                    setKnowledgeDraftText(event.target.value);
                    setKnowledgeDraftSources([]);
                  }}
                  placeholder="粘贴一篇过去晨读营发言，或一段关于破产、债务、重建、关系、亲子等经历的文字..."
                />
                <div className="knowledge-import-hint">
                  {knowledgeDraftSources.length > 0
                    ? `已导入 ${knowledgeDraftSources.length} 篇文档；会追加到现有知识库。短文 1-3 条，中等 3-6 条，长文/合集约每 6000 字一段、每段 5-10 条。`
                    : '粘贴大段文字也可以；系统会按内容长度决定提炼数量，长文会自动分段并追加保存。'}
                </div>
              </div>
              <div className="knowledge-import-actions">
                <input
                  ref={knowledgeFileRef}
                  type="file"
                  accept=".txt,.md,.docx,text/plain,text/markdown,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                  multiple
                  onChange={(event) => void importKnowledgeFiles(event.target.files)}
                />
                <button className="plain-button" disabled={busy === 'knowledge-file'} onClick={() => knowledgeFileRef.current?.click()}>
                  {busy === 'knowledge-file' ? '导入中...' : '上传文档'}
                </button>
                <button className="primary-button" disabled={busy === 'knowledge'} onClick={() => void extractKnowledgeFromDraft()}>
                  {busy === 'knowledge' ? '提炼中...' : '按内容提炼知识'}
                </button>
                {busy === 'knowledge' ? (
                  <button
                    className="plain-button danger-button"
                    onClick={() => {
                      knowledgeCancelRef.current = true;
                      setNotice('正在停止提炼，当前正在返回的请求结束后会停下。');
                    }}
                  >
                    停止提炼
                  </button>
                ) : null}
                <button
                  className="plain-button"
                  disabled={!knowledgeDraftText && knowledgeDraftSources.length === 0}
                  onClick={() => {
                    setKnowledgeDraftText('');
                    setKnowledgeDraftTitle('');
                    setKnowledgeDraftSources([]);
                    setNotice('导入区已清空，已保存的知识不会受影响。');
                  }}
                >
                  清空导入区
                </button>
                <button className="plain-button" onClick={createManualKnowledgeEntry}>
                  手动新增
                </button>
              </div>
            </section>

            <section className="knowledge-maintenance">
              <div>
                <h3>知识维护</h3>
                <p>导重了可以按来源删除；标题重复的条目可以合并，合并会保留更完整的内容。</p>
              </div>
              <select value={selectedKnowledgeSource} onChange={(event) => setSelectedKnowledgeSource(event.target.value)}>
                <option value="">选择来源</option>
                {knowledgeSourceOptions.map((option) => (
                  <option key={option.source} value={option.source}>
                    {option.source}（{option.count} 条）
                  </option>
                ))}
              </select>
              <button className="plain-button danger-button" disabled={!selectedKnowledgeSource} onClick={deleteKnowledgeBySource}>
                删除该来源
              </button>
              <button className="plain-button" disabled={knowledgeEntries.length < 2} onClick={mergeDuplicateKnowledgeEntries}>
                合并重复知识
              </button>
            </section>

            <section className="knowledge-manager">
              <aside className="knowledge-list">
                <div className="knowledge-list-head">
                  <strong>{knowledgeEntries.length} 条知识</strong>
                  <small>分析时自动匹配 3-8 条</small>
                </div>
                {knowledgeEntries.length === 0 ? (
                  <div className="empty-state">还没有知识。先粘贴一篇过去发言，或上传 txt、md、docx。</div>
                ) : (
                  knowledgeEntries.map((entry) => (
                    <div
                      key={entry.id}
                      className={`knowledge-item ${entry.id === selectedKnowledge?.id ? 'active' : ''}`}
                    >
                      <button className="knowledge-select-button" onClick={() => setSelectedKnowledgeId(entry.id)}>
                        <span>{entry.title}</span>
                        <small>{knowledgeTypeLabels[entry.type]} · {entry.tags.slice(0, 3).join('、') || '未打标签'}</small>
                      </button>
                      <label className="knowledge-pin">
                        <input
                          type="checkbox"
                          checked={pinnedKnowledgeIds.includes(entry.id)}
                          onChange={() => togglePinnedKnowledge(entry.id)}
                        />
                        本次必用
                      </label>
                    </div>
                  ))
                )}
              </aside>

              <section className="knowledge-editor">
                {!selectedKnowledge ? (
                  <div className="empty-state">选择一条知识后可以编辑。</div>
                ) : (
                  <>
                    <div className="knowledge-editor-grid">
                      <label className="field">
                        <span>标题</span>
                        <input
                          value={selectedKnowledge.title}
                          onChange={(event) => updateKnowledgeField(selectedKnowledge.id, 'title', event.target.value)}
                        />
                      </label>
                      <label className="field">
                        <span>类型</span>
                        <select
                          value={selectedKnowledge.type}
                          onChange={(event) => updateKnowledgeField(selectedKnowledge.id, 'type', event.target.value as KnowledgeType)}
                        >
                          {(Object.keys(knowledgeTypeLabels) as KnowledgeType[]).map((type) => (
                            <option key={type} value={type}>
                              {knowledgeTypeLabels[type]}
                            </option>
                          ))}
                        </select>
                      </label>
                    </div>

                    <label className="knowledge-editor-pin">
                      <input
                        type="checkbox"
                        checked={pinnedKnowledgeIds.includes(selectedKnowledge.id)}
                        onChange={() => togglePinnedKnowledge(selectedKnowledge.id)}
                      />
                      本场观察和全场观察优先使用这条案例
                    </label>

                    <label className="field">
                      <span>标签</span>
                      <input
                        value={joinListText(selectedKnowledge.tags)}
                        onChange={(event) => updateKnowledgeField(selectedKnowledge.id, 'tags', splitListText(event.target.value))}
                        placeholder="破产、身份绑定、羞耻感、重新开始"
                      />
                    </label>

                    <label className="field">
                      <div className="textarea-label-row">
                        <span>适合场景</span>
                        <TextCount value={selectedKnowledge.applicableScenes} />
                      </div>
                      <textarea
                        value={selectedKnowledge.applicableScenes}
                        onChange={(event) => updateKnowledgeField(selectedKnowledge.id, 'applicableScenes', event.target.value)}
                      />
                    </label>

                    <label className="field">
                      <div className="textarea-label-row">
                        <span>内容摘要</span>
                        <TextCount value={selectedKnowledge.summary} />
                      </div>
                      <textarea
                        value={selectedKnowledge.summary}
                        onChange={(event) => updateKnowledgeField(selectedKnowledge.id, 'summary', event.target.value)}
                      />
                    </label>

                    <label className="field">
                      <div className="textarea-label-row">
                        <span>可引用原话</span>
                        <TextCount value={selectedKnowledge.originalExcerpt} />
                      </div>
                      <textarea
                        value={selectedKnowledge.originalExcerpt}
                        onChange={(event) => updateKnowledgeField(selectedKnowledge.id, 'originalExcerpt', event.target.value)}
                      />
                    </label>

                    <label className="field">
                      <div className="textarea-label-row">
                        <span>可复用句子</span>
                        <TextCount value={selectedKnowledge.reusableLines.join('\n')} />
                      </div>
                      <textarea
                        value={selectedKnowledge.reusableLines.join('\n')}
                        onChange={(event) => updateKnowledgeField(selectedKnowledge.id, 'reusableLines', splitListText(event.target.value))}
                      />
                    </label>

                    <label className="field">
                      <div className="textarea-label-row">
                        <span>讲述边界</span>
                        <TextCount value={selectedKnowledge.speakingBoundary} />
                      </div>
                      <textarea
                        value={selectedKnowledge.speakingBoundary}
                        onChange={(event) => updateKnowledgeField(selectedKnowledge.id, 'speakingBoundary', event.target.value)}
                      />
                    </label>

                    <label className="field">
                      <span>不要展开</span>
                      <input
                        value={joinListText(selectedKnowledge.avoidDetails)}
                        onChange={(event) => updateKnowledgeField(selectedKnowledge.id, 'avoidDetails', splitListText(event.target.value))}
                        placeholder="具体金额、具体人名、责怪他人"
                      />
                    </label>

                    <div className="modal-actions">
                      <button className="plain-button danger-button" onClick={() => deleteKnowledgeEntry(selectedKnowledge.id)}>
                        删除条目
                      </button>
                    </div>
                  </>
                )}
              </section>
            </section>
          </section>
        </div>
      ) : null}

      {settingsOpen ? (
        <div className="modal-backdrop" role="dialog" aria-modal="true">
          <section className="settings-modal">
            <div className="panel-heading split">
              <div>
                <h2>AI 设置</h2>
                <p>API Key 保存在本机应用数据目录。留空会保留已有 Key。</p>
              </div>
              <button className="plain-button" onClick={() => setSettingsOpen(false)}>
                关闭
              </button>
            </div>
            <label className="field">
              <span>模型服务</span>
              <select value={providerInput} onChange={(event) => changeProvider(event.target.value as AIProvider)}>
                {(Object.keys(providerPresets) as AIProvider[]).map((provider) => (
                  <option key={provider} value={provider}>
                    {providerPresets[provider].label}
                  </option>
                ))}
              </select>
              <small>{providerPresets[providerInput].help}</small>
            </label>
            {providerInput === 'xiaomi_mimo' ? (
              <section className="mimo-plan-panel">
                <div className="mimo-plan-head">
                  <div>
                    <span className="mimo-kicker">Token Plan</span>
                    <h3>{xiaomiTokenPlan.title}</h3>
                  </div>
                  <button className="plain-button" onClick={applyXiaomiTokenPlan}>
                    套用配置
                  </button>
                </div>
                <div className="mimo-status-grid">
                  <div>
                    <span>API Key</span>
                    <strong>{settings.hasApiKey ? '已保存' : '未保存'}</strong>
                  </div>
                  <div>
                    <span>额度</span>
                    <strong>{xiaomiTokenPlan.quota}</strong>
                  </div>
                  <div>
                    <span>推荐模型</span>
                    <strong>{xiaomiTokenPlan.primaryModel}</strong>
                  </div>
                </div>
                <div className="mimo-url-list">
                  <div className="mimo-url-row">
                    <span>OpenAI Base URL</span>
                    <code>{xiaomiTokenPlan.openAIBaseUrl}</code>
                    <button onClick={() => void copyText(xiaomiTokenPlan.openAIBaseUrl, '小米 OpenAI Base URL')}>复制</button>
                  </div>
                  <div className="mimo-url-row muted">
                    <span>Anthropic Base URL</span>
                    <code>{xiaomiTokenPlan.anthropicBaseUrl}</code>
                    <button onClick={() => void copyText(xiaomiTokenPlan.anthropicBaseUrl, '小米 Anthropic Base URL')}>复制</button>
                  </div>
                </div>
                <div className="mimo-model-list">
                  {xiaomiTokenPlan.models.map((model) => (
                    <button key={model} className={modelInput === model ? 'active' : ''} onClick={() => setModelInput(model)}>
                      {model}
                    </button>
                  ))}
                </div>
              </section>
            ) : null}
            <label className="field">
              <span>{providerPresets[providerInput].keyLabel}</span>
              <input
                type="password"
                value={apiKeyInput}
                placeholder={settings.hasApiKey ? '已保存，留空不变' : providerInput === 'xiaomi_mimo' ? '粘贴小米平台的 API Key' : 'sk-...'}
                onChange={(event) => setApiKeyInput(event.target.value)}
              />
              <small>切换模型服务时，请粘贴对应平台的 Key；留空会保留当前已保存的 Key。</small>
            </label>
            {providerInput !== 'openai_responses' ? (
              <label className="field">
                <span>Base URL</span>
                <input value={baseUrlInput} onChange={(event) => setBaseUrlInput(event.target.value)} />
              </label>
            ) : null}
            <label className="field">
              <span>模型</span>
              <input value={modelInput} onChange={(event) => setModelInput(event.target.value)} />
            </label>
            <button className="primary-button full-width" onClick={saveSettings}>
              保存设置
            </button>
          </section>
        </div>
      ) : null}

      {courseChangeOpen ? (
        <div className="modal-backdrop" role="dialog" aria-modal="true">
          <section className="settings-modal course-change-modal">
            <div className="panel-heading split">
              <div>
                <h2>更换本场课程</h2>
                <p>用于选错课程时迁移当前这场观察。原始内容保留，旧课程生成的观察会清空。</p>
              </div>
              <button className="plain-button" onClick={() => setCourseChangeOpen(false)}>
                关闭
              </button>
            </div>

            <label className="field">
              <span>当前课程</span>
              <input value={selectedTheme.name} readOnly />
            </label>

            <label className="field">
              <span>更换为</span>
              <select value={courseChangeTarget} onChange={(event) => setCourseChangeTarget(event.target.value)}>
                {themes.map((theme) => (
                  <option key={theme.id} value={theme.id}>
                    {theme.name}
                  </option>
                ))}
              </select>
              <small>更换后，发言人和内容片段会留在当前这场观察里，但需要重新生成单人洞察和全场观察。</small>
            </label>

            <div className="modal-actions">
              <button className="plain-button" onClick={() => setCourseChangeOpen(false)}>
                取消
              </button>
              <button className="primary-button" disabled={courseChangeTarget === session.themeId} onClick={migrateCurrentSessionCourse}>
                确认更换
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </main>
  );
}

function InsightView({ insight, onCopy }: { insight: SpeakerInsight; onCopy: (text: string, label: string) => void }) {
  return (
    <div className="insight-stack">
      <KeyValue title="最值得抓的点" body={insight.strongestPoint} />
      <KeyValue title="背后的本质" body={insight.underlyingPattern} />
      <KeyValue title="课程连接" body={insight.themeConnection} />
      <KeyValue title="看到的问题" body={insight.stuckType} />
      <KeyValue title="需要被看见" body={insight.seenNeed} />
      <KeyValue title="适合关联的经历" body={`${insight.suggestedObserverStory}\n${insight.storyUseBoundary}`} />

      <ResponseBlock title="1 分钟回应" body={insight.oneMinuteResponse} onCopy={() => onCopy(insight.oneMinuteResponse, '1 分钟回应')} />
      <ResponseBlock title="深度回应" body={insight.deepResponse} onCopy={() => onCopy(insight.deepResponse, '深度回应')} />
      <ResponseBlock title="有力量的追问" body={insight.powerfulQuestion} onCopy={() => onCopy(insight.powerfulQuestion, '追问')} />

      <div className="warning-box">
        <h3>不要说</h3>
        <ul>
          {insight.doNotSay.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function SummaryVersionCard({
  version,
  onCopy,
  onToggle,
  onDelete,
  onAppendToFinal,
  onAppendSectionToFinal,
}: {
  version: SummaryVersion;
  onCopy: (text: string, label: string) => void;
  onToggle: () => void;
  onDelete: () => void;
  onAppendToFinal: () => void;
  onAppendSectionToFinal: (title: string, body: string) => void;
}) {
  const templateName = version.summary.templateDecision?.templateName || summaryTemplateNames[version.templateMode];
  return (
    <article className={`summary-version ${version.collapsed ? 'collapsed' : ''}`}>
      <div className="summary-version-head">
        <div>
          <div className="summary-version-kicker">
            <span>{version.source === 'refined' ? '优化输出' : '模板输出'}</span>
            <small>{nowLabel(version.createdAt)}</small>
          </div>
          <h3>{version.label}</h3>
          <p>
            {templateName}
            {version.requirement ? ` · ${version.requirement}` : ''}
          </p>
        </div>
        <div className="summary-version-actions">
          <button className="plain-button" onClick={onToggle} type="button">
            {version.collapsed ? '展开' : '收起'}
          </button>
          <button className="plain-button" onClick={() => onCopy(summaryToShareText(version.summary), version.label)} type="button">
            复制
          </button>
          <button className="plain-button" onClick={onAppendToFinal} type="button">
            放入最终发言
          </button>
          <button className="plain-button danger-button" onClick={onDelete} type="button">
            删除
          </button>
        </div>
      </div>
      {version.collapsed ? null : <SummaryView summary={version.summary} onCopy={onCopy} onAppendSectionToFinal={onAppendSectionToFinal} />}
    </article>
  );
}

function FinalSpeechEditor({
  value,
  onChange,
  onSave,
  onCopy,
  onClear,
}: {
  value: string;
  onChange: (value: string) => void;
  onSave: () => void;
  onCopy: () => void;
  onClear: () => void;
}) {
  const editorRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const editor = editorRef.current;
    if (editor && editor.innerHTML !== value) {
      editor.innerHTML = value;
    }
  }, [value]);

  function emitChange() {
    onChange(editorRef.current?.innerHTML || '');
  }

  function runCommand(command: string, commandValue?: string) {
    editorRef.current?.focus();
    document.execCommand(command, false, commandValue);
    emitChange();
  }

  return (
    <section className="final-speech-panel">
      <div className="panel-heading split">
        <div>
          <h2>本次最后的发言</h2>
          <p>把上面的版本放进来后，在这里改成你最终要说的话。</p>
        </div>
        <div className="summary-actions">
          <button className="plain-button" onClick={onCopy} type="button">
            复制最终发言
          </button>
          <button className="plain-button" onClick={onClear} type="button">
            清空
          </button>
          <button className="primary-button" onClick={onSave} type="button">
            保存最终发言
          </button>
        </div>
      </div>
      <div className="final-editor-toolbar" aria-label="最终发言编辑工具">
        <button type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => runCommand('formatBlock', 'h3')}>
          标题
        </button>
        <button type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => runCommand('formatBlock', 'p')}>
          正文
        </button>
        <button type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => runCommand('bold')}>
          加粗
        </button>
        <button type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => runCommand('insertUnorderedList')}>
          列表
        </button>
        <button type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => runCommand('formatBlock', 'blockquote')}>
          引用
        </button>
      </div>
      <div className="textarea-label-row final-editor-count-row">
        <span>最终发言正文</span>
        <TextCount value={htmlToPlainText(value || '')} />
      </div>
      <div
        ref={editorRef}
        className="final-speech-editor"
        contentEditable
        data-placeholder="把你选中的版本放进来，或直接粘贴你想说的内容..."
        onInput={emitChange}
        onBlur={emitChange}
        suppressContentEditableWarning
      />
    </section>
  );
}

function SectionActionButtons({
  title,
  body,
  onCopy,
  onAppendSectionToFinal,
}: {
  title: string;
  body: string;
  onCopy: (text: string, label: string) => void;
  onAppendSectionToFinal: (title: string, body: string) => void;
}) {
  return (
    <div className="section-actions">
      <button className="plain-button" onClick={() => onCopy(summarySectionToText(title, body), title)} type="button">
        复制
      </button>
      <button className="plain-button" onClick={() => onAppendSectionToFinal(title, body)} type="button">
        插入正文
      </button>
    </div>
  );
}

function SummaryView({
  summary,
  onCopy,
  onAppendSectionToFinal,
}: {
  summary: WholeSessionSummary;
  onCopy: (text: string, label: string) => void;
  onAppendSectionToFinal: (title: string, body: string) => void;
}) {
  const structuredSections = getSummaryStructuredSections(summary);
  const hasTemplateSections = Boolean(summary.structuredSections && summary.structuredSections.length > 0);
  const copyPayload = summaryToShareText(summary);

  return (
    <div className="summary-grid">
      <section className="template-decision-card">
        <div>
          <span>本场推荐模板</span>
          <h3>{summary.templateDecision?.templateName || (hasTemplateSections ? '模板化输出' : '旧版结构')}</h3>
          <p>{summary.templateDecision?.reason || '这是一条历史全场观察，重新输出后会自动判断共振型、结构型或融合型。'}</p>
          {summary.templateDecision?.sceneSignals?.length ? (
            <div className="template-signals">
              {summary.templateDecision.sceneSignals.map((signal) => (
                <small key={signal}>{signal}</small>
              ))}
            </div>
          ) : null}
        </div>
      </section>

      {hasTemplateSections ? (
        structuredSections.map((section) => (
          <article key={`${section.key}-${section.title}`} className="summary-section-card">
            <div className="summary-section-head">
              <h3>{section.title}</h3>
              <SectionActionButtons title={section.title} body={section.body} onCopy={onCopy} onAppendSectionToFinal={onAppendSectionToFinal} />
            </div>
            <p>{section.body}</p>
          </article>
        ))
      ) : (
        <>
          <KeyValue title="课程主题" body={summary.courseTheme || '等待重新输出全场观察'} onCopy={onCopy} onAppendSectionToFinal={onAppendSectionToFinal} />
          <KeyValue title="共同主题" body={summary.commonTheme} onCopy={onCopy} onAppendSectionToFinal={onAppendSectionToFinal} />
          <div className="summary-lessons">
            <div className="summary-section-head">
              <h3>每人的问题线索</h3>
              <SectionActionButtons
                title="每人的问题线索"
                body={
                  summary.speakerLessons.length === 0
                    ? '还没有已观察的发言人。'
                    : summary.speakerLessons.map((item) => `${item.speakerName}：${item.lesson}`).join('\n')
                }
                onCopy={onCopy}
                onAppendSectionToFinal={onAppendSectionToFinal}
              />
            </div>
            {summary.speakerLessons.length === 0 ? (
              <p>还没有已观察的发言人。</p>
            ) : (
              summary.speakerLessons.map((item) => (
                <p key={item.speakerName}>
                  <strong>{item.speakerName}</strong>：{item.lesson}
                </p>
              ))
            )}
          </div>
          <KeyValue title="重点回应" body={summary.keyResponse || '等待重新输出全场观察'} onCopy={onCopy} onAppendSectionToFinal={onAppendSectionToFinal} />
        </>
      )}

      {!hasTemplateSections && structuredSections.length > 0 ? (
        <section className="sharing-sections">
          <div className="response-title">
            <h3>历史分享内容</h3>
            <button onClick={() => onCopy(copyPayload, '全场观察')}>复制</button>
          </div>
          <div className="sharing-section-list">
            {structuredSections.map((section) => (
              <article key={section.title} className="sharing-section-item">
                <div className="summary-section-head">
                  <h4>{section.title}</h4>
                  <SectionActionButtons title={section.title} body={section.body} onCopy={onCopy} onAppendSectionToFinal={onAppendSectionToFinal} />
                </div>
                <p>{section.body}</p>
              </article>
            ))}
          </div>
        </section>
      ) : null}
      {(summary.oneSentenceSummaries || []).length > 0 ? (
        <div className="summary-lessons">
          <div className="summary-section-head">
            <h3>一句话总结</h3>
            <SectionActionButtons
              title="一句话总结"
              body={(summary.oneSentenceSummaries || []).join('\n')}
              onCopy={onCopy}
              onAppendSectionToFinal={onAppendSectionToFinal}
            />
          </div>
          {(summary.oneSentenceSummaries || []).map((sentence) => (
            <p key={sentence}>{sentence}</p>
          ))}
        </div>
      ) : null}
      {summary.missingSpeakers.length > 0 ? <div className="missing-warning">未观察：{summary.missingSpeakers.join('、')}</div> : null}
    </div>
  );
}

function KnowledgeUsePanel({
  title,
  entries,
  pinnedIds,
  emptyText,
  defaultCollapsed = false,
  excludedCount = 0,
  onRemove,
  removeLabel = '移除',
}: {
  title: string;
  entries: KnowledgeEntry[];
  pinnedIds: string[];
  emptyText: string;
  defaultCollapsed?: boolean;
  excludedCount?: number;
  onRemove?: (entryId: string) => void;
  removeLabel?: string;
}) {
  const [collapsed, setCollapsed] = useState(defaultCollapsed);

  return (
    <section className="knowledge-use-panel">
      <div className="knowledge-use-head">
        <button className="knowledge-use-toggle" onClick={() => setCollapsed((current) => !current)} type="button">
          <span>{collapsed ? '展开' : '收起'}</span>
          <h3>{title}</h3>
        </button>
        <small>
          {entries.length > 0 ? `${entries.length} 条` : '未匹配'}
          {excludedCount > 0 ? ` · 已排除 ${excludedCount} 条` : ''}
        </small>
      </div>
      {collapsed ? null : entries.length === 0 ? (
        <p className="knowledge-use-empty">{emptyText}</p>
      ) : (
        <div className="knowledge-use-list">
          {entries.map((entry) => (
            <article key={entry.id} className="knowledge-use-item">
              <div className="knowledge-use-item-head">
                <div>
                  <strong>{entry.title}</strong>
                  <small>
                    {pinnedIds.includes(entry.id) ? '本次必用 · ' : ''}
                    {entry.tags.slice(0, 4).join('、') || knowledgeTypeLabels[entry.type]}
                  </small>
                </div>
                {onRemove ? (
                  <button className="plain-button knowledge-use-remove" onClick={() => onRemove(entry.id)} type="button">
                    {removeLabel}
                  </button>
                ) : null}
              </div>
              <p>{compactText(entry.summary || entry.applicableScenes || entry.originalExcerpt, 110)}</p>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

function KeyValue({
  title,
  body,
  onCopy,
  onAppendSectionToFinal,
}: {
  title: string;
  body: string;
  onCopy?: (text: string, label: string) => void;
  onAppendSectionToFinal?: (title: string, body: string) => void;
}) {
  return (
    <section className="kv-block">
      <div className="summary-section-head">
        <h3>{title}</h3>
        {onCopy && onAppendSectionToFinal ? (
          <SectionActionButtons title={title} body={body} onCopy={onCopy} onAppendSectionToFinal={onAppendSectionToFinal} />
        ) : null}
      </div>
      <p>{body}</p>
    </section>
  );
}

function ResponseBlock({ title, body, onCopy }: { title: string; body: string; onCopy: () => void }) {
  return (
    <section className="response-block">
      <div className="response-title">
        <h3>{title}</h3>
        <button onClick={onCopy}>复制</button>
      </div>
      <p>{body}</p>
    </section>
  );
}
