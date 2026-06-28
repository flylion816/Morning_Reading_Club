/**
 * 管理员数据分析页自动化检查
 *
 * 前置条件：
 *   微信开发者工具已开启「服务端口」（设置 → 安全 → 服务端口）
 *
 * 运行：
 *   npm run test:e2e -- admin-analytics
 */

const automator = require('miniprogram-automator');
const { spawn } = require('child_process');
const net = require('net');
const WebSocket = require('ws');
const path = require('path');

const DEVTOOLS_CLI = '/Applications/wechatwebdevtools.app/Contents/MacOS/cli';
const PROJECT_PATH = path.resolve(__dirname, '../../');

jest.setTimeout(90000);

async function getAvailablePort(startPort = 9433) {
  for (let port = startPort; port < startPort + 100; port += 1) {
    const available = await new Promise((resolve) => {
      const server = net.createServer();
      server.once('error', () => resolve(false));
      server.once('listening', () => {
        server.close(() => resolve(true));
      });
      server.listen(port, '127.0.0.1');
    });
    if (available) return port;
  }
  throw new Error('No available automation port found');
}

async function waitForDevToolsReady(port, timeout = 50000) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    try {
      const sdkVersion = await new Promise((resolve, reject) => {
        const ws = new WebSocket(`ws://127.0.0.1:${port}`);
        const timer = setTimeout(() => { ws.close(); reject(new Error('timeout')); }, 3000);
        ws.on('open', () => {
          ws.send(JSON.stringify({ id: 1, method: 'Tool.getInfo', params: {} }));
        });
        ws.on('message', (data) => {
          clearTimeout(timer);
          try {
            const res = JSON.parse(data.toString());
            ws.close();
            resolve(res.result?.SDKVersion);
          } catch (error) {
            reject(error);
          }
        });
        ws.on('error', (error) => { clearTimeout(timer); reject(error); });
      });
      if (sdkVersion && sdkVersion !== '') return sdkVersion;
    } catch (_) { /* DevTools is still starting */ }
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  throw new Error(`DevTools automation WS not ready after ${timeout}ms`);
}

async function waitForSelector(miniProgram, selector, timeout = 10000) {
  const deadline = Date.now() + timeout;
  let lastPagePath = '';
  while (Date.now() < deadline) {
    const page = await miniProgram.currentPage();
    lastPagePath = page.path;
    const element = await page.$(selector);
    if (element) return { page, element };
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  throw new Error(`Selector ${selector} not found on current page ${lastPagePath}`);
}

describe('管理员数据分析页自动化', () => {
  let miniProgram;
  let cliProcess;
  let autoPort;
  let cliOutput = '';

  beforeAll(async () => {
    autoPort = await getAvailablePort();
    cliProcess = spawn(DEVTOOLS_CLI, [
      'auto',
      '--project', PROJECT_PATH,
      '--auto-port', String(autoPort)
    ], { stdio: ['ignore', 'pipe', 'pipe'] });
    cliProcess.stdout.on('data', data => { cliOutput += data.toString(); });
    cliProcess.stderr.on('data', data => { cliOutput += data.toString(); });

    try {
      await waitForDevToolsReady(autoPort);
    } catch (error) {
      throw new Error(`${error.message}\nDevTools output:\n${cliOutput}`);
    }
    miniProgram = await automator.connect({
      wsEndpoint: `ws://127.0.0.1:${autoPort}`
    });
  });

  afterAll(async () => {
    try { if (miniProgram) await miniProgram.close(); } catch (_) {}
    try { if (cliProcess) cliProcess.kill(); } catch (_) {}
  });

  test('能打开页面并渲染核心筛选区域', async () => {
    await miniProgram.reLaunch('/pages/admin-analytics/admin-analytics');

    const { page, element: root } = await waitForSelector(miniProgram, '.page-admin-analytics');
    const { element: filterPanel } = await waitForSelector(miniProgram, '.filter-panel');
    const { element: overviewTab } = await waitForSelector(miniProgram, '.tab');

    expect(page.path).toContain('admin-analytics');
    expect(root).not.toBeNull();
    expect(filterPanel).not.toBeNull();
    expect(overviewTab).not.toBeNull();
  });
});
