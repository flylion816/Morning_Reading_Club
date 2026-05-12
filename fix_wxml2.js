const fs = require('fs');
const file = 'miniprogram/pages/course-detail/course-detail.wxml';
let content = fs.readFileSync(file, 'utf8');

content = content.replace(/                      <view class="reply-reply" catchtap="handleReplyToReply"/g, `                      <view class="comment-actions-right">\n                        <view class="reply-reply" catchtap="handleReplyToReply"`);

// It's bindtap="handleReplyToReply" in the current code
content = content.replace(/                      <view class="reply-reply" bindtap="handleReplyToReply"/g, `                      <view class="comment-actions-right">\n                        <view class="reply-reply" bindtap="handleReplyToReply"`);

// Need to close it correctly. The reply-footer closes right after delete.
content = content.replace(/                      <view wx:if="\{\{reply\.canDelete\}\}" class="reply-delete" catchtap="handleDeleteComment" data-checkin-id="\{\{item\.id\}\}" data-comment-id="\{\{reply\.id\}\}" style="pointer-events: auto;">\n                        <text>删除<\/text>\n                      <\/view>\n                    <\/view>/g, `                      <view wx:if="{{reply.canDelete}}" class="reply-delete" catchtap="handleDeleteComment" data-checkin-id="{{item.id}}" data-comment-id="{{reply.id}}" style="pointer-events: auto;">\n                        <text>删除</text>\n                      </view>\n                      </view>\n                    </view>`);

// Nested replies don't have reply/delete in the screenshot? Yes they do. But in our WXML we didn't add comment-actions-right to nested replies yet.
content = content.replace(/                              <view class="nested-reply-reply" bindtap="handleReplyToReply"/g, `                              <view class="comment-actions-right">\n                                <view class="nested-reply-reply" bindtap="handleReplyToReply"`);
content = content.replace(/                              <view wx:if="\{\{nestedReply\.canDelete\}\}" class="nested-reply-delete" catchtap="handleDeleteComment" data-checkin-id="\{\{item\.id\}\}" data-comment-id="\{\{nestedReply\.id\}\}" style="pointer-events: auto;">\n                                <text>删除<\/text>\n                              <\/view>\n                            <\/view>/g, `                              <view wx:if="{{nestedReply.canDelete}}" class="nested-reply-delete" catchtap="handleDeleteComment" data-checkin-id="{{item.id}}" data-comment-id="{{nestedReply.id}}" style="pointer-events: auto;">\n                                <text>删除</text>\n                              </view>\n                              </view>\n                            </view>`);

fs.writeFileSync(file, content);
console.log('done fixing reply actions');
