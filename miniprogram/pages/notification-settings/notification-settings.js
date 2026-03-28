const subscribeMessageService = require('../../services/subscribe-message.service');
const MAX_SUBSCRIBE_SCENES_PER_TAP = 3;

function formatDateTime(value) {
  if (!value) {
    return '';
  }

  const date = new Date(value);
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hour = String(date.getHours()).padStart(2, '0');
  const minute = String(date.getMinutes()).padStart(2, '0');
  return `${month}-${day} ${hour}:${minute}`;
}

function normalizeResponse(response) {
  const scenes = (response.scenes || []).map(scene => ({
    ...scene,
    lastAcceptedAtText: formatDateTime(scene.lastAcceptedAt)
  }));

  return {
    scenes,
    summary: response.summary || null
  };
}

function getMissingScenes(scenes = []) {
  return scenes.filter(scene => (scene.availableCount || 0) <= 0);
}

function buildPendingSceneKeys(scenes = [], pendingSceneKeys = []) {
  const sceneMap = new Map(scenes.map(scene => [scene.scene, scene]));
  return pendingSceneKeys.filter(sceneKey => {
    const scene = sceneMap.get(sceneKey);
    return scene && (scene.availableCount || 0) <= 0;
  });
}

function buildSubscribeAllMeta(scenes = [], pendingSceneKeys = []) {
  const missingScenes = getMissingScenes(scenes);
  const normalizedPendingKeys = buildPendingSceneKeys(scenes, pendingSceneKeys);
  const sceneMap = new Map(scenes.map(scene => [scene.scene, scene]));
  const pendingScenes = normalizedPendingKeys.map(sceneKey => sceneMap.get(sceneKey)).filter(Boolean);
  const targetScenes = pendingScenes.length > 0 ? pendingScenes : missingScenes;
  const hasPendingScenes = pendingScenes.length > 0;
  const targetSceneCount = targetScenes.length;
  const totalStepCount = Math.max(1, Math.ceil(targetSceneCount / MAX_SUBSCRIBE_SCENES_PER_TAP));
  const targetSceneTitles = targetScenes.map(scene => scene.title);
  const titleSummary =
    targetSceneTitles.length > 0 ? `待补充：${targetSceneTitles.join('、')}` : '当前全部场景已有余量。';

  return {
    pendingSceneKeys: normalizedPendingKeys,
    subscribeAllButtonText: targetSceneCount <= 0
      ? '全部场景已有余量'
      : hasPendingScenes
        ? `继续补充剩余 ${pendingScenes.length} 项`
        : totalStepCount > 1
          ? `一键补充缺少场景（分 ${totalStepCount} 步）`
          : `一键补充缺少场景（${targetSceneCount} 项）`,
    subscribeAllHint:
      targetSceneCount > 0 && targetSceneCount > MAX_SUBSCRIBE_SCENES_PER_TAP
        ? `${titleSummary} 微信要求每次点击最多请求 ${MAX_SUBSCRIBE_SCENES_PER_TAP} 项订阅。`
        : titleSummary,
    subscribeAllDisabled: targetSceneCount <= 0
  };
}

