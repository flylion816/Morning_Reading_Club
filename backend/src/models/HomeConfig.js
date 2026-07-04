const mongoose = require('mongoose');
const tenantPlugin = require('./plugins/tenantPlugin');
const { HOME_SECTION_KEYS } = require('../constants/homeSections');

const homeConfigSchema = new mongoose.Schema(
  {
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tenant',
      required: true,
      index: true
    },
    sections: {
      type: [String],
      default: HOME_SECTION_KEYS
    },
    hiddenSections: {
      type: [String],
      default: []
    }
  },
  { timestamps: true }
);

homeConfigSchema.plugin(tenantPlugin);
homeConfigSchema.index({ tenantId: 1 }, { unique: true });

module.exports = mongoose.model('HomeConfig', homeConfigSchema);
