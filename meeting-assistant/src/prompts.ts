import type { ObserverSession, SpeakerCard, SpeakerInsight, Theme, WholeSessionSummary } from './types';

export const speakerInsightSchema = {
  name: 'speaker_insight',
  schema: {
    type: 'object',
    additionalProperties: false,
    required: [
      'strongestPoint',
      'underlyingPattern',
      'themeConnection',
      'stuckType',
      'seenNeed',
      'suggestedObserverStory',
      'storyUseBoundary',
      'twentySecondResponse',
      'oneMinuteResponse',
      'deepResponse',
      'powerfulQuestion',
      'goldenSentence',
      'doNotSay',
    ],
    properties: {
      strongestPoint: { type: 'string' },
      underlyingPattern: { type: 'string' },
      themeConnection: { type: 'string' },
      stuckType: { type: 'string' },
      seenNeed: { type: 'string' },
      suggestedObserverStory: { type: 'string' },
      storyUseBoundary: { type: 'string' },
      twentySecondResponse: { type: 'string' },
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
    required: ['commonTheme', 'speakerLessons', 'unifiedResponseAngle', 'finalSummary', 'goldenSentences', 'closingSentence', 'missingSpeakers'],
    properties: {
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
      unifiedResponseAngle: { type: 'string' },
      finalSummary: { type: 'string' },
      goldenSentences: {
        type: 'array',
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

export function buildSpeakerPrompt(session: ObserverSession, theme: Theme, speaker: SpeakerCard) {
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
      '你是晨读营观察者副驾驶。你帮助观察者在现场快速看见发言人背后的真实卡点，并生成真诚、克制、具体、口语化的回应。不要心理诊断，不要审判，不要鸡汤，不要把观察者的经历压过发言人。如果输入里包含图片，请先识别图片中的会议转写、字幕、聊天或截图文字，再和文本片段一起分析。',
    input: JSON.stringify(
      {
        本期主题: theme,
        观察者立场: session.observerStance,
        个人故事库: session.stories,
        发言人: speaker.name,
        发言内容片段: speaker.snippets.map((snippet, index) => ({
          id: snippet.id,
          sourceType: snippet.sourceType,
          text: snippet.text,
          createdAt: snippet.createdAt,
          imageRef: snippet.imageDataUrl ? `图片 ${index + 1}` : undefined,
          fileName: snippet.fileName,
        })),
        输出要求: [
          '抓一个最值得回应的点',
          '如果有图片，先从图片中提取和理解可见文字',
          '说清背后的本质，不要泛泛而谈',
          '必须连接本期主题',
          '判断卡点分类',
          '推荐观察者可关联的经历和边界',
          '生成 20 秒、1 分钟、深度回应和追问',
          '必须生成不要说的话',
        ],
      },
      null,
      2
    ),
    schema: speakerInsightSchema,
    images,
  };
}

export function buildSessionPrompt(session: ObserverSession, theme: Theme) {
  return {
    instructions:
      '你是晨读营观察者副驾驶。你帮助观察者把多位发言人的分享合并成全场洞察。输出要有共同主题、每个人的生命课题、与本期主题的关系、观察者统一回应角度和最后收束。',
    input: JSON.stringify(
      {
        本期主题: theme,
        观察者立场: session.observerStance,
        发言人卡片: session.speakers.map((speaker) => ({
          name: speaker.name,
          status: speaker.status,
          snippets: speaker.snippets.map((snippet) => ({
            sourceType: snippet.sourceType,
            text: snippet.text,
            createdAt: snippet.createdAt,
            fileName: snippet.fileName,
            hasImage: Boolean(snippet.imageDataUrl),
          })),
          insight: speaker.insight,
          actualResponse: speaker.actualResponse,
        })),
      },
      null,
      2
    ),
    schema: wholeSessionSchema,
  };
}

export function createLocalSpeakerInsight(speaker: SpeakerCard, theme: Theme): SpeakerInsight {
  const text = speaker.snippets
    .map((snippet) => snippet.text || (snippet.imageDataUrl ? `已上传图片：${snippet.fileName || '截图'}` : ''))
    .join('\n')
    .trim();
  const firstLine = text.split(/[。！？\n]/).find(Boolean)?.trim() || '他这段分享里有一个还没有被真正接住的点';
  return {
    strongestPoint: firstLine,
    underlyingPattern: `这更像是在面对“${theme.name}”时，仍被现实压力牵着走，还没有完全看见自己可选择的回应方式。`,
    themeConnection: `可从“${theme.core}”切入，不急着给方法，先帮他把关注圈和影响圈分开。`,
    stuckType: '关注圈陷阱 / 身份绑定',
    seenNeed: '他需要先被看见的是：痛苦不是软弱，卡住也不代表他没有能力，只是此刻还没找到能重新站稳的入口。',
    suggestedObserverStory: '公司破产',
    storyUseBoundary: '可以讲你如何没有把事情失败等同于自己失败，但不要比较谁更惨，也不要展开太多债务细节。',
    twentySecondResponse: `我听到你刚才有一点很重：${firstLine}。我感觉这里不只是事情难，而是你在努力把自己从这件事里重新放稳。`,
    oneMinuteResponse: `我听到你刚才最打动我的点是：${firstLine}。如果放到今天“${theme.name}”这个主题里，我会觉得这不是简单要你更积极一点，而是先看见：哪些确实已经发生，哪些仍然在你的影响圈里。我自己经历公司破产时，也有很长一段时间会把事情的失败等同于自己的失败。后来我慢慢发现，真正让我重新站起来的，不是马上解决所有问题，而是先承认现实，然后抓住一个我还能选择的回应。`,
    deepResponse: `这段分享里，我会抓住“${firstLine}”。它背后像是在说：现实已经很重，但更重的是人会把现实的压力变成对自己的判断。今天的主题如果是“${theme.name}”，我不想把它讲成一句“你要积极主动”，那样太轻了。我更想说，积极主动有时候只是一个很小的动作：先把已经发生的事情和“我这个人是谁”分开，再从混乱里找到一个自己还能负责的小部分。我经历破产时，最难的也是这个分开。`,
    powerfulQuestion: '如果不急着解决全部问题，你现在最能拿回来的一个小选择是什么？',
    goldenSentence: '真正的积极主动，不是把所有痛苦扛住，而是在痛苦里重新看见自己还可以怎样回应。',
    doNotSay: ['你应该积极主动一点', '我当年比你还惨', '这都是因果', '你就是还没放下', '你要感谢苦难'],
    generatedBy: 'local',
  };
}

export function createLocalWholeSummary(session: ObserverSession, theme: Theme): WholeSessionSummary {
  const analyzed = session.speakers.filter((speaker) => speaker.insight);
  const missing = session.speakers.filter((speaker) => speaker.snippets.length > 0 && !speaker.insight).map((speaker) => speaker.name);

  return {
    commonTheme: `大家都在围绕“${theme.name}”面对一个共同问题：现实很重，但仍然要找到自己还可以选择的回应。`,
    speakerLessons: analyzed.map((speaker) => ({
      speakerName: speaker.name,
      lesson: speaker.insight?.underlyingPattern || '还需要进一步分析',
      themeConnection: speaker.insight?.themeConnection || theme.core,
    })),
    unifiedResponseAngle: '从破产重建经验出发，不讲方法优越感，而是讲如何在最硬的现实里一点点拿回影响圈。',
    finalSummary: `今天我听到的共同底色，是大家都在面对某种现实压力。放到“${theme.name}”里，我不想把它收束成一句轻飘飘的鼓励。更真实的是：我们每个人都会被事情压住，也会在某些时刻把事情的失败等同于自己的失败。观察者能做的，是帮大家把现实、感受和选择重新分开。现实可能暂时改不了，但回应方式可以一点点拿回来。`,
    goldenSentences: [
      '痛苦需要先被看见，然后才谈得上选择。',
      '积极主动不是硬扛，而是重新找到自己的影响圈。',
      '事情失败，不等于人失败。',
      '回应不是给答案，而是帮对方看见自己。',
      '真正的收束，是让每个人带走一个可以行动的小选择。',
    ],
    closingSentence: '愿我们都能在还没完全解决的现实里，先拿回一点点可以选择的自己。',
    missingSpeakers: missing,
    generatedBy: 'local',
  };
}
