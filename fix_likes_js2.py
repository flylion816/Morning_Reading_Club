import re

with open('miniprogram/pages/course-detail/course-detail.js', 'r') as f:
    content = f.read()

# Fix handleLikeComment
content = re.sub(
    r"this\.triggerAutoTopUp\('course_detail_like_checkin'\);\s+const \{ id \} = e\.currentTarget\.dataset;",
    "this.triggerAutoTopUp('course_detail_like_checkin');\n\n    const app = getApp();\n    const currentUserId = String(app.globalData.userInfo?._id || app.globalData.userInfo?.id || '');\n\n    const { id } = e.currentTarget.dataset;",
    content
)

# Fix handleLikeReply
content = re.sub(
    r"this\.triggerAutoTopUp\('course_detail_like_reply'\);\s+const \{ commentId, replyId \} = e\.currentTarget\.dataset;",
    "this.triggerAutoTopUp('course_detail_like_reply');\n\n    const app = getApp();\n    const currentUserId = String(app.globalData.userInfo?._id || app.globalData.userInfo?.id || '');\n\n    const { commentId, replyId } = e.currentTarget.dataset;",
    content
)

with open('miniprogram/pages/course-detail/course-detail.js', 'w') as f:
    f.write(content)

print("done")
