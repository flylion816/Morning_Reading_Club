// 成员列表页面
Page({
  data: {
    periodId: null,

    // 成员总数
    totalMembers: 0,

    // 成员列表
    members: []
  },

  onLoad(options) {
    console.log('成员列表页面加载', options);
    if (options.periodId) {
      this.setData({ periodId: parseInt(options.periodId) });
    }

    this.loadMembers();
  },

  /**
   * 加载成员列表
   */
  loadMembers() {
    // Mock 数据 - 后续替换为真实接口
    const mockMembers = this.generateMockMembers();

    this.setData({
      members: mockMembers,
      totalMembers: mockMembers.length
    });
  },

  /**
   * 生成 Mock 成员数据
   */
  generateMockMembers() {
    const colors = ['#4a90e2', '#e74c3c', '#f39c12', '#2ecc71', '#9b59b6', '#1abc9c'];
    const names = [
      '张三', '李四', '王五', '赵六', '钱七', '孙八',
      '周九', '吴十', '郑十一', '陈十二', '褚十三', '卫十四',
      '蒋十五', '沈十六', '韩十七', '杨十八', '朱十九', '秦二十'
    ];

    const members = [];
    const now = new Date();

    for (let i = 0; i < 18; i++) {
      const name = names[i];

      // 生成加入日期（最近30天内的随机日期）
      const daysAgo = Math.floor(Math.random() * 30);
      const joinDate = new Date(now.getTime() - daysAgo * 24 * 60 * 60 * 1000);
      const dateStr = `${joinDate.getFullYear()}-${String(joinDate.getMonth() + 1).padStart(2, '0')}-${String(joinDate.getDate()).padStart(2, '0')}`;

      members.push({
        userId: 2000 + i,
        userName: name,
        avatarText: name.charAt(name.length - 1),
        avatarColor: colors[i % colors.length],
        joinDate: dateStr
      });
    }

    // 按加入时间倒序排序（最新的在前面）
    members.sort((a, b) => {
      return new Date(b.joinDate).getTime() - new Date(a.joinDate).getTime();
    });

    return members;
  }
});
