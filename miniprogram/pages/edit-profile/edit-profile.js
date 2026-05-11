const app = getApp();
const userService = require('../../services/user.service');
const activityService = require('../../services/activity.service');
const constants = require('../../config/constants');

Page({
  data: {
    nickname: '',
    avatar: '🦁',
    avatarUrl: '',
    signature: '',
    saving: false
  },

  onLoad() {
    const userInfo = app.globalData.userInfo || {};
    this.setData({
      nickname: userInfo.nickname || userInfo.name || '',
      avatar: userInfo.avatar || '🦁',
      avatarUrl: userInfo.avatarUrl || '',
      signature: userInfo.signature || ''
    });
  },

  async handleChooseWechatAvatar(e) {
    const avatarUrl = e.detail && e.detail.avatarUrl;
    if (!avatarUrl) {
      wx.showToast({ title: '未获取到头像', icon: 'none' });
      return;
    }

    const normalizedAvatar = await this.compressAvatarImage(avatarUrl);
    this.setData({ avatarUrl: normalizedAvatar });
  },

  compressAvatarImage(filePath) {
    if (!filePath || !wx.compressImage) {
      return Promise.resolve(filePath);
    }

    return new Promise((resolve) => {
      wx.compressImage({
        src: filePath,
        quality: 80,
        success: (res) => {
          resolve(res.tempFilePath || filePath);
        },
        fail: () => {
          resolve(filePath);
        }
      });
    });
  },

  isRemoteAvatarUrl(avatarUrl) {
    return /^https?:\/\//i.test(avatarUrl || '');
  },

  async prepareAvatarUrlForSave(avatarUrl) {
    if (!avatarUrl || this.isRemoteAvatarUrl(avatarUrl)) {
      return avatarUrl || '';
    }

    const uploadResult = await userService.uploadAvatar(avatarUrl);
    return uploadResult.avatarUrl || uploadResult.url || '';
  },

  onNicknameInput(e) {
    this.setData({ nickname: e.detail.value });
  },

  onSignatureInput(e) {
    this.setData({ signature: e.detail.value });
  },

  async handleSave() {
    const { nickname, avatar, avatarUrl, signature, saving } = this.data;

    if (saving) return;

    if (!nickname.trim()) {
      wx.showToast({ title: '请输入昵称', icon: 'none' });
      return;
    }

    this.setData({ saving: true });

    try {
      const savedAvatarUrl = await this.prepareAvatarUrlForSave(avatarUrl);
      const response = await userService.updateUserProfile({
        avatar,
        avatarUrl: savedAvatarUrl,
        nickname: nickname.trim(),
        signature: signature || null
      });

      if (response && response._id) {
        activityService.track('profile_update', {
          targetType: 'profile'
        });

        const updatedUserInfo = {
          ...app.globalData.userInfo,
          avatar,
          avatarUrl: response.avatarUrl !== undefined ? response.avatarUrl : savedAvatarUrl,
          nickname: nickname.trim(),
          signature: signature || null
        };

        app.globalData.userInfo = updatedUserInfo;
        wx.setStorageSync(constants.STORAGE_KEYS.USER_INFO, updatedUserInfo);

        wx.showToast({ title: '保存成功', icon: 'success' });

        setTimeout(() => {
          wx.navigateBack();
        }, 800);
      } else {
        wx.showToast({ title: '保存失败，请重试', icon: 'none' });
      }
    } catch (error) {
      console.error('保存用户信息失败:', error);
      wx.showToast({ title: '保存失败，请重试', icon: 'none' });
    } finally {
      this.setData({ saving: false });
    }
  }
});
