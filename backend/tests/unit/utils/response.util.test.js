/**
 * Response Utils 单元测试
 */

const { expect } = require('chai');
const {
  success,
  successWithPagination,
  error,
  errors
} = require('../../../src/utils/response');

describe('Response Utils', () => {
  describe('success', () => {
    it('应该返回成功响应格式', () => {
      const data = { id: 1, name: 'test' };
      const response = success(data);

      expect(response).to.have.property('code', 200);
      expect(response).to.have.property('message', 'success');
      expect(response).to.have.property('data', data);
      expect(response).to.have.property('timestamp');
    });

    it('应该支持自定义message', () => {
      const response = success({}, '数据获取成功');

      expect(response.message).to.equal('数据获取成功');
    });

    it('应该返回有效的timestamp', () => {
      const before = Date.now();
      const response = success({});
      const after = Date.now();

      expect(response.timestamp).to.be.at.least(before);
      expect(response.timestamp).to.be.at.most(after);
    });

    it('应该支持null数据', () => {
      const response = success(null);

      expect(response.data).to.be.null;
      expect(response.code).to.equal(200);
    });

    it('应该支持数组数据', () => {
      const data = [1, 2, 3, 4, 5];
      const response = success(data);

      expect(response.data).to.deep.equal(data);
    });

    it('应该支持嵌套对象', () => {
      const data = {
        user: { id: 1, name: 'John' },
        posts: [{ id: 1, title: 'Post 1' }]
      };
      const response = success(data);

      expect(response.data).to.deep.equal(data);
    });

    it('应该支持特殊字符在message中', () => {
      const message = '获取成功！@#$%^&*()';
      const response = success({}, message);

      expect(response.message).to.equal(message);
    });
  });

  describe('successWithPagination', () => {
    it('应该返回分页响应格式', () => {
      const items = [{ id: 1 }, { id: 2 }];
      const pagination = { page: 1, pageSize: 10, total: 25 };
      const response = successWithPagination(items, pagination);

      expect(response).to.have.property('code', 200);
      expect(response).to.have.property('message', 'success');
      expect(response).to.have.property('data');
      expect(response.data).to.have.property('items', items);
      expect(response.data).to.have.property('pagination');
    });

    it('分页对象应该包含所有必要字段', () => {
      const items = [];
      const pagination = { page: 2, pageSize: 10, total: 100 };
      const response = successWithPagination(items, pagination);

      const paginationData = response.data.pagination;
      expect(paginationData).to.have.property('page', 2);
      expect(paginationData).to.have.property('pageSize', 10);
      expect(paginationData).to.have.property('total', 100);
      expect(paginationData).to.have.property('totalPages');
      expect(paginationData).to.have.property('hasNext');
      expect(paginationData).to.have.property('hasPrev');
    });

    it('应该正确计算totalPages', () => {
      const pagination = { page: 1, pageSize: 10, total: 25 };
      const response = successWithPagination([], pagination);

      expect(response.data.pagination.totalPages).to.equal(3);
    });

    it('第1页的hasPrev应该为false', () => {
      const pagination = { page: 1, pageSize: 10, total: 30 };
      const response = successWithPagination([], pagination);

      expect(response.data.pagination.hasPrev).to.be.false;
    });

    it('最后一页的hasNext应该为false', () => {
      const pagination = { page: 3, pageSize: 10, total: 30 };
      const response = successWithPagination([], pagination);

      expect(response.data.pagination.hasNext).to.be.false;
    });

    it('中间页的hasNext和hasPrev都应该为true', () => {
      const pagination = { page: 2, pageSize: 10, total: 30 };
      const response = successWithPagination([], pagination);

      expect(response.data.pagination.hasNext).to.be.true;
      expect(response.data.pagination.hasPrev).to.be.true;
    });

    it('应该支持自定义message', () => {
      const response = successWithPagination([], { page: 1, pageSize: 10, total: 0 }, '分页获取成功');

      expect(response.message).to.equal('分页获取成功');
    });

    it('应该处理只有1条记录的分页', () => {
      const pagination = { page: 1, pageSize: 10, total: 1 };
      const response = successWithPagination([{ id: 1 }], pagination);

      expect(response.data.pagination.totalPages).to.equal(1);
      expect(response.data.pagination.hasNext).to.be.false;
      expect(response.data.pagination.hasPrev).to.be.false;
    });

    it('应该处理大分页', () => {
      const pagination = { page: 1, pageSize: 100, total: 1000000 };
      const response = successWithPagination([], pagination);

      expect(response.data.pagination.totalPages).to.equal(10000);
    });
  });

  describe('error', () => {
    it('应该返回错误响应格式', () => {
      const response = error(400, '参数错误');

      expect(response).to.have.property('code', 400);
      expect(response).to.have.property('message', '参数错误');
      expect(response).to.have.property('timestamp');
    });

    it('应该支持详情信息', () => {
      const details = { field: 'email', issue: '格式不正确' };
      const response = error(400, '参数错误', details);

      expect(response).to.have.property('error', details);
    });

    it('不提供详情时不应该包含error字段', () => {
      const response = error(400, '参数错误');

      expect(response).not.to.have.property('error');
    });

    it('应该支持不同的状态码', () => {
      const codes = [400, 401, 403, 404, 409, 429, 500];
      codes.forEach(code => {
        const response = error(code, '错误消息');
        expect(response.code).to.equal(code);
      });
    });
  });

  describe('errors 便利函数', () => {
    it('应该提供badRequest快捷方法', () => {
      const response = errors.badRequest('参数缺失');

      expect(response.code).to.equal(400);
      expect(response.message).to.equal('参数缺失');
    });

    it('应该提供unauthorized快捷方法', () => {
      const response = errors.unauthorized('缺少认证令牌');

      expect(response.code).to.equal(401);
      expect(response.message).to.equal('缺少认证令牌');
    });

    it('应该提供forbidden快捷方法', () => {
      const response = errors.forbidden('没有权限访问此资源');

      expect(response.code).to.equal(403);
      expect(response.message).to.equal('没有权限访问此资源');
    });

    it('应该提供notFound快捷方法', () => {
      const response = errors.notFound('用户不存在');

      expect(response.code).to.equal(404);
      expect(response.message).to.equal('用户不存在');
    });

    it('应该提供conflict快捷方法', () => {
      const response = errors.conflict('资源已存在');

      expect(response.code).to.equal(409);
      expect(response.message).to.equal('资源已存在');
    });

    it('应该提供tooManyRequests快捷方法', () => {
      const response = errors.tooManyRequests('请求过于频繁，请稍后再试');

      expect(response.code).to.equal(429);
      expect(response.message).to.equal('请求过于频繁，请稍后再试');
    });

    it('应该提供serverError快捷方法', () => {
      const response = errors.serverError('数据库连接失败');

      expect(response.code).to.equal(500);
      expect(response.message).to.equal('数据库连接失败');
    });

    it('所有便利方法都应该有默认消息', () => {
      expect(errors.badRequest()).to.have.property('message', '参数错误');
      expect(errors.unauthorized()).to.have.property('message', '未授权');
      expect(errors.forbidden()).to.have.property('message', '无权限访问');
      expect(errors.notFound()).to.have.property('message', '资源不存在');
      expect(errors.conflict()).to.have.property('message', '资源冲突');
      expect(errors.tooManyRequests()).to.have.property('message', '请求过于频繁');
      expect(errors.serverError()).to.have.property('message', '服务器内部错误');
    });

    it('应该支持详情参数在badRequest中', () => {
      const details = { field: 'email', error: '非法格式' };
      const response = errors.badRequest('验证失败', details);

      expect(response).to.have.property('error', details);
    });
  });

  describe('响应格式一致性', () => {
    it('所有响应都应该有timestamp字段', () => {
      const responses = [
        success({}),
        successWithPagination([], { page: 1, pageSize: 10, total: 0 }),
        error(400, 'test'),
        errors.badRequest()
      ];

      responses.forEach(response => {
        expect(response).to.have.property('timestamp');
        expect(response.timestamp).to.be.a('number');
      });
    });

    it('所有响应都应该有code和message字段', () => {
      const responses = [
        success({}),
        successWithPagination([], { page: 1, pageSize: 10, total: 0 }),
        error(400, 'test'),
        errors.badRequest()
      ];

      responses.forEach(response => {
        expect(response).to.have.property('code');
        expect(response).to.have.property('message');
      });
    });
  });

  describe('性能和边界情况', () => {
    it('应该处理大数据集', () => {
      const largeData = new Array(10000).fill({ id: 1 });
      const response = success(largeData);

      expect(response.data).to.have.lengthOf(10000);
    });

    it('应该处理深层嵌套对象', () => {
      const deepObject = {
        level1: {
          level2: {
            level3: {
              level4: { data: 'deep' }
            }
          }
        }
      };
      const response = success(deepObject);

      expect(response.data.level1.level2.level3.level4.data).to.equal('deep');
    });

    it('应该处理特殊字符和unicode', () => {
      const data = { text: '你好世界🌍 @#$%^&*()' };
      const response = success(data);

      expect(response.data.text).to.equal('你好世界🌍 @#$%^&*()');
    });

    it('timestamp应该是毫秒精度', () => {
      const response = success({});

      expect(response.timestamp % 1).to.equal(0); // 整数毫秒
      expect(response.timestamp.toString().length).to.equal(13); // 通常13位数字
    });
  });
});
