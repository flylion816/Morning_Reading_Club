const sceneConfigs = {
  enrollment_result: {
    scene: 'enrollment_result',
    title: '报名结果',
    description: '报名成功后提醒用户进入晨读营',
    templateId: 'Qzn9auOyMjCKUaHrfekzK0XMaQ64nO0mfdikQNXjbdo',
    page: 'pages/index/index',
    fieldDefinitions: [
      { name: 'result', label: '报名结果' },
      { name: 'name', label: '姓名' },
      { name: 'content', label: '报名内容' }
    ],
    defaultFieldKeyMap: {
      result: 'phrase1',
      name: 'name6',
      content: 'thing7'
    },
    fieldKeyMapEnv: 'WECHAT_SUBSCRIBE_FIELD_KEYS_ENROLLMENT_RESULT'
  },
  payment_result: {
    scene: 'payment_result',
    title: '付款结果',
    description: '支付完成后提醒用户进入晨读营',
    templateId: 'UCzIuWtUYbc_ucf05GEOqglXK1HJHzwtN50e1NkmhCI',
    page: 'pages/index/index',
    fieldDefinitions: [
      { name: 'orderContent', label: '订单内容' },
      { name: 'orderTime', label: '下单时间' }
    ],
    defaultFieldKeyMap: {
      orderContent: 'thing1',
      orderTime: 'date3'
    },
    fieldKeyMapEnv: 'WECHAT_SUBSCRIBE_FIELD_KEYS_PAYMENT_RESULT'
  },
  comment_received: {
    scene: 'comment_received',
    title: '收到评论',
    description: '有人评论或回复时提醒查看',
    templateId: 'oMN_lu5vxoBlqcqiTxNDDq_kx9M4ENLUlfruD2rPZbs',
    page: 'pages/course-detail/course-detail',
    fieldDefinitions: [
      { name: 'replyUser', label: '回复人' },
      { name: 'replyTopic', label: '回复主题' },
      { name: 'replyContent', label: '回复内容' },
      { name: 'replyTime', label: '回复时间' }
    ],
    defaultFieldKeyMap: {
      replyUser: 'thing1',
      replyTopic: 'thing5',
      replyContent: 'thing2',
      replyTime: 'time3'
    },
    fieldKeyMapEnv: 'WECHAT_SUBSCRIBE_FIELD_KEYS_COMMENT_RECEIVED'
  },
  like_received: {
    scene: 'like_received',
    title: '收到点赞',
    description: '有人点赞打卡或评论时提醒查看',
    templateId: '7bzStHl6spoC8Vh_DHDXvAebxF5htrNLlfiAoDjp9Ek',
    page: 'pages/course-detail/course-detail',
    fieldDefinitions: [
      { name: 'likeUser', label: '点赞用户' },
      { name: 'likeTime', label: '点赞时间' }
    ],
    defaultFieldKeyMap: {
      likeUser: 'thing1',
      likeTime: 'time2'
    },
    fieldKeyMapEnv: 'WECHAT_SUBSCRIBE_FIELD_KEYS_LIKE_RECEIVED'
  },
  insight_request_created: {
    scene: 'insight_request_created',
    title: '申请小凡看见',
    description: '有人请求查看你的小凡看见时提醒处理',
    templateId: '6M4Cb5qrZa5xF3uuJLvw4UPvRuMzAef_N0biZgx7j6A',
    page: 'pages/profile/profile',
    fieldDefinitions: [
      { name: 'requestUser', label: '申请人' },
      { name: 'remark', label: '备注' },
      { name: 'requestTime', label: '申请时间' }
    ],
    defaultFieldKeyMap: {
      requestUser: 'name2',
      remark: 'thing3',
      requestTime: 'date1'
    },
    fieldKeyMapEnv: 'WECHAT_SUBSCRIBE_FIELD_KEYS_INSIGHT_REQUEST_CREATED'
  }
};

function getSubscribeSceneConfig(scene) {
  return sceneConfigs[scene] || null;
}

function getSubscribeSceneList() {
  return Object.values(sceneConfigs);
}

function normalizeMiniProgramPage(page = '') {
  return String(page || '').replace(/^\/+/, '');
}

module.exports = {
  SUBSCRIBE_MESSAGE_SCENES: sceneConfigs,
  getSubscribeSceneConfig,
  getSubscribeSceneList,
  normalizeMiniProgramPage
};
