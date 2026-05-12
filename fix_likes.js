const fs = require('fs');
const file = 'miniprogram/pages/course-detail/course-detail.js';
let content = fs.readFileSync(file, 'utf8');

const helpers = `  getLikeAvatarInfo(user) {
    if (!user) return { avatarUrl: '', avatarText: '👤', userId: '' };
    const name = user.nickname || '用户';
    let avatarUrl = user.avatarUrl || '';
    let avatarText = '';
    if (!avatarUrl && user.avatar && user.avatar.startsWith('http')) {
      avatarUrl = user.avatar;
    }
    if (!avatarUrl) {
      avatarText = (user.avatar && !user.avatar.startsWith('http')) ? user.avatar : name.charAt(0);
    }
    return {
      userId: String(user._id || user.id || user || ''),
      avatarUrl,
      avatarText
    };
  },

  getDisplayLikeAvatars(likeAvatars) {
    if (!likeAvatars || !Array.isArray(likeAvatars)) return [];
    if (likeAvatars.length <= 5) return likeAvatars;
    const display = likeAvatars.slice(0, 4);
    display.push({
      userId: 'more',
      isMore: true
    });
    return display;
  },

  buildCheckinItem(checkin = {}) {`;
content = content.replace('  buildCheckinItem(checkin = {}) {', helpers);

content = content.replace(/      isLiked:[\s\S]*?: false,\n      replies: \[\],/g, (match) => {
  return match.replace('      replies: [],', `      likeAvatars: Array.isArray(checkin.likes) ? checkin.likes.map(like => this.getLikeAvatarInfo(like.userId)) : [],\n      displayLikeAvatars: Array.isArray(checkin.likes) ? this.getDisplayLikeAvatars(checkin.likes.map(like => this.getLikeAvatarInfo(like.userId))) : [],\n      replies: [],`);
});

content = content.replace(/                likeCount: reply\.likeCount \|\| 0,\n                isLiked,\n                canDelete: this\.isOwnCommentUser\(reply\.userId\),/g, `                likeCount: reply.likeCount || 0,\n                isLiked,\n                likeAvatars: Array.isArray(reply.likes) ? reply.likes.map(l => this.getLikeAvatarInfo(l.userId)) : [],\n                displayLikeAvatars: Array.isArray(reply.likes) ? this.getDisplayLikeAvatars(reply.likes.map(l => this.getLikeAvatarInfo(l.userId))) : [],\n                canDelete: this.isOwnCommentUser(reply.userId),`);

content = content.replace(/            likeCount: comment\.likeCount \|\| 0,\n            isLiked: isCommentLiked,\n            canDelete: this\.isOwnCommentUser\(comment\.userId\),/g, `            likeCount: comment.likeCount || 0,\n            isLiked: isCommentLiked,\n            likeAvatars: Array.isArray(comment.likes) ? comment.likes.map(l => this.getLikeAvatarInfo(l.userId)) : [],\n            displayLikeAvatars: Array.isArray(comment.likes) ? this.getDisplayLikeAvatars(comment.likes.map(l => this.getLikeAvatarInfo(l.userId))) : [],\n            canDelete: this.isOwnCommentUser(comment.userId),`);

content = content.replace(/        comment\.isLiked = false;\n        console\.log/g, `        comment.isLiked = false;\n        if (comment.likeAvatars) {\n          comment.likeAvatars = comment.likeAvatars.filter(l => String(l.userId) !== currentUserId);\n          comment.displayLikeAvatars = this.getDisplayLikeAvatars(comment.likeAvatars);\n        }\n        console.log`);

content = content.replace(/        comment\.likeCount \+= 1;\n        comment\.isLiked = true;\n        console\.log/g, `        comment.likeCount += 1;\n        comment.isLiked = true;\n        if (!comment.likeAvatars) comment.likeAvatars = [];\n        const currentUserInfo = this.getLikeAvatarInfo(app.globalData.userInfo);\n        comment.likeAvatars.unshift({\n          userId: currentUserId,\n          avatarUrl: currentUserInfo.avatarUrl,\n          avatarText: currentUserInfo.avatarText\n        });\n        comment.displayLikeAvatars = this.getDisplayLikeAvatars(comment.likeAvatars);\n        console.log`);

content = content.replace(/        reply\.isLiked = false;\n        console\.log/g, `        reply.isLiked = false;\n        if (reply.likeAvatars) {\n          reply.likeAvatars = reply.likeAvatars.filter(l => String(l.userId) !== currentUserId);\n          reply.displayLikeAvatars = this.getDisplayLikeAvatars(reply.likeAvatars);\n        }\n        console.log`);

content = content.replace(/        reply\.likeCount = \(reply\.likeCount \|\| 0\) \+ 1;\n        reply\.isLiked = true;\n        console\.log/g, `        reply.likeCount = (reply.likeCount || 0) + 1;\n        reply.isLiked = true;\n        if (!reply.likeAvatars) reply.likeAvatars = [];\n        const currentUserInfo = this.getLikeAvatarInfo(app.globalData.userInfo);\n        reply.likeAvatars.unshift({\n          userId: currentUserId,\n          avatarUrl: currentUserInfo.avatarUrl,\n          avatarText: currentUserInfo.avatarText\n        });\n        reply.displayLikeAvatars = this.getDisplayLikeAvatars(reply.likeAvatars);\n        console.log`);

fs.writeFileSync(file, content);
console.log('done');
