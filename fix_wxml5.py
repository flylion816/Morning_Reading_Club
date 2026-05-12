import re

with open('miniprogram/pages/course-detail/course-detail.wxml', 'r') as f:
    content = f.read()

# 1. Main checkin footer
content = content.replace('''              <view class="comment-like" catchtap="handleLikeComment" data-id="{{item.id}}">
                <text class="like-icon {{item.isLiked ? 'liked' : ''}}">❤️ {{item.likeCount ? '(' + item.likeCount + ')' : ''}}</text>
                <view class="like-avatars" wx:if="{{item.likeAvatars && item.likeAvatars.length > 0}}">''', '''              <view class="comment-like" catchtap="handleLikeComment" data-id="{{item.id}}">
                <text class="like-icon {{item.isLiked ? 'liked' : ''}}">{{item.isLiked ? '❤️' : '♡'}}</text>
                <text class="like-count" wx:if="{{item.likeCount}}">({{item.likeCount}})</text>
                <view class="like-avatars" wx:if="{{item.likeAvatars && item.likeAvatars.length > 0}}">''')

# 2. Reply footer
content = content.replace('''                      <view class="reply-like" bindtap="handleLikeReply" data-comment-id="{{item.id}}" data-reply-id="{{reply.id}}" style="pointer-events: auto;">
                        <text class="like-icon {{reply.isLiked ? 'liked' : ''}}">❤️ {{reply.likeCount ? '(' + reply.likeCount + ')' : ''}}</text>
                        <view class="like-avatars" wx:if="{{reply.likeAvatars && reply.likeAvatars.length > 0}}">''', '''                      <view class="reply-like" bindtap="handleLikeReply" data-comment-id="{{item.id}}" data-reply-id="{{reply.id}}" style="pointer-events: auto;">
                        <text class="like-icon {{reply.isLiked ? 'liked' : ''}}">{{reply.isLiked ? '❤️' : '♡'}}</text>
                        <text class="like-count" wx:if="{{reply.likeCount}}">({{reply.likeCount}})</text>
                        <view class="like-avatars" wx:if="{{reply.likeAvatars && reply.likeAvatars.length > 0}}">''')

# 3. Nested reply footer
content = content.replace('''                              <view class="nested-reply-like" bindtap="handleLikeReply" data-comment-id="{{item.id}}" data-reply-id="{{nestedReply.id}}" style="pointer-events: auto;">
                                <text class="like-icon {{nestedReply.isLiked ? 'liked' : ''}}">❤️ {{nestedReply.likeCount ? '(' + nestedReply.likeCount + ')' : ''}}</text>
                                <view class="like-avatars" wx:if="{{nestedReply.likeAvatars && nestedReply.likeAvatars.length > 0}}">''', '''                              <view class="nested-reply-like" bindtap="handleLikeReply" data-comment-id="{{item.id}}" data-reply-id="{{nestedReply.id}}" style="pointer-events: auto;">
                                <text class="like-icon {{nestedReply.isLiked ? 'liked' : ''}}">{{nestedReply.isLiked ? '❤️' : '♡'}}</text>
                                <text class="like-count" wx:if="{{nestedReply.likeCount}}">({{nestedReply.likeCount}})</text>
                                <view class="like-avatars" wx:if="{{nestedReply.likeAvatars && nestedReply.likeAvatars.length > 0}}">''')


# 4. Fix detail Checkin Top Pill (dynamic-like-strip)
# First we need to find it and inject the avatars
# Currently it is:
#     <view wx:if="{{detailCheckin}}" class="dynamic-like-strip">
#       <view class="dynamic-like-pill" bindtap="handleLikeComment" data-id="{{detailCheckin.id}}">
#         <text class="dynamic-like-pill-icon {{detailCheckin.isLiked ? 'liked' : ''}}">♡</text>
#         <text class="dynamic-like-pill-count">{{detailCheckin.likeCount || 0}}</text>
#       </view>
#     </view>

content = content.replace('''    <view wx:if="{{detailCheckin}}" class="dynamic-like-strip">
      <view class="dynamic-like-pill" bindtap="handleLikeComment" data-id="{{detailCheckin.id}}">
        <text class="dynamic-like-pill-icon {{detailCheckin.isLiked ? 'liked' : ''}}">♡</text>
        <text class="dynamic-like-pill-count">{{detailCheckin.likeCount || 0}}</text>
      </view>
    </view>''', '''    <view wx:if="{{detailCheckin}}" class="dynamic-like-strip">
      <view class="dynamic-like-pill" bindtap="handleLikeComment" data-id="{{detailCheckin.id}}">
        <text class="dynamic-like-pill-icon {{detailCheckin.isLiked ? 'liked' : ''}}">{{detailCheckin.isLiked ? '❤️' : '♡'}}</text>
        <text class="like-count" wx:if="{{detailCheckin.likeCount}}">({{detailCheckin.likeCount}})</text>
        <view class="like-avatars" wx:if="{{detailCheckin.likeAvatars && detailCheckin.likeAvatars.length > 0}}">
          <block wx:for="{{detailCheckin.displayLikeAvatars || detailCheckin.likeAvatars}}" wx:key="userId" wx:for-item="avatar">
            <view wx:if="{{avatar.isMore}}" class="like-avatar-more">+</view>
            <image wx:elif="{{avatar.avatarUrl}}" class="like-avatar-img" src="{{avatar.avatarUrl}}" mode="aspectFill" />
            <view wx:else class="like-avatar-text">{{avatar.avatarText}}</view>
          </block>
        </view>
      </view>
    </view>''')

# 5. Fix Detail Checkin Bottom Bar
# Remove the pill I accidentally inserted there
content = content.replace('''      <view class="dynamic-like-pill" bindtap="handleLikeComment" data-id="{{detailCheckin.id}}">
        <text class="dynamic-like-pill-icon {{detailCheckin.isLiked ? 'liked' : ''}}">❤️ {{detailCheckin.likeCount ? '(' + detailCheckin.likeCount + ')' : ''}}</text>
        <view class="like-avatars" wx:if="{{detailCheckin.likeAvatars && detailCheckin.likeAvatars.length > 0}}">
          <block wx:for="{{detailCheckin.displayLikeAvatars || detailCheckin.likeAvatars}}" wx:key="userId" wx:for-item="avatar">
            <view wx:if="{{avatar.isMore}}" class="like-avatar-more">+</view>
            <image wx:elif="{{avatar.avatarUrl}}" class="like-avatar-img" src="{{avatar.avatarUrl}}" mode="aspectFill" />
            <view wx:else class="like-avatar-text">{{avatar.avatarText}}</view>
          </block>
        </view>
      </view>''', '''      <view class="dynamic-bottom-action" bindtap="handleLikeComment" data-id="{{detailCheckin.id}}">
        <text class="dynamic-bottom-action-icon {{detailCheckin.isLiked ? 'liked' : ''}}">{{detailCheckin.isLiked ? '❤️' : '♡'}}</text>
        <text>{{detailCheckin.likeCount || 0}}</text>
      </view>''')

with open('miniprogram/pages/course-detail/course-detail.wxml', 'w') as f:
    f.write(content)

print("done")
