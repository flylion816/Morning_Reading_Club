import re

with open('miniprogram/pages/course-detail/course-detail.wxml', 'r') as f:
    content = f.read()

# Fix any remaining instances of the old ♡ markup inside reply-like and nested-reply-like
# We use regex to find `<view class=".*?reply-like" ...>` and update the contents

# 1. Reply Like
pattern_reply = re.compile(
    r'(<view class="reply-like"[^>]*>)\s*<text class="like-icon \{\{reply\.isLiked \? \'liked\' : \'\'\}\}">♡</text>\s*<text class="like-count">\{\{reply\.likeCount \|\| 0\}\}</text>\s*</view>'
)
replacement_reply = r'''\1
                  <text class="like-icon {{reply.isLiked ? 'liked' : ''}}">{{reply.isLiked ? '❤️' : '♡'}}</text>
                  <text class="like-count" wx:if="{{reply.likeCount}}">({{reply.likeCount}})</text>
                  <view class="like-avatars" wx:if="{{reply.likeAvatars && reply.likeAvatars.length > 0}}">
                    <block wx:for="{{reply.displayLikeAvatars || reply.likeAvatars}}" wx:key="userId" wx:for-item="avatar">
                      <view wx:if="{{avatar.isMore}}" class="like-avatar-more">+</view>
                      <image wx:elif="{{avatar.avatarUrl}}" class="like-avatar-img" src="{{avatar.avatarUrl}}" mode="aspectFill" />
                      <view wx:else class="like-avatar-text">{{avatar.avatarText}}</view>
                    </block>
                  </view>
                </view>'''
content = pattern_reply.sub(replacement_reply, content)

# 2. Nested Reply Like
pattern_nested = re.compile(
    r'(<view class="nested-reply-like"[^>]*>)\s*<text class="like-icon \{\{nestedReply\.isLiked \? \'liked\' : \'\'\}\}">♡</text>\s*<text class="like-count">\{\{nestedReply\.likeCount \|\| 0\}\}</text>\s*</view>'
)
replacement_nested = r'''\1
                          <text class="like-icon {{nestedReply.isLiked ? 'liked' : ''}}">{{nestedReply.isLiked ? '❤️' : '♡'}}</text>
                          <text class="like-count" wx:if="{{nestedReply.likeCount}}">({{nestedReply.likeCount}})</text>
                          <view class="like-avatars" wx:if="{{nestedReply.likeAvatars && nestedReply.likeAvatars.length > 0}}">
                            <block wx:for="{{nestedReply.displayLikeAvatars || nestedReply.likeAvatars}}" wx:key="userId" wx:for-item="avatar">
                              <view wx:if="{{avatar.isMore}}" class="like-avatar-more">+</view>
                              <image wx:elif="{{avatar.avatarUrl}}" class="like-avatar-img" src="{{avatar.avatarUrl}}" mode="aspectFill" />
                              <view wx:else class="like-avatar-text">{{avatar.avatarText}}</view>
                            </block>
                          </view>
                        </view>'''
content = pattern_nested.sub(replacement_nested, content)

with open('miniprogram/pages/course-detail/course-detail.wxml', 'w') as f:
    f.write(content)

print("done")
