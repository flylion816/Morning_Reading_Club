/**
 * 分享面板：随喜和觉察共用。
 * 页面里放一个 <joy-share id="joy-share" />，再调用 open(payload)（payload 来自 share-poster.payloadFromNote）。
 *
 *  - 发给微信好友：面板里的 open-type="share" 按钮，页面的 onShareAppMessage 用 getShareConfig() 取卡片信息
 *  - 生成长图：画出带小程序码的长图，可以保存、预览、发给好友
 *  - 谁能看：关联了期次的记录可以选「本期书友」或「所有登录的书友」
 *  - 停止分享：此前的链接和二维码立即失效
 *
 * 只在真正分享时才开启：打开面板会先创建分享，如果这次是新建的，用户关面板时既没转发也没生成长图，就自动撤销。
 */
const service = require('../../share.service');
const poster = require('../../share-poster');
const { getDefaultShareImage, getMiniProgramCode } = require('../../../../utils/brand');

const QR_TIMEOUT_MS = 6000;
const CLOSE_AFTER_FORWARD_MS = 300;

function withTimeout(promise, ms) {
  return Promise.race([promise, new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), ms))]);
}

Component({
  data: {
    visible: false,
    // menu：分享方式；poster：长图预览
    phase: 'menu',
    loading: false,
    share: null,
    audience: '',
    // 这条记录是不是早就在分享中（决定要不要显示「停止分享」）
    canStop: false,
    generating: false,
    posterPath: '',
    posterError: '',
    truncated: false
  },

  lifetimes: {
    detached() {
      clearTimeout(this._closeTimer);
    }
  },

  methods: {
    // ---- 打开 ----
    async open(payload) {
      if (!payload || !payload.id) return;
      clearTimeout(this._closeTimer);
      this._payload = payload;
      this._used = false;
      this._share = null;
      this.setData({
        visible: true,
        phase: 'menu',
        loading: true,
        share: null,
        audience: '',
        canStop: false,
        generating: false,
        posterPath: '',
        posterError: '',
        truncated: false
      });
      try {
        const share = await service.open(payload.id);
        if (!this._payload || this._payload.id !== payload.id) return;
        this._share = share;
        this.setData({ loading: false, share, audience: share.audience, canStop: !share.created });
      } catch (error) {
        this.setData({ visible: false, loading: false });
        wx.showToast({ title: (error && error.message) || '暂时分享不了，稍后再试', icon: 'none' });
      }
    },

    // ---- 谁能看 ----
    async chooseAudience(event) {
      const audience = event.currentTarget.dataset.value;
      if (!this._share || !audience || audience === this.data.audience) return;
      try {
        const updated = await service.open(this._payload.id, audience);
        // created 记的是「这次面板是不是新开启的」，换范围时保持不变
        this._share = { ...updated, created: this._share.created };
        this.setData({ audience: updated.audience, share: this._share });
      } catch (error) {
        wx.showToast({ title: (error && error.message) || '没改成，再试一次', icon: 'none' });
      }
    },

    // ---- 发给微信好友：open-type="share" 的按钮，页面的 onShareAppMessage 会来取 getShareConfig ----
    onForwardTap() {
      this._used = true;
      this.setData({ canStop: true });
      // 稍等一下再收起面板，别让按钮在分享触发前就被拿掉
      clearTimeout(this._closeTimer);
      this._closeTimer = setTimeout(() => this.close(), CLOSE_AFTER_FORWARD_MS);
    },

    // 转发卡片：标题、直达这一页的路径。没有开启分享时返回 null，页面用默认的
    getShareConfig() {
      if (!this._share || !this._payload) return null;
      this._used = true;
      const p = this._payload;
      const subject = p.kind === 'awareness' ? '一次觉察' : '一句随喜';
      const name = p.authorName || '书友';
      const title = p.title ? `${name} 的${subject}：${p.title}` : `${name} 的${subject}`;
      return {
        title: Array.from(title).slice(0, 40).join(''),
        path: `/pages/joy-notes/shared/shared?code=${this._share.code}`,
        imageUrl: getDefaultShareImage()
      };
    },

    // ---- 长图 ----
    getCanvasNode() {
      return new Promise((resolve, reject) => {
        wx.createSelectorQuery()
          .in(this)
          .select('#joyShareCanvas')
          .fields({ node: true, size: true })
          .exec(result => {
            const target = result && result[0];
            if (!target || !target.node) {
              reject(new Error('找不到分享画布'));
              return;
            }
            resolve(target.node);
          });
      });
    },

    loadImage(canvas, candidates) {
      return new Promise((resolve, reject) => {
        let index = 0;
        const tryLoad = () => {
          const src = candidates[index];
          if (!src) {
            reject(new Error('加载图片失败'));
            return;
          }
          const image = canvas.createImage();
          image.onload = () => resolve(image);
          image.onerror = () => {
            index += 1;
            tryLoad();
          };
          image.src = src;
        };
        tryLoad();
      });
    },

    // 专属小程序码（扫码直达这一页）；失败或超时就退回通用小程序码，长图照常可用
    async loadQr(canvas) {
      try {
        const result = await withTimeout(service.qrcode(this._share.code), QR_TIMEOUT_MS);
        if (result && result.imageBase64) {
          // 固定文件名：每次覆盖上一次，不在用户存储里堆积临时文件
          const filePath = `${wx.env.USER_DATA_PATH}/joy-share-qr.png`;
          await new Promise((resolve, reject) => {
            wx.getFileSystemManager().writeFile({
              filePath,
              data: result.imageBase64,
              encoding: 'base64',
              success: resolve,
              fail: reject
            });
          });
          return { image: await this.loadImage(canvas, [filePath]), precise: true };
        }
      } catch (error) {
        console.warn('专属小程序码生成失败，改用通用码', error);
      }
      try {
        return { image: await this.loadImage(canvas, [getMiniProgramCode(), '/assets/images/mini-program-code.jpg']), precise: false };
      } catch (error) {
        return { image: null, precise: false };
      }
    },

    async generatePoster() {
      if (this.data.generating || !this._share) return;
      this._used = true;
      this.setData({ phase: 'poster', generating: true, posterPath: '', posterError: '', canStop: true });
      try {
        const canvas = await this.getCanvasNode();
        const qr = await this.loadQr(canvas);
        const model = poster.buildPosterModel(this._payload);
        const dpr = Math.min((wx.getWindowInfo && wx.getWindowInfo().pixelRatio) || 2, 2);
        const result = poster.renderPoster({ canvas, model, qrImage: qr.image, qrPrecise: qr.precise, dpr });
        const path = await new Promise((resolve, reject) => {
          wx.canvasToTempFilePath({
            canvas,
            width: result.width,
            height: result.height,
            destWidth: Math.round(result.width * result.scale),
            destHeight: Math.round(result.height * result.scale),
            fileType: 'png',
            quality: 1,
            success: res => resolve(res.tempFilePath),
            fail: reject
          });
        });
        this.setData({ generating: false, posterPath: path, truncated: Boolean(result.truncated) });
      } catch (error) {
        console.error('生成分享长图失败:', error);
        this.setData({ generating: false, posterError: '长图没生成出来，再试一次' });
      }
    },

    backToMenu() {
      this.setData({ phase: 'menu' });
    },

    previewPoster() {
      if (!this.data.posterPath) return;
      wx.previewImage({ urls: [this.data.posterPath], current: this.data.posterPath });
    },

    savePoster() {
      if (!this.data.posterPath) return;
      wx.saveImageToPhotosAlbum({
        filePath: this.data.posterPath,
        success: () => wx.showToast({ title: '已保存', icon: 'success' }),
        fail: () => wx.showToast({ title: '没保存上，请允许保存到相册后再试', icon: 'none' })
      });
    },

    sharePosterToFriend() {
      if (!this.data.posterPath) return;
      if (typeof wx.showShareImageMenu === 'function') {
        wx.showShareImageMenu({
          path: this.data.posterPath,
          fail: () => wx.showToast({ title: '没分享出去，再试一次', icon: 'none' })
        });
        return;
      }
      this.previewPoster();
    },

    // ---- 停止分享 ----
    // 确认弹窗用组件自带的 app-dialog（面板盖在页面之上，页面级的弹窗宿主在这里不好用）
    confirmStop() {
      const dialog = this.selectComponent && this.selectComponent('#js-dialog');
      const options = {
        title: '停止分享这一页？',
        content: '之前发出去的链接，和长图上的小程序码都会失效。',
        confirmText: '停止分享',
        danger: true
      };
      if (!dialog || typeof dialog.open !== 'function') {
        wx.showModal({ ...options, success: result => result && result.confirm && this.stopSharing() });
        return;
      }
      dialog.open(options).then(result => {
        if (result && result.confirm) this.stopSharing();
      });
    },

    async stopSharing() {
      try {
        await service.revoke(this._payload.id);
        const id = this._payload.id;
        this._share = null;
        this._used = true;
        this.setData({ visible: false, phase: 'menu', share: null });
        wx.showToast({ title: '已停止分享', icon: 'none' });
        this.triggerEvent('revoked', { id });
      } catch (error) {
        wx.showToast({ title: (error && error.message) || '没停掉，再试一次', icon: 'none' });
      }
    },

    // ---- 关闭 ----
    onMaskTap() {
      this.close();
    },

    close() {
      clearTimeout(this._closeTimer);
      // 这次分享是新开启的，却没有转发也没有生成长图：撤销，不留下没人用的分享
      if (this._share && this._share.created && !this._used && this._payload) {
        service.revoke(this._payload.id).catch(() => {});
        this._share = null;
      }
      this.setData({ visible: false, phase: 'menu' });
    },

    noop() {}
  }
});
