// 只比较实际可编辑字段，避免“昵称没变”吞掉头像或签名修改。
function profileValues(profile = {}) {
  return {
    nickname: String(profile.nickname || profile.name || '').trim(),
    avatar: profile.avatar || '🦁',
    avatarUrl: profile.avatarUrl || '',
    signature: profile.signature || ''
  };
}

function isProfileUnchanged(form, original) {
  if (!original) return false;
  return JSON.stringify(profileValues(form)) === JSON.stringify(profileValues(original));
}

function profileError(error) {
  const body = error && error.data && typeof error.data === 'object' ? error.data : (error || {});
  const conflict = body.code === 409 || (error && error.statusCode === 409);
  return {
    conflict,
    message: conflict ? (body.message || '该昵称已被使用，请修改后再保存') : '没保存上，稍后再试试'
  };
}

module.exports = { profileValues, isProfileUnchanged, profileError };
