const constants = require('../../config/constants');

describe('request timeout configuration', () => {
  test('allows large production insight lists to finish on slow clients', () => {
    expect(constants.REQUEST_TIMEOUT).toBe(30000);
  });
});
