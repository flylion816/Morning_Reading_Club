const fs = require('fs');
const file = 'miniprogram/pages/course-detail/course-detail.wxml';
let content = fs.readFileSync(file, 'utf8');

content = content.replace(/                            <image wx:if="\{\{item\.avatarUrl\}\}" class="like-avatar-img" src="\{\{item\.avatarUrl\}\}" mode="aspectFill" \/>\n                            <view wx:else class="like-avatar-text">\{\{item\.avatarText\}\}<\/view>\n/g, '');

content = content.replace(/                                    <image wx:if="\{\{item\.avatarUrl\}\}" class="like-avatar-img" src="\{\{item\.avatarUrl\}\}" mode="aspectFill" \/>\n                                    <view wx:else class="like-avatar-text">\{\{item\.avatarText\}\}<\/view>\n/g, '');

fs.writeFileSync(file, content);
console.log('done fixing dupes');
