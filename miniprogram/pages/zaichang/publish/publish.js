const imprintService = require('../../../services/imprint.service');
const request = require('../../../utils/request');
const envConfig = require('../../../config/env');
const currentTenant = require('../../../config/current-tenant');
const activityService = require('../../../services/activity.service');
const { tenantStorage } = require('../../../utils/storage');
const constants = require('../../../config/constants');
const enrollmentService = require('../../../services/enrollment.service');
const { hasPaidEnrollment, redirectAfterCommunityDenied } = require('../../../utils/period-access');

const DEFAULT_ACTIVITY_TYPES = [
  { key: 'reading', label: '📚 读书会' },
  { key: 'cooking', label: '🍳 做饭' },
  { key: 'tea', label: '☕ 喝茶' },
  { key: 'walk', label: '🚶 散步' },
  { key: 'create', label: '🎨 创作' },
  { key: 'other', label: '✨ 其他' }
];

Page({
  data: {
    checking: true,
    mediaList: [],
    title: '',
    activityType: '',
    location: '',
    description: '',
    attendees: [],
    submitting: false,
    showAttendeePanel: false,
    attendeeSearch: '',
    searchResults: [],
    manualName: '',
    activityTypes: DEFAULT_ACTIVITY_TYPES,
    uploading: false,
    justAdded: false,
    editId: null,
    hasVideo: false,
    dragIndex: -1,
    dropIndex: -1
  },

  _dragStartIndex: -1,
  _gridLeft: 0,
  _gridTop: 0,
  _itemSize: 216, // 200rpx + 16rpx gap, approximate px

  async onLoad(options) {
    if (!tenantStorage.get(constants.STORAGE_KEYS.TOKEN)) {
      wx.redirectTo({ url: '/pages/index/index' });
      return;
    }
    const userEnrollments = await enrollmentService
      .getUserEnrollments({ limit: 100 })
      .catch(() => ({ list: [] }));
    const enrollmentList = userEnrollments.list || userEnrollments || [];
    if (!hasPaidEnrollment(enrollmentList)) {
      redirectAfterCommunityDenied('/pages/index/index', '完成支付后可使用此功能');
      return;
    }
    this.setData({ checking: false });
    this.loadActivityTypes();
    if (!options.id) {
      activityService.track('zaichang_publish_view');
    }
    if (options.id) {
      this.setData({ editId: options.id });
      wx.setNavigationBarTitle({ title: '编辑印记' });
      try {
        const res = await imprintService.detail(options.id);
        const imprint = res.imprint || res;
        const mediaList = imprint.mediaList || [];
        this.setData({
          title: imprint.title || '',
          activityType: imprint.activityType || '',
          location: imprint.location || '',
          description: imprint.description || '',
          mediaList,
          attendees: (imprint.attendees || []).map(a => ({
            userId: a.userId || null,
            name: a.name,
            isRegistered: a.isRegistered,
            avatarUrl: a.avatarUrl || ''
          }))
        });
        this._syncMediaState(mediaList);
      } catch (e) {
        wx.showToast({ title: '加载失败', icon: 'none' });
      }
    }
  },

  async loadActivityTypes() {
    try {
      const res = await imprintService.getActivityTypes();
      const types = Array.isArray(res) ? res : (res.list || res.data || []);
      if (types.length > 0) {
        this.setData({ activityTypes: types.map(t => ({ key: t.key, label: `${t.emoji} ${t.label}` })) });
      }
    } catch (e) {
      // 降级使用默认列表
    }
  },

  async onChooseMedia() {
    const { mediaList } = this.data;
    if (mediaList.some(m => m.type === 'video')) return;

    const hasImages = mediaList.some(m => m.type !== 'video');
    const remaining = 9 - mediaList.length;
    if (remaining <= 0) return wx.showToast({ title: '最多9张图片', icon: 'none' });

    if (hasImages) {
      // 已有图片，直接选图片
      this._doChooseMedia(['image'], remaining);
    } else {
      // 空状态，先让用户选类型
      wx.showActionSheet({
        itemList: ['选择图片（最多9张）', '选择视频（仅1个）'],
        success: (res) => {
          if (res.tapIndex === 0) {
            this._doChooseMedia(['image'], 9);
          } else {
            this._doChooseMedia(['video'], 1);
          }
        }
      });
    }
  },

  async _doChooseMedia(mediaType, count) {
    wx.chooseMedia({
      count,
      mediaType,
      sourceType: ['album', 'camera'],
      sizeType: ['compressed'],
      maxDuration: 60,
      success: async (res) => {
        this.setData({ uploading: true });

        let processFiles = res.tempFiles.slice(0, count);
        processFiles = processFiles.filter(f => {
          const limit = f.fileType === 'video' ? 50 * 1024 * 1024 : 2 * 1024 * 1024;
          return f.size <= limit;
        });

        const skipped = res.tempFiles.length - processFiles.length;
        if (skipped > 0) wx.showToast({ title: `${skipped}个文件已跳过`, icon: 'none', duration: 2000 });
        if (processFiles.length === 0) { this.setData({ uploading: false }); return; }

        const token = tenantStorage.get(constants.STORAGE_KEYS.TOKEN);
        const uploadUrl = `${envConfig.apiBaseUrl}/imprints/upload`;

        const results = await Promise.allSettled(
          processFiles.map(f => new Promise((resolve, reject) => {
            const filePath = f.tempFilePath || f.tempVideoPath;
            wx.uploadFile({
              url: uploadUrl,
              filePath,
              name: 'file',
              header: { Authorization: `Bearer ${token}`, 'X-Wx-AppId': currentTenant.wxAppId },
              success: (r) => {
                try {
                  const data = JSON.parse(r.data);
                  if (data.code === 0 || data.success) resolve(data.data);
                  else reject(new Error(data.message || '上传失败'));
                } catch (e) { reject(e); }
              },
              fail: (err) => { reject(err); }
            });
          }))
        );

        const uploaded = results
          .filter(r => r.status === 'fulfilled')
          .map(r => ({ type: r.value.type || 'image', url: r.value.url, thumbUrl: r.value.thumbUrl }));
        const failed = results.filter(r => r.status === 'rejected').length;

        const newList = [...this.data.mediaList, ...uploaded];
        this.setData({ mediaList: newList, uploading: false });
        this._syncMediaState(newList);
        if (failed > 0) wx.showToast({ title: `${failed}个上传失败`, icon: 'none' });
      }
    });
  },

  _syncMediaState(mediaList) {
    this.setData({ hasVideo: mediaList.some(m => m.type === 'video') });
  },

  onPreviewVideo(e) {
    wx.previewMedia({ sources: [{ url: e.currentTarget.dataset.url, type: 'video' }] });
  },

  onRemoveImage(e) {
    const idx = e.currentTarget.dataset.index;
    const mediaList = [...this.data.mediaList];
    mediaList.splice(idx, 1);
    this.setData({ mediaList });
    this._syncMediaState(mediaList);
  },

  onLongPress(e) {
    const index = e.currentTarget.dataset.index;
    wx.vibrateShort({ type: 'medium' });
    // 查询网格位置，用于后续 touchmove 计算
    wx.createSelectorQuery().select('#media-grid').boundingClientRect(rect => {
      if (rect) {
        this._gridLeft = rect.left;
        this._gridTop = rect.top;
        // 每格宽度 = (网格宽 - 2*gap) / 3，gap=8px
        this._itemSize = (rect.width - 16) / 3;
      }
    }).exec();
    this._dragStartIndex = index;
    this.setData({ dragIndex: index, dropIndex: index });
  },

  onTouchStart(e) {
    // 仅在长按已触发拖拽时处理
  },

  onTouchMove(e) {
    if (this._dragStartIndex < 0) return;
    const touch = e.touches[0];
    const x = touch.clientX - this._gridLeft;
    const y = touch.clientY - this._gridTop;
    const size = this._itemSize + 8; // item + gap
    const col = Math.max(0, Math.min(2, Math.floor(x / size)));
    const row = Math.max(0, Math.floor(y / size));
    const targetIndex = Math.min(row * 3 + col, this.data.mediaList.length - 1);
    if (targetIndex !== this.data.dropIndex) {
      this.setData({ dropIndex: targetIndex });
    }
  },

  onTouchEnd() {
    if (this._dragStartIndex < 0) return;
    const from = this._dragStartIndex;
    const to = this.data.dropIndex;
    this._dragStartIndex = -1;
    if (from !== to && to >= 0) {
      const list = [...this.data.mediaList];
      const item = list.splice(from, 1)[0];
      list.splice(to, 0, item);
      this.setData({ mediaList: list, dragIndex: -1, dropIndex: -1 });
    } else {
      this.setData({ dragIndex: -1, dropIndex: -1 });
    }
  },

  onSelectType(e) {
    this.setData({ activityType: e.currentTarget.dataset.key });
  },

  onTitleInput(e) { this.setData({ title: e.detail.value }); },
  onLocationInput(e) { this.setData({ location: e.detail.value }); },
  onDescInput(e) { this.setData({ description: e.detail.value }); },

  onShowAttendeePanel() { this.setData({ showAttendeePanel: true, attendeeSearch: '', searchResults: [] }); },
  onHideAttendeePanel() { this.setData({ showAttendeePanel: false }); },

  _searchTimer: null,
  onAttendeeSearchInput(e) {
    const q = e.detail.value;
    this.setData({ attendeeSearch: q });
    clearTimeout(this._searchTimer);
    if (!q.trim()) { this.setData({ searchResults: [] }); return; }
    this._searchTimer = setTimeout(async () => {
      try {
        const res = await request.get('/users/search', { search: q, pageSize: 10 });
        const list = (res.list || res.users || []).filter(u =>
          !this.data.attendees.find(a => a.userId === u._id)
        );
        this.setData({ searchResults: list });
      } catch (e) { this.setData({ searchResults: [] }); }
    }, 300);
  },

  onAddAttendee(e) {
    const user = e.currentTarget.dataset.user;
    if (this.data.attendees.find(a => a.userId === user._id)) return;
    this.setData({
      attendees: [...this.data.attendees, { userId: user._id, name: user.nickname, isRegistered: true, avatarUrl: user.avatarUrl || '' }],
      searchResults: [],
      attendeeSearch: '',
      justAdded: true
    });
    wx.showToast({ title: `已添加 ${user.nickname}`, icon: 'none', duration: 1500 });
    setTimeout(() => this.setData({ justAdded: false }), 100);
  },

  onManualNameInput(e) { this.setData({ manualName: e.detail.value }); },

  onAddManualAttendee() {
    const name = this.data.manualName.trim();
    if (!name) return;
    this.setData({
      attendees: [...this.data.attendees, { userId: null, name, isRegistered: false }],
      manualName: ''
    });
    wx.showToast({ title: `已添加 ${name}`, icon: 'none', duration: 1500 });
  },

  onRemoveAttendee(e) {
    const idx = e.currentTarget.dataset.index;
    const attendees = [...this.data.attendees];
    attendees.splice(idx, 1);
    this.setData({ attendees });
  },

  async onSubmit() {
    const { mediaList, title, activityType, editId } = this.data;
    if (mediaList.length === 0) return wx.showToast({ title: '请至少选一张图片', icon: 'none' });
    if (!title.trim()) return wx.showToast({ title: '请填写标题', icon: 'none' });
    if (!activityType) return wx.showToast({ title: '请选择活动类型', icon: 'none' });
    if (this.data.submitting) return;

    this.setData({ submitting: true });
    wx.showLoading({ title: editId ? '保存中...' : '发布中...' });
    try {
      const payload = {
        title: title.trim(),
        description: this.data.description.trim(),
        activityType,
        location: this.data.location.trim(),
        mediaList,
        attendees: this.data.attendees.map(a => ({ userId: a.userId || undefined, name: a.name, isRegistered: a.isRegistered }))
      };
      if (editId) {
        await imprintService.update(editId, payload);
      } else {
        await imprintService.create(payload);
        activityService.track('zaichang_imprint_publish');
      }
      wx.hideLoading();
      wx.setStorageSync('zaichang_need_refresh', true);
      wx.showToast({ title: editId ? '保存成功' : '发布成功', icon: 'success' });
      setTimeout(() => wx.navigateBack(), 1200);
    } catch (e) {
      wx.hideLoading();
      wx.showToast({ title: e.message || (editId ? '保存失败' : '发布失败'), icon: 'none' });
    }
    this.setData({ submitting: false });
  }
});
