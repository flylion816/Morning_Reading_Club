const { buildCourseModules } = require('../../utils/course-modules');

describe('course modules presentation', () => {
  const snapshot = { templateId: 'custom', modules: [
    { id: 'observe', name: '观察空间', type: 'text' },
    { id: 'read', name: '学习内容', type: 'body' },
    { id: 'photo', name: '空间照片', type: 'image' }
  ] };
  test('preserves custom names, order and rendered body while hiding empty values', () => {
    const modules = buildCourseModules({ courseTemplateSnapshot: snapshot, courseModuleValues: { observe: ' ', read: '# 学习' } }, '<p>学习</p>');
    expect(modules).toEqual([{ id: 'read', name: '学习内容', type: 'body', value: '<p>学习</p>' }]);
  });
  test('normalizes uploaded images and rejects unsafe image URLs', () => {
    expect(buildCourseModules({ courseTemplateSnapshot: snapshot, courseModuleValues: { photo: '/uploads/tenants/t/a.jpg' } }, '', 'https://example.test')[0].value).toBe('https://example.test/uploads/tenants/t/a.jpg');
    expect(buildCourseModules({ courseTemplateSnapshot: snapshot, courseModuleValues: { photo: 'javascript:alert(1)' } }, '')).toEqual([]);
  });
  test('keeps historical fixed fields and allows image-only body content', () => {
    const modules = buildCourseModules({ meditation: '静思', content: '![图](a.jpg)' }, '<p><img src="a.jpg" /></p>');
    expect(modules.map(module => module.name)).toEqual(['静一静', '读一读']);
  });
  test('handles a custom course without a body or any filled modules', () => {
    expect(buildCourseModules({ courseTemplateSnapshot: { ...snapshot, modules: [snapshot.modules[0]] }, courseModuleValues: {} }, '')).toEqual([]);
  });
});
