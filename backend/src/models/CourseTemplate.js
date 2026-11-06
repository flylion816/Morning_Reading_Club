const mongoose = require('mongoose');
const tenantPlugin = require('./plugins/tenantPlugin');
const { validateCourseTemplate } = require('../utils/course-template-validation');

const moduleSchema = new mongoose.Schema({
  id: { type: String, required: true },
  name: { type: String, required: true, trim: true, maxlength: 30 },
  type: { type: String, required: true, enum: ['shortText', 'text', 'body', 'image'] }
}, { _id: false });

const schema = new mongoose.Schema({
  tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
  name: { type: String, required: true, trim: true, maxlength: 30 },
  modules: {
    type: [moduleSchema],
    required: true,
    validate: {
      validator(modules) {
        return !validateCourseTemplate({ name: 'template', modules, extensions: this.extensions });
      },
      message: '课程模板模块配置无效'
    }
  },
  extensions: {
    type: mongoose.Schema.Types.Mixed,
    default: { duration: true, closingVideo: true, podcast: true }
  },
  active: { type: Boolean, default: true },
  revision: { type: Number, default: 1, min: 1 }
}, { timestamps: true, versionKey: false, collection: 'course_templates' });

schema.plugin(tenantPlugin);

module.exports = mongoose.model('CourseTemplate', schema);
