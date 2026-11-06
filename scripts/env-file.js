'use strict';

/** Shared dotenv/Compose-safe value encoding. Unsupported secrets fail before a file is written. */
function line(name, value) {
  const normalized = String(value);
  if (/[\r\n'\\]/.test(normalized)) {
    throw new Error(`${name} contains a single quote, backslash, or newline that cannot be represented safely in both dotenv and Compose files`);
  }
  return `${name}='${normalized}'`;
}

function composeLine(name, value) {
  if (String(value).includes('$')) {
    throw new Error(`${name} contains a dollar sign that Docker Compose would interpolate; use a generated URL-safe secret`);
  }
  return line(name, value);
}

module.exports = { line, composeLine };
