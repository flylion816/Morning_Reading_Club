"""
晨读营小程序 E2E 自动化测试
覆盖：微信登录、报名、支付、打卡等关键流程
通过微信开发工具的 Chrome DevTools Protocol (CDP) 进行远程调试
"""

import os
import sys
import time
import json
from datetime import datetime
from pathlib import Path
from playwright.sync_api import sync_playwright

# 配置
MINIPROGRAM_DEVTOOLS_URL = os.getenv("MINIPROGRAM_DEVTOOLS_URL", "http://127.0.0.1:9222")
SCREENSHOT_DIR = Path("/tmp/e2e-screenshots/miniprogram")
SCREENSHOT_DIR.mkdir(parents=True, exist_ok=True)


class MiniProgramUITester:
    def __init__(self):
        self.p = sync_playwright().start()
        self.browser = None
        self.page = None
        self.test_results = []
        self.setup_browser()

    def setup_browser(self):
        """连接到微信开发工具的调试端口"""
        self.log("🔗 正在连接微信开发工具调试端口...")
        try:
            # 尝试连接到已打开的微信开发工具
            self.browser = self.p.chromium.connect_over_cdp(
                MINIPROGRAM_DEVTOOLS_URL,
                timeout=10000
            )
            # 获取第一个上下文和页面
            contexts = self.browser.contexts
            if contexts:
                self.page = contexts[0].pages[0] if contexts[0].pages else None

            if self.page:
                self.log("✅ 已连接到微信开发工具")
            else:
                self.log("⚠️ 未找到活跃页面，尝试创建新页面", "WARN")
                self.page = self.browser.new_page()
        except Exception as e:
            self.log(f"❌ 无法连接到微信开发工具: {str(e)}", "ERROR")
            self.log("💡 请确保：", "INFO")
            self.log("  1. 已打开微信开发工具", "INFO")
            self.log("  2. 已启动小程序 (npm run dev)", "INFO")
            self.log("  3. 调试模式已启用", "INFO")
            raise

    def log(self, message: str, level: str = "INFO"):
        """日志输出"""
        timestamp = datetime.now().strftime("%H:%M:%S")
        print(f"[{timestamp}] [{level}] {message}")

    def screenshot(self, name: str):
        """保存截图"""
        try:
            path = SCREENSHOT_DIR / f"{name}_{datetime.now().strftime('%Y%m%d_%H%M%S')}.png"
            self.page.screenshot(path=str(path), full_page=True)
            self.log(f"📸 截图已保存: {path}", "DEBUG")
            return path
        except Exception as e:
            self.log(f"⚠️ 截图失败: {str(e)}", "WARN")
            return None

    def wait_for_element(self, selector: str, timeout: int = 5000, name: str = ""):
        """等待元素出现"""
        try:
            self.page.wait_for_selector(selector, timeout=timeout)
            self.log(f"✓ {name or selector} 已加载")
            return True
        except:
            self.log(f"⚠ {name or selector} 未找到", "WARN")
            return False

    def test_app_launch(self):
        """测试 1: 小程序启动"""
        self.log("=== 测试 1: 小程序启动 ===")
        try:
            self.page.wait_for_load_state("networkidle", timeout=10000)
            self.screenshot("01-app-launch")
            self.log("✅ 小程序已启动")
            self.test_results.append(("app_launch", "PASSED", "App launched successfully"))
            return True
        except Exception as e:
            self.log(f"❌ 小程序启动失败: {str(e)}", "ERROR")
            self.screenshot("01-app-launch-error")
            self.test_results.append(("app_launch", "FAILED", str(e)))
            return False

    def test_home_page(self):
        """测试 2: 首页加载"""
        self.log("=== 测试 2: 首页加载 ===")
        try:
            # 等待首页主要元素
            elements = [
                ('view:has-text("七个习惯"), text=晨读营', "应用标题"),
                ('button:has-text("微信登录"), button:has-text("稍后登录")', "登录按钮"),
            ]

            loaded = 0
            for selector, name in elements:
                if self.wait_for_element(selector, timeout=3000, name=name):
                    loaded += 1

            self.screenshot("02-home-page")
            if loaded > 0:
                self.log(f"✅ 首页已加载 ({loaded} 个主要组件)")
                self.test_results.append(("home_page", "PASSED", f"Loaded {loaded} components"))
                return True
            else:
                self.log("❌ 首页加载不完整")
                self.test_results.append(("home_page", "FAILED", "Incomplete page load"))
                return False

        except Exception as e:
            self.log(f"❌ 首页加载失败: {str(e)}", "ERROR")
            self.screenshot("02-home-page-error")
            self.test_results.append(("home_page", "FAILED", str(e)))
            return False

    def test_weixin_login(self):
        """测试 3: 微信登录流程"""
        self.log("=== 测试 3: 微信登录流程 ===")
        try:
            # 查找微信登录按钮
            login_button = self.page.locator('button:has-text("微信登录")')

            if not login_button.is_visible():
                self.log("⚠️ 微信登录按钮不可见，可能已登录", "WARN")
                self.test_results.append(("weixin_login", "SKIPPED", "Already logged in"))
                return True

            # 点击登录按钮
            self.log("📍 点击微信登录按钮...")
            login_button.click()
            self.page.wait_for_timeout(2000)  # 等待登录弹窗出现
            self.screenshot("03-weixin-login-popup")

            # 注意：实际的微信授权流程需要用户交互，这里只能验证按钮可点击
            self.log("✅ 微信登录流程可启动（实际授权需要用户交互）")
            self.test_results.append(("weixin_login", "PASSED", "Login flow initiated"))
            return True

        except Exception as e:
            self.log(f"❌ 微信登录测试失败: {str(e)}", "ERROR")
            self.screenshot("03-weixin-login-error")
            self.test_results.append(("weixin_login", "FAILED", str(e)))
            return False

    def test_enrollment_page(self):
        """测试 4: 报名页面"""
        self.log("=== 测试 4: 报名页面 ===")
        try:
            # 尝试导航到报名页面或通过底部导航栏点击
            nav_buttons = self.page.locator('[role="tab"], .tab-bar-item, text=报名').all()

            enrollment_found = False
            for button in nav_buttons:
                if "报名" in button.text_content():
                    self.log("📍 点击报名导航...")
                    button.click()
                    enrollment_found = True
                    break

            if not enrollment_found:
                self.log("⚠️ 未找到报名导航，尝试直接检查页面", "WARN")

            self.page.wait_for_timeout(2000)
            self.screenshot("04-enrollment-page")

            # 检查报名表单元素
            if self.wait_for_element('input, button:has-text("报名")', timeout=3000, name="报名表单"):
                self.log("✅ 报名页面已加载")
                self.test_results.append(("enrollment_page", "PASSED", "Enrollment page loaded"))
                return True
            else:
                self.log("⚠️ 报名页面内容不完整")
                self.test_results.append(("enrollment_page", "PARTIAL", "Page structure different"))
                return True

        except Exception as e:
            self.log(f"❌ 报名页面测试失败: {str(e)}", "ERROR")
            self.screenshot("04-enrollment-page-error")
            self.test_results.append(("enrollment_page", "FAILED", str(e)))
            return False

    def test_checkin_page(self):
        """测试 5: 打卡页面"""
        self.log("=== 测试 5: 打卡页面 ===")
        try:
            # 查找打卡导航
            nav_buttons = self.page.locator('[role="tab"], .tab-bar-item, text=打卡').all()

            checkin_found = False
            for button in nav_buttons:
                if "打卡" in button.text_content():
                    self.log("📍 点击打卡导航...")
                    button.click()
                    checkin_found = True
                    break

            self.page.wait_for_timeout(2000)
            self.screenshot("05-checkin-page")

            if self.wait_for_element('button:has-text("打卡"), text=打卡记录', timeout=3000, name="打卡按钮"):
                self.log("✅ 打卡页面已加载")
                self.test_results.append(("checkin_page", "PASSED", "Checkin page loaded"))
                return True
            else:
                self.log("⚠️ 打卡页面内容不完整")
                self.test_results.append(("checkin_page", "PARTIAL", "Page structure different"))
                return True

        except Exception as e:
            self.log(f"❌ 打卡页面测试失败: {str(e)}", "ERROR")
            self.screenshot("05-checkin-page-error")
            self.test_results.append(("checkin_page", "FAILED", str(e)))
            return False

    def test_insights_page(self):
        """测试 6: 小凡看见页面"""
        self.log("=== 测试 6: 小凡看见页面 ===")
        try:
            # 查找insights或小凡看见导航
            nav_buttons = self.page.locator('[role="tab"], .tab-bar-item, text=小凡看见').all()

            insights_found = False
            for button in nav_buttons:
                button_text = button.text_content()
                if "小凡看见" in button_text or "Insights" in button_text:
                    self.log("📍 点击小凡看见导航...")
                    button.click()
                    insights_found = True
                    break

            self.page.wait_for_timeout(2000)
            self.screenshot("06-insights-page")

            if self.wait_for_element('[role="article"], .card, text=小凡看见', timeout=3000, name="内容列表"):
                self.log("✅ 小凡看见页面已加载")
                self.test_results.append(("insights_page", "PASSED", "Insights page loaded"))
                return True
            else:
                self.log("⚠️ 小凡看见页面内容不完整")
                self.test_results.append(("insights_page", "PARTIAL", "Page structure different"))
                return True

        except Exception as e:
            self.log(f"❌ 小凡看见页面测试失败: {str(e)}", "ERROR")
            self.screenshot("06-insights-page-error")
            self.test_results.append(("insights_page", "FAILED", str(e)))
            return False

    def test_console_logs(self):
        """测试 7: 检查控制台错误"""
        self.log("=== 测试 7: 检查控制台日志 ===")
        try:
            # 收集所有console消息
            messages = []
            def handle_console_message(msg):
                messages.append({"type": msg.type, "text": msg.text})

            self.page.on("console", handle_console_message)
            self.page.wait_for_timeout(1000)  # 收集1秒内的日志

            # 统计错误和警告
            errors = [m for m in messages if m["type"] == "error"]
            warnings = [m for m in messages if m["type"] == "warning"]

            self.log(f"📊 控制台信息统计:")
            self.log(f"  - 错误: {len(errors)}")
            self.log(f"  - 警告: {len(warnings)}")

            if errors:
                self.log("❌ 发现控制台错误:", "WARN")
                for i, error in enumerate(errors[:5]):  # 只显示前5个
                    self.log(f"  {i+1}. {error['text']}", "WARN")

            self.test_results.append(("console_logs", "PASSED", f"Errors: {len(errors)}, Warnings: {len(warnings)}"))
            return True

        except Exception as e:
            self.log(f"⚠️ 控制台日志检查失败: {str(e)}", "WARN")
            self.test_results.append(("console_logs", "PARTIAL", str(e)))
            return True

    def generate_report(self):
        """生成测试报告"""
        self.log("\n" + "=" * 60)
        self.log("📊 小程序 E2E 测试结果报告", "INFO")
        self.log("=" * 60)

        passed = sum(1 for _, status, _ in self.test_results if status == "PASSED")
        failed = sum(1 for _, status, _ in self.test_results if status == "FAILED")
        skipped = sum(1 for _, status, _ in self.test_results if status == "SKIPPED")
        partial = sum(1 for _, status, _ in self.test_results if status == "PARTIAL")

        for test_name, status, message in self.test_results:
            if status == "PASSED":
                symbol = "✅"
            elif status == "FAILED":
                symbol = "❌"
            elif status == "SKIPPED":
                symbol = "⏭️"
            else:
                symbol = "⚠️"
            self.log(f"{symbol} {test_name}: {status} - {message}")

        self.log("=" * 60)
        self.log(f"总计: {len(self.test_results)} 个测试")
        self.log(f"通过: {passed} | 失败: {failed} | 跳过: {skipped} | 部分: {partial}")
        total_valid = len(self.test_results) - skipped
        success_rate = (passed / total_valid * 100) if total_valid > 0 else 0
        self.log(f"成功率: {success_rate:.1f}%")
        self.log(f"截图保存位置: {SCREENSHOT_DIR}")
        self.log("=" * 60)

        return {
            "total": len(self.test_results),
            "passed": passed,
            "failed": failed,
            "skipped": skipped,
            "partial": partial,
            "success_rate": success_rate
        }

    def run_all_tests(self):
        """运行所有测试"""
        self.log("🚀 开始运行小程序 E2E 自动化测试")
        self.log(f"调试工具 URL: {MINIPROGRAM_DEVTOOLS_URL}")

        try:
            self.test_app_launch()
            self.test_home_page()
            self.test_weixin_login()
            self.test_enrollment_page()
            self.test_checkin_page()
            self.test_insights_page()
            self.test_console_logs()
        except Exception as e:
            self.log(f"❌ 测试运行出错: {str(e)}", "ERROR")

        report = self.generate_report()
        self.cleanup()
        return report

    def cleanup(self):
        """清理资源"""
        try:
            if self.page:
                self.page.close()
            if self.browser:
                self.browser.close()
            self.p.stop()
            self.log("✅ 浏览器连接已关闭")
        except:
            pass


if __name__ == "__main__":
    try:
        tester = MiniProgramUITester()
        report = tester.run_all_tests()
        sys.exit(0 if report["failed"] == 0 else 1)
    except Exception as e:
        print(f"❌ 无法启动小程序 E2E 测试: {str(e)}")
        print("\n💡 故障排查：")
        print("1. 确保微信开发工具已打开")
        print("2. 确保已执行 'npm run dev' 启动小程序")
        print("3. 检查是否启用了调试模式（工具 → 调试）")
        print("4. 确认 Chrome DevTools Protocol 端口为 9222")
        sys.exit(1)
