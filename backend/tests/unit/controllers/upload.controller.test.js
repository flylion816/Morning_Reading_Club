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

  describe('uploadFile', () => {
    it('应该上传单个文件', async () => {
      req.file = {
        filename: 'file_123456.jpg',
        path: '/uploads/file_123456.jpg',
        size: 1024000,
        mimetype: 'image/jpeg'
      };

      await uploadController.uploadFile(req, res, next);

      expect(res.json.called).to.be.true;
      const responseData = res.json.getCall(0).args[0];
      expect(responseData.data).to.have.property('url');
      expect(responseData.data).to.have.property('filename');
    });

    it('应该返回400当没有文件', async () => {
      req.file = null;

      await uploadController.uploadFile(req, res, next);

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

  describe('deleteFile', () => {
    it('应该删除文件', async () => {
      req.body = { filename: 'image_123456.jpg' };

      await uploadController.deleteFile(req, res, next);

      expect(res.json.called).to.be.true;
    });
  });
});
