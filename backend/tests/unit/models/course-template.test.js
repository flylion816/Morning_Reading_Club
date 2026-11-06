const { expect } = require('chai');
const mongoose = require('mongoose');
const CourseTemplate = require('../../../src/models/CourseTemplate');
const { defaultCourseTemplate } = require('../../../src/services/course-template.service');

describe('CourseTemplate model', () => {
  it('validates module definitions without connecting to a database', () => {
    const template = new CourseTemplate({
      tenantId: new mongoose.Types.ObjectId(),
      name: '空间管理',
      modules: [{ id: 'reading', name: '学习内容', type: 'body' }]
    });
    expect(template.validateSync()).to.equal(undefined);
    template.modules.push({ id: 'other', name: '另一个正文', type: 'body' });
    expect(template.validateSync().errors.modules.message).to.match(/模块配置无效/);
  });

  it('returns independent copies of the built-in definition', () => {
    const first = defaultCourseTemplate();
    first.modules[0].name = '改名';
    expect(defaultCourseTemplate().modules[0].name).to.equal('静一静');
  });
});
