import type { KnowledgeEntry, ObserverSession, SpeakerCard, SpeakerInsight, SummaryTemplateMode, Theme, WholeSessionSummary } from './types';

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
      title: '几位发言人的生命课题',
      prompt: '逐个回应发言人。每个人只抓一个最值得被看见的点：他/她正在承受什么、渴望什么、哪里已经开始有力量。避免贴标签，避免说教。',
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
      title: '每人课题',
      prompt: '每位发言人对应一个清晰课题，用“某某今天呈现的是……”的方式表达。要具体，不要泛泛而谈。',
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
      prompt: '再像金玲一样提炼结构。指出全场共同暗线是什么，例如失控感、自责、选择权、关系卡点、重新承担。',
    },
    {
      key: 'course_connection',
      title: '课程连接',
      prompt: '把共同主题和当天课程连接起来。不要硬套课程词，要说明课程如何帮助我们重新理解这些分享。',
    },
    {
      key: 'speaker_lessons',
      title: '每人课题',
      prompt: '每个人一小段，既要有温度，也要有结构：先看见状态，再点出课题，再给一个温和方向。',
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
          'applicableScenes：用 60-120 字说明遇到什么样的发言人或卡点时适合调用',
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
        '你是韧性之树晨读营的观察者副驾驶。你的任务不是写一篇漂亮文章，而是帮助观察者在现场快速看见发言人背后的真实卡点，并生成可以直接口播、真诚、克制、具体的回应。',
        '你要像一个有经验的带营观察者：先接住人，再连接课程；先看见痛苦，再提出选择；先尊重对方处境，再给出一点照亮。',
        '禁止心理诊断、审判、鸡汤、道德绑架、因果论、居高临下，也不要把观察者的破产经历讲成“我比你惨”。',
        '分析必须连接用户选择的当天课程内容，不能泛泛连接七个习惯。课程连接要落到发言人的具体语言和处境。',
        '“本次匹配到的观察者知识素材”已经按优先级排序，靠前的素材尤其要优先参考；如果素材适配，要把它转化成观察者自己的现场表达。',
        '如果内容中能识别出真实姓名，请输出 suggestedSpeakerName，只输出姓名本身，不要带“发言人”前缀；识别不到就保持空字符串。',
      ].join('\n'),
    input: JSON.stringify(
      {
        当天课程: theme,
        观察者立场: session.observerStance,
        个人故事库: session.stories,
        本次匹配到的观察者知识素材: serializeKnowledge(relevantKnowledge),
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
          '如果内容中出现明确发言人姓名，提取姓名，suggestedSpeakerName 只填姓名本身',
          'strongestPoint：抓一个最值得回应的点，必须来自发言人的具体表达，不要泛泛总结',
          'underlyingPattern：说清背后的本质，约 120-180 字，说明他真正卡住的不是表面事件，而是什么内在模式',
          'themeConnection：必须连接所选当天课程内容，约 220-320 字，要引用课程核心意思，并落回发言人的真实处境',
          'stuckType：给出一个主卡点和一个辅助卡点，例如“身份绑定 / 结果执着”，不要超过两个',
          'seenNeed：写出这个人真正需要被看见的地方，约 80-140 字，语气要温柔但不含糊',
          'suggestedObserverStory：从个人故事库里选一个最适合轻轻关联的经历；如果不适合就写“不建议关联个人故事”',
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
        '这不是会议纪要，也不是短摘要。你要把“当天课程 -> 多位发言人的共同生命课题 -> 每个人具体卡点 -> 观察者可以如何回应 -> 最后如何收束”串成一条清楚的线。',
        '观察者经历过公司破产、债务、银行起诉、限高和重新站起来，但他的经历只能作为温柔的参照，不能压过发言人，不能比较谁更惨。',
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
        输出要求: [
          'templateDecision：必须先判断或确认使用的模板。template 只能是 resonance、structure、hybrid；templateName 写中文名“共振型 / 结构型 / 融合型”；reason 用 80-160 字说明为什么这场适合这个模板；sceneSignals 列 3-5 个判断依据',
          'courseTheme：用 220-340 字总结当天课程内容要点，只回答“今天课程提醒了我们什么”，不要提前总结发言人，也不要和 commonTheme/keyResponse 重复',
          'commonTheme：用 220-340 字提炼几位发言人背后的共同关联主题，只回答“这几个人共同卡在哪里”，要承接 courseTheme，但不要复述课程定义',
          'speakerLessons：每位已经有内容或已分析的发言人都要写；lesson 约 120-220 字，themeConnection 约 100-180 字',
          'keyResponse：用 350-550 字写最值得重点展开回应的部分，只回答“现场最应该抓住哪里回应、边界是什么”，不要再重复课程主题和共同主题',
          'structuredSections：必须按 templateDecision.template 对应的“可用模板板块与每块提示词”输出同名同序板块；key 和 title 必须完全匹配该模板；每个 body 180-360 字，必须能直接口播，板块之间有自然衔接，但不要互相重复',
          '如果使用 resonance：语言要更有现场温度和共振感，少用第一第二第三；如果使用 structure：层次要非常清楚，可以使用第一层第二层第三层；如果使用 hybrid：先共振、再结构、最后用观察者经历落地',
          '如果知识素材里有用户过去晨读营发言或破产经历，优先提炼其中适合现场讲的切面；禁止展开 avoidDetails',
          'goldenSentences：给 6-8 句，句子要有现场感，不能空泛鸡汤',
          'oneSentenceSummaries：最后增加“一句话总结”，必须给 3 句。每句都要能单独作为观察者收束表达，短、准、有现场感，不要空泛口号',
          'closingSentence：给一句最后可直接说出口的收束句',
          'missingSpeakers：列出有内容但尚未分析、或内容明显不足的人',
          '如果输入里有人没有分析但有原始片段，也要基于原始片段做保守判断，并在 missingSpeakers 提醒',
          '如果用户补充要求改变了字数、语气、重点人物、案例使用方式或结构，以用户补充要求为准，同时保持内容真诚、克制、可口播',
        ],
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
    suggestedSpeakerName: '',
    strongestPoint: firstLine,
    underlyingPattern: `这更像是在面对“${theme.name}”时，仍被现实压力牵着走，还没有完全看见自己可选择的回应方式。`,
    themeConnection: `如果连接到当天课程“${theme.name}”，这段分享可以从“${theme.core}”切入。回应时不要把课程变成概念解释，而是先承认他当下真实的压力，再帮他看见课程里最重要的一点：人在困难里并不是立刻拥有全部答案，而是先重新分辨哪些是已经发生的现实，哪些是自己仍然可以选择的回应。这样课程就不是道理，而是帮他回到自己的一个支点。`,
    stuckType: '关注圈陷阱 / 身份绑定',
    seenNeed: '他需要先被看见的是：痛苦不是软弱，卡住也不代表他没有能力，只是此刻还没找到能重新站稳的入口。',
    suggestedObserverStory: '公司破产',
    storyUseBoundary: '可以讲你如何没有把事情失败等同于自己失败，但不要比较谁更惨，也不要展开太多债务细节。',
    oneMinuteResponse: `我听到你刚才最打动我的点是：${firstLine}。如果放到今天“${theme.name}”这个主题里，我会觉得这不是简单要你更积极一点，而是先看见：哪些确实已经发生，哪些仍然在你的影响圈里。我自己经历公司破产时，也有很长一段时间会把事情的失败等同于自己的失败。后来我慢慢发现，真正让我重新站起来的，不是马上解决所有问题，而是先承认现实，然后抓住一个我还能选择的回应。`,
    deepResponse: `这段分享里，我会抓住“${firstLine}”。它背后像是在说：现实已经很重，但更重的是人会把现实的压力变成对自己的判断。今天的主题如果是“${theme.name}”，我不想把它讲成一句“你要积极主动”，那样太轻了。我更想说，积极主动有时候只是一个很小的动作：先把已经发生的事情和“我这个人是谁”分开，再从混乱里找到一个自己还能负责的小部分。我经历破产时，最难的也是这个分开。`,
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
  const text = session.speakers.flatMap((speaker) => speaker.snippets.map((snippet) => snippet.text)).join('\n');
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
  const seenSpeakers =
    analyzed.length > 0
      ? analyzed.map((speaker) => `${speaker.name}呈现的是：${speaker.insight?.seenNeed || speaker.insight?.strongestPoint || '还需要被更具体地看见'}`).join('；')
      : '每个人的课题都不完全一样，但都值得被具体地看见，而不是被一句道理概括。';

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
        title: '几位发言人的生命课题',
        body: seenSpeakers,
      },
      {
        key: 'experience_mirror',
        title: '我的经历映照',
        body: '我自己经历破产、债务和限高时，也很熟悉那种系统突然崩塌的感觉。后来真正帮助我的，不是证明自己没有失败，而是先承认现实，再一点点把自己能负责、能选择的那一小部分拿回来。',
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
        body: '全场共同模式是：每个人讲的事件不同，但背后都在处理同一个问题，外在结果尚未稳定时，内在如何不跟着全部失序。有人卡在责任，有人卡在关系，有人卡在自我否定，但底层都在寻找新的支点。',
      },
      {
        key: 'three_layers',
        title: '三层理解',
        body: '第一层是表层事件：现实里发生了让人不舒服的事情。第二层是内在状态：人把事件变成了对自己的判断。第三层是成长方向：把事情和自己分开，把能回应的部分重新拿回来。',
      },
      {
        key: 'speaker_topics',
        title: '每人课题',
        body: seenSpeakers,
      },
      {
        key: 'observer_experience',
        title: '我的经验补充',
        body: '我经历公司破产时，最重要的区分是：承担责任不等于否定自己。责任让我看见下一步还能做什么，自我否定只会把能量继续耗掉。这也是我觉得今天这节课必须落到现实里的原因。',
      },
      {
        key: 'action_practice',
        title: '可带走的行动',
        body: '今天可以带走三个小动作：先写下已经发生的现实；再写下我对此产生的感受；最后只选一个今天还能做的小回应。这个动作很小，但它能帮人从混乱里重新回到影响圈。',
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
        title: '每人课题',
        body: seenSpeakers,
      },
      {
        key: 'key_response',
        title: '重点回应',
        body: analyzed[0]?.insight?.deepResponse || '最值得重点回应的是：先接住一个人最真实的压力，再把课程主题落到他还能做出的一个小选择上。回应时要避免站在高处给答案，而是陪他看见已经出现的力量。',
      },
      {
        key: 'experience_connection',
        title: '我的经历连接',
        body: '我自己的破产经历让我很深地体会到，真正击垮人的不只是事情本身，而是人在事情里不断把自己判成失败。后来我慢慢学会的，是面对现实，但不把现实等同于我这个人的全部价值。',
      },
      {
        key: 'takeaway_action',
        title: '带走的行动',
        body: '今天大家可以先带走一个小练习：遇到卡住的事时，问自己三个问题：这是已经发生的现实，还是我对现实的解释？这里面我最强烈的感受是什么？今天我还能做出的一个小回应是什么？',
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
    commonTheme: `大家都在围绕“${theme.name}”面对一个共同问题：现实很重，但仍然要找到自己还可以选择的回应。`,
    speakerLessons: analyzed.map((speaker) => ({
      speakerName: speaker.name,
      lesson: speaker.insight?.underlyingPattern || '还需要进一步分析',
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
