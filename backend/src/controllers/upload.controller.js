const path = require('path');
const fs = require('fs');
const { success, errors } = require('../utils/response');
const logger = require('../utils/logger');

// 确保上传目录存在
const uploadDir = path.join(__dirname, '../../uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

module.exports = {
  /**
   * 上传单个文件
   * POST /api/v1/upload
   */
  uploadFile: (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json(errors.badRequest('未找到上传的文件'));
      }

      const { filename, mimetype, size } = req.file;

      // 返回文件信息和访问 URL
      const fileUrl = `/uploads/${filename}`;

      res.json(
        success(
          {
            filename,
            mimetype,
            size,
            url: fileUrl,
            uploadedAt: new Date()
          },
          '文件上传成功'
        )
      );
    } catch (err) {
      logger.error('File upload error:', err);
      res.status(500).json(errors.internalServerError('文件上传失败'));
    }
  },

  /**
   * 上传多个文件
   * POST /api/v1/upload/multiple
   */
  uploadMultiple: (req, res) => {
    try {
      if (!req.files || req.files.length === 0) {
        return res.status(400).json(errors.badRequest('未找到上传的文件'));
      }

      const uploadedFiles = req.files.map(file => ({
        filename: file.filename,
        mimetype: file.mimetype,
        size: file.size,
        url: `/uploads/${file.filename}`,
        uploadedAt: new Date()
      }));

      res.json(
        success(
          {
            files: uploadedFiles,
            count: uploadedFiles.length
          },
          '文件上传成功'
        )
      );
    } catch (err) {
      logger.error('Multiple files upload error:', err);
      res.status(500).json(errors.internalServerError('文件上传失败'));
    }
  },

  /**
   * 删除文件
   * DELETE /api/v1/upload/:filename
   */
  deleteFile: (req, res) => {
    try {
      const { filename } = req.params;

      // 防止路径遍历攻击
      if (filename.includes('..') || filename.includes('/')) {
        return res.status(400).json(errors.badRequest('无效的文件名'));
      }

      const filePath = path.join(uploadDir, filename);

      // 确保文件在上传目录内
      if (!filePath.startsWith(uploadDir)) {
        return res.status(400).json(errors.badRequest('无效的文件路径'));
      }

      if (!fs.existsSync(filePath)) {
        return res.status(404).json(errors.notFound('文件不存在'));
      }

      fs.unlinkSync(filePath);

      res.json(success(null, '文件删除成功'));
    } catch (err) {
      logger.error('File deletion error:', err);
      res.status(500).json(errors.internalServerError('文件删除失败'));
    }
  }
};
