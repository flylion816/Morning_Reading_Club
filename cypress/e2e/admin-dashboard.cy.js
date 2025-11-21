/**
 * 管理后台 E2E 测试
 * 涵盖登录、报名管理、支付、分析等核心功能
 */

describe('管理后台 E2E 测试', () => {
  const baseUrl = 'http://localhost:5173';
  const adminEmail = 'admin@morningreading.com';
  const adminPassword = 'admin123';

  beforeEach(() => {
    // 访问首页
    cy.visit(baseUrl);
  });

  describe('1. 登录流程', () => {
    it('应该能成功登录', () => {
      // 点击登录按钮
      cy.contains('登录').click();

      // 填写邮箱
      cy.get('input[placeholder*="邮箱"]').type(adminEmail);

      // 填写密码
      cy.get('input[type="password"]').type(adminPassword);

      // 点击登录
      cy.contains('button', '登录').click();

      // 等待重定向到仪表板
      cy.url().should('include', '/');

      // 验证用户信息显示
      cy.get('.user-info').should('contain', '系统管理员');

      // 验证菜单显示
      cy.get('.el-menu').should('be.visible');
    });

    it('错误密码应该被拒绝', () => {
      cy.contains('登录').click();
      cy.get('input[placeholder*="邮箱"]').type(adminEmail);
      cy.get('input[type="password"]').type('wrongpassword');
      cy.contains('button', '登录').click();

      // 应该显示错误提示
      cy.get('.el-message--error').should('be.visible');
      cy.url().should('include', '/login');
    });
  });

  describe('2. 报名管理', () => {
    beforeEach(() => {
      // 登录
      cy.get('input[placeholder*="邮箱"]').type(adminEmail);
      cy.get('input[type="password"]').type(adminPassword);
      cy.contains('button', '登录').click();

      // 等待登录成功
      cy.url().should('include', '/');

      // 导航到报名管理
      cy.get('.el-menu').contains('报名管理').click();
      cy.url().should('include', '/enrollments');
    });

    it('应该能加载报名列表', () => {
      // 验证表格存在
      cy.get('.el-table').should('be.visible');

      // 验证至少有一列报名记录
      cy.get('.el-table tbody tr').should('have.length.greaterThan', 0);

      // 验证关键字段显示
      cy.get('.el-table').contains('期次').should('be.visible');
      cy.get('.el-table').contains('状态').should('be.visible');
    });

    it('应该能进行批量批准操作', () => {
      // 选择第一条待审批的报名
      cy.get('.el-table tbody tr').first().within(() => {
        cy.get('input[type="checkbox"]').click();
      });

      // 验证选择计数更新
      cy.get('.selected-count').should('contain', '已选中');

      // 点击批量批准按钮
      cy.get('.batch-operation-bar').contains('批量批准').click();

      // 确认操作
      cy.get('.el-message-box').contains('确认').click();

      // 验证成功提示
      cy.get('.el-message--success').should('be.visible');

      // 验证列表刷新（表格重新加载）
      cy.get('.el-table').should('exist');
    });

    it('应该能进行批量拒绝操作', () => {
      // 选择报名
      cy.get('.el-table tbody tr').first().within(() => {
        cy.get('input[type="checkbox"]').click();
      });

      // 点击批量拒绝
      cy.get('.batch-operation-bar').contains('批量拒绝').click();

      // 输入拒绝原因
      cy.get('input[placeholder*="拒绝原因"]').type('不符合要求');

      // 确认
      cy.get('.el-message-box').contains('确认').click();

      // 验证成功
      cy.get('.el-message--success').should('be.visible');
    });

    it('应该能使用筛选器', () => {
      // 点击筛选
      cy.get('.filter-section').within(() => {
        cy.get('input[placeholder*="审批状态"]').click();
      });

      // 选择待审批
      cy.get('.el-dropdown-menu').contains('待审批').click();

      // 点击查询
      cy.contains('button', '查询').click();

      // 验证表格刷新
      cy.get('.el-table').should('exist');
    });
  });

  describe('3. 数据分析', () => {
    beforeEach(() => {
      // 登录
      cy.get('input[placeholder*="邮箱"]').type(adminEmail);
      cy.get('input[type="password"]').type(adminPassword);
      cy.contains('button', '登录').click();

      // 导航到分析页面
      cy.get('.el-menu').contains('数据分析').click();
      cy.url().should('include', '/analytics');
    });

    it('应该能加载分析仪表板', () => {
      // 验证统计卡片
      cy.get('.stat-card').should('have.length.greaterThan', 0);

      // 验证数值显示
      cy.get('.stat-card').first().within(() => {
        cy.get('.stat-value').should('contain.text', /\d+/);
      });
    });

    it('应该能显示图表', () => {
      // 验证 ECharts 容器存在
      cy.get('[class*="echarts"]').should('have.length.greaterThan', 0);

      // 等待图表加载（通常需要一秒）
      cy.wait(1000);

      // 验证图表容器有高度
      cy.get('[class*="echarts"]').first().should('have.css', 'height').and('not.equal', '0px');
    });

    it('应该能导出数据', () => {
      // 点击导出按钮
      cy.contains('button', '导出').click();

      // 验证下载开始（可能有下载对话框）
      cy.get('.el-message--success').should('be.visible');
    });
  });

  describe('4. 审计日志', () => {
    beforeEach(() => {
      // 登录
      cy.get('input[placeholder*="邮箱"]').type(adminEmail);
      cy.get('input[type="password"]').type(adminPassword);
      cy.contains('button', '登录').click();

      // 导航到审计日志
      cy.get('.el-menu').contains('审计日志').click();
      cy.url().should('include', '/audit-logs');
    });

    it('应该能加载审计日志', () => {
      // 验证表格存在
      cy.get('.el-table').should('be.visible');

      // 验证至少有一条日志
      cy.get('.el-table tbody tr').should('have.length.greaterThan', 0);

      // 验证字段显示
      cy.get('.el-table').contains('管理员').should('be.visible');
      cy.get('.el-table').contains('操作类型').should('be.visible');
    });

    it('应该能筛选日志', () => {
      // 点击操作类型筛选
      cy.get('input[placeholder*="操作类型"]').click();

      // 选择一个操作类型
      cy.get('.el-dropdown-menu').first().click();

      // 点击查询
      cy.contains('button', '查询').click();

      // 验证表格刷新
      cy.get('.el-table').should('exist');
    });

    it('应该能查看日志详情', () => {
      // 点击第一条日志的查看详情
      cy.get('.el-table tbody tr').first().within(() => {
        cy.contains('查看详情').click();
      });

      // 验证详情弹窗显示
      cy.get('.el-dialog').should('be.visible');

      // 验证日志信息显示
      cy.get('.log-detail').within(() => {
        cy.contains('操作类型').should('be.visible');
        cy.contains('IP地址').should('be.visible');
      });

      // 关闭弹窗
      cy.get('.el-dialog .el-dialog__close').click();
    });
  });

  describe('5. 支付管理', () => {
    beforeEach(() => {
      // 登录
      cy.get('input[placeholder*="邮箱"]').type(adminEmail);
      cy.get('input[type="password"]').type(adminPassword);
      cy.contains('button', '登录').click();

      // 导航到支付
      cy.get('.el-menu').contains('支付记录').click();
      cy.url().should('include', '/payments');
    });

    it('应该能加载支付列表', () => {
      cy.get('.el-table').should('be.visible');
      cy.get('.el-table tbody tr').should('have.length.greaterThan', 0);
    });

    it('应该能按状态筛选支付', () => {
      // 点击状态筛选
      cy.get('input[placeholder*="支付状态"]').click();

      // 选择已完成
      cy.get('.el-dropdown-menu').contains('已完成').click();

      // 查询
      cy.contains('button', '查询').click();

      // 验证结果
      cy.get('.el-table').should('exist');
    });
  });

  describe('6. 错误处理', () => {
    it('未登录应该重定向到登录页', () => {
      // 清除 token
      cy.clearLocalStorage('auth_token');

      // 访问受保护页面
      cy.visit(`${baseUrl}/enrollments`);

      // 应该重定向到登录
      cy.url().should('include', '/login');
    });

    it('应该处理 API 错误', () => {
      // 登录
      cy.get('input[placeholder*="邮箱"]').type(adminEmail);
      cy.get('input[type="password"]').type(adminPassword);
      cy.contains('button', '登录').click();

      // 模拟网络错误（拦截请求）
      cy.intercept('GET', '/api/v1/enrollments', {
        statusCode: 500,
        body: { code: 500, message: '服务器错误' }
      }).as('enrollmentError');

      // 导航到报名
      cy.get('.el-menu').contains('报名管理').click();

      // 等待错误请求
      cy.wait('@enrollmentError');

      // 应该显示错误提示
      cy.get('.el-message--error').should('be.visible');
    });
  });

  describe('7. 性能测试', () => {
    beforeEach(() => {
      // 登录
      cy.get('input[placeholder*="邮箱"]').type(adminEmail);
      cy.get('input[type="password"]').type(adminPassword);
      cy.contains('button', '登录').click();
    });

    it('报名列表应该在 2 秒内加载', () => {
      const startTime = Date.now();

      cy.get('.el-menu').contains('报名管理').click();
      cy.get('.el-table tbody tr').should('have.length.greaterThan', 0);

      cy.then(() => {
        const duration = Date.now() - startTime;
        expect(duration).to.be.lessThan(2000);
      });
    });

    it('分析页面应该在 3 秒内加载', () => {
      const startTime = Date.now();

      cy.get('.el-menu').contains('数据分析').click();
      cy.get('[class*="echarts"]').should('have.length.greaterThan', 0);

      cy.then(() => {
        const duration = Date.now() - startTime;
        expect(duration).to.be.lessThan(3000);
      });
    });
  });
});
