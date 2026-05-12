import re

with open('miniprogram/pages/course-detail/course-detail.js', 'r') as f:
    content = f.read()

# Fix handleLikeComment
content = content.replace('''  async handleLikeComment(e) {
    if (!this.checkLoginStatus()) return;

    this.triggerAutoTopUp('course_detail_like_checkin');

    const { id } = e.currentTarget.dataset;''', '''  async handleLikeComment(e) {
    if (!this.checkLoginStatus()) return;

    this.triggerAutoTopUp('course_detail_like_checkin');

    const app = getApp();
    const currentUserId = String(app.globalData.userInfo?._id || app.globalData.userInfo?.id || '');

    const { id } = e.currentTarget.dataset;''')

# Fix handleLikeReply
content = content.replace('''  async handleLikeReply(e) {
    if (!this.checkLoginStatus()) return;

    this.triggerAutoTopUp('course_detail_like_reply');

    const { commentId, replyId } = e.currentTarget.dataset;''', '''  async handleLikeReply(e) {
    if (!this.checkLoginStatus()) return;

    this.triggerAutoTopUp('course_detail_like_reply');

    const app = getApp();
    const currentUserId = String(app.globalData.userInfo?._id || app.globalData.userInfo?.id || '');

    const { commentId, replyId } = e.currentTarget.dataset;''')

with open('miniprogram/pages/course-detail/course-detail.js', 'w') as f:
    f.write(content)

print("done")
