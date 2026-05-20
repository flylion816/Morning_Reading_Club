const path = require('path');
const fs = require('fs');
const { success, errors } = require('../utils/response');
const logger = require('../utils/logger');
const { getCurrentTenantId } = require('../utils/tenantContext');
const { resolveTenantSlug } = require('../utils/tenantSlug');

const uploadRoot = path.join(__dirname, '../../uploads');
const tenantsRoot = path.join(uploadRoot, 'tenants');

module.exports = {
  uploadFile: async (req, res) => {
    try {
      if (!req.file) return res.status(400).json(errors.badRequest('未找到上传的文件'));
      const tenantId = req._resolvedTenantId || getCurrentTenantId();
      const slug = await resolveTenantSlug(tenantId);
      res.json(success({
        filename: req.file.filename,
        mimetype: req.file.mimetype,
        size: req.file.size,
        url: `/uploads/tenants/${slug}/${req.file.filename}`,
        uploadedAt: new Date()
      }, '文件上传成功'));
    } catch (err) {
      logger.error('File upload error:', err);
      res.status(500).json(errors.serverError('文件上传失败'));
    }
  },

  uploadMultiple: async (req, res) => {
    try {
      if (!req.files || req.files.length === 0) {
        return res.status(400).json(errors.badRequest('未找到上传的文件'));
      }
      const tenantId = req._resolvedTenantId || getCurrentTenantId();
      const slug = await resolveTenantSlug(tenantId);
      const uploadedFiles = req.files.map(file => ({
        filename: file.filename,
        mimetype: file.mimetype,
        size: file.size,
        url: `/uploads/tenants/${slug}/${file.filename}`,
        uploadedAt: new Date()
      }));
      res.json(success({ files: uploadedFiles, count: uploadedFiles.length }, '文件上传成功'));
    } catch (err) {
      logger.error('Multiple files upload error:', err);
      res.status(500).json(errors.serverError('文件上传失败'));
    }
  },

  deleteFile: async (req, res) => {
    try {
      const { filename } = req.params;
      if (filename.includes('..') || filename.includes('/')) {
        return res.status(400).json(errors.badRequest('无效的文件名'));
      }
      const tenantId = req._resolvedTenantId || getCurrentTenantId();
      const slug = await resolveTenantSlug(tenantId);
      const tenantDir = path.join(tenantsRoot, slug);
      const filePath = path.join(tenantDir, filename);

      if (!filePath.startsWith(tenantDir + path.sep)) {
        return res.status(400).json(errors.badRequest('无效的文件路径'));
      }
      if (!fs.existsSync(filePath)) {
        return res.status(404).json(errors.notFound('文件不存在'));
      }
      // realpath 符号链接校验
      try {
        const realTenantDir = fs.realpathSync(tenantDir);
        const realFilePath = fs.realpathSync(filePath);
        if (!realFilePath.startsWith(realTenantDir + path.sep)) {
          return res.status(400).json(errors.badRequest('无效的文件路径'));
        }
      } catch (_) {
        return res.status(400).json(errors.badRequest('无效的文件路径'));
      }
      fs.unlinkSync(filePath);
      res.json(success(null, '文件删除成功'));
    } catch (err) {
      logger.error('File deletion error:', err);
      res.status(500).json(errors.serverError('文件删除失败'));
    }
  }
};
