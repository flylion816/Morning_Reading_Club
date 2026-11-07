import { expect, test, type Page } from '@playwright/test';

const admin = {
  _id: 'admin-e2e',
  name: '回归管理员',
  email: 'e2e@morningreading.com',
  role: 'superadmin',
  status: 'active',
  tenantId: null,
  permissions: []
};

const session = {
  accessToken: 'e2e-access-token',
  token: 'e2e-access-token',
  admin
};

const courseTemplates = [
  {
    _id: 'seven-habits',
    name: '七个习惯晨读营',
    active: true,
    builtIn: true,
    revision: 1,
    modules: [
      { id: 'm1', name: '静一静', type: 'shortText' as const },
      { id: 'm2', name: '问一问', type: 'text' as const },
      { id: 'm3', name: '读一读', type: 'body' as const }
    ],
    extensions: { duration: true, closingVideo: true, podcast: true }
  },
  {
    _id: 'space-management',
    name: '空间管理',
    active: true,
    revision: 1,
    modules: [
      { id: 'sm1', name: '看一看', type: 'image' as const },
      { id: 'sm2', name: '练一练', type: 'text' as const }
    ],
    extensions: { duration: false, closingVideo: false, podcast: false }
  }
];

const enrollmentTemplates = [
  {
    _id: 'simple-enrollment',
    name: '简洁报名',
    preset: 'simple' as const,
    active: true,
    revision: 1,
    usageCount: 2,
    fields: [
      { key: 'name' as const, label: '姓名', required: true },
      { key: 'phone' as const, label: '手机号', required: true }
    ]
  }
];

const periods = [
  {
    _id: 'period-space',
    name: '空间管理第一期',
    title: '空间管理 · 回归测试',
    status: 'published',
    startDate: '2026-11-01T00:00:00.000Z',
    endDate: '2026-11-21T00:00:00.000Z',
    totalDays: 21,
    price: 0,
    currentEnrollment: 6,
    readingAccessMode: 'open',
    visibilityType: 'all',
    isPublished: true,
    enrollmentOpen: true,
    courseTemplateSnapshot: {
      templateId: 'space-management',
      name: '空间管理',
      revision: 1,
      modules: courseTemplates[1].modules
    },
    enrollmentTemplateSnapshot: { templateId: 'simple-enrollment', name: '简洁报名' }
  }
];

function ok(data: unknown, pagination?: Record<string, unknown>) {
  return {
    code: 0,
    message: 'ok',
    data,
    ...(pagination ? { pagination } : {})
  };
}

async function mockAdminApi(page: Page, options: { authenticated?: boolean } = {}) {
  const authenticated = options.authenticated !== false;
  const pageErrors: Error[] = [];
  page.on('pageerror', error => pageErrors.push(error));

  await page.route('**/api/v1/**', async route => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    const method = request.method();

    if (path.endsWith('/auth/admin/refresh-token')) {
      await route.fulfill({ json: authenticated ? ok(session) : { code: 401, message: '未登录' } });
      return;
    }

    if (path.endsWith('/auth/admin/login') && method === 'POST') {
      await route.fulfill({ json: ok(session) });
      return;
    }

    if (path.endsWith('/admin/tenants')) {
      await route.fulfill({ json: ok([]) });
      return;
    }

    if (path.endsWith('/stats/dashboard')) {
      await route.fulfill({
        json: ok({
          totalUsers: 128,
          totalEnrollments: 96,
          pendingEnrollments: 3,
          paidEnrollments: 80,
          totalPaymentAmount: 19900,
          activePeriods: 2
        })
      });
      return;
    }

    if (path.endsWith('/enrollments')) {
      await route.fulfill({ json: ok([], { total: 0, page: 1, limit: 5 }) });
      return;
    }

    if (path.endsWith('/payments')) {
      await route.fulfill({ json: ok([], { total: 0, page: 1, limit: 5 }) });
      return;
    }

    if (path.endsWith('/periods') && method === 'GET') {
      await route.fulfill({ json: ok(periods, { total: periods.length, page: 1, limit: 10 }) });
      return;
    }

    if (path.endsWith('/course-templates') && method === 'GET') {
      await route.fulfill({ json: ok(courseTemplates, { total: courseTemplates.length }) });
      return;
    }

    if (path.endsWith('/enrollment-templates') && method === 'GET') {
      await route.fulfill({ json: ok(enrollmentTemplates, { total: enrollmentTemplates.length }) });
      return;
    }

    await route.fulfill({ json: ok([], { total: 0, page: 1, limit: 10 }) });
  });

  return () => {
    expect(pageErrors, `页面不应产生运行时错误: ${pageErrors.map(error => error.message).join('; ')}`).toHaveLength(0);
  };
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
});

test('未登录访问受保护页面会回到登录页', async ({ page }) => {
  await mockAdminApi(page, { authenticated: false });

  await page.goto('/periods');

  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByText('管理员登录')).toBeVisible();
  await expect(page.getByPlaceholder('邮箱地址')).toBeVisible();
  await expect(page.getByPlaceholder('密码')).toBeVisible();
});

