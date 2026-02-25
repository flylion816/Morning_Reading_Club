/**
 * 支付页面
 * 处理报名后的支付流程
 */

const paymentService = require('../../services/payment.service');
const envConfig = require('../../config/env');

Page({
  data: {
    loading: true,
    paying: false,
    paymentMethod: '', // 'wechat' or 'mock'
    isDevelopment: envConfig.currentEnv !== 'prod', // 是否为开发/测试环境

    // 订单数据
    enrollmentData: {
      enrollmentId: '',
      periodId: '',
      periodTitle: '',
      startDate: '',
      endDate: ''
    },

    // 支付金额
    paymentAmount: 99, // 默认课程费用 99 元
    discountAmount: 0, // 优惠金额
    finalAmount: 99, // 最终支付金额

    // 支付结果
    showPaymentResult: false,
    paymentResult: {
      success: false,
      title: '',
      message: ''
    }
  },

  onLoad(options) {
    // 从路由参数获取报名信息
    const { enrollmentId, periodId, periodTitle, startDate, endDate, amount } = options;

    if (!enrollmentId || !periodId) {
      wx.showToast({
        title: '参数错误，请重新操作',
        icon: 'none'
      });
      setTimeout(() => {
        wx.navigateBack({ delta: 1 });
      }, 1500);
      return;
    }

    // 设置订单数据
    // amount 单位为"分"（100分 = 1元），默认 9900分 = 99元
    const finalAmount = amount ? parseInt(amount) : 9900;
    this.setData({
      'enrollmentData.enrollmentId': enrollmentId,
      'enrollmentData.periodId': periodId,
      'enrollmentData.periodTitle': periodTitle || '晨读营课程',
      'enrollmentData.startDate': startDate || '2025-11-10',
      'enrollmentData.endDate': endDate || '2025-12-02',
      paymentAmount: finalAmount,
      finalAmount: finalAmount,
      loading: false
    });
  },

  /**
   * 选择支付方式
   */
  selectPaymentMethod(e) {
    const method = e.currentTarget.dataset.method;
    this.setData({ paymentMethod: method });
  },

  /**
   * 处理支付
   */
  async handlePayment() {
    const { paymentMethod } = this.data;

    if (!paymentMethod) {
      wx.showToast({
        title: '请选择支付方式',
        icon: 'none'
      });
      return;
    }

    this.setData({ paying: true });

    try {
      if (paymentMethod === 'wechat') {
        // 真实微信支付流程
        await this.handleWechatPayment();
      } else if (paymentMethod === 'mock') {
        // 模拟支付流程（开发测试）
        await this.handleMockPayment();
      }
    } catch (error) {
      console.error('支付失败:', error);

      // 从错误对象中提取错误消息
      let errorMessage = '支付失败，请重试';

      // 优先级顺序：error.data.message > error.message > 默认值
      if (error && error.data && error.data.message) {
        errorMessage = error.data.message;
      } else if (error && error.message) {
        errorMessage = error.message;
      }

      this.showPaymentFailed('支付失败', errorMessage);
    } finally {
      this.setData({ paying: false });
    }
  },

  /**
   * 微信支付流程
   */
  async handleWechatPayment() {
    try {
      const { enrollmentData, finalAmount } = this.data;

      // 1. 调用后端获取支付参数
      console.log('获取微信支付参数...');
      // 这里应该调用后端 API 获取支付参数
      // const res = await enrollmentService.initWechatPayment({
      //   enrollmentId: enrollmentData.enrollmentId,
      //   amount: finalAmount
      // });

      // 2. 模拟获取支付参数（实际项目中应该从后端获取）
      const paymentParams = {
        timeStamp: Math.floor(Date.now() / 1000).toString(),
        nonceStr: 'mock_nonce_' + Math.random().toString(36).substr(2, 9),
        package: 'prepay_id=mock_' + Math.random().toString(36).substr(2, 20),
        signType: 'RSA',
        paySign: 'mock_signature_' + Math.random().toString(36).substr(2, 30)
      };

      // 3. 调用微信支付
      return new Promise((resolve, reject) => {
        wx.requestPayment({
          timeStamp: paymentParams.timeStamp,
          nonceStr: paymentParams.nonceStr,
          package: paymentParams.package,
          signType: paymentParams.signType,
          paySign: paymentParams.paySign,
          success: res => {
            console.log('微信支付成功:', res);
            this.handlePaymentSuccess();
            resolve(res);
          },
          fail: err => {
            console.error('微信支付失败:', err);
            // 用户取消支付时 errMsg 为 "requestPayment:fail cancel"
            if (err.errMsg && err.errMsg.includes('cancel')) {
              wx.showToast({
                title: '已取消支付',
                icon: 'none'
              });
            } else {
              reject(new Error('微信支付失败'));
            }
          }
        });
      });
    } catch (error) {
      console.error('微信支付异常:', error);
      throw error;
    }
  },

  /**
   * 模拟支付流程（开发测试用）
   */
  async handleMockPayment() {
    try {
      const { enrollmentData } = this.data;

      // 1. 调用后端初始化支付（模拟支付会直接完成）
      console.log('初始化模拟支付...');
      const initRes = await paymentService.initiatePayment({
        enrollmentId: enrollmentData.enrollmentId,
        paymentMethod: 'mock',
        amount: this.data.finalAmount
      });

      console.log('支付初始化响应:', initRes);

      if (initRes && initRes.paymentId) {
        console.log('支付初始化成功，paymentId:', initRes.paymentId);
        console.log('支付状态:', initRes.status);

        // 对于模拟支付，后端在 initiatePayment 中已经完成支付
        // 所以直接显示成功
        if (initRes.status === 'completed') {
          console.log('模拟支付已完成');
          this.handlePaymentSuccess();
          return Promise.resolve();
        } else if (initRes.status === 'pending') {
          // 如果是 pending 状态，则需要确认支付
          // 模拟 2 秒支付处理时间
          return new Promise(resolve => {
            setTimeout(async () => {
              console.log('模拟支付完成，开始确认支付...');
              try {
                const confirmRes = await paymentService.confirmPayment(initRes.paymentId);
                console.log('支付确认成功:', confirmRes);
                this.handlePaymentSuccess();
                resolve();
              } catch (confirmErr) {
                console.error('确认支付失败:', confirmErr);
                throw confirmErr;
              }
            }, 2000);
          });
        } else {
          throw new Error('支付状态异常：' + initRes.status);
        }
      } else {
        throw new Error('支付初始化失败：无效的响应');
      }
    } catch (error) {
      console.error('模拟支付异常:', error);
      throw error;
    }
  },

  /**
   * 支付成功处理
   */
  handlePaymentSuccess() {
    const { enrollmentData, finalAmount } = this.data;

    // 显示成功结果
    this.setData({
      showPaymentResult: true,
      'paymentResult.success': true,
      'paymentResult.title': '支付成功',
      'paymentResult.message': '报名已完成，现在可以进入课程学习了'
    });

    // 保存支付成功状态到本地存储
    const enrollmentInfo = {
      enrollmentId: enrollmentData.enrollmentId,
      periodId: enrollmentData.periodId,
      periodTitle: enrollmentData.periodTitle,
      paymentStatus: 'paid',
      paidAt: new Date().toISOString(),
      finalAmount: finalAmount
    };

    wx.setStorageSync('lastEnrollment', enrollmentInfo);

    // 保存到报名列表
    const enrollments = wx.getStorageSync('enrollments') || [];
    enrollments.unshift(enrollmentInfo);
    wx.setStorageSync('enrollments', enrollments);
  },

  /**
   * 显示支付失败
   */
  showPaymentFailed(title, message) {
    this.setData({
      showPaymentResult: true,
      'paymentResult.success': false,
      'paymentResult.title': title,
      'paymentResult.message': message
    });
  },

  /**
   * 处理支付成功后进入课程
   */
  handleSuccess() {
    const { enrollmentData } = this.data;

    // 关闭弹窗
    this.closeModal();

    // 延迟后跳转到课程页面（等待弹窗动画完成）
    setTimeout(() => {
      // 先返回到首页
      wx.navigateBack({
        delta: 1,
        success: () => {
          // 返回成功后，跳转到课程列表
          wx.navigateTo({
            url: `/pages/courses/courses?periodId=${enrollmentData.periodId}&name=${enrollmentData.periodTitle}`,
            fail: err => {
              console.error('导航到课程列表失败:', err);
              wx.showToast({
                title: '导航失败，请手动进入课程',
                icon: 'none'
              });
            }
          });
        },
        fail: err => {
          console.error('返回首页失败:', err);
          // 如果返回失败，尝试直接跳转到课程列表
          wx.navigateTo({
            url: `/pages/courses/courses?periodId=${enrollmentData.periodId}&name=${enrollmentData.periodTitle}`,
            fail: navErr => {
              console.error('导航到课程列表失败:', navErr);
              wx.showToast({
                title: '导航失败，请手动进入课程',
                icon: 'none'
              });
            }
          });
        }
      });
    }, 800);
  },

  /**
   * 关闭弹窗
   */
  closeModal() {
    this.setData({ showPaymentResult: false });
  },

  /**
   * 阻止弹窗事件冒泡
   */
  preventClose(e) {
    e.stopPropagation();
  },

  /**
   * 取消支付
   */
  handleCancel() {
    wx.showModal({
      title: '取消支付',
      content: '确定要取消支付吗？',
      success: res => {
        if (res.confirm) {
          // 返回到报名页面或首页
          wx.navigateBack({ delta: 1 });
        }
      }
    });
  }
});
