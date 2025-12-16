/**
 * Upload Controller 单元测试
 */

const { expect } = require('chai');
const sinon = require('sinon');
const proxyquire = require('proxyquire').noCallThru();

describe('Upload Controller', () => {
  let uploadController;
  let sandbox;
  let req;
  let res;
  let next;

  beforeEach(() => {
    sandbox = sinon.createSandbox();

    req = {
      body: {},
      params: {},
      query: {},
      user: {},
      file: null,
      files: []
    };

    res = {
      status: sandbox.stub().returnsThis(),
      json: sandbox.stub().returnsThis()
    };

    next = sandbox.stub();

    const responseUtils = {
      success: (data, message) => ({ code: 200, message, data }),
      errors: {
        badRequest: (msg) => ({ code: 400, message: msg })
      }
    };

    uploadController = proxyquire(
      '../../../src/controllers/upload.controller',
      {
        '../utils/response': responseUtils
      }
    );
  });

  afterEach(() => {
    sandbox.restore();
  });

  describe('uploadImage', () => {
    it('应该上传单个图片', async () => {
      req.file = {
        filename: 'image_123456.jpg',
        path: '/uploads/image_123456.jpg',
        size: 1024000,
        mimetype: 'image/jpeg'
      };

      await uploadController.uploadImage(req, res, next);

      expect(res.json.called).to.be.true;
      const responseData = res.json.getCall(0).args[0];
      expect(responseData.data).to.have.property('url');
      expect(responseData.data).to.have.property('filename');
    });

    it('应该返回400当没有文件', async () => {
      req.file = null;

      await uploadController.uploadImage(req, res, next);

      expect(res.status.calledWith(400)).to.be.true;
    });

    it('应该验证文件类型', async () => {
      req.file = {
        filename: 'file.exe',
        path: '/uploads/file.exe',
        mimetype: 'application/x-msdownload'
      };

      await uploadController.uploadImage(req, res, next);

      expect(res.status.calledWith(400)).to.be.true;
    });
  });

  describe('uploadMultiple', () => {
    it('应该上传多个图片', async () => {
      req.files = [
        {
          filename: 'image_1.jpg',
          path: '/uploads/image_1.jpg',
          mimetype: 'image/jpeg'
        },
        {
          filename: 'image_2.jpg',
          path: '/uploads/image_2.jpg',
          mimetype: 'image/jpeg'
        }
      ];

      await uploadController.uploadMultiple(req, res, next);

      expect(res.json.called).to.be.true;
      const responseData = res.json.getCall(0).args[0];
      expect(responseData.data).to.have.property('urls');
      expect(responseData.data.urls).to.have.lengthOf(2);
    });

    it('应该返回400当没有文件', async () => {
      req.files = [];

      await uploadController.uploadMultiple(req, res, next);

      expect(res.status.calledWith(400)).to.be.true;
    });
  });

  describe('uploadAvatar', () => {
    it('应该上传用户头像', async () => {
      req.file = {
        filename: 'avatar_user123.jpg',
        path: '/uploads/avatar_user123.jpg',
        mimetype: 'image/jpeg'
      };

      await uploadController.uploadAvatar(req, res, next);

      expect(res.json.called).to.be.true;
      const responseData = res.json.getCall(0).args[0];
      expect(responseData.data).to.have.property('url');
    });
  });

  describe('uploadMaterial', () => {
    it('应该上传学习材料', async () => {
      req.file = {
        filename: 'material.pdf',
        path: '/uploads/material.pdf',
        mimetype: 'application/pdf',
        size: 5242880
      };

      await uploadController.uploadMaterial(req, res, next);

      expect(res.json.called).to.be.true;
    });

    it('应该验证文件大小', async () => {
      req.file = {
        filename: 'large_file.pdf',
        path: '/uploads/large_file.pdf',
        mimetype: 'application/pdf',
        size: 104857600
      };

      await uploadController.uploadMaterial(req, res, next);

      expect(res.status.calledWith(400)).to.be.true;
    });
  });

  describe('deleteFile', () => {
    it('应该删除文件', async () => {
      req.body = { filename: 'image_123456.jpg' };

      await uploadController.deleteFile(req, res, next);

      expect(res.json.called).to.be.true;
    });
  });
});
