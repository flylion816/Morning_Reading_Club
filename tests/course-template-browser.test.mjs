import assert from 'node:assert/strict';
import { existsSync, mkdirSync, writeFileSync, unlinkSync } from 'node:fs';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { after, before, test } from 'node:test';
import { chromium } from 'playwright';

const root = resolve(import.meta.dirname, '..');
const backendRequire = createRequire(resolve(root, 'backend/package.json'));
process.env.NODE_ENV = 'test';
backendRequire('dotenv').config({ path: resolve(root, 'backend/.env.test'), override: true });
const mongoose = backendRequire('mongoose');
const { MongoMemoryServer } = backendRequire('mongodb-memory-server');
const { withSystemContext } = backendRequire('./src/utils/tenantContext');
const express = backendRequire('express');
let mongo;
let server;
let browser;
let origin;
let context;
const tenants = {};
const uploadedFiles = [];
const password = 'Synthetic-Browser-Template-Test-Password';
const email = 'template-browser@example.test';

before(async () => {
  mongo = await MongoMemoryServer.create();
  process.env.MONGODB_URI = mongo.getUri();
  await mongoose.connect(process.env.MONGODB_URI);
  const Tenant = backendRequire('./src/models/Tenant');
  const Admin = backendRequire('./src/models/Admin');
  const Period = backendRequire('./src/models/Period');
  const Section = backendRequire('./src/models/Section');
  const CourseTemplate = backendRequire('./src/models/CourseTemplate');
  const { defaultCourseTemplate, snapshotCourseTemplate } = backendRequire('./src/services/course-template.service');
  for (const slug of ['fanren', 'starry']) {
    const config = backendRequire(resolve(root, `miniprogram/config/tenants/${slug}.js`));
    const tenant = await Tenant.create({ slug, name: config.brandName, branding: { brandName: config.brandName, primaryColor: config.primaryColor }, wxAppIds: [slug === 'fanren' ? 'wx1111111111111111' : 'wx2222222222222222'] });
    tenants[slug] = tenant;
    await withSystemContext(tenant._id, async () => {
      await CourseTemplate.create({ tenantId: tenant._id, name: '空间管理示例模板', modules: [{ id: 'observe', name: '观察空间', type: 'text' }, { id: 'body', name: '学习内容', type: 'body' }, { id: 'practice', name: '实践任务', type: 'text' }] });
      const period = await Period.create({ tenantId: tenant._id, name: '示例共读期次', title: '示例共读课程', startDate: '2026-11-01', endDate: '2026-11-23', courseTemplateSnapshot: snapshotCourseTemplate(defaultCourseTemplate()), courseTemplateLocked: true });
      await Section.create({ tenantId: tenant._id, periodId: period._id, day: 0, title: '示例课程', content: '# 示例正文', meditation: '示例静思内容' });
    });
  }
  await Admin.create({ email, password, name: '演示管理员', role: 'platform_superadmin' });
  const api = backendRequire('./src/app');
  const web = express();
  web.use((req, res, next) => req.path.startsWith('/api/') || req.path.startsWith('/uploads/') ? api(req, res, next) : next());
  web.use('/admin', express.static(resolve(root, 'admin/dist')));
  web.get('/admin/*', (req, res) => res.sendFile(resolve(root, 'admin/dist/index.html')));
  server = web.listen(0, '127.0.0.1');
  await new Promise(done => server.once('listening', done));
  origin = `http://127.0.0.1:${server.address().port}`;
  const chromePath = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
  browser = await chromium.launch({ headless: true, ...(existsSync(chromePath) ? { executablePath: chromePath } : {}) });
  context = await browser.newContext({ viewport: { width: 1512, height: 771 } });
  await context.route('https://**/*', route => route.abort());
  await context.addInitScript(id => { if (!localStorage.getItem('admin_active_tenant')) localStorage.setItem('admin_active_tenant', id); }, String(tenants.fanren._id));
  const page = await context.newPage();
  await page.goto(`${origin}/admin/login`);
  await page.getByPlaceholder('邮箱地址').fill(email);
  await page.getByPlaceholder('密码', { exact: true }).fill(password);
  await page.getByRole('button', { name: '登录', exact: true }).click();
  await page.waitForFunction(() => window.location.pathname !== '/admin/login', null, { timeout: 30000 });
  await page.close();
}, { timeout: 90000 });

