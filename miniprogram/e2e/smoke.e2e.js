/**
 * 小程序自动化 Smoke Test
 *
 * 前置条件：
 *   微信开发者工具已开启「服务端口」（设置 → 安全 → 服务端口）
 *
 * 运行：npm run test:e2e
 */

const automator = require('miniprogram-automator');
const { spawn } = require('child_process');
const WebSocket = require('ws');
const path = require('path');

const DEVTOOLS_CLI = '/Applications/wechatwebdevtools.app/Contents/MacOS/cli';
const PROJECT_PATH = path.resolve(__dirname, '../../');
const AUTO_PORT = 9422;

jest.setTimeout(90000);

// 等待 WS 就绪且 Tool.getInfo 返回合法 SDKVersion
async function waitForDevToolsReady(port, timeout = 30000) {
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
          } catch (e) { reject(e); }
        });
        ws.on('error', (e) => { clearTimeout(timer); reject(e); });
      });
      if (sdkVersion && sdkVersion !== '') return sdkVersion;
    } catch (_) { /* not ready yet */ }
    await new Promise(r => setTimeout(r, 1000));
  }
  throw new Error(`DevTools automation WS not ready after ${timeout}ms`);
}

describe('小程序自动化 — Smoke Test', () => {
  let miniProgram;
  let cliProcess;

  beforeAll(async () => {
    console.log('[e2e] 启动 DevTools 自动化模式...');

    cliProcess = spawn(DEVTOOLS_CLI, [
      'auto',
      '--project', PROJECT_PATH,
      '--auto-port', String(AUTO_PORT)
    ], { stdio: 'ignore' });

    cliProcess.on('error', err => console.error('[e2e] CLI 启动失败:', err.message));

    // 等 DevTools 完全就绪（WS 启动 + Tool.getInfo 返回有效 SDKVersion）
    const sdkVersion = await waitForDevToolsReady(AUTO_PORT, 40000);
    console.log(`[e2e] DevTools 就绪，SDKVersion: ${sdkVersion}`);

    miniProgram = await automator.connect({
      wsEndpoint: `ws://127.0.0.1:${AUTO_PORT}`
    });
    console.log('[e2e] automator 已连接');
  });

  afterAll(async () => {
    try { if (miniProgram) await miniProgram.close(); } catch (_) {}
    try { if (cliProcess) cliProcess.kill(); } catch (_) {}
  });

  // ── T1: 基础连通 ──────────────────────────────────────────
  test('能获取当前页面路径', async () => {
    const page = await miniProgram.currentPage();
    const pagePath = page.path;
    console.log('[e2e] 当前页面:', pagePath);
    expect(typeof pagePath).toBe('string');
    expect(pagePath.length).toBeGreaterThan(0);
  });

  // ── T2: 页面导航 ──────────────────────────────────────────
  test('能 reLaunch 到晨读营列表页', async () => {
    const page = await miniProgram.reLaunch('/pages/periods/periods');
    const pagePath = page.path;
    console.log('[e2e] 导航后页面:', pagePath);
    expect(pagePath).toContain('periods');
  });

  // ── T3: 页面元素存在 ──────────────────────────────────────
  test('晨读营列表页根节点已渲染', async () => {
    const page = await miniProgram.currentPage();
    const root = await page.$('page');
    expect(root).not.toBeNull();
  });

  // ── T4: TabBar 切换 ───────────────────────────────────────
  test('能 switchTab 切换到首页', async () => {
    const page = await miniProgram.switchTab('/pages/index/index');
    const pagePath = page.path;
    console.log('[e2e] switchTab 后页面:', pagePath);
    expect(pagePath).toContain('index');
  });

  // ── T5: 多租户注入验证 ────────────────────────────────────
  test('运行时 wxAppId 与 fanren 租户配置一致', async () => {
    const wxAppId = await miniProgram.evaluate(() => {
      const tenant = require('config/current-tenant');
      return tenant.wxAppId;
    });
    console.log('[e2e] 运行时 wxAppId:', wxAppId);
    expect(wxAppId).toBe('wx2b9a3c1d5e4195f8');
  });
});
