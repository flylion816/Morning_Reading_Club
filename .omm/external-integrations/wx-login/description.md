微信 OAuth 登录接口（code2session）。小程序调用 wx.login() 获取临时 code，后端用 code + appSecret 换取用户 openid 和 session_key，再生成系统 JWT token 返回给客户端。
