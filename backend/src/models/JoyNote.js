const mongoose = require('mongoose');
const tenantPlugin = require('./plugins/tenantPlugin');

// 觉察记录的结构化内容：看（facts）、感（feelings…）、问（asks）、择（choice）、后来（followUps）。
// 回访 revisit：none 不回访；pending 待投递；delivering 投递中；delivered 已送到来信；
// answered 已写后来；skipped 选了先不写。
const AwarenessSchema = new mongoose.Schema({
  facts: { type: String, default: '', maxlength: 600 },
  // 带格式的 HTML（经白名单清洗）。facts / answer / choice 的纯文本由它推出；没有格式时不存
  factsHtml: { type: String, default: '', maxlength: 12000 },
  feelings: { type: [String], default: [] },
  bodyAreas: { type: [String], default: [] },
  feelingNote: { type: String, default: '', maxlength: 200 },
  asks: {
    type: [new mongoose.Schema({
      level: { type: Number, min: 1, max: 3 },
      question: { type: String, maxlength: 80 },
      answer: { type: String, maxlength: 500 },
      answerHtml: { type: String, maxlength: 12000 }
    }, { _id: false })],
    default: []
  },
  habitKey: { type: String, default: 'general' },
  choice: { type: String, default: '', maxlength: 300 },
  choiceHtml: { type: String, default: '', maxlength: 12000 },
  followUps: {
    type: [new mongoose.Schema({
      content: { type: String, required: true, maxlength: 500 },
      createdAt: { type: Date, default: Date.now }
    }, { _id: false })],
    default: []
  },
  revisit: {
    enabled: { type: Boolean, default: false },
    status: {
      type: String,
      enum: ['none', 'pending', 'delivering', 'delivered', 'answered', 'skipped'],
      default: 'none'
    },
    dueAt: { type: Date, default: null },
    deliveredAt: { type: Date, default: null }
  }
}, { _id: false });

const JoyNoteSchema = new mongoose.Schema({
  tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', default: null },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  // 标题：选填，最多 40 字
  title: { type: String, default: '', maxlength: 60 },
  content: { type: String, required: true, maxlength: 3000 },
  // 随喜的带格式 HTML（经白名单清洗；content 由它推出）。没有格式时不存
  contentHtml: { type: String, default: '', maxlength: 20000 },
  // 缺少 kind 的历史记录一律按随喜处理
  kind: { type: String, enum: ['joy', 'awareness'], default: 'joy' },
  awareness: { type: AwarenessSchema, default: undefined },
  periodId: { type: mongoose.Schema.Types.ObjectId, ref: 'Period', default: null },
  sectionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Section', default: null }
}, { timestamps: true, versionKey: false });

JoyNoteSchema.index({ tenantId: 1, userId: 1, createdAt: -1, _id: -1 });
JoyNoteSchema.index({ tenantId: 1, userId: 1, periodId: 1, createdAt: -1 });
// 回访定时任务只扫待投递的觉察记录
JoyNoteSchema.index(
  { 'awareness.revisit.dueAt': 1 },
  { partialFilterExpression: { 'awareness.revisit.status': 'pending' } }
);
JoyNoteSchema.plugin(tenantPlugin);

module.exports = mongoose.model('JoyNote', JoyNoteSchema);
