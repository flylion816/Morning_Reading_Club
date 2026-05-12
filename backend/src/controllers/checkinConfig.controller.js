const CheckinCelebrationConfig = require('../models/CheckinCelebrationConfig');
const { success, errors } = require('../utils/response');

const ANIMATION_STYLES = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'random'];
const RANDOM_ANIMATION_STYLES = ['A', 'B', 'C', 'D', 'E', 'F', 'G'];

const DEFAULT_MESSAGES = [
  { content: '积极主动是你最强的武器，今天你做到了！', category: '七个习惯', isEnabled: true },
  { content: '以终为始，每一次打卡都是朝终点迈进的一步 🎯', category: '七个习惯', isEnabled: true },
  { content: '要事第一！你把成长放在了今天最重要的位置', category: '七个习惯', isEnabled: true },
  { content: '双赢思维——你的坚持，也在激励身边的人', category: '七个习惯', isEnabled: true },
  { content: '不断更新自我，你的"锯子"正越磨越利 🪚', category: '七个习惯', isEnabled: true },
  { content: '主动选择成长，这就是高效能人士的秘诀', category: '七个习惯', isEnabled: true },
  { content: '晨读一刻钟，智慧长三分！今天的你已赚到 📖', category: '晨读', isEnabled: true },
  { content: '书香浸润心田，知识正在悄悄改变你', category: '晨读', isEnabled: true },
  { content: '阅读是最廉价的奢侈品，而你每天都在拥有它', category: '晨读', isEnabled: true },
  { content: '每一页翻过，都是一次小小的蜕变 🦋', category: '晨读', isEnabled: true },
  { content: '你用阅读开启了今天，这一天注定不平凡', category: '晨读', isEnabled: true },
  { content: '文字有温度，思想有力量，你感受到了吗？', category: '晨读', isEnabled: true },
  { content: '日积月累，聚沙成塔。习惯的力量正在生长 🌱', category: '积累', isEnabled: true },
  { content: '又一天，又一步。你正在变成更好的自己', category: '积累', isEnabled: true },
  { content: '每天进步 1%，一年后你会超越现在的 37 倍！', category: '积累', isEnabled: true },
  { content: '小小打卡，大大成就。为你今天的选择点赞 👍', category: '积累', isEnabled: true },
  { content: '播下勤学的种子，等待收获的季节 🌸', category: '积累', isEnabled: true },
  { content: '坚持不是一蹴而就，但每一天都算数', category: '积累', isEnabled: true },
  { content: '能量满格！今天的你，已经赢了！⚡', category: '励志', isEnabled: true },
  { content: '不管今天多忙，你还是来了。真的很棒！', category: '励志', isEnabled: true },
  { content: '送你一颗星 ⭐——这是坚持的奖励', category: '励志', isEnabled: true },
  { content: '自律，是你给自己最好的礼物', category: '励志', isEnabled: true },
  { content: '今天比昨天更好，明天比今天更强 💪', category: '励志', isEnabled: true },
  { content: '你的行动比任何借口都更有力量', category: '励志', isEnabled: true },
  { content: '与志同道合的人同行，路不孤单！', category: '社区', isEnabled: true },
  { content: '你的坚持，正在悄悄影响身边的书友', category: '社区', isEnabled: true },
  { content: '同频共振！你是这个社区最美的风景 🌈', category: '社区', isEnabled: true },
  { content: '今天，又多了一个人因你而受到鼓舞', category: '社区', isEnabled: true },
  { content: '共读共进，每个人都是彼此成长的光', category: '社区', isEnabled: true },
  { content: '晨读营因为有你，才更有温度 ☕', category: '社区', isEnabled: true },
];

async function getOrCreateConfig() {
  let config = await CheckinCelebrationConfig.findOne();
  if (!config) {
    config = await CheckinCelebrationConfig.create({
      animationStyle: 'random',
      enabledAnimationStyles: RANDOM_ANIMATION_STYLES,
      messages: DEFAULT_MESSAGES
    });
  } else if (!Array.isArray(config.enabledAnimationStyles) || config.enabledAnimationStyles.length === 0) {
    config.enabledAnimationStyles = RANDOM_ANIMATION_STYLES;
    await config.save();
  }
  return config;
}

