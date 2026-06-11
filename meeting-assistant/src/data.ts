import type { ObserverSession, Story, Theme } from './types';

export const themes: Theme[] = [
  {
    id: 'proactive',
    name: '积极主动',
    core: '从关注圈回到影响圈，看见自己仍然拥有选择回应的自由。',
    observationQuestions: ['他现在在讲关注圈还是影响圈？', '他有没有把事情和自我绑死？', '他还有哪一点选择自由？', '他是过度负责，还是把责任完全交出去？'],
    commonMistakes: ['把积极主动讲成硬扛', '急着劝人行动', '用责任压住对方的痛苦'],
  },
  {
    id: 'begin-with-end',
    name: '以终为始',
    core: '先看见真正想成为的人，再回头安排此刻的选择。',
    observationQuestions: ['他真正想守住的是什么？', '他被短期结果带走了吗？', '他有没有说出想成为什么样的人？'],
    commonMistakes: ['把目标当成焦虑来源', '只谈结果不谈身份', '忽视当下仍可定义的方向'],
  },
  {
    id: 'first-things-first',
    name: '要事第一',
    core: '辨认重要而不紧急的事，把精力放回真正有价值的行动。',
    observationQuestions: ['他现在被什么紧急事拖住？', '真正重要但没被照顾的是什么？', '他需要放下哪个低价值消耗？'],
    commonMistakes: ['把忙碌当承担', '把救火当价值', '把所有事都列成同等重要'],
  },
  {
    id: 'win-win',
    name: '双赢思维',
    core: '从输赢防御转向共同成就，看见关系中的第三种可能。',
    observationQuestions: ['他是否陷在谁赢谁输？', '他怕失去的是什么？', '关系中有没有第三种可能？'],
    commonMistakes: ['把双赢讲成委屈自己', '忽视边界', '把合作说成讨好'],
  },
  {
    id: 'seek-first',
    name: '知彼解己',
    core: '先真正听见对方，再表达自己；先理解，再求被理解。',
    observationQuestions: ['他最需要谁听见？', '他有没有先解释自己而没有听见对方？', '他内在没有被听见的声音是什么？'],
    commonMistakes: ['急着分析别人', '把理解当认同', '听见事实但没听见感受'],
  },
  {
    id: 'synergize',
    name: '统合综效',
    core: '尊重差异，让差异形成比单独选择更高的第三方案。',
    observationQuestions: ['他在抗拒哪种差异？', '他有没有把差异等同于威胁？', '第三方案可能在哪里？'],
    commonMistakes: ['把统合讲成妥协', '忽视冲突中的资源', '只想消灭差异'],
  },
  {
    id: 'sharpen-saw',
    name: '不断更新',
    core: '从身体、心智、情感和精神四个面向持续修复与更新。',
    observationQuestions: ['他哪个面向已经透支？', '他是否只想解决问题却不修复自己？', '下一步最小更新动作是什么？'],
    commonMistakes: ['把更新讲成自律打卡', '忽视休息和修复', '只补技能不照顾生命状态'],
  },
];

export const defaultStories: Story[] = [
  {
    id: 'bankruptcy',
    title: '公司破产',
    summary: '公司走到破产边缘时，最难的不是承认失败，而是不把失败等同于自己这个人完了。',
    fitFor: ['身份绑定', '羞耻感', '结果执着'],
    sayLevel: '适合讲“我当时如何从事情失败里把自己分离出来”，不要展开过多财务细节。',
    avoidDetails: ['具体金额', '责怪某个人', '渲染惨烈程度'],
  },
  {
    id: 'bank-lawsuit',
    title: '银行起诉',
    summary: '面对银行起诉时，先承认现实，再把能处理的部分一件件拆出来。',
    fitFor: ['关注圈陷阱', '行动瘫痪', '责任边界'],
    sayLevel: '适合讲“现实很硬，但我仍然可以选择怎么回应”。',
    avoidDetails: ['法律细节推断', '承诺一定能解决', '把对方痛苦轻描淡写'],
  },
  {
    id: 'restricted-consumption',
    title: '限高',
    summary: '限高带来的不只是行动受限，还有被看见时的羞耻和身份压力。',
    fitFor: ['羞耻感', '身份绑定', '意义断裂'],
    sayLevel: '适合讲羞耻感如何被接住，少讲制度细节。',
    avoidDetails: ['自我英雄化', '比较谁更惨', '把苦难美化'],
  },
  {
    id: 'unpaid-wages',
    title: '员工欠薪处理',
    summary: '处理欠薪时，需要同时面对责任、边界和实际可执行的顺序。',
    fitFor: ['无边界负责', '要事第一', '关系内耗'],
    sayLevel: '适合讲“承担不是全吞下，而是按顺序处理能处理的”。',
    avoidDetails: ['具体人员评价', '过度合理化自己', '轻易给对方建议'],
  },
  {
    id: 'relationship-warning',
    title: '合伙人关系警报',
    summary: '关系里的裂缝往往早有信号，只是人在危机中会选择不看。',
    fitFor: ['关系内耗', '知彼解己', '双赢思维'],
    sayLevel: '适合讲“我后来才承认自己当时没有真正听见关系里的警报”。',
    avoidDetails: ['指责合伙人', '给关系下诊断', '把问题归因给单方'],
  },
  {
    id: 'new-work',
    title: '重新找工作',
    summary: '重新进入工作不是退回去，而是在现实里重新接上自己的行动能力。',
    fitFor: ['行动瘫痪', '积极主动', '意义断裂'],
    sayLevel: '适合讲“先做一个能恢复影响圈的小动作”。',
    avoidDetails: ['把找工作说成唯一出路', '否定创业经历', '急着给方法论'],
  },
  {
    id: 'ai-rebuild',
    title: 'AI 改造公司',
    summary: '用 AI 改造工作方式，是把危机后的经验重新转化成创造力。',
    fitFor: ['不断更新', '积极主动', '以终为始'],
    sayLevel: '适合讲从修复到更新的过程，不适合压成技术炫耀。',
    avoidDetails: ['工具清单堆砌', '显得高高在上', '把 AI 当万能答案'],
  },
];

const now = () => new Date().toISOString();

export function createDefaultSession(): ObserverSession {
  return {
    id: crypto.randomUUID(),
    title: '下一期晨读营观察',
    themeId: 'proactive',
    observerStance: '经历过破产、债务、银行起诉和重新站起来；回应要真诚、克制、口语化，不说教，不压过对方的经验。',
    stories: defaultStories,
    speakers: ['发言人 A', '发言人 B', '发言人 C', '发言人 D'].map((name) => ({
      id: crypto.randomUUID(),
      name,
      status: 'empty',
      snippets: [],
    })),
    updatedAt: now(),
  };
}
