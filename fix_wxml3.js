const fs = require('fs');
const file = 'miniprogram/pages/course-detail/course-detail.wxml';
let content = fs.readFileSync(file, 'utf8');

// 1. Checkin Like
content = content.replace(
  /              <view class="comment-like" catchtap="handleLikeComment" data-id="\{\{item\.id\}\}">\n                <text class="like-icon \{\{item\.isLiked \? 'liked' : ''\}\}">❤️<\/text>\n                <text class="like-count">\{\{item\.likeCount\}\}<\/text>\n              <\/view>\n              <view class="comment-reply" catchtap="handleReplyComment" data-id="\{\{item\.id\}\}">/g,
  `              <view class="comment-like" catchtap="handleLikeComment" data-id="{{item.id}}">
                <text class="like-icon {{item.isLiked ? 'liked' : ''}}">❤️ {{item.likeCount ? '(' + item.likeCount + ')' : ''}}</text>
                <view class="like-avatars" wx:if="{{item.likeAvatars && item.likeAvatars.length > 0}}">
                  <block wx:for="{{item.displayLikeAvatars || item.likeAvatars}}" wx:key="userId" wx:for-item="avatar">
                    <view wx:if="{{avatar.isMore}}" class="like-avatar-more">+</view>
                    <image wx:elif="{{avatar.avatarUrl}}" class="like-avatar-img" src="{{avatar.avatarUrl}}" mode="aspectFill" />
                    <view wx:else class="like-avatar-text">{{avatar.avatarText}}</view>
                  </block>
                </view>
              </view>
              <view class="comment-actions-right">
                <view class="comment-reply" catchtap="handleReplyComment" data-id="{{item.id}}">`
);

content = content.replace(
  /                <text class="toggle-text loading" wx:else>加载中\.\.\.<\/text>\n              <\/view>\n            <\/view>/g,
  `                <text class="toggle-text loading" wx:else>加载中...</text>\n              </view>\n              </view>\n            </view>`
);

// 2. Reply Like
content = content.replace(
  /                      <view class="reply-like" bindtap="handleLikeReply" data-comment-id="\{\{item\.id\}\}" data-reply-id="\{\{reply\.id\}\}" style="pointer-events: auto;">\n                        <text class="like-icon \{\{reply\.isLiked \? 'liked' : ''\}\}">❤️<\/text>\n                        <text class="like-count">\{\{reply\.likeCount \|\| 0\}\}<\/text>\n                      <\/view>\n                      <view class="reply-reply" bindtap="handleReplyToReply" data-checkin-id="\{\{item\.id\}\}" data-comment-id="\{\{reply\.id\}\}" data-reply-id="\{\{reply\.userId\}\}" data-user-name="\{\{reply\.userName\}\}" style="pointer-events: auto;">/g,
  `                      <view class="reply-like" bindtap="handleLikeReply" data-comment-id="{{item.id}}" data-reply-id="{{reply.id}}" style="pointer-events: auto;">
                        <text class="like-icon {{reply.isLiked ? 'liked' : ''}}">❤️ {{reply.likeCount ? '(' + reply.likeCount + ')' : ''}}</text>
                        <view class="like-avatars" wx:if="{{reply.likeAvatars && reply.likeAvatars.length > 0}}">
                          <block wx:for="{{reply.displayLikeAvatars || reply.likeAvatars}}" wx:key="userId" wx:for-item="avatar">
                            <view wx:if="{{avatar.isMore}}" class="like-avatar-more">+</view>
                            <image wx:elif="{{avatar.avatarUrl}}" class="like-avatar-img" src="{{avatar.avatarUrl}}" mode="aspectFill" />
                            <view wx:else class="like-avatar-text">{{avatar.avatarText}}</view>
                          </block>
                        </view>
                      </view>
                      <view class="comment-actions-right">
                        <view class="reply-reply" bindtap="handleReplyToReply" data-checkin-id="{{item.id}}" data-comment-id="{{reply.id}}" data-reply-id="{{reply.userId}}" data-user-name="{{reply.userName}}" style="pointer-events: auto;">`
);

content = content.replace(
  /                      <view wx:if="\{\{reply\.canDelete\}\}" class="reply-delete" catchtap="handleDeleteComment" data-checkin-id="\{\{item\.id\}\}" data-comment-id="\{\{reply\.id\}\}" style="pointer-events: auto;">\n                        <text>删除<\/text>\n                      <\/view>\n                    <\/view>/g,
  `                      <view wx:if="{{reply.canDelete}}" class="reply-delete" catchtap="handleDeleteComment" data-checkin-id="{{item.id}}" data-comment-id="{{reply.id}}" style="pointer-events: auto;">
                        <text>删除</text>
                      </view>
                      </view>
                    </view>`
);

