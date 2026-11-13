const fs = require('fs');
const path = require('path');

const workspaceRoot = path.resolve(__dirname, '../..', '..');

function collectFiles(root, extensions) {
  const files = [];
  if (!fs.existsSync(root)) return files;
  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === '__tests__') continue;
    const fullPath = path.join(root, entry.name);
    if (entry.isDirectory()) {
      files.push(...collectFiles(fullPath, extensions));
    } else if (extensions.some(ext => entry.name.endsWith(ext))) {
      files.push(fullPath);
    }
  }
  return files;
}

describe('Avatar source contract', () => {
  test('frontends do not use a user avatar emoji/text as an image URL fallback', () => {
    const files = [
      ...collectFiles(path.join(workspaceRoot, 'miniprogram'), ['.js', '.wxml']),
      ...collectFiles(path.join(workspaceRoot, 'admin', 'src'), ['.ts', '.vue'])
    ];
    const violations = [];
    const mixedSourcePattern = /avatarUrl\s*\|\|\s*[^\n,;}]*\bavatar\b/;

    files.forEach(file => {
      const source = fs.readFileSync(file, 'utf8');
      if (mixedSourcePattern.test(source)) violations.push(path.relative(workspaceRoot, file));
    });

    expect(violations).toEqual([]);
  });
});
