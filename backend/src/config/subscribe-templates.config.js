const FANREN_SUBSCRIBE_TEMPLATES = {
  enrollment_result: 'Qzn9auOyMjCKUaHrfekzK0XMaQ64nO0mfdikQNXjbdo',
  payment_result: 'UCzIuWtUYbc_ucf05GEOqglXK1HJHzwtN50e1NkmhCI',
  comment_received: 'oMN_lu5vxoBlqcqiTxNDDq_kx9M4ENLUlfruD2rPZbs',
  like_received: '7bzStHl6spoC8Vh_DHDXvAebxF5htrNLlfiAoDjp9Ek',
  danmaku_received: 'oMN_lu5vxoBlqcqiTxNDDq_kx9M4ENLUlfruD2rPZbs',
  insight_liked: '7bzStHl6spoC8Vh_DHDXvAebxF5htrNLlfiAoDjp9Ek',
  insight_request_created: '6M4Cb5qrZa5xF3uuJLvw4UPvRuMzAef_N0biZgx7j6A',
  insight_request_approved: '6M4Cb5qrZa5xF3uuJLvw4UPvRuMzAef_N0biZgx7j6A',
  next_day_study_reminder: 'aVKlwM2zva8WuT04AdaibI6akNh8aoPjn3oKzWE-SLA',
  insight_created: '7Q501HNbbT7_GqaBsoj71eKIhVYUFwRU097Q3r8d5_M',
  podcast_published: '7Q501HNbbT7_GqaBsoj71eKIhVYUFwRU097Q3r8d5_M',
  activity_reminder: 'aVKlwM2zva8WuT04AdaibI6akNh8aoPjn3oKzWE-SLA'
};

const STARRY_SUBSCRIBE_TEMPLATES = {
  enrollment_result: 'zT9hN6i7m9NBv5xEWgxUdS7cu0MsJHVQteV3EYpMUeE',
  payment_result: 'DpzkHzJWp7uA6IRtkscp23cw8ay2NnroP7hz8v-P4E8',
  comment_received: 'UnTm9p8Q_YGJtcin1PvuGUBA3qlcxXP7nYiM2CmjrUU',
  like_received: 'q_0_QCfKvds8ZXMxLcTsFtJYoW2pHL5V_5-LIrb7I6s',
  danmaku_received: 'UnTm9p8Q_YGJtcin1PvuGUBA3qlcxXP7nYiM2CmjrUU',
  insight_liked: 'q_0_QCfKvds8ZXMxLcTsFtJYoW2pHL5V_5-LIrb7I6s',
  insight_request_created: 'corZC20wZhyA_ouVSu65ORud4a6YQAKw_LHSpd2SL9w',
  insight_request_approved: 'corZC20wZhyA_ouVSu65ORud4a6YQAKw_LHSpd2SL9w',
  next_day_study_reminder: 'shZCZaWJZlKiFYvnWbV7IuqAvUefrND7pn7eXBLME3A',
  insight_created: 'MGPg88ZnA0CB9aOt2iX5JACxjib_YzUtHPxjlcpxw8E',
  podcast_published: 'MGPg88ZnA0CB9aOt2iX5JACxjib_YzUtHPxjlcpxw8E',
  activity_reminder: 'shZCZaWJZlKiFYvnWbV7IuqAvUefrND7pn7eXBLME3A'
};

const TENANT_SUBSCRIBE_TEMPLATES = {
  fanren: FANREN_SUBSCRIBE_TEMPLATES,
  wx2b9a3c1d5e4195f8: FANREN_SUBSCRIBE_TEMPLATES,
  chaoren: {
    enrollment_result: '',
    payment_result: '',
    comment_received: '',
    like_received: '',
    danmaku_received: '',
    insight_liked: '',
    insight_request_created: '',
    insight_request_approved: '',
    next_day_study_reminder: '',
    insight_created: '',
    podcast_published: '',
    activity_reminder: ''
  },
  starry: STARRY_SUBSCRIBE_TEMPLATES,
  wx9cd59e2c89880289: STARRY_SUBSCRIBE_TEMPLATES
};

function getConfiguredSubscribeTemplates(tenant = null) {
  if (!tenant) {
    return { ...FANREN_SUBSCRIBE_TEMPLATES };
  }

  const keys = [
    tenant.slug,
    tenant.wechatLogin?.appId,
    ...(Array.isArray(tenant.wxAppIds) ? tenant.wxAppIds : [])
  ].filter(Boolean);

  for (const key of keys) {
    if (TENANT_SUBSCRIBE_TEMPLATES[key]) {
      return { ...TENANT_SUBSCRIBE_TEMPLATES[key] };
    }
  }

  return {};
}

module.exports = {
  FANREN_SUBSCRIBE_TEMPLATES,
  STARRY_SUBSCRIBE_TEMPLATES,
  TENANT_SUBSCRIBE_TEMPLATES,
  getConfiguredSubscribeTemplates
};
