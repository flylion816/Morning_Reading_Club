const ImprintActivityType = require('../models/ImprintActivityType');
const { success, errors } = require('../utils/response');

const DEFAULT_TYPES = [
  { key: 'reading', label: '读书会', emoji: '📚', sortOrder: 0 },
  { key: 'cooking', label: '做饭', emoji: '🍳', sortOrder: 1 },
  { key: 'tea', label: '喝茶', emoji: '☕', sortOrder: 2 },
  { key: 'walk', label: '散步', emoji: '🚶', sortOrder: 3 },
  { key: 'create', label: '创作', emoji: '🎨', sortOrder: 4 },
  { key: 'other', label: '其他', emoji: '✨', sortOrder: 5 }
];

async function list(req, res) {
  try {
    let types = await ImprintActivityType.find({ isActive: true }).sort({ sortOrder: 1 }).lean();
    if (types.length === 0) types = DEFAULT_TYPES;
    return res.json(success(types));
  } catch (err) {
    return res.status(500).json(errors.serverError('获取标签列表失败'));
  }
}

async function adminList(req, res) {
  try {
    let types = await ImprintActivityType.find({}).sort({ sortOrder: 1 }).lean();
    if (types.length === 0) types = DEFAULT_TYPES.map(t => ({ ...t, _id: null, isActive: true }));
    return res.json(success(types));
  } catch (err) {
    return res.status(500).json(errors.serverError('获取标签列表失败'));
  }
}

async function create(req, res) {
  try {
    const { key, label, emoji, sortOrder } = req.body;
    if (!key || !label || !emoji) return res.status(400).json(errors.badRequest('key、label、emoji 为必填项'));
    const maxOrder = await ImprintActivityType.countDocuments({});
    const type = await ImprintActivityType.create({
      key: key.trim(),
      label: label.trim(),
      emoji: emoji.trim(),
      sortOrder: sortOrder != null ? sortOrder : maxOrder,
      isActive: true
    });
    return res.json(success(type));
  } catch (err) {
    if (err.code === 11000) return res.status(400).json(errors.badRequest('该 key 已存在'));
    return res.status(500).json(errors.serverError('创建标签失败'));
  }
}

async function update(req, res) {
  try {
    const { id } = req.params;
    const { label, emoji, sortOrder } = req.body;
    const type = await ImprintActivityType.findByIdAndUpdate(
      id,
      { ...(label != null && { label: label.trim() }), ...(emoji != null && { emoji: emoji.trim() }), ...(sortOrder != null && { sortOrder }) },
      { new: true }
    );
    if (!type) return res.status(404).json(errors.notFound('标签不存在'));
    return res.json(success(type));
  } catch (err) {
    return res.status(500).json(errors.serverError('更新标签失败'));
  }
}

async function remove(req, res) {
  try {
    const { id } = req.params;
    const type = await ImprintActivityType.findByIdAndUpdate(id, { isActive: false }, { new: true });
    if (!type) return res.status(404).json(errors.notFound('标签不存在'));
    return res.json(success({ message: '已删除' }));
  } catch (err) {
    return res.status(500).json(errors.serverError('删除标签失败'));
  }
}

async function reorder(req, res) {
  try {
    const { items } = req.body; // [{id, sortOrder}]
    if (!Array.isArray(items)) return res.status(400).json(errors.badRequest('items 必须为数组'));
    await Promise.all(items.map(({ id, sortOrder }) =>
      ImprintActivityType.findByIdAndUpdate(id, { sortOrder })
    ));
    return res.json(success({ message: '排序已更新' }));
  } catch (err) {
    return res.status(500).json(errors.serverError('更新排序失败'));
  }
}

module.exports = { list, adminList, create, update, remove, reorder };
