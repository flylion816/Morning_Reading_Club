#!/usr/bin/env node

const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const EXCLUDED_PARTS = new Set([
  'node_modules',
  'coverage',
  'dist',
  'exports',
  'output',
  'graphify-out',
  '__pycache__'
]);
const EXCLUDED_SUFFIXES = new Set([
  '.lock',
  '.log',
  '.png',
  '.jpg',
  '.jpeg',
  '.gif',
  '.webp',
  '.mp4',
  '.mov',
  '.wav',
  '.mp3',
  '.zip',
  '.gz',
  '.pdf',
  '.docx',
  '.xlsx',
  '.pptx'
]);

const CHECKS = [
  {
    name: 'private-key',
    pattern: /-----BEGIN (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----/
  },
  {
    name: 'aws-access-key',
    pattern: /\bAKIA[0-9A-Z]{16}\b/
  },
  {
    name: 'credential-url',
    pattern: /\b(?:mongodb(?:\+srv)?|mysql|postgres(?:ql)?|redis):\/\/[^\s:@/'"]+:([^\s@'"]+)@/i,
    isSafe: value => /^(?:CHANGE_ME|test|test-password|<[^>]+>|\$\{[^}]+\})$/i.test(value)
  },
  {
    name: 'hardcoded-secret',
    pattern: /\b(?:api[_-]?key|app[_-]?secret|secret[_-]?key|access[_-]?token|refresh[_-]?token|password|passwd|pwd)\s*[:=]\s*['"]([^'"]{12,})['"]/i,
    isSafe: value => /(?:test|sample|example|placeholder|mock|dummy|change_?me|your[_-]|<[^>]+>|\$\{|jwt token|refresh token|刷新token|hashed_password|refreshtoken)/i.test(value)
  }
];

function trackedFiles() {
  const output = execFileSync(
    'git',
    ['ls-files', '--cached', '--others', '--exclude-standard', '-z'],
    { cwd: ROOT, maxBuffer: 64 * 1024 * 1024 }
  );
  return output.toString('utf8').split('\0').filter(Boolean);
}

function isScannable(relativePath) {
  const parts = path.posix.normalize(relativePath).split('/');
  if (parts.some(part => EXCLUDED_PARTS.has(part))) return false;
  if (EXCLUDED_SUFFIXES.has(path.extname(relativePath).toLowerCase())) return false;
  if (relativePath.startsWith('backend/tests/') || relativePath.includes('/__tests__/')) return false;
  const fullPath = path.join(ROOT, relativePath);
  return fs.existsSync(fullPath) && fs.statSync(fullPath).isFile();
}

const findings = [];
for (const relativePath of trackedFiles().filter(isScannable)) {
  const fullPath = path.join(ROOT, relativePath);
  if (fs.statSync(fullPath).size > 2 * 1024 * 1024) continue;

  const lines = fs.readFileSync(fullPath, 'utf8').split(/\r?\n/);
  lines.forEach((line, index) => {
    for (const check of CHECKS) {
      const match = line.match(check.pattern);
      if (match && (!check.isSafe || !check.isSafe(match[1] || ''))) {
        findings.push(`${check.name}\t${relativePath}:${index + 1}`);
        break;
      }
    }
  });
}

if (findings.length) {
  console.error(`Secret scan failed (${findings.length} finding(s)); values are not printed.`);
  findings.forEach(finding => console.error(finding));
  process.exit(1);
}

console.log('Secret scan passed.');
