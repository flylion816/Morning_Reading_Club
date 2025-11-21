/**
 * 支付页面
 * 处理报名后的支付流程
 */

const enrollmentService = require('../../services/enrollment.service');

Page({
  data: {
    loading: true,
    paying: false,
    paymentMethod: '', // 'wechat' or 'mock'

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
    finalAmount: 99,   // 最终支付金额

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
    const {
      enrollmentId,
      periodId,
      periodTitle,
      startDate,
      endDate,
      amount
    } = options;

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
    const finalAmount = amount ? parseInt(amount) : 99;
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
      this.showPaymentFailed('支付失败', error.message || '请重试');
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
          success: (res) => {
            console.log('微信支付成功:', res);
            this.handlePaymentSuccess();
            resolve(res);
          },
          fail: (err) => {
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
    return new Promise((resolve) => {
      // 模拟 2 秒支付处理时间
      setTimeout(() => {
        console.log('模拟支付完成');
        this.handlePaymentSuccess();
        resolve();
      }, 2000);
    });
  },

  /**
   * 支付成功处理
   */
  async handlePaymentSuccess() {
    try {
      const { enrollmentData, finalAmount } = this.data;

      // 1. 调用后端确认支付
      console.log('确认支付...');
      // 这里应该调用后端 API 确认支付
      // const res = await enrollmentService.confirmPayment({
      //   enrollmentId: enrollmentData.enrollmentId,
      //   amount: finalAmount
      // });

      // 2. 模拟后端确认支付
      const mockConfirmation = {
        success: true,
        message: '支付确认成功'
      };

      if (mockConfirmation.success) {
        // 3. 显示成功结果
        this.setData({
          showPaymentResult: true,
          'paymentResult.success': true,
          'paymentResult.title': '支付成功',
          'paymentResult.message': '报名已完成，现在可以进入课程学习了'
        });

        // 4. 保存支付成功状态到本地存储
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
      }
    } catch (error) {
      console.error('支付确认失败:', error);
      this.showPaymentFailed('支付确认失败', '请稍后重试');
    }
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

    // 延迟后跳转到课程页面
    setTimeout(() => {
      wx.switchTab({
        url: '/pages/home/home',
        success: () => {
          // 跳转到课程列表
          wx.navigateTo({
            url: `/pages/courses/courses?periodId=${enrollmentData.periodId}&name=${enrollmentData.periodTitle}`
          });
        }
      });
    }, 500);
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
      success: (res) => {
        if (res.confirm) {
          // 返回到报名页面或首页
          wx.navigateBack({ delta: 1 });
        }
      }
    });
  }
});
