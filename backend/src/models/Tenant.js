const mongoose = require('mongoose');

const TenantSchema = new mongoose.Schema(
  {
    slug: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      maxlength: 32,
      match: /^[a-z][a-z0-9_-]*$/
    },
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 50
    },
    description: {
      type: String,
      default: '',
      maxlength: 500
    },
    wxAppIds: {
      type: [String],
      default: []
    },
    wechatLogin: {
      appId: { type: String, default: null },
      appSecret: { type: String, default: null, select: false }
    },
    wechatPay: {
      mchId: { type: String, default: null },
      apiKey: { type: String, default: null, select: false },
      appId: { type: String, default: null },
      notifyUrl: { type: String, default: null }
    },
    branding: {
      logo: { type: String, default: null },
      primaryColor: { type: String, default: '#4a90e2' },
      brandName: { type: String, default: null }
    },
    status: {
      type: String,
      enum: ['active', 'suspended', 'archived'],
      default: 'active'
    }
  },
  {
    timestamps: true,
    versionKey: false,
    collection: 'tenants'
  }
);

TenantSchema.index({ wxAppIds: 1 });
TenantSchema.index({ 'wechatLogin.appId': 1 });
TenantSchema.index({ 'wechatPay.appId': 1, 'wechatPay.mchId': 1 });

TenantSchema.statics.findByWxAppId = async function (wxAppId) {
  if (!wxAppId || typeof wxAppId !== 'string') return null;
  if (!/^wx[0-9a-f]{16}$/i.test(wxAppId)) return null;
  return this.findOne({
    status: 'active',
    $or: [
      { wxAppIds: wxAppId },
      { 'wechatLogin.appId': wxAppId }
    ]
  }).lean();
};

module.exports = mongoose.model('Tenant', TenantSchema);
