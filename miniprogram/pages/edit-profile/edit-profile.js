const { profileValues, isProfileUnchanged, profileError } = require('../../utils/profile-edit');
const app = getApp();
const userService = require('../../services/user.service');
const activityService = require('../../services/activity.service');
const constants = require('../../config/constants');
const { tenantStorage } = require('../../utils/storage');
const { decorateUserAvatar, getUserAvatarDisplay } = require('../../utils/avatar');
const { THEME_PRIMARY } = require('../../utils/theme');

Page({
  data: {
    nickname: '',
    nicknameError: '',
    profileSaveHint: '',
    avatar: '🦁',
    avatarUrl: '',
    avatarText: '用',
    avatarColor: THEME_PRIMARY,
    signature: '',
    saving: false,
    themePrimaryColor: THEME_PRIMARY
  },

  onLoad() {
    const userInfo = app.globalData.userInfo || {};
    const avatarDisplay = getUserAvatarDisplay(userInfo);
    this.setData({
      nickname: userInfo.nickname || userInfo.name || '',
      originalProfile: profileValues(userInfo),
      nicknameError: '',
      profileSaveHint: '',
      avatar: userInfo.avatar || '🦁',
      avatarUrl: userInfo.avatarUrl || '',
      avatarText: userInfo.avatarText || avatarDisplay.avatarText,
      avatarColor: userInfo.avatarColor || avatarDisplay.avatarColor,
      signature: userInfo.signature || ''
    });
  },

  async handleChooseWechatAvatar(e) {
    const avatarUrl = e.detail && e.detail.avatarUrl;
    if (!avatarUrl) {
      wx.showToast({ title: '未获取到头像', icon: 'none' });
      return;
    }

    // 微信头像已是远程 CDN URL，直接使用，无需压缩上传
    if (this.isRemoteAvatarUrl(avatarUrl)) {
      this.setData({ avatarUrl });
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
    const nickname = e.detail.value;
    const avatarDisplay = getUserAvatarDisplay(app.globalData.userInfo || {}, {
      displayName: nickname || '用户'
    });
    this.setData({
      nickname,
      nicknameError: '',
      profileSaveHint: '',
      avatarText: avatarDisplay.avatarText,
      avatarColor: avatarDisplay.avatarColor
    });
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

    const normalizedNickname = nickname.trim();
    if (isProfileUnchanged(this.data, this.data.originalProfile)) {
      wx.showToast({ title: '个人信息未修改，无需保存', icon: 'none' });
      wx.navigateBack({ delta: 1 });
      return;
    }

    this.setData({ saving: true, nicknameError: '', profileSaveHint: '' });

    try {
      const savedAvatarUrl = await this.prepareAvatarUrlForSave(avatarUrl);
      const response = await userService.updateUserProfile({
        avatar,
        avatarUrl: savedAvatarUrl,
        nickname: normalizedNickname,
        signature: signature || null
      });

      if (response && response._id) {
        activityService.track('profile_update', {
          targetType: 'profile'
        });

        const updatedUserInfo = decorateUserAvatar({
          ...app.globalData.userInfo,
          avatar,
          avatarUrl: response.avatarUrl !== undefined ? response.avatarUrl : savedAvatarUrl,
          nickname: normalizedNickname,
          signature: signature || null
        });

        app.globalData.userInfo = updatedUserInfo;
        tenantStorage.set('userInfo', updatedUserInfo);

        wx.showToast({ title: '保存成功', icon: 'success' });

        setTimeout(() => {
          wx.navigateBack({ delta: 1 });
        }, 800);
      } else {
        wx.showToast({ title: '保存失败，请重试', icon: 'none' });
      }
    } catch (error) {
      const failure = profileError(error);
      if (failure.conflict) {
        this.setData({
          nicknameError: failure.message,
          profileSaveHint: `修改未保存，当前昵称仍为「${(this.data.originalProfile || profileValues(app.globalData.userInfo)).nickname}」`
        });
      } else {
        wx.showToast({ title: failure.message, icon: 'none' });
      }
    } finally {
      this.setData({ saving: false });
    }
  }
});
