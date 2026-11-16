const crypto = require('crypto');

// 8 位小写字母和数字，不含容易看错的符号（i l o 0 1），可以直接放进小程序码的 scene
// 31 个字符对 256 不整除：偏大的字节取模会让前几个字母概率略高，用拒绝采样保持均匀
const ALPHABET = 'abcdefghjkmnpqrstuvwxyz23456789';
const ALPHABET_MASK = 255 - (256 % ALPHABET.length);

function randomIndex() {
  // >= 248 的字节丢弃重取，让每个字符等概率
  let byte;
  do {
    byte = crypto.randomBytes(1)[0];
  } while (byte > ALPHABET_MASK);
  return byte % ALPHABET.length;
}

function generateShareCode() {
  return Array.from({ length: 8 }, randomIndex)
    .map(index => ALPHABET[index])
    .join('');
}

const SHARE_CODE_PATTERN = /^[a-z0-9]{8}$/;

module.exports = { generateShareCode, SHARE_CODE_PATTERN };