test('管理员登录后能查看仪表盘核心指标', async ({ page }) => {
  await mockAdminApi(page, { authenticated: false });

  await page.goto('/login');
  await page.getByPlaceholder('邮箱地址').fill('e2e@morningreading.com');
  await page.getByPlaceholder('密码').fill('e2e-password');
  await page.getByRole('button', { name: '登录', exact: true }).click();

  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByText('仪表板：现在要做什么')).toBeVisible();
  await expect(page.getByText('总用户数')).toBeVisible();
  await expect(page.getByText('128')).toBeVisible();
  await expect(page.getByText('待审批').nth(1)).toBeVisible();
  await expect(page.getByText('支付总额')).toBeVisible();
  await expect(page.getByText('¥199.00')).toBeVisible();
});

test('期次列表展示模板、学习门槛并支持新建入口', async ({ page }) => {
  const assertNoPageError = await mockAdminApi(page);

  await page.goto('/periods');

  await expect(page.getByRole('heading', { name: '期次安排' })).toBeVisible();
  await expect(page.getByText('空间管理第一期')).toBeVisible();
  await expect(page.getByText('空间管理 · 回归测试')).toBeVisible();
  await expect(page.getByText('公开阅读').first()).toBeVisible();
  await expect(page.getByText('简洁报名').first()).toBeVisible();
  await expect(page.getByText('共 1 个期次')).toBeVisible();

  await page.getByRole('button', { name: '＋新建期次' }).click();
  const dialog = page.getByRole('dialog', { name: '新建期次' });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText('课程模板')).toBeVisible();
  await expect(dialog.getByText('七个习惯晨读营')).toBeVisible();
  await expect(dialog.getByText('报名模板', { exact: true })).toBeVisible();
  await expect(dialog.getByText('无需报名即可阅读')).toBeVisible();
  await expect(dialog.getByText('报名后阅读')).toBeVisible();
  await dialog.getByRole('button', { name: '关闭此对话框' }).click();
  await expect(dialog).toBeHidden();

  assertNoPageError();
});

test('课程模板列表展示规则并支持手机预览关闭', async ({ page }) => {
  const assertNoPageError = await mockAdminApi(page);

  await page.goto('/course-templates');

  await expect(page.getByRole('heading', { name: '课程模板' })).toBeVisible();
  await expect(page.getByText('已有期次保持原模板快照')).toBeVisible();
  await expect(page.getByRole('cell', { name: '空间管理' })).toBeVisible();
  await expect(page.getByRole('cell', { name: '看一看 · 练一练' })).toBeVisible();

  await page.getByRole('row', { name: /空间管理/ }).getByRole('button', { name: '预览' }).click();
  const dialog = page.getByRole('dialog', { name: '手机预览 · 示例内容' });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText('DAY 01')).toBeVisible();
  await expect(dialog.getByRole('heading', { name: '看一看' })).toBeVisible();
  await expect(dialog.getByRole('heading', { name: '练一练' })).toBeVisible();
  await dialog.getByRole('button', { name: '关闭此对话框' }).click();
  await expect(dialog).toBeHidden();

  assertNoPageError();
});

test('报名模板展示资料卡片并支持手机预览', async ({ page }) => {
  const assertNoPageError = await mockAdminApi(page);

  await page.goto('/enrollment-templates');

  await expect(page.getByRole('heading', { level: 1, name: '报名模板' })).toBeVisible();
  await expect(page.getByText('模板被期次使用后仍可编辑')).toBeVisible();
  await expect(page.getByRole('heading', { name: '简洁报名' })).toBeVisible();
  await expect(page.getByText('已绑定 2 个期次')).toBeVisible();
  await expect(page.getByText('姓名必填').first()).toBeVisible();
  await expect(page.getByText('手机号必填').first()).toBeVisible();

  await page.getByRole('article').filter({ hasText: '简洁报名' }).getByRole('button', { name: '预览' }).click();
  const dialog = page.getByRole('dialog', { name: '手机预览 · 示例内容' });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText('课程报名')).toBeVisible();
  await expect(dialog.getByText('确认报名')).toBeVisible();
  await expect(dialog.getByText('请输入手机号')).toBeVisible();
  await dialog.getByRole('button', { name: '关闭此对话框' }).click();
  await expect(dialog).toBeHidden();

  assertNoPageError();
});

test('核心管理页面在小屏下不出现横向溢出', async ({ page }) => {
  await mockAdminApi(page);
  await page.setViewportSize({ width: 390, height: 844 });

  for (const path of ['/periods', '/course-templates', '/enrollment-templates']) {
    await page.goto(path);
    await expect(page.locator('main').first()).toBeVisible();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow, `${path} 不应横向溢出`).toBeLessThanOrEqual(2);
  }
});
