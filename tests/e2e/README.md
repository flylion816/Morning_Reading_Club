# 晨读营 E2E UI 自动化测试指南

完整的端到端 (E2E) UI 自动化测试套件，覆盖管理后台、小程序和完整业务流程。

## 📋 测试套件概览

| 测试脚本 | 目标 | 覆盖范围 | 环境要求 |
|---------|------|---------|---------|
| `admin-ui.py` | 管理后台功能验证 | 登录、报名审批、数据看板、小凡看见 | 线上/本地环境 |
| `miniprogram-ui.py` | 小程序核心流程验证 | 启动、首页、登录、报名、打卡、Insights | 微信开发工具 |
| `e2e-workflow.py` | 完整业务链路验证 | 小程序全流程 + 管理后台验证 | 两者都需要 |

---

## 🚀 快速开始

### 1. 环境准备

#### 1.1 安装依赖
```bash
# 进入项目根目录
cd "/Users/pica_1/我的坚果云/flylion/AI项目开发/七个习惯晨读营"

# 安装 Playwright（如果未安装）
pip install playwright
playwright install chromium  # 安装 Chromium 浏览器

# 或使用 Python 包管理器
python -m pip install playwright
python -m playwright install chromium
```

#### 1.2 配置环境变量
```bash
# 创建 .env.test 文件
cat > tests/.env.test << 'EOF'
# 管理后台凭证
ADMIN_EMAIL=admin@morningreading.com
ADMIN_PASSWORD=admin123456

# 小程序开发工具地址（默认 9222 端口）
MINIPROGRAM_DEVTOOLS_URL=http://127.0.0.1:9222
EOF

# 加载环境变量
source tests/.env.test
```

---

## 🧪 运行测试

### 2.1 单独运行管理后台测试

```bash
# 基础运行
python tests/e2e/admin-ui.py

# 指定凭证
ADMIN_EMAIL=your_email@example.com ADMIN_PASSWORD=your_password python tests/e2e/admin-ui.py
```

**预期输出：**
```
[14:30:45] [INFO] 🚀 开始运行管理后台 UI 自动化测试
[14:30:46] [INFO] ✅ 已连接到后台
[14:30:50] [INFO] ✅ 登录成功
[14:30:55] [INFO] ✅ 数据看板已加载
...
============================================================
📊 测试结果报告
============================================================
✅ login: PASSED - Successfully logged in
✅ dashboard: PASSED - Loaded 4 components
✅ enrollment_management: PASSED - Enrollments loaded
✅ insights_management: PASSED - Insights loaded
✅ users_list: PASSED - Users loaded
============================================================
总计: 5 个测试
通过: 5 | 失败: 0 | 跳过: 0
成功率: 100.0%
============================================================
```

**截图位置：** `/tmp/e2e-screenshots/`

---

### 2.2 单独运行小程序测试

#### 前置条件：
1. **打开微信开发工具**
2. **启动小程序**
   ```bash
   cd miniprogram
   npm run dev
   ```
3. **启用调试模式**（工具 → 调试）
4. **确认 Chrome DevTools Protocol 端口为 9222**

#### 运行测试：
```bash
# 基础运行
python tests/e2e/miniprogram-ui.py

# 指定调试端口
MINIPROGRAM_DEVTOOLS_URL=http://127.0.0.1:9222 python tests/e2e/miniprogram-ui.py
```

**预期输出：**
```
[14:31:45] [INFO] 🚀 开始运行小程序 E2E 自动化测试
[14:31:46] [INFO] 🔗 正在连接微信开发工具调试端口...
[14:31:47] [INFO] ✅ 已连接到微信开发工具
[14:31:50] [INFO] ✅ 小程序已启动
[14:31:52] [INFO] ✅ 首页已加载
...
============================================================
📊 小程序 E2E 测试结果报告
============================================================
✅ app_launch: PASSED - App launched successfully
✅ home_page: PASSED - Loaded 2 components
✅ weixin_login: PASSED - Login flow initiated
✅ enrollment_page: PASSED - Enrollment page loaded
✅ checkin_page: PASSED - Checkin page loaded
✅ insights_page: PASSED - Insights page loaded
✅ console_logs: PASSED - Errors: 0, Warnings: 2
============================================================
总计: 7 个测试
通过: 7 | 失败: 0 | 跳过: 0
成功率: 100.0%
============================================================
```

**截图位置：** `/tmp/e2e-screenshots/miniprogram/`

---

### 2.3 运行完整端到端业务流程测试

#### 前置条件：
1. 微信开发工具已打开并运行小程序
2. 管理后台可访问
3. 环境变量已配置

#### 运行测试：
```bash
python tests/e2e/e2e-workflow.py
```

**测试流程：**
```
小程序端：
  1. 登录（微信授权）
  2. 报名（选择期次、填写信息）
  3. 支付（调起支付流程）
  4. 打卡（每日打卡）

管理后台验证：
  5. 管理员登录
  6. 验证报名记录已创建
  7. 验证支付记录已记录
  8. 验证打卡记录已同步
```

**预期输出：**
```
============================================================
📊 端到端业务流程测试最终报告
============================================================

📋 测试步骤结果:
1. ✅ miniprogram_login: PASSED
2. ✅ miniprogram_enrollment: PASSED
3. ✅ miniprogram_payment: PASSED
4. ✅ miniprogram_checkin: PASSED
5. ✅ admin_login: PASSED
6. ✅ admin_verify_enrollment: PASSED
7. ✅ admin_verify_payment: PASSED
8. ✅ admin_verify_checkin: PASSED

📊 统计信息:
总计: 8 个测试步骤
通过: 8 | 失败: 0 | 跳过: 0
成功率: 100.0%

📦 测试数据记录:
用户邮箱: test_user_1709470000@example.com
报名状态: verified
支付状态: verified
打卡记录: 1 条

📸 截图位置: /tmp/e2e-screenshots/workflow
💾 测试报告已保存: /tmp/e2e-screenshots/workflow/report_20240303_143045.json
```

