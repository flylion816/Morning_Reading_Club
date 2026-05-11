const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const uploadController = require('../controllers/upload.controller');
const { adminAuthMiddleware } = require('../middleware/adminAuth');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();

// 配置 multer
const uploadDir = path.join(__dirname, '../../uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const mimeExtensionMap = {
  'image/jpeg': '.jpg',
  'image/jpg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/gif': '.gif'
};

function getFileExtension(file) {
  const originalExt = path.extname(file.originalname || '').toLowerCase();
  return originalExt || mimeExtensionMap[file.mimetype] || '';
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    // 生成唯一的文件名: 时间戳 + 原始扩展名
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + getFileExtension(file));
  }
});

// 文件过滤
const fileFilter = (req, file, cb) => {
  // 允许的文件类型
  const allowedTypes = /jpeg|jpg|png|gif|webp|pdf|doc|docx|xls|xlsx|mp4|webm/;
  const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
  const mimetype = allowedTypes.test(file.mimetype);

  if (mimetype && extname) {
    return cb(null, true);
  } else {
    cb(new Error('不支持的文件类型'));
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 50 * 1024 * 1024 // 50MB 限制
  }
});

const avatarUpload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|webp/;
    const originalExt = path.extname(file.originalname || '').toLowerCase();
    const extname = !originalExt || allowedTypes.test(originalExt);
    const mimetype = allowedTypes.test(file.mimetype);

    if (mimetype && extname) {
      return cb(null, true);
    }

    cb(new Error('头像仅支持 jpg、png、webp 格式'));
  },
  limits: {
    fileSize: 5 * 1024 * 1024
  }
});

// 上传单个文件
router.post('/', adminAuthMiddleware, upload.single('file'), uploadController.uploadFile);

// 上传用户头像
router.post('/avatar', authMiddleware, avatarUpload.single('file'), uploadController.uploadAvatar);

// 上传多个文件
router.post(
  '/multiple',
  adminAuthMiddleware,
  upload.array('files', 10),
  uploadController.uploadMultiple
);

// 删除文件
router.delete('/:filename', adminAuthMiddleware, uploadController.deleteFile);

module.exports = router;
