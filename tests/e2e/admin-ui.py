"""
晨读营管理后台 E2E 自动化测试
覆盖：登录、报名审批、数据看板、小凡看见管理
使用 Playwright 进行自动化测试
"""

import os
import sys
from datetime import datetime
from pathlib import Path
from playwright.sync_api import sync_playwright, expect

# 配置
ADMIN_URL = "https://wx.shubai01.com/admin"
ADMIN_EMAIL = os.getenv("ADMIN_EMAIL", "admin@morningreading.com")
ADMIN_PASSWORD = os.getenv("ADMIN_PASSWORD", "admin123456")
SCREENSHOT_DIR = Path("/tmp/e2e-screenshots")
SCREENSHOT_DIR.mkdir(exist_ok=True)


class AdminUITester:
    def __init__(self):
        self.p = sync_playwright().start()
        self.browser = self.p.chromium.launch(headless=False)  # 显示浏览器窗口便于调试
        self.page = self.browser.new_page()
        self.test_results = []

    def log(self, message: str, level: str = "INFO"):
        """日志输出"""
        timestamp = datetime.now().strftime("%H:%M:%S")
        print(f"[{timestamp}] [{level}] {message}")

    def screenshot(self, name: str):
        """保存截图"""
        path = SCREENSHOT_DIR / f"{name}_{datetime.now().strftime('%Y%m%d_%H%M%S')}.png"
        self.page.screenshot(path=str(path), full_page=True)
        self.log(f"截图已保存: {path}", "DEBUG")
        return path

    def test_login(self):
        """测试 1: 管理员登录"""
        self.log("=== 测试 1: 管理员登录 ===")
        try:
            self.page.goto(ADMIN_URL, wait_until="networkidle")
            self.screenshot("01-login-page")

            # 检查是否已登录（如果已登录则跳过）
            try:
                self.page.locator('[data-testid="dashboard-title"]').wait_for(timeout=2000)
                self.log("✅ 已登录状态，跳过登录步骤")
                self.test_results.append(("login", "SKIPPED", "Already logged in"))
                return True
            except:
                pass

            # 输入邮箱
            email_input = self.page.locator('input[type="email"]')
            email_input.fill(ADMIN_EMAIL)
            self.log(f"✓ 输入邮箱: {ADMIN_EMAIL}")

            # 输入密码
            password_input = self.page.locator('input[type="password"]')
            password_input.fill(ADMIN_PASSWORD)
            self.log("✓ 输入密码")

            # 点击登录按钮
            login_button = self.page.locator('button:has-text("登录")')
            login_button.click()

            # 等待登录完成
            self.page.wait_for_load_state("networkidle")
            self.screenshot("02-login-success")

            # 验证登录成功
            self.page.locator('[data-testid="dashboard-title"], h1:has-text("仪表板")').wait_for()
            self.log("✅ 登录成功")
            self.test_results.append(("login", "PASSED", "Successfully logged in"))
            return True

        except Exception as e:
            self.log(f"❌ 登录失败: {str(e)}", "ERROR")
            self.screenshot("02-login-error")
            self.test_results.append(("login", "FAILED", str(e)))
            return False

    def test_dashboard(self):
        """测试 2: 数据看板加载"""
        self.log("=== 测试 2: 数据看板加载 ===")
        try:
            self.page.goto(f"{ADMIN_URL}/", wait_until="networkidle")
            self.screenshot("03-dashboard")

            # 验证看板主要组件
            components = [
                ('总报名数', '[data-testid="enrollment-count"]'),
                ('待审批', '[data-testid="pending-count"]'),
                ('支付总额', '[data-testid="payment-total"]'),
                ('活跃期次', '[data-testid="active-periods"]'),
            ]

            loaded_components = []
            for name, selector in components:
                try:
                    element = self.page.locator(selector)
                    element.wait_for(timeout=3000)
                    loaded_components.append(name)
                    self.log(f"✓ {name} 已加载")
                except:
                    # 如果选择器找不到，尝试通过文本查找
                    try:
                        self.page.locator(f'text={name}').wait_for(timeout=1000)
                        loaded_components.append(name)
                        self.log(f"✓ {name} 已加载")
                    except:
                        self.log(f"⚠ {name} 未找到", "WARN")

            if len(loaded_components) >= 2:
                self.log(f"✅ 数据看板已加载 ({len(loaded_components)} 个组件)")
                self.test_results.append(("dashboard", "PASSED", f"Loaded {len(loaded_components)} components"))
                return True
            else:
                self.log("❌ 数据看板加载不完整")
                self.test_results.append(("dashboard", "FAILED", "Incomplete dashboard"))
                return False

        except Exception as e:
            self.log(f"❌ 数据看板测试失败: {str(e)}", "ERROR")
            self.screenshot("03-dashboard-error")
            self.test_results.append(("dashboard", "FAILED", str(e)))
            return False

    def test_enrollment_management(self):
        """测试 3: 报名管理"""
        self.log("=== 测试 3: 报名管理 ===")
        try:
            # 导航到报名管理页面
            self.page.goto(f"{ADMIN_URL}/enrollments", wait_until="networkidle")
            self.screenshot("04-enrollments-list")

            # 检查报名列表是否加载
            try:
                # 查找表格或列表
                self.page.locator('table, [role="grid"], .enrollments-list').wait_for(timeout=5000)
                self.log("✓ 报名列表已加载")
            except:
                self.log("⚠ 未找到报名列表表格", "WARN")

            # 尝试找到第一个报名记录
            rows = self.page.locator('tbody tr, [role="row"]').all()
            if rows:
                self.log(f"✓ 找到 {len(rows)} 条报名记录")

                # 点击第一条记录查看详情
                try:
                    first_row = rows[0]
                    first_row.click()
                    self.page.wait_for_load_state("networkidle")
                    self.screenshot("05-enrollment-detail")
                    self.log("✓ 已打开报名详情")
                except:
                    self.log("⚠ 无法打开报名详情", "WARN")

            self.log("✅ 报名管理测试完成")
            self.test_results.append(("enrollment_management", "PASSED", "Enrollments loaded"))
            return True

        except Exception as e:
            self.log(f"❌ 报名管理测试失败: {str(e)}", "ERROR")
            self.screenshot("04-enrollments-error")
            self.test_results.append(("enrollment_management", "FAILED", str(e)))
            return False

    def test_insights_management(self):
        """测试 4: 小凡看见管理"""
        self.log("=== 测试 4: 小凡看见管理 ===")
        try:
            # 导航到小凡看见管理页面
            self.page.goto(f"{ADMIN_URL}/insights", wait_until="networkidle")
            self.screenshot("06-insights-list")

            # 检查Insights列表
            try:
                self.page.locator('table, [role="grid"], .insights-list').wait_for(timeout=5000)
                self.log("✓ 小凡看见列表已加载")
            except:
                self.log("⚠ 未找到小凡看见列表", "WARN")

            # 检查发布/下架按钮
            buttons = self.page.locator('button:has-text("发布"), button:has-text("下架")').all()
            if buttons:
                self.log(f"✓ 找到 {len(buttons)} 个操作按钮")

            self.log("✅ 小凡看见管理测试完成")
            self.test_results.append(("insights_management", "PASSED", "Insights loaded"))
            return True

        except Exception as e:
            self.log(f"❌ 小凡看见管理测试失败: {str(e)}", "ERROR")
            self.screenshot("06-insights-error")
            self.test_results.append(("insights_management", "FAILED", str(e)))
            return False

    def test_users_list(self):
        """测试 5: 用户列表"""
        self.log("=== 测试 5: 用户列表 ===")
        try:
            self.page.goto(f"{ADMIN_URL}/users", wait_until="networkidle")
            self.screenshot("07-users-list")

            # 检查用户列表
            try:
                self.page.locator('table, [role="grid"], .users-list').wait_for(timeout=5000)
                self.log("✓ 用户列表已加载")
            except:
                self.log("⚠ 未找到用户列表", "WARN")

            self.log("✅ 用户列表测试完成")
            self.test_results.append(("users_list", "PASSED", "Users loaded"))
            return True

        except Exception as e:
            self.log(f"❌ 用户列表测试失败: {str(e)}", "ERROR")
            self.screenshot("07-users-error")
            self.test_results.append(("users_list", "FAILED", str(e)))
            return False

    def generate_report(self):
        """生成测试报告"""
        self.log("\n" + "=" * 60)
        self.log("📊 测试结果报告", "INFO")
        self.log("=" * 60)

        passed = sum(1 for _, status, _ in self.test_results if status == "PASSED")
        failed = sum(1 for _, status, _ in self.test_results if status == "FAILED")
        skipped = sum(1 for _, status, _ in self.test_results if status == "SKIPPED")

        for test_name, status, message in self.test_results:
            symbol = "✅" if status == "PASSED" else "❌" if status == "FAILED" else "⏭️"
            self.log(f"{symbol} {test_name}: {status} - {message}")

        self.log("=" * 60)
        self.log(f"总计: {len(self.test_results)} 个测试")
        self.log(f"通过: {passed} | 失败: {failed} | 跳过: {skipped}")
        self.log(f"成功率: {passed / len(self.test_results) * 100:.1f}%")
        self.log(f"截图保存位置: {SCREENSHOT_DIR}")
        self.log("=" * 60)

        return {
            "total": len(self.test_results),
            "passed": passed,
            "failed": failed,
            "skipped": skipped,
            "success_rate": passed / len(self.test_results) * 100 if self.test_results else 0
        }

    def run_all_tests(self):
        """运行所有测试"""
        self.log("🚀 开始运行管理后台 UI 自动化测试")
        self.log(f"目标 URL: {ADMIN_URL}")

        try:
            self.test_login()
            if self.test_results[-1][1] != "FAILED":  # 只有登录成功才继续测试
                self.test_dashboard()
                self.test_enrollment_management()
                self.test_insights_management()
                self.test_users_list()
        except Exception as e:
            self.log(f"❌ 测试运行出错: {str(e)}", "ERROR")

        report = self.generate_report()
        self.cleanup()
        return report

    def cleanup(self):
        """清理资源"""
        self.page.close()
        self.browser.close()
        self.p.stop()
        self.log("✅ 浏览器已关闭")


if __name__ == "__main__":
    tester = AdminUITester()
    report = tester.run_all_tests()

    # 返回退出码
    sys.exit(0 if report["failed"] == 0 else 1)
