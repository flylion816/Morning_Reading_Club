/**
 * 觉察日记的本机存储：草稿、「上次关联」和静室里自己加的情绪词。
 * 都按「用户」区分，换账号不会看到上一个人的草稿；本地存储不可用时只是少了草稿恢复，不影响记录。
 * 随喜速记条（主包）、觉察日记页和觉察静室（分包）共用。
 */
const { tenantStorage } = require('./storage');
const constants = require('../config/constants');

const KEYS = {
  // 随喜的草稿：速记条和日记页的输入框共用同一份
  joyDraft: 'joyNoteDraft',
  lastSource: 'joyNoteLastSource',
  // 觉察静室的草稿
  awarenessDraft: 'awarenessDraft',
  // 觉察静室「感」里自己加的情绪词：{ heavy: [], bright: [] }，按「沉一点的」「亮一点的」两组记
  customFeelings: 'awarenessCustomFeelings'
};

function currentIdentity() {
  try {
    const user = tenantStorage.get(constants.STORAGE_KEYS.USER_INFO);
    return (user && (user._id || user.id || user.userId)) || tenantStorage.get(constants.STORAGE_KEYS.TOKEN) || '';
  } catch (error) {
    return '';
  }
}

function read(key) {
  try {
    return tenantStorage.get(`${key}:${currentIdentity()}`) || null;
  } catch (error) {
    return null;
  }
}

function write(key, value) {
  try {
    const name = `${key}:${currentIdentity()}`;
    if (value) tenantStorage.set(name, value);
    else tenantStorage.remove(name);
  } catch (error) {
    // 本地存储不可用：少了草稿恢复，不影响记录
  }
}

// 随喜草稿：标题、纯文本、带格式的 HTML。旧版本存的是纯文本字符串，这里兼容读取
function readJoyDraft() {
  const raw = read(KEYS.joyDraft);
  if (typeof raw === 'string') return { title: '', content: raw, html: '' };
  if (raw && typeof raw === 'object') {
    return { title: String(raw.title || ''), content: String(raw.content || ''), html: String(raw.html || '') };
  }
  return { title: '', content: '', html: '' };
}

function writeJoyDraft({ title = '', content = '', html = '' } = {}) {
  if (!String(title).trim() && !String(content).trim()) write(KEYS.joyDraft, null);
  else write(KEYS.joyDraft, { title, content, html });
}

module.exports = { KEYS, currentIdentity, read, write, readJoyDraft, writeJoyDraft };
