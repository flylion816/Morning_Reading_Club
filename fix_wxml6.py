import re

with open('miniprogram/pages/course-detail/course-detail.wxml', 'r') as f:
    content = f.read()

# Completely remove the like action from the bottom bar
content = content.replace('''      <view class="dynamic-bottom-action" bindtap="handleLikeComment" data-id="{{detailCheckin.id}}">
        <text class="dynamic-bottom-action-icon {{detailCheckin.isLiked ? 'liked' : ''}}">{{detailCheckin.isLiked ? '❤️' : '♡'}}</text>
        <text>{{detailCheckin.likeCount || 0}}</text>
      </view>''', '')

with open('miniprogram/pages/course-detail/course-detail.wxml', 'w') as f:
    f.write(content)

print("done")
