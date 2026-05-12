import re

with open('miniprogram/pages/course-detail/course-detail.js', 'r') as f:
    content = f.read()

new_func = '''  getLikeAvatarInfo(user) {
    if (!user) return { avatarUrl: '', avatarText: '👤', userId: '' };
    
    // 如果 user 只是一个字符串ID，尝试返回一个后备显示
    if (typeof user === 'string') {
      return { avatarUrl: '', avatarText: '👤', userId: user };
    }

    const name = user.nickname || user.nickName || user.userName || '用户';
    let avatarText = '👤';
    let avatarUrl = '';

    if (user.avatarUrl) {
      avatarUrl = user.avatarUrl;
    } else if (user.avatar && user.avatar.startsWith('http')) {
      avatarUrl = user.avatar;
    } else if (user.avatar && user.avatar.startsWith('data:image')) {
      avatarUrl = user.avatar;
    }

    if (!avatarUrl) {
      // 优先使用实际的 nickname 首字母，如果实在没有才用 avatar 字段里的字符
      if (user.nickname || user.nickName || user.userName) {
         avatarText = name.charAt(0);
      } else {
         avatarText = (user.avatar && !user.avatar.startsWith('http')) ? user.avatar : name.charAt(0);
      }
    }

    return {
      userId: user._id || user.id || '',
      avatarUrl,
      avatarText,
      isMore: false
    };
  },'''

content = re.sub(r"  getLikeAvatarInfo\(user\) \{[\s\S]*?isMore: false\n    \};\n  \},", new_func, content)

with open('miniprogram/pages/course-detail/course-detail.js', 'w') as f:
    f.write(content)

print("done")
