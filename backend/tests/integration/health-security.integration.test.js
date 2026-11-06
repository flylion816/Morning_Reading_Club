const request = require('supertest');
const app = require('../../src/app');

describe('Health route security', () => {
  it('keeps basic probes public but requires an administrator for detailed status', async () => {
    await request(app).get('/api/v1/live').expect(200);
    await request(app).get('/api/v1/status').expect(401);
  });
});
