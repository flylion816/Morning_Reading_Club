/**
 * 文本格式化工具 - 将纯文本转换为rich-text节点格式
 */

/**
 * 将纯文本转换为HTML格式
 * @param {string} text - 纯文本内容（可能包含\n换行符）
 * @returns {string} HTML格式的字符串
 */
function textToHtml(text) {
  if (!text) return '';

  // 1. 转义HTML特殊字符
  const escaped = escapeHtml(text);

  // 2. 将换行符转换为<br>标签
  const withLineBreaks = escaped.replace(/\n/g, '<br/>');

  // 3. 检测段落（通过两个或更多连续换行）并用<p>标签包装
  const withParagraphs = withLineBreaks
    .split(/<br\/><br\/>/g)
    .map(paragraph => `<p>${paragraph.replace(/<br\/>/g, '<br/>')}</p>`)
    .join('');

  return withParagraphs;
}

/**
 * 转义HTML特殊字符
 * @param {string} text - 原始文本
 * @returns {string} 转义后的文本
 */
function escapeHtml(text) {
  const map = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  };
  return text.replace(/[&<>"']/g, char => map[char]);
}

module.exports = {
  textToHtml,
  escapeHtml
};
