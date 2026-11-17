const mongoose = require('mongoose');
const tenantPlugin = require('./plugins/tenantPlugin');

const FileSchema = new mongoose.Schema(
  {
    dir: { type: String, required: true },
    originalName: { type: String, required: true, maxlength: 255 },
    size: { type: Number, required: true, min: 0 },
    pageCount: { type: Number, required: true, min: 1, max: 120 },
    pagesReady: { type: Boolean, default: false },
    uploadedAt: { type: Date, default: Date.now }
  },
  { _id: false }
);

const CompanionNoteSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true, minlength: 1, maxlength: 40 },
    summary: { type: String, trim: true, maxlength: 200, default: '' },
    companionName: { type: String, required: true, trim: true, minlength: 1, maxlength: 20 },
    companionUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    file: { type: FileSchema, required: true },
    coverUrl: { type: String, required: true, trim: true, maxlength: 1000 },
    periodId: { type: mongoose.Schema.Types.ObjectId, ref: 'Period', default: null },
    sectionIds: { type: [mongoose.Schema.Types.ObjectId], ref: 'Section', default: [] },
    status: { type: String, enum: ['draft', 'published'], default: 'draft' },
    publishedAt: { type: Date, default: null },
    sortOrder: { type: Number, default: 0 },
    likeCount: { type: Number, default: 0, min: 0 },
    commentCount: { type: Number, default: 0, min: 0 },
    readerCount: { type: Number, default: 0, min: 0 },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin', default: null },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin', default: null },
    deletedAt: { type: Date, default: null },
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', default: null, index: true }
  },
  { timestamps: true, versionKey: false }
);

CompanionNoteSchema.index({ tenantId: 1, status: 1, periodId: 1, sortOrder: 1 });
CompanionNoteSchema.index({ tenantId: 1, sectionIds: 1, status: 1 });
CompanionNoteSchema.index({ tenantId: 1, status: 1, publishedAt: -1 });

CompanionNoteSchema.plugin(tenantPlugin);

module.exports = mongoose.model('CompanionNote', CompanionNoteSchema);