content = content.replace(
  /                      <\/view>\n                    <\/view>\n\n                    <view class="nested-replies-list"/g,
  `                      </view>\n                      </view>\n                    </view>\n\n                    <view class="nested-replies-list"`
);

// 3. Nested Reply Like
content = content.replace(
  /                              <view class="nested-reply-like" bindtap="handleLikeReply" data-comment-id="\{\{item\.id\}\}" data-reply-id="\{\{nestedReply\.id\}\}" style="pointer-events: auto;">\n                                <text class="like-icon \{\{nestedReply\.isLiked \? 'liked' : ''\}\}">❤️<\/text>\n                                <text class="like-count">\{\{nestedReply\.likeCount \|\| 0\}\}<\/text>\n                              <\/view>\n                            <\/view>/g,
  `                              <view class="nested-reply-like" bindtap="handleLikeReply" data-comment-id="{{item.id}}" data-reply-id="{{nestedReply.id}}" style="pointer-events: auto;">
                                <text class="like-icon {{nestedReply.isLiked ? 'liked' : ''}}">❤️ {{nestedReply.likeCount ? '(' + nestedReply.likeCount + ')' : ''}}</text>
                                <view class="like-avatars" wx:if="{{nestedReply.likeAvatars && nestedReply.likeAvatars.length > 0}}">
                                  <block wx:for="{{nestedReply.displayLikeAvatars || nestedReply.likeAvatars}}" wx:key="userId" wx:for-item="avatar">
                                    <view wx:if="{{avatar.isMore}}" class="like-avatar-more">+</view>
                                    <image wx:elif="{{avatar.avatarUrl}}" class="like-avatar-img" src="{{avatar.avatarUrl}}" mode="aspectFill" />
                                    <view wx:else class="like-avatar-text">{{avatar.avatarText}}</view>
                                  </block>
                                </view>
                              </view>
                              <view class="comment-actions-right">
                              </view>
                            </view>`
);

content = content.replace(
  /                              <view class="nested-reply-reply" bindtap="handleReplyToReply" data-checkin-id="\{\{item\.id\}\}" data-comment-id="\{\{reply\.id\}\}" data-reply-id="\{\{nestedReply\.userId\}\}" data-user-name="\{\{nestedReply\.userName\}\}" style="pointer-events: auto;">/g,
  `                              <view class="comment-actions-right">
                                <view class="nested-reply-reply" bindtap="handleReplyToReply" data-checkin-id="{{item.id}}" data-comment-id="{{reply.id}}" data-reply-id="{{nestedReply.userId}}" data-user-name="{{nestedReply.userName}}" style="pointer-events: auto;">`
);

content = content.replace(
  /                              <view wx:if="\{\{nestedReply\.canDelete\}\}" class="nested-reply-delete" catchtap="handleDeleteComment" data-checkin-id="\{\{item\.id\}\}" data-comment-id="\{\{nestedReply\.id\}\}" style="pointer-events: auto;">\n                                <text>删除<\/text>\n                              <\/view>\n                            <\/view>/g,
  `                              <view wx:if="{{nestedReply.canDelete}}" class="nested-reply-delete" catchtap="handleDeleteComment" data-checkin-id="{{item.id}}" data-comment-id="{{nestedReply.id}}" style="pointer-events: auto;">
                                <text>删除</text>
                              </view>
                              </view>
                            </view>`
);

// 4. Detail Checkin Like
content = content.replace(
  /      <view class="dynamic-bottom-action" bindtap="handleLikeComment" data-id="\{\{detailCheckin\.id\}\}">\n        <text class="dynamic-bottom-action-icon \{\{detailCheckin\.isLiked \? 'liked' : ''\}\}">♡<\/text>\n        <text>\{\{detailCheckin\.likeCount \|\| 0\}\}<\/text>\n      <\/view>/g,
  `      <view class="dynamic-like-pill" bindtap="handleLikeComment" data-id="{{detailCheckin.id}}">
        <text class="dynamic-like-pill-icon {{detailCheckin.isLiked ? 'liked' : ''}}">❤️ {{detailCheckin.likeCount ? '(' + detailCheckin.likeCount + ')' : ''}}</text>
        <view class="like-avatars" wx:if="{{detailCheckin.likeAvatars && detailCheckin.likeAvatars.length > 0}}">
          <block wx:for="{{detailCheckin.displayLikeAvatars || detailCheckin.likeAvatars}}" wx:key="userId" wx:for-item="avatar">
            <view wx:if="{{avatar.isMore}}" class="like-avatar-more">+</view>
            <image wx:elif="{{avatar.avatarUrl}}" class="like-avatar-img" src="{{avatar.avatarUrl}}" mode="aspectFill" />
            <view wx:else class="like-avatar-text">{{avatar.avatarText}}</view>
          </block>
        </view>
      </view>`
);

fs.writeFileSync(file, content);
console.log('done wxml 3');