Page({
  data: {
    loading: true,
    submitting: false,
    scenes: [],
    summary: null,
    pendingSceneKeys: [],
    subscribeAllButtonText: '一键补充全部',
    subscribeAllHint: '',
    subscribeAllDisabled: false
  },

  onShow() {
    this.loadSettings();
  },

  async loadSettings() {
    this.setData({ loading: true });

    try {
      const response = await subscribeMessageService.getSettings();
      const normalized = normalizeResponse(response);
      const subscribeAllMeta = buildSubscribeAllMeta(
        normalized.scenes,
        this.data.pendingSceneKeys
      );
      this.setData({
        scenes: normalized.scenes,
        summary: normalized.summary,
        loading: false,
        pendingSceneKeys: subscribeAllMeta.pendingSceneKeys,
        subscribeAllButtonText: subscribeAllMeta.subscribeAllButtonText,
        subscribeAllHint: subscribeAllMeta.subscribeAllHint,
        subscribeAllDisabled: subscribeAllMeta.subscribeAllDisabled
      });
    } catch (error) {
      console.error('加载订阅消息设置失败:', error);
      this.setData({ loading: false });
      wx.showToast({
        title: '加载失败',
        icon: 'none'
      });
    }
  },

  async requestSubscriptions(sceneList = [], options = {}) {
    if (this.data.submitting || !sceneList.length) {
      return;
    }

    this.setData({ submitting: true });
    const grants = [];

    try {
      const requestScenes = sceneList.slice(0, MAX_SUBSCRIBE_SCENES_PER_TAP);
      const templateIds = requestScenes.map(scene => scene.templateId);
      const requestResult = await new Promise((resolve, reject) => {
        wx.requestSubscribeMessage({
          tmplIds: templateIds,
          success: resolve,
          fail: reject
        });
      });

      const collectGrantResults = (tmplIds, result) => {
        tmplIds.forEach(templateId => {
          const matchedScene = requestScenes.find(scene => scene.templateId === templateId);
          if (!matchedScene) {
            return;
          }

          grants.push({
            scene: matchedScene.scene,
            templateId,
            result: result[templateId] || 'error'
          });
        });
      };

      collectGrantResults(templateIds, requestResult);

      const response = await subscribeMessageService.saveGrants(grants);
      const normalized = normalizeResponse(response);
      const nextPendingSceneKeys = buildPendingSceneKeys(
        normalized.scenes,
        options.remainingSceneKeys || []
      );
      const subscribeAllMeta = buildSubscribeAllMeta(normalized.scenes, nextPendingSceneKeys);
      this.setData({
        scenes: normalized.scenes,
        summary: normalized.summary,
        submitting: false,
        pendingSceneKeys: subscribeAllMeta.pendingSceneKeys,
        subscribeAllButtonText: subscribeAllMeta.subscribeAllButtonText,
        subscribeAllHint: subscribeAllMeta.subscribeAllHint,
        subscribeAllDisabled: subscribeAllMeta.subscribeAllDisabled
      });

      const acceptedCount = grants.filter(item => item.result === 'accept').length;
      wx.showToast({
        title: nextPendingSceneKeys.length > 0
          ? `已处理 ${requestScenes.length} 项`
          : acceptedCount > 0
            ? `已补充 ${acceptedCount} 项`
            : '未新增授权',
        icon: 'none'
      });
    } catch (error) {
      console.error('请求订阅消息授权失败:', error);
      this.setData({ submitting: false });
      wx.showToast({
        title: '授权失败',
        icon: 'none'
      });
    }
  },

  handleSubscribeScene(e) {
    const { scene } = e.currentTarget.dataset;
    const targetScene = this.data.scenes.find(item => item.scene === scene);
    if (!targetScene) {
      return;
    }
    this.requestSubscriptions([targetScene], {
      remainingSceneKeys: []
    });
  },

  handleSubscribeAll() {
    const sceneMap = new Map(this.data.scenes.map(scene => [scene.scene, scene]));
    const pendingSceneKeys = buildPendingSceneKeys(this.data.scenes, this.data.pendingSceneKeys);
    const queue = (
      pendingSceneKeys.length > 0
        ? pendingSceneKeys
        : getMissingScenes(this.data.scenes).map(scene => scene.scene)
    )
      .map(scene => sceneMap.get(scene))
      .filter(Boolean);

    if (!queue.length) {
      wx.showToast({
        title: '暂无可补充场景',
        icon: 'none'
      });
      return;
    }

    this.requestSubscriptions(queue.slice(0, MAX_SUBSCRIBE_SCENES_PER_TAP), {
      remainingSceneKeys: queue.slice(MAX_SUBSCRIBE_SCENES_PER_TAP).map(scene => scene.scene)
    });
  }
});
