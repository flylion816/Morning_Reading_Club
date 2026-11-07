describe('管理后台登录冒烟测试', () => {
  beforeEach(() => {
    cy.intercept('POST', '**/auth/admin/refresh-token', {
      statusCode: 401,
      body: { code: 401, message: '未登录' }
    }).as('refreshSession');
  });

  it('显示登录表单', () => {
    cy.visit('/login');
    cy.contains('管理员登录').should('be.visible');
    cy.get('input[placeholder="邮箱地址"]').should('be.visible');
    cy.get('input[placeholder="密码"]').should('be.visible');
    cy.contains('button', '登录').should('be.visible');
  });

  it('未登录访问受保护页面时跳转到登录页', () => {
    cy.visit('/periods');
    cy.url().should('include', '/login');
    cy.contains('管理员登录').should('be.visible');
  });
});
