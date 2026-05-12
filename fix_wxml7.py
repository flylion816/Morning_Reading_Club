import re

with open('miniprogram/pages/course-detail/course-detail.wxml', 'r') as f:
    content = f.read()

# 1. Detail Checkin Reply Footer
content = content.replace('''              <view class="reply-footer">
                <view class="reply-like" bindtap="handleLikeReply" data-comment-id="{{detailCheckin.id}}" data-reply-id="{{reply.id}}">
                  <text class="like-icon {{reply.isLiked ? 'liked' : ''}}">♡</text>
                  <text class="like-count">{{reply.likeCount || 0}}</text>
                </view>
                <view
                  class="reply-reply"
                  bindtap="handleReplyToReply"
                  data-checkin-id="{{detailCheckin.id}}"
                  data-comment-id="{{reply.id}}"
                  data-reply-id="{{reply.userId}}"
                  data-user-name="{{reply.userName}}">
                  <text class="reply-icon">💬</text>
                  <text>回复</text>
                </view>
              </view>''', '''              <view class="reply-footer">
                <view class="reply-like" bindtap="handleLikeReply" data-comment-id="{{detailCheckin.id}}" data-reply-id="{{reply.id}}">
                  <text class="like-icon {{reply.isLiked ? 'liked' : ''}}">{{reply.isLiked ? '❤️' : '♡'}}</text>
                  <text class="like-count" wx:if="{{reply.likeCount}}">({{reply.likeCount}})</text>
                  <view class="like-avatars" wx:if="{{reply.likeAvatars && reply.likeAvatars.length > 0}}">
                    <block wx:for="{{reply.displayLikeAvatars || reply.likeAvatars}}" wx:key="userId" wx:for-item="avatar">
                      <view wx:if="{{avatar.isMore}}" class="like-avatar-more">+</view>
                      <image wx:elif="{{avatar.avatarUrl}}" class="like-avatar-img" src="{{avatar.avatarUrl}}" mode="aspectFill" />
                      <view wx:else class="like-avatar-text">{{avatar.avatarText}}</view>
                    </block>
                  </view>
                </view>
                <view class="comment-actions-right">
                  <view
                    class="reply-reply"
                    bindtap="handleReplyToReply"
                    data-checkin-id="{{detailCheckin.id}}"
                    data-comment-id="{{reply.id}}"
                    data-reply-id="{{reply.userId}}"
                    data-user-name="{{reply.userName}}">
                    <text class="reply-icon">💬</text>
                    <text>回复</text>
                  </view>
                  <view wx:if="{{reply.canDelete}}" class="reply-delete" catchtap="handleDeleteComment" data-checkin-id="{{detailCheckin.id}}" data-comment-id="{{reply.id}}" style="pointer-events: auto;">
                    <text>删除</text>
                  </view>
                </view>
              </view>''')

# 2. Detail Checkin Nested Reply Footer
content = content.replace('''                            <view class="nested-reply-footer">
                              <view class="nested-reply-like" bindtap="handleLikeReply" data-comment-id="{{detailCheckin.id}}" data-reply-id="{{nestedReply.id}}">
                                <text class="like-icon {{nestedReply.isLiked ? 'liked' : ''}}">♡</text>
                                <text class="like-count">{{nestedReply.likeCount || 0}}</text>
                              </view>
                            </view>''', '''                            <view class="nested-reply-footer">
                              <view class="nested-reply-like" bindtap="handleLikeReply" data-comment-id="{{detailCheckin.id}}" data-reply-id="{{nestedReply.id}}">
                                <text class="like-icon {{nestedReply.isLiked ? 'liked' : ''}}">{{nestedReply.isLiked ? '❤️' : '♡'}}</text>
                                <text class="like-count" wx:if="{{nestedReply.likeCount}}">({{nestedReply.likeCount}})</text>
                                <view class="like-avatars" wx:if="{{nestedReply.likeAvatars && nestedReply.likeAvatars.length > 0}}">
                                  <block wx:for="{{nestedReply.displayLikeAvatars || nestedReply.likeAvatars}}" wx:key="userId" wx:for-item="avatar">
                                    <view wx:if="{{avatar.isMore}}" class="like-avatar-more">+</view>
                                    <image wx:elif="{{avatar.avatarUrl}}" class="like-avatar-img" src="{{avatar.avatarUrl}}" mode="aspectFill" />
                                    <view wx:else class="like-avatar-text">{{avatar.avatarText}}</view>
                                  </block>
                                </view>
                              </view>
                              <view class="comment-actions-right">
                                <view wx:if="{{nestedReply.canDelete}}" class="nested-reply-delete" catchtap="handleDeleteComment" data-checkin-id="{{detailCheckin.id}}" data-comment-id="{{nestedReply.id}}" style="pointer-events: auto;">
                                  <text>删除</text>
                                </view>
                              </view>
                            </view>''')

with open('miniprogram/pages/course-detail/course-detail.wxml', 'w') as f:
    f.write(content)

print("done")
