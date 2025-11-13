const checkinService = require('../../services/checkin.service');
const courseService = require('../../services/course.service');

Page({
  data: {
    courseId: null,
    sectionId: null,
    courseTitle: '',
    courseDate: '',

    // 五大学习模块内容
    meditation: '',
    question: '',
    content: '',
    reflection: '',
    action: '',

    // UI状态
    expanded: false,

    // 日记内容
    diaryContent: '',

    // 可见范围
    visibility: 'all', // 'all' 或 'admin'

    // 附件
    images: [],
    videos: [],
    voices: []
  },

  async onLoad(options) {
    console.log('打卡页面加载，参数:', options);

    const courseId = options.courseId || options.id;

    this.setData({
      courseId: courseId,
      sectionId: courseId  // 统一使用 courseId
    });

    // 加载课程详情
    await this.loadCourseDetail();
  },

  async loadCourseDetail() {
    try {
      const course = await courseService.getCourseDetail(this.data.courseId);
      console.log('打卡页面-加载课程详情:', course);

      this.setData({
        courseTitle: course.title || '',
        courseDate: `${course.startDate} 至 ${course.endDate}`,
        meditation: course.meditation || '',
        question: course.question || '',
        content: course.content || '',
        reflection: course.reflection || '',
        action: course.action || ''
      });
    } catch (error) {
      console.error('加载课程详情失败:', error);
    }
  },

  // 切换展开/收起
  toggleExpand() {
    this.setData({
      expanded: !this.data.expanded
    });
  },

  // 输入日记内容
  handleInput(e) {
    this.setData({
      diaryContent: e.detail.value
    });
  },

  // 选择可见范围
  handleVisibilityChange(e) {
    const { value } = e.currentTarget.dataset;
    this.setData({
      visibility: value
    });
  },

  // 添加语音
  handleVoice() {
    wx.showToast({
      title: '语音功能待开发',
      icon: 'none'
    });
  },

  // 添加视频
  handleVideo() {
    wx.chooseVideo({
      sourceType: ['album', 'camera'],
      maxDuration: 60,
      camera: 'back',
      success: (res) => {
        console.log('选择视频:', res);
        const videos = this.data.videos;
        if (videos.length >= 9) {
          wx.showToast({
            title: '最多添加9个视频',
            icon: 'none'
          });
          return;
        }
        videos.push(res.tempFilePath);
        this.setData({ videos });
      }
    });
  },

  // 添加图片
  handleImage() {
    wx.chooseImage({
      count: 9 - this.data.images.length,
      sizeType: ['original', 'compressed'],
      sourceType: ['album', 'camera'],
      success: (res) => {
        const images = this.data.images.concat(res.tempFilePaths);
        this.setData({ images });
      }
    });
  },

  // 添加微信文件
  handleFile() {
    wx.showToast({
      title: '文件功能待开发',
      icon: 'none'
    });
  },

  // 取消
  handleCancel() {
    wx.navigateBack();
  },

  // 提交打卡
  async handleSubmit() {
    if (!this.data.diaryContent.trim()) {
      wx.showToast({
        title: '请输入打卡内容',
        icon: 'none'
      });
      return;
    }

    try {
      wx.showLoading({ title: '提交中...' });

      const result = await checkinService.submitCheckin({
        courseId: this.data.courseId,
        sectionId: this.data.sectionId,
        content: this.data.diaryContent,
        visibility: this.data.visibility,
        images: this.data.images,
        videos: this.data.videos,
        voices: this.data.voices
      });

      // 保存打卡记录到本地存储
      const storageKey = `checkins_${this.data.courseId}`;
      let checkins = wx.getStorageSync(storageKey) || [];

      console.log('保存打卡前的记录:', checkins);
      console.log('存储Key:', storageKey);
      console.log('courseId:', this.data.courseId);

      // 创建新的打卡记录
      const newCheckin = {
        id: result.id || Date.now(),
        userId: 1000, // 当前用户ID（mock）
        userName: '我',
        avatarText: '我',
        avatarColor: '#4a90e2',
        content: this.data.diaryContent,
        likeCount: 0,
        createTime: '刚刚',
        isLiked: false,
        replies: [],
        // 添加课程信息，用于在列表页显示
        courseId: this.data.courseId,
        courseTitle: this.data.courseTitle,
        timestamp: Date.now()
      };

      checkins.unshift(newCheckin); // 添加到开头
      wx.setStorageSync(storageKey, checkins);

      // 同时保存到全局打卡记录（用于课程列表页显示）
      const allCheckinsKey = 'all_checkins';
      let allCheckins = wx.getStorageSync(allCheckinsKey) || [];
      allCheckins.unshift(newCheckin);
      wx.setStorageSync(allCheckinsKey, allCheckins);

      console.log('保存打卡后的记录:', checkins);
      console.log('全局打卡记录:', allCheckins);

      wx.hideLoading();
      wx.showToast({
        title: '打卡成功',
        icon: 'success'
      });

      setTimeout(() => {
        wx.navigateBack();
      }, 1500);
    } catch (error) {
      wx.hideLoading();
      console.error('打卡失败:', error);
      wx.showToast({
        title: '打卡失败',
        icon: 'none'
      });
    }
  }
});
