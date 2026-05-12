import re

with open('miniprogram/pages/course-detail/course-detail.wxml', 'r') as f:
    content = f.read()

# 1. Main checkin footer
# Replace everything inside comment-footer
content = content.replace('''            <view class="comment-footer">
              <view class="comment-like" catchtap="handleLikeComment" data-id="{{item.id}}">
                <text class="like-icon {{item.isLiked ? 'liked' : ''}}">❤️</text>
                <text class="like-count">{{item.likeCount}}</text>
              </view>
              <view class="comment-reply" catchtap="handleReplyComment" data-id="{{item.id}}">
                <text class="reply-icon">💬</text>
                <text>回复</text>
              </view>
              <view class="comment-toggle" catchtap="toggleComments" data-index="{{index}}">
                <text class="toggle-icon">💬</text>
                <text class="toggle-text" wx:if="{{!commentLoading[item.id]}}">{{commentExpanded[item.id] ? '收起评论' : '查看评论'}}</text>
                <text class="toggle-text loading" wx:else>加载中...</text>
              </view>
            </view>''', '''            <view class="comment-footer">
              <view class="comment-like" catchtap="handleLikeComment" data-id="{{item.id}}">
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
                <view class="comment-reply" catchtap="handleReplyComment" data-id="{{item.id}}">
                  <text class="reply-icon">💬</text>
                  <text>回复</text>
                </view>
                <view class="comment-toggle" catchtap="toggleComments" data-index="{{index}}">
                  <text class="toggle-icon">💬</text>
                  <text class="toggle-text" wx:if="{{!commentLoading[item.id]}}">{{commentExpanded[item.id] ? '收起评论' : '查看评论'}}</text>
                  <text class="toggle-text loading" wx:else>加载中...</text>
                </view>
              </view>
            </view>''')

# 2. Reply footer
# Replace everything inside reply-footer
content = content.replace('''                    <view class="reply-footer" style="pointer-events: auto;">
                      <view class="reply-like" bindtap="handleLikeReply" data-comment-id="{{item.id}}" data-reply-id="{{reply.id}}" style="pointer-events: auto;">
                        <text class="like-icon {{reply.isLiked ? 'liked' : ''}}">❤️</text>
                        <text class="like-count">{{reply.likeCount || 0}}</text>
                      </view>
                      <view class="reply-reply" bindtap="handleReplyToReply" data-checkin-id="{{item.id}}" data-comment-id="{{reply.id}}" data-reply-id="{{reply.userId}}" data-user-name="{{reply.userName}}" style="pointer-events: auto;">
                        <text class="reply-icon">💬</text>
                        <text>回复</text>
                      </view>
                    </view>''', '''                    <view class="reply-footer" style="pointer-events: auto;">
                      <view class="reply-like" bindtap="handleLikeReply" data-comment-id="{{item.id}}" data-reply-id="{{reply.id}}" style="pointer-events: auto;">
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
                        <view class="reply-reply" bindtap="handleReplyToReply" data-checkin-id="{{item.id}}" data-comment-id="{{reply.id}}" data-reply-id="{{reply.userId}}" data-user-name="{{reply.userName}}" style="pointer-events: auto;">
                          <text class="reply-icon">💬</text>
                          <text>回复</text>
                        </view>
                        <view wx:if="{{reply.canDelete}}" class="reply-delete" catchtap="handleDeleteComment" data-checkin-id="{{item.id}}" data-comment-id="{{reply.id}}" style="pointer-events: auto;">
                          <text>删除</text>
                        </view>
                      </view>
                    </view>''')

# 3. Nested reply footer
content = content.replace('''                            <view class="nested-reply-footer" style="pointer-events: auto;">
                              <view class="nested-reply-like" bindtap="handleLikeReply" data-comment-id="{{item.id}}" data-reply-id="{{nestedReply.id}}" style="pointer-events: auto;">
                                <text class="like-icon {{nestedReply.isLiked ? 'liked' : ''}}">❤️</text>
                                <text class="like-count">{{nestedReply.likeCount || 0}}</text>
                              </view>
                            </view>''', '''                            <view class="nested-reply-footer" style="pointer-events: auto;">
                              <view class="nested-reply-like" bindtap="handleLikeReply" data-comment-id="{{item.id}}" data-reply-id="{{nestedReply.id}}" style="pointer-events: auto;">
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
                                <view wx:if="{{nestedReply.canDelete}}" class="nested-reply-delete" catchtap="handleDeleteComment" data-checkin-id="{{item.id}}" data-comment-id="{{nestedReply.id}}" style="pointer-events: auto;">
                                  <text>删除</text>
                                </view>
                              </view>
                            </view>''')

# 4. Detail Checkin Like (The pill)
content = content.replace('''      <view class="dynamic-bottom-action" bindtap="handleLikeComment" data-id="{{detailCheckin.id}}">
        <text class="dynamic-bottom-action-icon {{detailCheckin.isLiked ? 'liked' : ''}}">♡</text>
        <text>{{detailCheckin.likeCount || 0}}</text>
      </view>''', '''      <view class="dynamic-like-pill" bindtap="handleLikeComment" data-id="{{detailCheckin.id}}">
        <text class="dynamic-like-pill-icon {{detailCheckin.isLiked ? 'liked' : ''}}">❤️ {{detailCheckin.likeCount ? '(' + detailCheckin.likeCount + ')' : ''}}</text>
        <view class="like-avatars" wx:if="{{detailCheckin.likeAvatars && detailCheckin.likeAvatars.length > 0}}">
          <block wx:for="{{detailCheckin.displayLikeAvatars || detailCheckin.likeAvatars}}" wx:key="userId" wx:for-item="avatar">
            <view wx:if="{{avatar.isMore}}" class="like-avatar-more">+</view>
            <image wx:elif="{{avatar.avatarUrl}}" class="like-avatar-img" src="{{avatar.avatarUrl}}" mode="aspectFill" />
            <view wx:else class="like-avatar-text">{{avatar.avatarText}}</view>
          </block>
        </view>
      </view>''')

with open('miniprogram/pages/course-detail/course-detail.wxml', 'w') as f:
    f.write(content)

print("done")
