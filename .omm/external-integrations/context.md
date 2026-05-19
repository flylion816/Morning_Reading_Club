每个租户拥有独立的微信小程序 AppId 和对应的微信支付商户号。后端通过 Tenant 模型存储各租户的微信配置（appId、appSecret、mchId 等），wechat.service.js 和 payment.service.js 在调用微信 API 时动态读取当前租户配置。