**报告位置：**
- 截图：`/tmp/e2e-screenshots/workflow/`
- JSON 报告：`/tmp/e2e-screenshots/workflow/report_*.json`

---

## 🔧 高级用法

### 3.1 调试模式（显示浏览器窗口）

修改脚本中的 `headless` 参数：

```python
# admin-ui.py
self.browser = self.p.chromium.launch(headless=False)  # 显示浏览器

# 或保持隐藏
self.browser = self.p.chromium.launch(headless=True)  # 无头模式
```

### 3.2 自定义超时时间

```python
# 修改脚本中的等待时间
page.wait_for_load_state("networkidle", timeout=10000)  # 10 秒
page.wait_for_selector(selector, timeout=5000)  # 5 秒
```

### 3.3 保存 HAR 文件（录制网络流量）

```python
browser = p.chromium.launch()
context = browser.new_context(record_har_path="/tmp/test.har")
page = context.new_page()
# ... 测试代码
context.close()
```

---

## 📊 截图和报告

### 4.1 截图位置

所有截图自动保存到：
- **管理后台：** `/tmp/e2e-screenshots/`
- **小程序：** `/tmp/e2e-screenshots/miniprogram/`
- **E2E 流程：** `/tmp/e2e-screenshots/workflow/`

### 4.2 查看截图

```bash
# macOS
open /tmp/e2e-screenshots/

# Linux
ls /tmp/e2e-screenshots/

# Windows
explorer C:\Users\<YourUsername>\AppData\Local\Temp\e2e-screenshots\
```

### 4.3 JSON 报告格式

```json
{
  "total": 8,
  "passed": 8,
  "failed": 0,
  "skipped": 0,
  "success_rate": 100.0,
  "test_data": {
    "user_email": "test_user_1709470000@example.com",
    "enrollment_id": "verified",
    "payment_id": "verified",
    "checkin_records": [
      {
        "timestamp": "2024-03-03T14:30:45.123456",
        "status": "success"
      }
    ]
  }
}
```

---

## ⚠️ 常见问题排查

### 问题 1: "无法连接到微信开发工具"

```
❌ 无法连接到微信开发工具: connection refused
```

**解决方案：**
```bash
# 1. 确保微信开发工具已打开
# 2. 确保小程序已启动：npm run dev
# 3. 检查调试端口是否为 9222
# 4. 尝试指定正确的端口
MINIPROGRAM_DEVTOOLS_URL=http://127.0.0.1:9222 python tests/e2e/miniprogram-ui.py
```

### 问题 2: "登录失败"

```
❌ 登录失败: Element not found
```

**解决方案：**
```bash
# 1. 检查邮箱和密码是否正确
ADMIN_EMAIL=your_email@example.com ADMIN_PASSWORD=your_password python tests/e2e/admin-ui.py

# 2. 检查网络连接
curl https://wx.shubai01.com/api/v1/health

# 3. 检查管理员账户是否存在
```

### 问题 3: "元素未找到"

```
⚠️ 报名页面内容不完整
```

**解决方案：**
- UI 结构可能已变更，需要更新选择器
- 检查 `page.locator()` 中的选择器是否正确
- 使用 `page.screenshot()` 查看实际界面

### 问题 4: "超时"

```
TimeoutError: Timeout 5000ms exceeded
```

**解决方案：**
```python
# 增加超时时间
page.wait_for_load_state("networkidle", timeout=10000)  # 10 秒

# 或检查网络连接
# 或修改应用的加载性能
```

---

## 🎯 CI/CD 集成

### 5.1 GitHub Actions 示例

```yaml
name: E2E Tests

on: [push, pull_request]

jobs:
  e2e-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Setup Python
        uses: actions/setup-python@v4
        with:
          python-version: '3.10'

      - name: Install Playwright
        run: |
          pip install playwright
          playwright install chromium

      - name: Run Admin UI Tests
        env:
          ADMIN_EMAIL: ${{ secrets.ADMIN_EMAIL }}
          ADMIN_PASSWORD: ${{ secrets.ADMIN_PASSWORD }}
        run: python tests/e2e/admin-ui.py

      - name: Upload Screenshots
        if: always()
        uses: actions/upload-artifact@v3
        with:
          name: e2e-screenshots
          path: /tmp/e2e-screenshots/
```

---

## 📚 参考资源

- [Playwright 官方文档](https://playwright.dev/python/)
- [Playwright 选择器指南](https://playwright.dev/python/docs/selectors)
- [微信开发工具调试指南](https://developers.weixin.qq.com/miniprogram/dev/devtools/devtools.html)
- [Chrome DevTools Protocol](https://chromedevtools.github.io/devtools-protocol/)

---

## 💡 最佳实践

1. **定期更新选择器**：UI 变更后及时更新脚本中的选择器
2. **避免硬编码等待时间**：使用 `wait_for_load_state()` 而不是 `timeout()`
3. **保存截图用于调试**：自动保存的截图有助于快速定位问题
4. **使用环境变量**：避免在代码中硬编码密码等敏感信息
5. **定期运行测试**：建议在 CI/CD 流水线中自动运行

---

## 📝 版本历史

| 版本 | 日期 | 变更 |
|------|------|------|
| 1.0 | 2024-03-03 | 初始版本，包含3个E2E测试脚本 |

---

**需要帮助？** 检查截图和日志，或查看[常见问题排查](#常见问题排查)部分。
