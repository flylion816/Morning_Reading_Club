const app = getApp();
const userService = require('../../services/user.service');
const constants = require('../../config/constants');

Page({
  data: {
    nickname: '',
    avatar: '🦁',
    signature: '',
    avatarList: ['🦁', '🐯', '🐻', '🐼', '🐨', '🦊', '🦝', '🐶', '🐱', '🦌', '🦅', '⭐'],
    saving: false
  },

  onLoad() {
    const userInfo = app.globalData.userInfo || {};
    this.setData({
      nickname: userInfo.nickname || userInfo.name || '',
      avatar: userInfo.avatar || '🦁',
      signature: userInfo.signature || ''
    });
  },

  selectAvatar(e) {
    const { avatar } = e.currentTarget.dataset;
    this.setData({ avatar });
  },

  onNicknameInput(e) {
    this.setData({ nickname: e.detail.value });
  },

  onSignatureInput(e) {
    this.setData({ signature: e.detail.value });
  },

  async handleSave() {
    const { nickname, avatar, signature, saving } = this.data;

    if (saving) return;

    if (!nickname.trim()) {
      wx.showToast({ title: '请输入昵称', icon: 'none' });
      return;
    }

    this.setData({ saving: true });

    try {
      const response = await userService.updateUserProfile({
        avatar,
        nickname: nickname.trim(),
        signature: signature || null
      });

      if (response && response._id) {
        const updatedUserInfo = {
          ...app.globalData.userInfo,
          avatar,
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
