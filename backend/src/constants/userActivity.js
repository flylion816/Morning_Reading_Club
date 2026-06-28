const ACTION_LABELS = {
  app_open: '访问小程序',
  profile_update: '编辑个人资料',
  course_view: '查看课程',
  checkin_submit: '打卡',
  comment_create: '评论',
  like_create: '点赞',
  own_insight_view: '查看自己的小凡看见',
  other_insight_view: '查看他人的小凡看见',
  meeting_enter: '去晨读',
  insight_request_approve: '同意请求',
  zaichang_list_view: '进入在场列表',
  zaichang_publish_view: '进入发布印记页',
  zaichang_imprint_publish: '发布印记',
  zaichang_detail_view: '查看印记详情',
  zaichang_imprint_like: '点赞印记',
  zaichang_imprint_comment: '评论印记',
  index_popup_view: '点击首页弹窗',
  index_podcast_enter: '首页进入播客',
  checkin_records_view: '查看我的打卡',
  course_ai_read: '课程 AI 朗读',
  insight_ai_read: '小凡看见 AI 朗读',
  insight_share: '分享小凡看见',
  insight_like: '小凡看见点赞',
  insight_danmaku: '小凡看见发弹幕',
  podcast_play: '播客播放',
  podcast_bar_play: '底部悬浮窗播放播客',
  podcast_share: '播客分享',
  closing_video_share: '结营视频分享',
  course_share: '课程分享',
  activity_enroll: '活动报名'
};

const ACTIONS = Object.keys(ACTION_LABELS);

const TREND_ACTIONS = [
  'app_open',
  'checkin_submit',
  'own_insight_view',
  'other_insight_view',
  'course_view',
  'meeting_enter'
];

const DAILY_SUMMARY_GROUPS = [
  {
    key: 'zaichang_activity',
    label: '在场',
    actions: [
      'zaichang_list_view',
      'zaichang_publish_view',
      'zaichang_imprint_publish',
      'zaichang_detail_view',
      'zaichang_imprint_like',
      'zaichang_imprint_comment'
    ]
  },
  {
    key: 'podcast_activity',
    label: '播客',
    actions: [
      'index_podcast_enter',
      'podcast_play',
      'podcast_bar_play',
      'podcast_share'
    ]
  },
  {
    key: 'ai_read_activity',
    label: 'AI朗读',
    actions: ['course_ai_read', 'insight_ai_read']
  },
  {
    key: 'share_activity',
    label: '分享',
    actions: ['insight_share', 'podcast_share', 'closing_video_share', 'course_share']
  },
  {
    key: 'activity_enroll',
    label: '活动报名',
    actions: ['activity_enroll']
  },
  {
    key: 'insight_interaction',
    label: '小凡互动',
    actions: ['insight_like', 'insight_danmaku']
  }
];

const COHORT_SCOPED_ACTIONS = [
  'app_open',
  'profile_update',
  'zaichang_list_view',
  'zaichang_publish_view',
  'zaichang_imprint_publish',
  'zaichang_detail_view',
  'zaichang_imprint_like',
  'zaichang_imprint_comment',
  'index_popup_view',
  'index_podcast_enter',
  'checkin_records_view',
  'course_ai_read',
  'insight_ai_read',
  'insight_share',
  'insight_like',
  'insight_danmaku',
  'podcast_play',
  'podcast_bar_play',
  'podcast_share',
  'closing_video_share',
  'course_share',
  'activity_enroll'
];

module.exports = {
  ACTIONS,
  ACTION_LABELS,
  TREND_ACTIONS,
  DAILY_SUMMARY_GROUPS,
  COHORT_SCOPED_ACTIONS
};
