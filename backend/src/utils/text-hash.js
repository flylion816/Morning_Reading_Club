/* eslint-disable no-bitwise */
/**
 * 文本规范化与哈希（摘抄本用）。
 * 小程序端 miniprogram/utils/text-hash.js 必须与本文件保持逐字一致的算法。
 * 规范化：去掉首尾空白、把连续空白合并为一个空格；哈希：对 UTF-16 码元做 FNV-1a 32 位，输出 8 位小写 16 进制。
 */
function normalizeText(text) {
  if (typeof text !== 'string') return '';
  return text.replace(/\s+/g, ' ').trim();
}

function hashText(text) {
  const normalized = normalizeText(text);
  let hash = 0x811c9dc5;
  for (let i = 0; i < normalized.length; i += 1) {
    hash ^= normalized.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, '0');
}

module.exports = { normalizeText, hashText };
