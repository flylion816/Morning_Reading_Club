const { expect } = require('chai');
const {
  defaultCourseTemplate,
  snapshotCourseTemplate,
  validateModuleValues
} = require('../../../src/services/course-template.service');

describe('course template snapshot and values', () => {
  it('copies module definitions so later edits do not mutate a period snapshot', () => {
    const template = defaultCourseTemplate();
    const snapshot = snapshotCourseTemplate(template);
    template.modules[0].name = '新名称';
    expect(snapshot.modules[0].name).to.equal('静一静');
    expect(snapshot.templateId).to.equal('seven-habits');
  });

  it('accepts values addressed by known stable module IDs', () => {
    const snapshot = snapshotCourseTemplate(defaultCourseTemplate());
    expect(validateModuleValues(snapshot, { meditation: '静思', content: '# 正文' })).to.equal(null);
  });

  it('rejects unknown IDs, wrong types, and oversized values', () => {
    const snapshot = snapshotCourseTemplate(defaultCourseTemplate());
    expect(validateModuleValues(snapshot, { other: 'x' })).to.be.a('string');
    expect(validateModuleValues(snapshot, { meditation: 5 })).to.be.a('string');
    expect(validateModuleValues(snapshot, { content: 'x'.repeat(20001) })).to.be.a('string');
    expect(validateModuleValues(snapshot, { meditation: 'x'.repeat(501) })).to.be.a('string');
  });

  it('rejects unsafe image schemes', () => {
    const snapshot = snapshotCourseTemplate(defaultCourseTemplate());
    expect(validateModuleValues(snapshot, { lookImage: 'javascript:alert(1)' })).to.be.a('string');
    expect(validateModuleValues(snapshot, { lookImage: '/uploads/tenants/example/pic.jpg' })).to.equal(null);
    expect(validateModuleValues(snapshot, { lookImage: 'https://example.com/pic.jpg' })).to.equal(null);
  });
});
