// 报名页面
const enrollmentService = require('../../services/enrollment.service');
const { calculatePeriodStatus } = require('../../utils/formatters');
const subscribeAutoTopUp = require('../../utils/subscribe-auto-topup');
const { markEnrollmentCacheDirty } = require('../../utils/period-access');
const { THEME_PRIMARY } = require('../../utils/theme');
const { getDefaultShareTitle, getDefaultShareImage } = require('../../utils/brand');
const {
  normalizeEnrollmentTemplate,
  buildEnrollmentPayload,
  validateEnrollmentForm: validateByTemplate,
  getEnrollmentPrice
} = require('../../utils/enrollment-template');

const SUBSCRIBE_SCENES = ['enrollment_result'];

function getPeriodId(period) {
  if (!period || typeof period !== 'object') return '';
  return period._id || period.id || '';
}

function getPeriodName(period) {
  if (!period || typeof period !== 'object') return '';
  return period.name || period.title || '未命名期次';
}

function getPeriodIcon(period) {
  if (!period || typeof period !== 'object') return '📚';
  return period.icon || period.coverEmoji || '📚';
}

function buildFieldVisibility(template = {}) {
  return (template.fields || []).reduce((result, field) => {
    result[field.id] = true;
    return result;
  }, {});
}

function buildFieldRequired(template = {}) {
  return (template.fields || []).reduce((result, field) => {
    result[field.id] = !!field.required;
    return result;
  }, {});
}

function validateTemplateStep(form = {}, template = {}, step = 1) {
  const errors = {};
  const fields = (template.fields || []).filter(field => field.step === step);

  fields.forEach(field => {
    const value = form[field.id];
    if (field.required && (value === undefined || value === null || String(value).trim() === '')) {
      errors[field.id] = `请填写${field.label || field.id}`;
    }
  });

  if (fields.some(field => field.id === 'phone') && form.phone && !/^1\d{10}$/.test(String(form.phone).trim())) {
    errors.phone = '请输入正确的11位手机号';
  }

  return errors;
}

function buildFieldLabels(template = {}) {
  const labels = {
    name: '姓名',
    phone: '手机号',
    gender: '性别',
    province: '所在地区',
    detailedAddress: '详细地址',
    age: '年龄',
    referrer: '推荐人',
    hasReadBook: '是否读过相关书籍',
    readTimes: '阅读次数',
    enrollReason: '参加课程的缘起',
    expectation: '对课程的期待',
    commitment: '参与承诺'
  };
  (template.fields || []).forEach(field => {
    if (field.id && field.label) labels[field.id] = field.label;
  });
  return labels;
}