// 小程序公开端点：返回动画配置 + 服务端随机一条消息
const getPublicConfig = async (req, res) => {
  try {
    const config = await getOrCreateConfig();
    const enabled = config.messages.filter(m => m.isEnabled);
    const msg = enabled.length > 0
      ? enabled[Math.floor(Math.random() * enabled.length)]
      : null;
    const enabledStyles = (config.enabledAnimationStyles || []).filter(style => RANDOM_ANIMATION_STYLES.includes(style));
    const animationStyle = config.animationStyle === 'random'
      ? enabledStyles[Math.floor(Math.random() * enabledStyles.length)]
      : config.animationStyle;
    res.json(success({
      animationStyle: animationStyle || 'A',
      enabledAnimationStyles: enabledStyles,
      message: msg ? msg.content : '打卡成功！坚持就是力量！'
    }));
  } catch (err) {
    res.status(500).json(errors.serverError(err.message));
  }
};

// 管理后台：启用/禁用随机池中的动画方式
const toggleRandomAnimationStyle = async (req, res) => {
  try {
    const { style } = req.params;
    if (!RANDOM_ANIMATION_STYLES.includes(style)) {
      return res.status(400).json(errors.badRequest('无效的动画方式'));
    }

    const config = await getOrCreateConfig();
    const enabledStyles = new Set(config.enabledAnimationStyles || RANDOM_ANIMATION_STYLES);

    if (enabledStyles.has(style)) {
      if (enabledStyles.size <= 1) {
        return res.status(400).json(errors.badRequest('随机池至少保留一种动画'));
      }
      enabledStyles.delete(style);
    } else {
      enabledStyles.add(style);
    }

    config.enabledAnimationStyles = RANDOM_ANIMATION_STYLES.filter(item => enabledStyles.has(item));
    await config.save();
    res.json(success({ enabledAnimationStyles: config.enabledAnimationStyles }));
  } catch (err) {
    res.status(500).json(errors.serverError(err.message));
  }
};

// 管理后台：获取完整配置
const getAdminConfig = async (req, res) => {
  try {
    const config = await getOrCreateConfig();
    res.json(success(config));
  } catch (err) {
    res.status(500).json(errors.serverError(err.message));
  }
};

// 管理后台：更新动画方式
const updateAnimationStyle = async (req, res) => {
  try {
    const { animationStyle } = req.body;
    if (!ANIMATION_STYLES.includes(animationStyle)) {
      return res.status(400).json(errors.badRequest('无效的动画方式'));
    }
    const config = await getOrCreateConfig();
    config.animationStyle = animationStyle;
    await config.save();
    res.json(success({ animationStyle: config.animationStyle }));
  } catch (err) {
    res.status(500).json(errors.serverError(err.message));
  }
};

// 管理后台：新增消息
const addMessage = async (req, res) => {
  try {
    const { content, category } = req.body;
    if (!content || !content.trim()) return res.status(400).json(errors.badRequest('内容不能为空'));
    const config = await getOrCreateConfig();
    config.messages.push({ content: content.trim(), category: category || '励志', isEnabled: true });
    await config.save();
    res.json(success(config.messages[config.messages.length - 1]));
  } catch (err) {
    res.status(500).json(errors.serverError(err.message));
  }
};

// 管理后台：编辑消息
const updateMessage = async (req, res) => {
  try {
    const { id } = req.params;
    const { content, category } = req.body;
    const config = await getOrCreateConfig();
    const msg = config.messages.id(id);
    if (!msg) return res.status(404).json(errors.notFound('消息不存在'));
    if (content !== undefined) msg.content = content.trim();
    if (category !== undefined) msg.category = category;
    await config.save();
    res.json(success(msg));
  } catch (err) {
    res.status(500).json(errors.serverError(err.message));
  }
};

// 管理后台：启用/禁用消息
const toggleMessage = async (req, res) => {
  try {
    const { id } = req.params;
    const config = await getOrCreateConfig();
    const msg = config.messages.id(id);
    if (!msg) return res.status(404).json(errors.notFound('消息不存在'));
    msg.isEnabled = !msg.isEnabled;
    await config.save();
    res.json(success({ _id: msg._id, isEnabled: msg.isEnabled }));
  } catch (err) {
    res.status(500).json(errors.serverError(err.message));
  }
};

// 管理后台：删除消息
const deleteMessage = async (req, res) => {
  try {
    const { id } = req.params;
    const config = await getOrCreateConfig();
    const msg = config.messages.id(id);
    if (!msg) return res.status(404).json(errors.notFound('消息不存在'));
    msg.deleteOne();
    await config.save();
    res.json(success({ deleted: true }));
  } catch (err) {
    res.status(500).json(errors.serverError(err.message));
  }
};

module.exports = {
  getPublicConfig,
  getAdminConfig,
  updateAnimationStyle,
  toggleRandomAnimationStyle,
  addMessage,
  updateMessage,
  toggleMessage,
  deleteMessage
};
