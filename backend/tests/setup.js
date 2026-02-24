/**
 * 测试环境设置
 * 为Mocha提供Jest API的兼容性
 */

// 为所有使用jest.mock的测试提供Jest API
if (typeof global.jest === 'undefined') {
  global.jest = {
    mock: (moduleName, moduleFactory, options) => {
      // Jest的mock在Mocha中被proxyquire替代
      // 这里只是占位符，实际的mocking在各个测试文件中通过proxyquire实现
    },
    fn: (impl) => {
      // jest.fn() 返回一个spy函数
      // 这里创建一个简单的stub来兼容
      const func = impl || (() => {});
      func.mock = { calls: [], results: [] };
      func.mockReturnValue = function(value) {
        return (...args) => { this.mock.calls.push(args); return value; };
      };
      func.mockResolvedValue = function(value) {
        return (...args) => { this.mock.calls.push(args); return Promise.resolve(value); };
      };
      return func;
    }
  };
}