Page({
  data: {
    // 加载状态
    loading: true,
    submitting: false,
    themePrimaryColor: THEME_PRIMARY,

    // 期次信息
    periodId: '',
    periodName: '',
    periodList: [],
    selectedPeriodIndex: 0,
    selectedPeriodName: '',
    selectedPeriodIcon: '📚',
    enrollmentTemplate: { mode: 'full', isSimple: false, name: '七个习惯完整版', fields: [] },
    fieldVisibility: {},
    fieldRequired: {},
    fieldLabels: {},
    isSimpleForm: false,
    enrollmentFeeText: '免费',
    enrollmentAmountInCents: 0,

    // 选项数据
    genderOptions: [
      { label: '男', value: 'male' },
      { label: '女', value: 'female' },
      { label: '不想透露', value: 'prefer_not_to_say' }
    ],
    provinceList: [
      '北京',
      '上海',
      '广东',
      '浙江',
      '江苏',
      '福建',
      '山东',
      '四川',
      '湖北',
      '湖南',
      '安徽',
      '江西',
      '黑龙江',
      '吉林',
      '辽宁',
      '河北',
      '河南',
      '山西',
      '陕西',
      '甘肃',
      '青海',
      '云南',
      '贵州',
      '重庆',
      '天津',
      '内蒙古',
      '宁夏',
      '新疆',
      '西藏',
      '台湾',
      '香港',
      '澳门',
      '其他'
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
      phone: '',
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

    // 分步表单
    currentStep: 1, // 1: 基本信息, 2: 了解你, 3: 确认
    inviterId: '',
    phoneAuthorized: false, // 是否通过微信授权获取了手机号

    // 表单验证错误
    errors: {}
  },

  onLoad(options) {
    console.log('报名页面加载，参数:', options);

    if (options.periodId) {
      this.setData({ periodId: options.periodId });
    }

    // 来自邀请链接：记录邀请人ID，自动填入推荐人
    if (options.referrerId) {
      this.setData({ inviterId: options.referrerId });
      // 尝试获取邀请人昵称填入 referrer 字段
      this.loadInviterName(options.referrerId);
    }

    this.loadPeriods();
  },

  async loadInviterName(inviterId) {
    try {
      const request = require('../../utils/request');
      const res = await request.get(`/users/${inviterId}/public-profile`);
      if (res && res.nickname) {
        this.setData({ 'form.referrer': res.nickname });
      }
    } catch (e) {
      // 获取失败不影响主流程
    }
  },

  onReady() {
    console.log('[CSS DEBUG] 页面已准备，正在检查样式...');
    // 使用 getComputedStyle 诊断输入框的实际样式
    const query = wx.createSelectorQuery();
    query.select('.form-control').boundingClientRect();
    query.exec((res) => {
      if (res[0]) {
        console.log('[CSS DEBUG] .form-control 的实际尺寸:', {
          width: res[0].width,
          height: res[0].height,
          left: res[0].left,
          right: res[0].right
        });
      }
    });
  },

  /**
   * 加载期次列表
   */
  async loadPeriods() {
    this.setData({ loading: true });

    try {
      const res = await enrollmentService.getPeriods();
      // API 返回的结构是：{array, timestamp, pagination}
      // request.js 返回 data.data 对象，是一个数组或包含数据的对象
      let periodList = Array.isArray(res) ? res : res.list || res.items || [];
      periodList = periodList.filter(item => item && typeof item === 'object' && getPeriodId(item));

      console.log('获取到期次列表:', periodList);

      const requestedPeriod = this.data.periodId
        ? periodList.find(p => getPeriodId(p) === this.data.periodId)
        : null;
      if (requestedPeriod && requestedPeriod.enrollmentOpen === false) {
        wx.showToast({
          title: '该期暂未开放报名',
          icon: 'none'
        });
        this.setData({ loading: false });
        setTimeout(() => {
          wx.redirectTo({
            url: `/pages/period-detail/period-detail?periodId=${getPeriodId(requestedPeriod)}`
          });
        }, 800);
        return;
      }

      periodList = periodList.filter(item => item.enrollmentOpen !== false);

      // ℹ️ 不过滤已完成的期次，让用户看到所有期次
      // 如果期次已完成，将在报名时验证并显示提示
      // periodList = periodList.filter(p => {
      //   const status = calculatePeriodStatus(p.startDate, p.endDate);
      //   return status !== 'completed';
      // });

      if (periodList.length === 0) {
        // 没有可报名的期次，返回首页
        wx.showToast({
          title: '暂无开放报名期次',
          icon: 'none'
        });
        this.setData({ loading: false });
        setTimeout(() => {
          wx.navigateBack();
        }, 1500);
        return;
      }

      // 设置默认选中的期次
      let selectedIndex = 0;
      const periodId = this.data.periodId;

      if (periodId) {
        selectedIndex = periodList.findIndex(p => getPeriodId(p) === periodId);
        if (selectedIndex === -1) selectedIndex = 0;
      }

      const selectedPeriod = periodList[selectedIndex] || periodList[0] || null;

      if (!selectedPeriod) {
        throw new Error('未找到有效的报名期次');
      }

      const enrollmentTemplate = normalizeEnrollmentTemplate(selectedPeriod);
      const enrollmentPrice = getEnrollmentPrice(selectedPeriod);
      this.setData({
        periodList,
        selectedPeriodIndex: selectedIndex,
        selectedPeriodName: getPeriodName(selectedPeriod),
        selectedPeriodIcon: getPeriodIcon(selectedPeriod),
        periodName: getPeriodName(selectedPeriod),
        selectedPeriodPrice: selectedPeriod.price ? (selectedPeriod.price / 100).toFixed(2).replace(/\.?0+$/, '') : 0,
        selectedPeriodPriceFen: enrollmentPrice.amountInCents,
        enrollmentTemplate,
        isSimpleForm: enrollmentTemplate.isSimple,
        fieldVisibility: buildFieldVisibility(enrollmentTemplate),
        fieldRequired: buildFieldRequired(enrollmentTemplate),
        fieldLabels: buildFieldLabels(enrollmentTemplate),
        enrollmentFeeText: enrollmentPrice.display,
        enrollmentAmountInCents: enrollmentPrice.amountInCents,
        form: {
          ...this.data.form,
          periodId: getPeriodId(selectedPeriod)
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

    if (!selectedPeriod) {
      console.warn('切换报名期次时未找到期次:', { index, periodListLength: this.data.periodList.length });
      return;
    }

    this.setData({
      selectedPeriodIndex: index,
      selectedPeriodName: getPeriodName(selectedPeriod),
      selectedPeriodIcon: getPeriodIcon(selectedPeriod),
      periodName: getPeriodName(selectedPeriod),
      periodId: getPeriodId(selectedPeriod),
      selectedPeriodPrice: selectedPeriod.price ? (selectedPeriod.price / 100).toFixed(2).replace(/\.?0+$/, '') : 0,
      selectedPeriodPriceFen: selectedPeriod.price || 0,
      enrollmentTemplate: normalizeEnrollmentTemplate(selectedPeriod),
      isSimpleForm: normalizeEnrollmentTemplate(selectedPeriod).isSimple,
      fieldVisibility: buildFieldVisibility(normalizeEnrollmentTemplate(selectedPeriod)),
      fieldRequired: buildFieldRequired(normalizeEnrollmentTemplate(selectedPeriod)),
      fieldLabels: buildFieldLabels(normalizeEnrollmentTemplate(selectedPeriod)),
      enrollmentFeeText: getEnrollmentPrice(selectedPeriod).display,
      enrollmentAmountInCents: getEnrollmentPrice(selectedPeriod).amountInCents,
      form: {
        ...this.data.form,
        periodId: getPeriodId(selectedPeriod)
      }
    });
  },

  getSelectedPeriod() {
    const byIndex = this.data.periodList[this.data.selectedPeriodIndex];
    if (byIndex && getPeriodId(byIndex)) {
      return byIndex;
    }

    const byFormPeriodId = this.data.periodList.find(
      item => getPeriodId(item) === this.data.form.periodId
    );
    if (byFormPeriodId) {
      return byFormPeriodId;
    }

    return this.data.periodList[0] || null;
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
   * 处理数字输入框 - 实时过滤非数字字符
   */
  handleNumberInput(e) {
    const field = e.currentTarget.dataset.field;
    const raw = e.detail.value;
    // 只保留数字
    const cleaned = raw.replace(/[^0-9]/g, '');

    const newForm = { ...this.data.form };
    newForm[field] = cleaned;

    const newErrors = { ...this.data.errors };
    delete newErrors[field];

    this.setData({
      form: newForm,
      errors: newErrors
    });
  },

  /**
   * 处理数字输入框失去焦点 - 即时校验范围
   */
  handleNumberBlur(e) {
    const field = e.currentTarget.dataset.field;
    const value = this.data.form[field];
    const errors = { ...this.data.errors };

    if (field === 'age') {
      if (!value) {
        errors.age = '请输入年龄';
      } else {
        const age = parseInt(value, 10);
        if (isNaN(age) || age <= 10 || age > 120) {
          errors.age = '年龄需在11-120之间';
        } else {
          delete errors.age;
        }
      }
    } else if (field === 'readTimes') {
      if (!value) {
        errors.readTimes = '请输入阅读次数';
      } else {
        const times = parseInt(value, 10);
        if (isNaN(times) || times < 1) {
          errors.readTimes = '阅读次数必须是正整数';
        } else {
          delete errors.readTimes;
        }
      }
    }

    this.setData({ errors });
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
    const errors = validateByTemplate(form, this.data.enrollmentTemplate);

    console.log('========== 开始表单验证 ==========');
    console.log('form 数据:', form);

    console.log('验证错误:', errors);
    console.log('验证结果:', Object.keys(errors).length === 0 ? '✓ 通过' : '✗ 失败');
    console.log('========== 验证结束 ==========');

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
      const errors = this.data.errors;
      const firstError = Object.values(errors)[0] || '请填写完整的表单';
      wx.showToast({
        title: firstError,
        icon: 'none',
        duration: 2500
      });
      return;
    }

    // 检查选中的期次是否已完成
    const selectedPeriod = this.getSelectedPeriod();
    if (!selectedPeriod) {
      wx.showToast({
        title: '报名期次异常，请返回重试',
        icon: 'none'
      });
      return;
    }
    const periodStatus = calculatePeriodStatus(selectedPeriod.startDate, selectedPeriod.endDate);

    if (periodStatus === 'completed') {
      wx.showToast({
        title: '该期晨读营已结束，无法报名',
        icon: 'none'
      });
      return;
    }

    if (selectedPeriod.enrollmentOpen === false) {
      wx.showToast({
        title: '该期暂未开放报名',
        icon: 'none'
      });
      return;
    }

    this.setData({ submitting: true });

    try {
      // 准备提交数据（不发送userId，后端从认证令牌中获取）
      const submitData = buildEnrollmentPayload(
        this.data.form,
        selectedPeriod,
        this.data.enrollmentTemplate,
        this.data.inviterId
      );

      console.log('提交报名数据:', submitData);
      console.log('检查必填字段：');
      console.log('- periodId:', submitData.periodId, '✓');
      console.log('- name:', submitData.name, '✓');

      await subscribeAutoTopUp.maybeAutoTopUpSubscriptions({
        sourceAction: 'enrollment_submit',
        sourcePage: 'enrollment',
        periodId: getPeriodId(selectedPeriod),
        sceneKeys: SUBSCRIBE_SCENES,
        requestMode: 'any'
      });

      // 调用API提交报名
      const res = await enrollmentService.submitEnrollment(submitData);

      console.log('报名成功，响应:', res);
      markEnrollmentCacheDirty(getPeriodId(selectedPeriod));

      const enrollment = res?.enrollment || res?.data || res || {};
      const paymentStatus = enrollment.paymentStatus || res?.paymentStatus || (this.data.enrollmentAmountInCents === 0 ? 'free' : 'pending');
      const enrollmentId = enrollment._id || enrollment.id || enrollment.enrollmentId || res?.enrollmentId || '';
      if (this.data.enrollmentAmountInCents > 0 && paymentStatus !== 'paid') {
        if (!enrollmentId) throw new Error('报名已提交，但缺少支付所需的报名编号');
        wx.navigateTo({
          url: `/pages/payment/payment?enrollmentId=${enrollmentId}&periodId=${getPeriodId(selectedPeriod)}&periodTitle=${encodeURIComponent(getPeriodName(selectedPeriod))}&startDate=${encodeURIComponent(selectedPeriod.startDate || '')}&endDate=${encodeURIComponent(selectedPeriod.endDate || '')}&amount=${this.data.enrollmentAmountInCents}`
        });
        return;
      }
      wx.showToast({ title: '免费报名成功', icon: 'success', duration: 1200 });
      setTimeout(() => this.navigateToCourses(selectedPeriod), 1200);
    } catch (error) {
      console.error('报名失败:', error);

      // 从错误对象中提取错误消息
      let errorMessage = '报名失败，请重试';

      // 优先级顺序：error.data.message > error.message > 默认值
      if (error && error.data && error.data.message) {
        errorMessage = error.data.message;
      } else if (error && error.message) {
        errorMessage = error.message;
      }

      wx.showToast({
        title: errorMessage,
        icon: 'none'
      });
    } finally {
      this.setData({ submitting: false });
    }
  },

  navigateToCourses(period) {
    wx.navigateTo({
      url: `/pages/courses/courses?periodId=${getPeriodId(period)}&name=${encodeURIComponent(getPeriodName(period))}`,
      fail: err => {
        console.error('导航到课程列表失败:', err);
        wx.showToast({ title: '导航失败，请重试', icon: 'none' });
      }
    });
  },

  /**
   * 取消报名
   */
  handleCancel() {
    wx.showModal({
      title: '取消报名',
      content: '确定要取消报名吗？',
      success: res => {
        if (res.confirm) {
          wx.navigateBack({ delta: 1 });
        }
      }
    });
  },

  // 微信授权获取手机号
  async onGetPhoneNumber(e) {
    if (e.detail.code) {
      try {
        const request = require('../../utils/request');
        const res = await request.post('/auth/phone', { code: e.detail.code });
        if (res && res.phone) {
          this.setData({ 'form.phone': res.phone, phoneAuthorized: true });
          wx.showToast({ title: '手机号已获取', icon: 'success' });
        }
      } catch (err) {
        wx.showToast({ title: '获取手机号失败，请手动输入', icon: 'none' });
      }
    } else {
      wx.showToast({ title: '请授权手机号以便联系你', icon: 'none' });
    }
  },

  clearPhone() {
    this.setData({ 'form.phone': '', phoneAuthorized: false });
  },

  // 分步导航
  goNextStep() {
    const { currentStep, form } = this.data;
    if (this.data.isSimpleForm) {
      return;
    }

    const errors = validateTemplateStep(form, this.data.enrollmentTemplate, currentStep);
    if (Object.keys(errors).length > 0) {
      this.setData({ errors });
      wx.showToast({ title: Object.values(errors)[0], icon: 'none' });
      return;
    }
    this.setData({ currentStep: currentStep + 1, errors: {} });
  },

  goPrevStep() {
    const { currentStep } = this.data;
    if (currentStep > 1) {
      this.setData({ currentStep: currentStep - 1 });
    }
  },

  onShareAppMessage() {
    const selectedPeriod = this.getSelectedPeriod();
    if (selectedPeriod && selectedPeriod._id) {
      const app = getApp();
      const userId = app.globalData.userInfo && (app.globalData.userInfo._id || app.globalData.userInfo.id);
      const inviterParam = userId ? `&inviterId=${userId}` : '';
      const title = selectedPeriod.inviteTitle ||
        `${selectedPeriod.name}·${selectedPeriod.subtitle || '21天七个习惯晨读营'}，快来加入！`;
      return {
        title,
        path: `/pages/invite/invite?periodId=${selectedPeriod._id}${inviterParam}`,
        imageUrl: selectedPeriod.coverImage || getDefaultShareImage()
      };
    }
    return { title: getDefaultShareTitle(), path: '/pages/index/index?from=share', imageUrl: getDefaultShareImage() };
  }
});
