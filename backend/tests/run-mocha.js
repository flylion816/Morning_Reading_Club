#!/usr/bin/env node

const path = require('path');
const fs = require('fs');
const glob = require('glob');
const Mocha = require('mocha');

const DEFAULT_PATTERN = 'tests/**/*.test.js';
const MOCHA_CONFIG_PATH = path.resolve(process.cwd(), '.mocharc.json');
const BOOLEAN_OPTIONS = new Set([
  'allow-uncaught',
  'async-only',
  'bail',
  'check-leaks',
  'color',
  'colors',
  'delay',
  'diff',
  'dry-run',
  'exit',
  'fail-zero',
  'forbid-only',
  'forbid-pending',
  'full-trace',
  'global',
  'inline-diffs',
  'invert',
  'no-color',
  'no-colors',
  'no-diff',
  'no-timeouts',
  'pass-on-failing-test-suite',
  'recursive',
  'sort'
]);
const VALUE_OPTIONS = new Set([
  'fgrep',
  'globals',
  'grep',
  'jobs',
  'retries',
  'reporter',
  'slow',
  'timeout',
  'ui'
]);
const OPTION_ALIASES = {
  A: 'async-only',
  b: 'bail',
  c: 'color',
  C: 'no-color',
  f: 'fgrep',
  g: 'grep',
  R: 'reporter',
  r: 'require',
  s: 'slow',
  t: 'timeout',
  u: 'ui'
};

function loadConfig() {
  if (!fs.existsSync(MOCHA_CONFIG_PATH)) {
    return {};
  }

  return JSON.parse(fs.readFileSync(MOCHA_CONFIG_PATH, 'utf8'));
}

function resolveFiles(patterns) {
  const files = new Set();

  for (const pattern of patterns) {
    const matches = glob.hasMagic(pattern)
      ? glob.sync(pattern, { nodir: true })
      : [pattern];

    for (const match of matches) {
      files.add(path.resolve(process.cwd(), match));
    }
  }

  return Array.from(files).sort();
}

function camelCase(option) {
  return option.replace(/-([a-z])/g, (_, char) => char.toUpperCase());
}

function normalizeOption(rawOption) {
  const trimmed = rawOption.replace(/^-+/, '');
  return OPTION_ALIASES[trimmed] || trimmed;
}

function setMochaOption(options, option, value = true) {
  if (option === 'no-color' || option === 'no-colors') {
    options.color = false;
    return;
  }
  if (option === 'no-diff') {
    options.diff = false;
    return;
  }
  if (option === 'no-timeouts') {
    options.timeout = 0;
    return;
  }
  if (option === 'colors') {
    options.color = true;
    return;
  }

  options[camelCase(option)] = value;
}

function coerceOptionValue(option, value) {
  if (['jobs', 'retries', 'slow', 'timeout'].includes(option)) {
    return Number(value);
  }
  return value;
}

function parseArgs(argv) {
  const patterns = [];
  const mochaOptions = {};

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === '--') {
      patterns.push(...argv.slice(index + 1));
      break;
    }

    if (!arg.startsWith('-') || arg === '-') {
      patterns.push(arg);
      continue;
    }

    const equalsIndex = arg.indexOf('=');
    const rawOption = equalsIndex === -1 ? arg : arg.slice(0, equalsIndex);
    const option = normalizeOption(rawOption);

    if (VALUE_OPTIONS.has(option)) {
      const rawValue = equalsIndex === -1 ? argv[index + 1] : arg.slice(equalsIndex + 1);
      if (rawValue === undefined) {
        throw new Error(`Missing value for Mocha option ${rawOption}`);
      }
      if (equalsIndex === -1) {
        index += 1;
      }
      setMochaOption(mochaOptions, option, coerceOptionValue(option, rawValue));
      continue;
    }

    if (BOOLEAN_OPTIONS.has(option)) {
      setMochaOption(mochaOptions, option, true);
      continue;
    }

    throw new Error(`Unsupported Mocha option: ${rawOption}`);
  }

  return { patterns, mochaOptions };
}

async function main() {
  const { patterns, mochaOptions } = parseArgs(process.argv.slice(2));
  const config = loadConfig();

  if (config.env && typeof config.env === 'object') {
    for (const [key, value] of Object.entries(config.env)) {
      process.env[key] = String(value);
    }
  }

  const requiredModules = [];
  if (process.env.SKIP_MOCHA_REQUIRE !== '1') {
    for (const requiredFile of config.require || []) {
      const requiredModule = require(path.resolve(process.cwd(), requiredFile));
      requiredModules.push(requiredModule);
      if (requiredModule && requiredModule.setupPromise) {
        await requiredModule.setupPromise;
      }
    }
  }

  const configuredSpec = Array.isArray(config.spec) && config.spec.length > 0
    ? config.spec
    : [DEFAULT_PATTERN];
  const files = resolveFiles(patterns.length > 0 ? patterns : configuredSpec);

  if (files.length === 0) {
    console.error(`No test files matched: ${(patterns.length > 0 ? patterns : [DEFAULT_PATTERN]).join(', ')}`);
    process.exit(1);
  }

  const mocha = new Mocha({
    timeout: Number(process.env.MOCHA_TIMEOUT || config.timeout || 10000),
    ...mochaOptions
  });

  for (const file of files) {
    mocha.addFile(file);
  }

  mocha.run(async failures => {
    for (const requiredModule of requiredModules.reverse()) {
      if (requiredModule && typeof requiredModule.cleanupMongoMemoryServer === 'function') {
        await requiredModule.cleanupMongoMemoryServer();
      }
    }
    process.exitCode = failures ? 1 : 0;
  });
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
