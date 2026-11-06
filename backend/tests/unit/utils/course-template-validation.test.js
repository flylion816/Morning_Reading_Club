const { expect } = require('chai');
const { validateCourseTemplate, MAX_MODULES } = require('../../../src/utils/course-template-validation');

describe('course template validation', () => {
  const validTemplate = () => ({
    name: '空间管理',
    modules: [
      { id: 'observe', name: '观察空间', type: 'text' },
      { id: 'reading', name: '学习内容', type: 'body' },
      { id: 'picture', name: '空间照片', type: 'image' }
    ]
  });

  it('accepts ordered modules with different types', () => {
    expect(validateCourseTemplate(validTemplate())).to.equal(null);
  });

  it('accepts a template without a body', () => {
    const template = validTemplate();
    template.modules.splice(1, 1);
    expect(validateCourseTemplate(template)).to.equal(null);
  });

  it('rejects invalid names, malformed modules, and invalid types', () => {
    expect(validateCourseTemplate({ ...validTemplate(), name: ' ' })).to.be.a('string');
    expect(validateCourseTemplate({ ...validTemplate(), name: '字'.repeat(31) })).to.be.a('string');
    expect(validateCourseTemplate({ ...validTemplate(), modules: [] })).to.be.a('string');
    expect(validateCourseTemplate({ ...validTemplate(), modules: [null] })).to.be.a('string');
    expect(validateCourseTemplate({ ...validTemplate(), modules: [{ id: 'a', name: 'A', type: 'unknown' }] })).to.be.a('string');
  });

  it('rejects duplicate and unsafe module IDs', () => {
    const template = validTemplate();
    template.modules[1].id = template.modules[0].id;
    expect(validateCourseTemplate(template)).to.match(/重复/);
    template.modules[1].id = '$unsafe';
    expect(validateCourseTemplate(template)).to.match(/标识无效/);
    template.modules[1].id = '__proto__';
    expect(validateCourseTemplate(template)).to.match(/标识无效/);
  });

  it('rejects more than one body module and too many modules', () => {
    const template = validTemplate();
    template.modules.push({ id: 'body2', name: '另一个正文', type: 'body' });
    expect(validateCourseTemplate(template)).to.match(/正文模块最多一个/);
    template.modules = Array.from({ length: MAX_MODULES + 1 }, (_, index) => ({
      id: `m${index}`, name: '模块', type: 'text'
    }));
    expect(validateCourseTemplate(template)).to.match(/模块/);
  });

  it('accepts extension capability switches and rejects unknown values', () => {
    const template = validTemplate();
    template.extensions = { duration: true, closingVideo: false, podcast: true };
    expect(validateCourseTemplate(template)).to.equal(null);
    template.extensions = { duration: 'yes' };
    expect(validateCourseTemplate(template)).to.match(/扩展能力/);
    template.extensions = { unknown: true };
    expect(validateCourseTemplate(template)).to.match(/扩展能力/);
  });
});
