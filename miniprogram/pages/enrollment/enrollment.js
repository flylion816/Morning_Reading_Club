// 报名页面
const enrollmentService = require('../../services/enrollment.service');

Page({
  data: {
    // 加载状态
    loading: true,
    submitting: false,

    // 期次信息
    periodId: '',
    periodName: '',
    periodList: [],
    selectedPeriodIndex: 0,
    selectedPeriodName: '',

    // 选项数据
    genderOptions: [
      { label: '男', value: 'male' },
      { label: '女', value: 'female' },
      { label: '不想透露', value: 'prefer_not_to_say' }
    ],
    provinceList: [
      '北京', '上海', '广东', '浙江', '江苏', '福建',
      '山东', '四川', '湖北', '湖南', '安徽', '江西',
      '黑龙江', '吉林', '辽宁', '河北', '河南', '山西',
      '陕西', '甘肃', '青海', '云南', '贵州', '重庆',
      '天津', '内蒙古', '宁夏', '新疆', '西藏', '台湾',
      '香港', '澳门', '其他'
    ],
    selectedProvinceIndex: 0,
    readOptions: [
      { label: '是', value: 'yes' },
      { label: '否', value: 'no' }
    ],
    commitmentOptions: [
      { label: '愿意', value: 'yes' },
      { label: '不愿意', value: 'no' }
    ],

    // 表单数据
    form: {
      periodId: '',
      name: '',
      gender: '',
      province: '',
      detailedAddress: '',
      age: '',
      referrer: '',
      hasReadBook: '',
      readTimes: '',
      enrollReason: '',
      expectation: '',
      commitment: ''
    },

    // 表单验证错误
    errors: {}
  },

  onLoad(options) {
    console.log('报名页面加载，参数:', options);

    // 从参数中获取期次ID
    if (options.periodId) {
      this.setData({ periodId: options.periodId });
    }

    this.loadPeriods();
  },

  /**
   * 加载期次列表
   */
  async loadPeriods() {
    this.setData({ loading: true });

    try {
      const res = await enrollmentService.getPeriods();
      // request.js 返回的是 data.data 对象 {list: [...], pagination: {...}}
      // 所以需要获取 list 属性
      const periodList = res.list || [];

      if (periodList.length === 0) {
        wx.showToast({
          title: '暂无可报名期次',
          icon: 'none'
        });
        this.setData({ loading: false });
        return;
      }

      // 设置默认选中的期次
      let selectedIndex = 0;
      const periodId = this.data.periodId;

      if (periodId) {
        selectedIndex = periodList.findIndex(p => p._id === periodId);
        if (selectedIndex === -1) selectedIndex = 0;
      }

      const selectedPeriod = periodList[selectedIndex];

      this.setData({
        periodList,
        selectedPeriodIndex: selectedIndex,
        selectedPeriodName: selectedPeriod.name,
        periodName: selectedPeriod.name,
        form: {
          ...this.data.form,
          periodId: selectedPeriod._id
        },
        loading: false
      });
    } catch (error) {
      console.error('加载期次失败:', error);
      wx.showToast({
        title: '加载期次失败',
        icon: 'none'
      });
      this.setData({ loading: false });
    }
  },

  /**
   * 处理期次选择变化
   */
  handlePeriodChange(e) {
    const index = parseInt(e.detail.value);
    const selectedPeriod = this.data.periodList[index];

    this.setData({
      selectedPeriodIndex: index,
      selectedPeriodName: selectedPeriod.name,
      periodId: selectedPeriod._id,
      form: {
        ...this.data.form,
        periodId: selectedPeriod._id
      }
    });
  },

  /**
   * 处理省份选择变化
   */
  handleProvinceChange(e) {
    const index = parseInt(e.detail.value);
    const province = this.data.provinceList[index];

    this.setData({
      selectedProvinceIndex: index,
      form: {
        ...this.data.form,
        province
      }
    });
  },

  /**
   * 处理输入框和选择器变化
   */
  handleInput(e) {
    const field = e.currentTarget.dataset.field;
    const value = e.detail.value;

    // 更新表单数据
    const newForm = { ...this.data.form };
    newForm[field] = value;

    // 清除该字段的验证错误
    const newErrors = { ...this.data.errors };
    delete newErrors[field];

    this.setData({
      form: newForm,
      errors: newErrors
    });
  },

  /**
   * 处理单选框变化
   */
  handleRadioChange(e) {
    const field = e.currentTarget.dataset.field;
    const value = e.detail.value;

    // 更新表单数据
    const newForm = { ...this.data.form };
    newForm[field] = value;

    // 清除该字段的验证错误
    const newErrors = { ...this.data.errors };
    delete newErrors[field];

    console.log(`单选框 ${field} 值已更新为: ${value}`);

    this.setData({
      form: newForm,
      errors: newErrors
    });
  },

  /**
   * 表单验证
   */
  validateForm() {
    const { form } = this.data;
    const errors = {};

    // 验证必填字段
    if (!form.periodId) errors.periodId = '请选择报名期数';
    if (!form.name || form.name.trim() === '') errors.name = '请输入姓名';
    if (!form.gender) errors.gender = '请选择性别';
    if (!form.province) errors.province = '请选择省/市/区(县)';
    if (!form.detailedAddress || form.detailedAddress.trim() === '') errors.detailedAddress = '请输入详细地址';
    if (!form.age) {
      errors.age = '请输入年龄';
    } else if (isNaN(parseInt(form.age)) || parseInt(form.age) < 1 || parseInt(form.age) > 120) {
      errors.age = '年龄必须是1-120之间的数字';
    }
    if (!form.referrer || form.referrer.trim() === '') errors.referrer = '请输入推荐人';
    if (!form.hasReadBook) errors.hasReadBook = '请选择是否读过此书';

    // 如果读过，则验证读过的次数
    if (form.hasReadBook === 'yes') {
      if (!form.readTimes) {
        errors.readTimes = '请输入阅读次数';
      } else if (isNaN(parseInt(form.readTimes)) || parseInt(form.readTimes) < 1) {
        errors.readTimes = '阅读次数必须是正整数';
      }
    }

    if (!form.enrollReason || form.enrollReason.trim() === '') errors.enrollReason = '请简述参加课程的原因';
    if (!form.expectation || form.expectation.trim() === '') errors.expectation = '请简述对课程的期待';
    if (!form.commitment) errors.commitment = '请选择是否承诺全程参加';

    this.setData({ errors });
    return Object.keys(errors).length === 0;
  },

  /**
   * 处理表单提交
   */
  async handleSubmit(e) {
    console.log('表单提交，数据:', this.data.form);

    // 验证表单
    if (!this.validateForm()) {
      wx.showToast({
        title: '请填写完整的表单',
        icon: 'none'
      });
      return;
    }

    this.setData({ submitting: true });

    try {
      // 获取当前用户ID
      const app = getApp();
      const userId = app.globalData.userInfo?._id;

      if (!userId) {
        wx.showToast({
          title: '用户信息不存在，请重新登录',
          icon: 'none'
        });
        return;
      }

      // 准备提交数据
      const submitData = {
        ...this.data.form,
        userId,  // 添加用户ID
        age: parseInt(this.data.form.age),
        readTimes: this.data.form.hasReadBook === 'yes' ? parseInt(this.data.form.readTimes) : 0
      };

      console.log('提交报名数据:', submitData);

      // 调用API提交报名
      const res = await enrollmentService.submitEnrollment(submitData);

      console.log('报名成功，响应:', res);

      wx.showToast({
        title: '报名成功，前往支付',
        icon: 'success',
        duration: 1500
      });

      // 获取期次信息
      const selectedPeriod = this.data.periodList[this.data.selectedPeriodIndex];

      // 延迟1.5秒后导航到支付页面
      setTimeout(() => {
        wx.navigateTo({
          url: `/pages/payment/payment?enrollmentId=${res._id}&periodId=${selectedPeriod._id}&periodTitle=${selectedPeriod.name}&startDate=${selectedPeriod.startDate}&endDate=${selectedPeriod.endDate}&amount=99`,
          fail: (err) => {
            console.error('导航到支付页面失败:', err);
            wx.showToast({
              title: '导航失败，请重试',
              icon: 'none'
            });
          }
        });
      }, 1500);
    } catch (error) {
      console.error('报名失败:', error);
      wx.showToast({
        title: error.message || '报名失败，请重试',
        icon: 'none'
      });
    } finally {
      this.setData({ submitting: false });
    }
  },

  /**
   * 取消报名
   */
  handleCancel() {
    wx.showModal({
      title: '取消报名',
      content: '确定要取消报名吗？',
      success: (res) => {
        if (res.confirm) {
          wx.navigateBack({
            delta: 1
          });
        }
      }
    });
  }
});