after(async () => {
  await browser?.close();
  if (server) await new Promise(done => server.close(done));
  await mongoose.disconnect();
  await mongo?.stop();
  for (const path of uploadedFiles) { if (existsSync(path)) unlinkSync(path); }
});

test('real browser creates a template and previews the current draft', { concurrency: false }, async () => {
  const page = await context.newPage();
  await page.goto(`${origin}/admin/course-templates`);
  await page.getByRole('button', { name: '＋新建模板', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByPlaceholder('例如：空间管理').fill('空间观察模板');
  await dialog.getByRole('button', { name: '＋添加模块' }).click();
  await dialog.getByRole('textbox', { name: '模块名称', exact: true }).fill('观察与实践');
  assert.equal(await dialog.locator('.preview-module h4').innerText(), '观察与实践');
  await dialog.getByRole('button', { name: '保存模板' }).click();
  await dialog.waitFor({ state: 'hidden' });
  await page.getByRole('cell', { name: '空间观察模板', exact: true }).waitFor();
  await page.close();
});

test('course template dialogs have one working close button from both entry points', { concurrency: false }, async () => {
  const page = await context.newPage();
  await page.goto(`${origin}/admin/course-templates`);
  await page.getByRole('button', { name: '＋新建模板', exact: true }).click();
  let dialog = page.getByRole('dialog', { name: '新建课程模板', exact: true });
  assert.equal(await dialog.locator('.el-dialog__headerbtn').count(), 1);
  assert.equal(await dialog.locator('[aria-label="关闭模板编辑器"]').count(), 0);
  await dialog.locator('.el-dialog__headerbtn').click();
  await dialog.waitFor({ state: 'hidden' });

  await page.goto(`${origin}/admin/periods`);
  await page.getByRole('button', { name: /新建期次/ }).click();
  const periodDialog = page.getByRole('dialog', { name: '新建期次', exact: true });
  await periodDialog.getByPlaceholder('例：第一期').fill('关闭弹窗测试');
  await periodDialog.getByRole('button', { name: '＋新建模板', exact: true }).first().click();
  dialog = page.getByRole('dialog', { name: '新建课程模板', exact: true });
  assert.equal(await dialog.locator('.el-dialog__headerbtn').count(), 1);
  assert.equal(await dialog.locator('[aria-label="关闭模板编辑器"]').count(), 0);
  await dialog.locator('.el-dialog__headerbtn').click();
  await dialog.waitFor({ state: 'hidden' });
  assert.equal(await periodDialog.getByPlaceholder('例：第一期').inputValue(), '关闭弹窗测试');
  await page.close();
});

test('creating a template inside a period preserves fields and selects the new template', { concurrency: false }, async () => {
  const page = await context.newPage();
  await page.goto(`${origin}/admin/periods`);
  await page.getByRole('button', { name: /新建期次/ }).click();
  const periodDialog = page.getByRole('dialog', { name: '新建期次', exact: true });
  await page.getByPlaceholder('例：第一期').fill('空间管理练习期');
  await periodDialog.getByRole('button', { name: '＋新建模板', exact: true }).first().click();
  const editor = page.getByRole('dialog', { name: '新建课程模板', exact: true });
  await editor.getByPlaceholder('例如：空间管理').fill('细心细行模板');
  await editor.getByRole('button', { name: '＋添加模块' }).click();
  await editor.getByRole('textbox', { name: '模块名称', exact: true }).fill('今日学习');
  await editor.getByRole('button', { name: '＋添加模块' }).click();
  await editor.getByRole('textbox', { name: '模块名称', exact: true }).nth(1).fill('课程正文');
  await editor.locator('.module-row').nth(1).locator('.el-select').click();
  await page.getByRole('option', { name: '正文', exact: true }).last().click();
  await editor.getByRole('button', { name: '＋添加模块' }).click();
  await editor.getByRole('textbox', { name: '模块名称', exact: true }).nth(2).fill('空间图片');
  await editor.locator('.module-row').nth(2).locator('.el-select').click();
  await page.getByRole('option', { name: '图片', exact: true }).last().click();
  await editor.getByRole('button', { name: '保存模板' }).click();
  await editor.waitFor({ state: 'hidden' });
  assert.equal(await page.getByPlaceholder('例：第一期').inputValue(), '空间管理练习期');
  assert.ok((await page.locator('.template-picker').innerText()).includes('细心细行模板'));
  await page.getByPlaceholder('期次的完整标题').fill('空间管理练习课程');
  await page.getByPlaceholder('选择起始日期').fill('2026-11-01');
  await page.getByPlaceholder('选择起始日期').press('Tab');
  await page.getByPlaceholder('选择结束日期').fill('2026-11-23');
  await page.getByPlaceholder('选择结束日期').press('Tab');
  await periodDialog.locator('button.choice-card').first().click();
  const saved = page.waitForResponse(response => response.url().endsWith('/api/v1/periods') && response.request().method() === 'POST');
  await page.getByRole('button', { name: '创建', exact: true }).click();
  assert.equal((await saved).status(), 201);
  await page.getByRole('dialog', { name: '新建期次', exact: true }).waitFor({ state: 'hidden' });
  await page.goto(`${origin}/admin/content`);
  await page.locator('.card-header .el-select').click();
  await page.getByRole('option', { name: '空间管理练习期', exact: true }).click();
  await page.getByRole('button', { name: '＋ 新增课节' }).count().then(async count => {
    if (count) await page.getByRole('button', { name: '＋ 新增课节' }).click();
    else await page.getByRole('button', { name: /新增课节/ }).click();
  });
  await page.getByPlaceholder('请输入课程标题').fill('自定义课程');
  const field = page.locator('.el-form-item').filter({ has: page.locator('label', { hasText: '今日学习' }) }).locator('textarea');
  await field.fill('课程内容保存测试');
  await page.locator('.body-editor textarea').fill('# 正文保存验证');
  const imageResponse = page.waitForResponse(response => response.url().endsWith('/api/v1/upload') && response.request().method() === 'POST');
  const choosingImage = page.waitForEvent('filechooser');
  await page.locator('.image-field').getByRole('button', { name: '选择图片', exact: true }).click();
  await (await choosingImage).setFiles({
    name: 'template-synthetic.png', mimeType: 'image/png',
    buffer: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/S5sAAAAASUVORK5CYII=', 'base64')
  });
  const upload = await imageResponse;
  assert.equal(upload.status(), 200);
  const uploadData = (await upload.json()).data;
  const filePath = resolve(root, 'backend', '.' + uploadData.url);
  assert.ok(filePath.startsWith(resolve(root, 'backend/uploads/tenants/fanren') + '/'));
  uploadedFiles.push(filePath);
  await page.locator('.image-field img').waitFor();
  const lesson = page.waitForResponse(response => /\/sections$/.test(response.url()) && response.request().method() === 'POST');
  await page.getByRole('button', { name: '保存', exact: true }).click();
  const savedLesson = await lesson;
  assert.equal(savedLesson.status(), 201);
  const savedData = (await savedLesson.json()).data;
  assert.equal(savedData.content, '# 正文保存验证');
  assert.equal(Object.values(savedData.courseModuleValues).includes('课程内容保存测试'), true);
  await page.getByRole('dialog').waitFor({ state: 'hidden' });
  await page.close();
});

test('real browser creates and previews a simple enrollment template', { concurrency: false }, async () => {
  const page = await context.newPage();
  await page.goto(`${origin}/admin/enrollment-templates`);
  await page.getByRole('button', { name: '＋新建模板', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: '新建报名模板', exact: true });
  await dialog.getByPlaceholder('例如：空间管理简洁报名').fill('空间管理轻量报名');
  await dialog.getByRole('button', { name: '保存报名模板', exact: true }).click();
  await dialog.waitFor({ state: 'hidden' });

  const card = page.locator('.template-card').filter({ hasText: '空间管理轻量报名' });
  await card.waitFor();
  await card.getByRole('button', { name: '预览', exact: true }).click();
  const preview = page.getByRole('dialog', { name: '手机预览 · 示例内容', exact: true });
  await preview.locator('.phone-preview').waitFor();
  assert.ok((await preview.locator('.phone-preview').innerText()).includes('空间管理轻量报名'));
  await page.keyboard.press('Escape');
  await page.close();
});

test('a new period requires a real enrollment template selection and saves it', { concurrency: false }, async () => {
  const page = await context.newPage();
  await page.goto(`${origin}/admin/periods`);
  await page.getByRole('button', { name: /新建期次/ }).click();
  const dialog = page.getByRole('dialog', { name: '新建期次', exact: true });
  const field = dialog.locator('#period-enrollment-template');
  await page.getByPlaceholder('例：第一期').fill('报名模板绑定验证');
  await page.getByPlaceholder('期次的完整标题').fill('报名模板绑定验证课程');
  await page.getByPlaceholder('选择起始日期').fill('2026-11-01');
  await page.getByPlaceholder('选择起始日期').press('Tab');
  await page.getByPlaceholder('选择结束日期').fill('2026-11-23');
  await page.getByPlaceholder('选择结束日期').press('Tab');
  await field.locator('.el-select:not(.is-disabled)').waitFor();
  assert.equal(await field.locator('.picker-summary').count(), 0, 'empty value must not appear selected');
  await dialog.getByRole('button', { name: '创建', exact: true }).click();
  await page.getByText('报名后阅读的期次请选择报名模板', { exact: true }).waitFor();
  await field.locator('.el-select').click();
  await page.getByRole('option', { name: '简洁报名', exact: true }).click();
  const saved = page.waitForResponse(response => response.url().endsWith('/api/v1/periods') && response.request().method() === 'POST');
  await dialog.getByRole('button', { name: '创建', exact: true }).click();
  const response = await saved;
  assert.equal(response.status(), 201);
  const requestBody = response.request().postDataJSON();
  const data = (await response.json()).data;
  assert.ok(requestBody.enrollmentTemplateId, 'selected template ID is submitted');
  assert.equal(data.enrollmentTemplateSnapshot.name, '简洁报名');
  assert.equal(data.enrollmentTemplateSnapshot.templateId, requestBody.enrollmentTemplateId);
  await dialog.waitFor({ state: 'hidden' });
  await page.close();
});

test('period list refreshes an expired admin session and retries', { concurrency: false }, async () => {
  const jwt = backendRequire('jsonwebtoken');
  const expiredToken = jwt.sign({
    sub: new mongoose.Types.ObjectId().toString(),
    sid: 'expired-browser-session',
    role: 'platform_superadmin',
    sessionVersion: 0,
    tokenType: 'admin_access'
  }, process.env.JWT_ADMIN_SECRET, {
    algorithm: 'HS256', issuer: 'morning-reading', audience: 'admin-api', expiresIn: -1
  });
  const page = await context.newPage();
  let injected = false;
  const statuses = [];
  page.on('response', response => {
    if (response.url().includes('/api/v1/periods?')) statuses.push(response.status());
  });
  await page.route('**/api/v1/periods?*', async route => {
    if (!injected) {
      injected = true;
      await route.continue({ headers: { ...route.request().headers(), authorization: `Bearer ${expiredToken}` } });
    } else {
      await route.continue();
    }
  });
  await page.goto(`${origin}/admin/periods`);
  await page.getByText('示例共读期次', { exact: true }).waitFor();
  assert.deepEqual(statuses.slice(0, 2), [401, 200]);
  await page.close();
});

test('lesson editor hides the full disabled extension group and retains legacy controls', { concurrency: false }, async () => {
  const CourseTemplate = backendRequire('./src/models/CourseTemplate');
  const Period = backendRequire('./src/models/Period');
  const { snapshotCourseTemplate } = backendRequire('./src/services/course-template.service');
  const disabled = { duration: false, closingVideo: false, podcast: false };
  const cases = await withSystemContext(tenants.fanren._id, async () => {
    const template = await CourseTemplate.create({ tenantId: tenants.fanren._id, name: '空间管理', modules: [
      { id: 'observe', name: '观察空间', type: 'shortText' },
      { id: 'practice', name: '今日实践', type: 'text' },
      { id: 'photo', name: '空间照片', type: 'image' }
    ], extensions: disabled });
    const base = { tenantId: tenants.fanren._id, title: '扩展配置验证', startDate: '2026-11-01', endDate: '2026-11-23' };
    return [
      await Period.create({ ...base, name: '扩展全关验证', courseTemplateSnapshot: snapshotCourseTemplate(template) }),
      await Period.create({ ...base, name: '历史扩展验证' })
    ];
  });
  for (const [index, period] of cases.entries()) {
    const page = await context.newPage();
    await page.goto(`${origin}/admin/content`);
    await page.locator('.card-header .el-select').click();
    await page.getByRole('option', { name: period.name, exact: true }).click();
    await page.waitForLoadState('networkidle');
    await page.getByRole('button', { name: /新增课节/ }).click();
    const dialog = page.getByRole('dialog', { name: '新增课节', exact: true });
    await dialog.waitFor();
    for (const label of ['扩展信息', '时长（分钟）', '结营视频', '凡人播客', '播客音频', '播客时长（秒）', '播客介绍']) {
      assert.equal(await dialog.getByText(label, { exact: true }).count(), index === 0 ? 0 : 1, label);
    }
    assert.equal(await dialog.getByText('发布状态', { exact: true }).count(), 1);
    if (index === 0) {
      mkdirSync(resolve(root, 'output/course-template-verification'), { recursive: true });
      await dialog.getByText('发布状态', { exact: true }).scrollIntoViewIfNeeded();
      await page.screenshot({ path: resolve(root, 'output/course-template-verification/disabled-lesson-extensions.png'), animations: 'disabled' });
      await dialog.locator('.el-dialog__body').evaluate(body => { body.scrollTop = 0; });
      await page.screenshot({ path: resolve(root, 'output/course-template-verification/lesson-layout-desktop.png'), animations: 'disabled' });
      await page.setViewportSize({ width: 390, height: 844 });
      const saveButton = dialog.getByRole('button', { name: '保存', exact: true });
      const saveBox = await saveButton.boundingBox();
      assert.ok(saveBox && saveBox.y >= 0 && saveBox.y + saveBox.height <= 844, 'save stays in the mobile viewport');
      const bodySize = await dialog.locator('.el-dialog__body').evaluate(body => ({ width: body.clientWidth, scrollWidth: body.scrollWidth }));
      assert.ok(bodySize.scrollWidth <= bodySize.width + 1, 'editor content must not overflow horizontally');
      await page.screenshot({ path: resolve(root, 'output/course-template-verification/lesson-layout-mobile.png'), animations: 'disabled' });
    }
    await page.close();
  }
});

test('new editor remains usable at a narrow viewport', { concurrency: false }, async () => {
  const page = await context.newPage();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${origin}/admin/course-templates`);
  await page.getByRole('button', { name: '＋新建模板', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByPlaceholder('例如：空间管理').fill('手机测试');
  await dialog.getByRole('button', { name: '＋添加模块' }).click();
  await dialog.getByRole('textbox', { name: '模块名称', exact: true }).fill('模块');
  const box = await dialog.locator('.el-dialog').boundingBox();
  assert.ok(box.width <= 390, 'dialog must fit the viewport');
  await dialog.getByRole('button', { name: '保存模板' }).scrollIntoViewIfNeeded();
  await page.close();
});

const shots = [
  ['annotated-01-dashboard.png', '/'], ['annotated-02-analytics.png', '/analytics', '活跃度'],
  ['annotated-03-registrations.png', '/enrollments'], ['annotated-03b-registration-statistics.png', '/enrollments', '报名信息统计'],
  ['annotated-04-users.png', '/users'], ['annotated-05-payments.png', '/payments'],
  ['annotated-06-sections.png', '/periods', 'copy'],
  ['annotated-06b-course-templates.png', '/course-templates'], ['annotated-06c-template-preview.png', '/course-templates', 'edit-template'],
  ['annotated-07-contents.png', '/content'], ['annotated-08a-checkins-records.png', '/checkins'], ['annotated-08b-checkins-celebration.png', '/checkins', '庆祝配置'],
  ['annotated-09a-insights-list.png', '/insights'], ['annotated-09b-insights-view-unmasked.png', '/insights'],
  ['annotated-10-applications.png', '/insight-requests'], ['annotated-11-completion-reports.png', '/completion-reports'],
  ['annotated-12-imprints.png', '/imprints'], ['annotated-13-activities.png', '/activities'], ['annotated-14-coupons.png', '/coupons'],
  ['annotated-15-home-config.png', '/home-config'], ['annotated-16-audit.png', '/audit-logs']
];

test('period editor keeps its header and save controls visible at desktop and phone widths', { concurrency: false }, async () => {
  const page = await context.newPage();
  await page.goto(`${origin}/admin/periods`);
  await page.waitForLoadState('networkidle');
  mkdirSync(resolve(root, 'output/enrollment-design'), { recursive: true });
  await page.screenshot({ path: resolve(root, 'output/enrollment-design/period-list.png'), animations: 'disabled' });
  await page.getByRole('button', { name: /新建期次/ }).click();
  const dialog = page.getByRole('dialog', { name: '新建期次', exact: true });
  for (const viewport of [{ width: 1512, height: 771 }, { width: 390, height: 844 }, { width: 320, height: 568 }]) {
    await page.setViewportSize(viewport);
    const body = dialog.locator('.el-dialog__body');
    await body.evaluate(element => { element.scrollTop = element.scrollHeight; });
    const save = await dialog.getByRole('button', { name: '创建', exact: true }).boundingBox();
    assert.ok(save && save.y >= 0 && save.y + save.height <= viewport.height, 'period save remains in viewport');
    const header = await dialog.locator('.el-dialog__header').boundingBox();
    assert.ok(header && header.y >= 0, 'period header remains in viewport');
    const size = await body.evaluate(element => ({ width: element.clientWidth, contentWidth: element.scrollWidth }));
    assert.ok(size.contentWidth <= size.width + 1, 'period form must not overflow horizontally');
    await body.evaluate(element => { element.scrollTop = 0; });
    await page.screenshot({ path: resolve(root, `output/enrollment-design/period-editor-${viewport.width}.png`), animations: 'disabled' });
  }
  await page.close();
});

test('existing period exposes enrollment templates through visible shortcuts and reopens at the top', async () => {
  const page = await context.newPage();
  await page.goto(`${origin}/admin/periods`);
  const edit = page.locator('.el-table__row').filter({ hasText: '示例共读期次' }).getByRole('button', { name: '编辑', exact: true });
  await edit.click();
  const dialog = page.getByRole('dialog', { name: '编辑期次', exact: true });
  await page.waitForLoadState('networkidle');
  const body = dialog.locator('.el-dialog__body');
  const field = dialog.locator('#period-enrollment-template');
  mkdirSync(resolve(root, 'output/enrollment-design'), { recursive: true });
  for (const [index, viewport] of [{ width: 1512, height: 771 }, { width: 390, height: 844 }].entries()) {
    await page.setViewportSize(viewport);
    await body.evaluate(element => { element.scrollTop = element.scrollHeight; });
    if (index === 0) await dialog.getByRole('button', { name: '去配置报名资料 ↑', exact: true }).click();
    else await dialog.locator('.period-dialog-heading').getByRole('button', { name: /^选择报名模板/ }).click();
    await page.waitForFunction(() => {
      const target = document.getElementById('period-enrollment-template');
      const container = document.querySelector('.period-editor-dialog .el-dialog__body');
      if (!target || !container) return false;
      const fieldBox = target.getBoundingClientRect();
      const bodyBox = container.getBoundingClientRect();
      return fieldBox.top >= bodyBox.top && fieldBox.bottom <= bodyBox.bottom;
    });
    await field.locator('.el-select').click();
    const label = index === 0 ? '简洁报名' : '七个习惯完整版';
    await page.getByRole('option', { name: label, exact: true }).click();
    assert.ok((await field.innerText()).includes(label), 'selected enrollment template is shown in the existing period');
    assert.equal(await field.locator('.picker-summary strong').innerText(), label, 'selected enrollment template name is visible below the picker');
    const enrollmentSelect = field.locator('.el-select');
    const courseSelect = dialog.locator('.template-picker > .el-select');
    const widths = await Promise.all([enrollmentSelect.boundingBox(), courseSelect.boundingBox()]);
    assert.ok(widths[0].width >= 150, 'enrollment template selector has room for its name');
    if (index === 0) assert.ok(Math.abs(widths[0].width - widths[1].width) < 2, 'template selectors have matching desktop widths');
    const selectedLabel = enrollmentSelect.locator('.el-select__selected-item').filter({ hasText: label });
    assert.equal((await selectedLabel.innerText()).trim(), label);
    const labelFits = await selectedLabel.evaluate(element => element.scrollWidth <= element.clientWidth + 1);
    assert.ok(labelFits, 'selected template name is not clipped');
    await page.screenshot({ path: resolve(root, `output/enrollment-design/enrollment-template-shortcut-${viewport.width}.png`), animations: 'disabled' });
  }
  await body.evaluate(element => { element.scrollTop = element.scrollHeight; });
  await dialog.getByRole('button', { name: '取消', exact: true }).click();
  await dialog.waitFor({ state: 'hidden' });
  await page.setViewportSize({ width: 1512, height: 771 });
  await edit.click();
  await dialog.waitFor();
  await page.waitForFunction(() => document.querySelector('.period-editor-dialog .el-dialog__body')?.scrollTop === 0);
  await page.close();
});

test('captures both tenant guides from the authenticated synthetic preview', { skip: process.env.REFRESH_ADMIN_GUIDE !== '1', timeout: 180000 }, async () => {
  const report = [];
  for (const slug of ['fanren', 'starry']) {
    const dir = resolve(root, 'docs/admin-guide-assets', slug);
    mkdirSync(dir, { recursive: true });
    const page = await context.newPage();
    await page.goto(`${origin}/admin/`);
    await page.evaluate(id => localStorage.setItem('admin_active_tenant', id), String(tenants[slug]._id));
    for (const [filename, route, action] of shots) {
      backendRequire('./src/middleware/ratelimit').resetTestRateLimitBuckets();
      await page.goto(`${origin}/admin${route}`);
      await page.locator('.admin-header').waitFor();
      await page.waitForLoadState('networkidle');
      if (action === 'copy') await page.locator('.el-table__row').first().getByRole('button', { name: '复制', exact: true }).click();
      else if (action === 'edit-template') await page.locator('.el-table__row').filter({ hasText: '空间管理示例模板' }).getByRole('button', { name: '编辑', exact: true }).click();
      else if (action) await page.getByRole('tab', { name: action, exact: true }).click();
      if (action === 'copy') await page.getByRole('dialog', { name: '复制期次', exact: true }).getByPlaceholder('例：第一期').waitFor();
      if (action === 'edit-template') await page.getByRole('dialog', { name: '编辑课程模板', exact: true }).locator('.phone-preview').waitFor();
      await page.waitForLoadState('networkidle');
      await page.locator('.el-loading-mask').waitFor({ state: 'hidden' }).catch(() => {});
      await page.evaluate(() => {
        for (const cell of document.querySelectorAll('.el-table__body td .cell')) {
          if (/\/audit-logs|\/payments|\/users|\/enrollments/.test(location.pathname)) cell.textContent = '已脱敏';
        }
        for (const toast of document.querySelectorAll('.el-message')) toast.remove();
      });
      assert.ok((await page.locator('.brand-copy').innerText()).includes(tenants[slug].name));
      await page.screenshot({ path: resolve(dir, filename), animations: 'disabled' });
      report.push({ slug, filename, route, action: action || null, width: 1512, height: 771 });
    }
    await page.close();
  }
  mkdirSync(resolve(root, 'output/course-template-verification'), { recursive: true });
  writeFileSync(resolve(root, 'output/course-template-verification/screenshots.json'), JSON.stringify(report, null, 2));
});
