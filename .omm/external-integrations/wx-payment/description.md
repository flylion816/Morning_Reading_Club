微信支付接口。后端 payment.service.js 创建支付订单并返回预支付参数，小程序调用 wx.requestPayment() 唤起支付，支付完成后微信回调后端验证签名并更新订单状态。
