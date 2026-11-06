const DEFAULT_MODULES = [
  ['meditation', '静一静', 'text'], ['question', '问一问', 'text'], ['learn', '学一学', 'text'],
  ['content', '读一读', 'body'], ['lookImage', '看一看', 'image'], ['reflection', '想一想', 'text'],
  ['action', '记一记', 'text'], ['extract', '摘一摘', 'text'], ['say', '说一说', 'text']
].map(([id, name, type]) => ({ id, name, type }));

function isNonEmpty(value) {
  return !!String(value || '').replace(/<[^>]*>/g, '').replace(/&nbsp;|\s/g, '') || /<img\b|!\[[^\]]*\]\(/i.test(String(value || ''));
}

function buildCourseModules(course, bodyHtml, baseUrl = '') {
  const custom = !!course.courseTemplateSnapshot && course.courseTemplateSnapshot.templateId !== 'seven-habits';
  const definitions = custom ? course.courseTemplateSnapshot.modules || [] : DEFAULT_MODULES;
  return definitions.map(module => {
    let value = custom ? course.courseModuleValues?.[module.id] || '' : course[module.id] || '';
    if (module.type === 'body') value = bodyHtml === undefined ? value : bodyHtml;
    if (module.type === 'image') {
      if (value.startsWith('/uploads/')) value = baseUrl + value;
      else if (!/^https?:\/\//i.test(value)) value = '';
    }
    return { ...module, value };
  }).filter(module => isNonEmpty(module.value));
}

function applyCourseTemplateExtensions(course) {
  const extensions = course.courseTemplateSnapshot?.extensions || {};
  if (extensions.closingVideo === false) {
    course.closingVideo = null;
    course.closingVideoUrl = '';
    course.closingVideoCoverUrl = '';
  }
  if (extensions.podcast === false) {
    course.podcastUrl = '';
    course.podcastDescription = '';
    course.podcastDuration = null;
  }
  return course;
}

module.exports = { buildCourseModules, isNonEmpty, applyCourseTemplateExtensions };
