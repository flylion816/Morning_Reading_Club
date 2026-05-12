const fs = require('fs');
const file = 'miniprogram/pages/course-detail/course-detail.wxml';
let content = fs.readFileSync(file, 'utf8');

// Replace standard checkin like icon
content = content.replace(/<text class="like-icon \{\{item\.isLiked \? 'liked' : ''\}\}">❤️<\/text>/g, `<text class="like-icon {{item.isLiked ? 'liked' : ''}}">❤️ {{item.likeCount ? '(' + item.likeCount + ')' : ''}}</text>`);

// Replace reply like icon
content = content.replace(/<text class="like-icon \{\{reply\.isLiked \? 'liked' : ''\}\}">❤️<\/text>/g, `<text class="like-icon {{reply.isLiked ? 'liked' : ''}}">❤️ {{reply.likeCount ? '(' + reply.likeCount + ')' : ''}}</text>`);

// Replace nested reply like icon
content = content.replace(/<text class="like-icon \{\{nestedReply\.isLiked \? 'liked' : ''\}\}">❤️<\/text>/g, `<text class="like-icon {{nestedReply.isLiked ? 'liked' : ''}}">❤️ {{nestedReply.likeCount ? '(' + nestedReply.likeCount + ')' : ''}}</text>`);

// Replace detail like icon
content = content.replace(/<text class="dynamic-like-pill-icon \{\{detailCheckin\.isLiked \? 'liked' : ''\}\}">♡<\/text>/g, `<text class="dynamic-like-pill-icon {{detailCheckin.isLiked ? 'liked' : ''}}">❤️ {{detailCheckin.likeCount ? '(' + detailCheckin.likeCount + ')' : ''}}</text>`);

// Replace the fallback count texts
content = content.replace(/<text class="like-count" wx:else>\{\{item\.likeCount \|\| 0\}\}<\/text>/g, '');
content = content.replace(/<text class="like-count" wx:else>\{\{reply\.likeCount \|\| 0\}\}<\/text>/g, '');
content = content.replace(/<text class="like-count" wx:else>\{\{nestedReply\.likeCount \|\| 0\}\}<\/text>/g, '');
content = content.replace(/<text class="dynamic-like-pill-count" wx:else>\{\{detailCheckin\.likeCount \|\| 0\}\}<\/text>/g, '');

// Replace loop blocks to use displayLikeAvatars and the isMore view
content = content.replace(/<block wx:for="\{\{item\.likeAvatars\}\}" wx:key="userId">/g, `<block wx:for="{{item.displayLikeAvatars || item.likeAvatars}}" wx:key="userId" wx:for-item="avatar">
                    <view wx:if="{{avatar.isMore}}" class="like-avatar-more">+</view>
                    <image wx:elif="{{avatar.avatarUrl}}" class="like-avatar-img" src="{{avatar.avatarUrl}}" mode="aspectFill" />
                    <view wx:else class="like-avatar-text">{{avatar.avatarText}}</view>`);

content = content.replace(/<block wx:for="\{\{reply\.likeAvatars\}\}" wx:key="userId">/g, `<block wx:for="{{reply.displayLikeAvatars || reply.likeAvatars}}" wx:key="userId" wx:for-item="avatar">
                            <view wx:if="{{avatar.isMore}}" class="like-avatar-more">+</view>
                            <image wx:elif="{{avatar.avatarUrl}}" class="like-avatar-img" src="{{avatar.avatarUrl}}" mode="aspectFill" />
                            <view wx:else class="like-avatar-text">{{avatar.avatarText}}</view>`);

content = content.replace(/<block wx:for="\{\{nestedReply\.likeAvatars\}\}" wx:key="userId">/g, `<block wx:for="{{nestedReply.displayLikeAvatars || nestedReply.likeAvatars}}" wx:key="userId" wx:for-item="avatar">
                                    <view wx:if="{{avatar.isMore}}" class="like-avatar-more">+</view>
                                    <image wx:elif="{{avatar.avatarUrl}}" class="like-avatar-img" src="{{avatar.avatarUrl}}" mode="aspectFill" />
                                    <view wx:else class="like-avatar-text">{{avatar.avatarText}}</view>`);

content = content.replace(/<block wx:for="\{\{detailCheckin\.likeAvatars\}\}" wx:key="userId">/g, `<block wx:for="{{detailCheckin.displayLikeAvatars || detailCheckin.likeAvatars}}" wx:key="userId" wx:for-item="avatar">
            <view wx:if="{{avatar.isMore}}" class="like-avatar-more">+</view>
            <image wx:elif="{{avatar.avatarUrl}}" class="like-avatar-img" src="{{avatar.avatarUrl}}" mode="aspectFill" />
            <view wx:else class="like-avatar-text">{{avatar.avatarText}}</view>`);

// Fix duplicate blocks that were just inserted incorrectly due to replacement overlap
content = content.replace(/<image wx:if="\{\{item\.avatarUrl\}\}" class="like-avatar-img"[\s\S]*?<\/view>\n                  <\/block>/g, '</block>');

// Align the right side comment footer
content = content.replace(/              <view class="comment-reply" catchtap="handleReplyComment"/g, `              <view class="comment-actions-right">\n                <view class="comment-reply" catchtap="handleReplyComment"`);
content = content.replace(/                <text class="toggle-text loading" wx:else>加载中\.\.\.<\/text>\n              <\/view>\n            <\/view>/g, `                <text class="toggle-text loading" wx:else>加载中...</text>\n              </view>\n              </view>\n            </view>`);

fs.writeFileSync(file, content);
console.log('done wxml');
