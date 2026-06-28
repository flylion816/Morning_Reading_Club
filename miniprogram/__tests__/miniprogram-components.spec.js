const fs = require('fs');
const path = require('path');

const miniprogramRoot = path.resolve(__dirname, '..');
const builtInHyphenTags = new Set([
  'ad-custom',
  'camera',
  'channel-live',
  'channel-video',
  'cover-image',
  'cover-view',
  'editor',
  'functional-page-navigator',
  'live-player',
  'live-pusher',
  'match-media',
  'movable-area',
  'movable-view',
  'native-component',
  'official-account',
  'open-data',
  'page-container',
  'radio-group',
  'rich-text',
  'scroll-view',
  'share-element',
  'swiper-item',
  'voip-room',
  'web-view'
]);

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(miniprogramRoot, relativePath), 'utf8'));
}

function walkFiles(dir, matcher, result = []) {
  fs.readdirSync(dir, { withFileTypes: true }).forEach((entry) => {
    if (['.omc', '__tests__', 'e2e', 'scripts'].includes(entry.name)) return;
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walkFiles(fullPath, matcher, result);
    } else if (matcher(fullPath)) {
      result.push(fullPath);
    }
  });
  return result;
}

function normalizeComponentPath(componentPath) {
  return componentPath.startsWith('/')
    ? componentPath.slice(1)
    : componentPath;
}

function expectComponentFilesExist(componentPath, owner) {
  const normalizedPath = normalizeComponentPath(componentPath);
  ['.json', '.js', '.wxml', '.wxss'].forEach((ext) => {
    const filePath = path.join(miniprogramRoot, `${normalizedPath}${ext}`);
    expect(fs.existsSync(filePath)).toBe(true);
  });

  const componentJson = readJson(`${normalizedPath}.json`);
  expect(componentJson.component).toBe(true);
  expect(owner).toBeTruthy();
}

describe('miniprogram component wiring', () => {
  test('declared app and page components resolve to real component files', () => {
    const appJson = readJson('app.json');
    const pageJsonFiles = walkFiles(
      path.join(miniprogramRoot, 'pages'),
      (filePath) => filePath.endsWith('.json')
    );
    const declarations = [
      ...Object.entries(appJson.usingComponents || {}).map(([name, componentPath]) => ({
        owner: 'app.json',
        name,
        componentPath
      })),
      ...pageJsonFiles.flatMap((filePath) => {
        const relativePath = path.relative(miniprogramRoot, filePath);
        const json = readJson(relativePath);
        return Object.entries(json.usingComponents || {}).map(([name, componentPath]) => ({
          owner: relativePath,
          name,
          componentPath
        }));
      })
    ];

    declarations.forEach(({ owner, name, componentPath }) => {
      expect(name).toMatch(/^[a-z][a-z0-9-]*$/);
      expectComponentFilesExist(componentPath, owner);
    });
  });

  test('business custom tags in page wxml are declared globally or by the page', () => {
    const appJson = readJson('app.json');
    const globalComponents = appJson.usingComponents || {};
    const pageWxmlFiles = walkFiles(
      path.join(miniprogramRoot, 'pages'),
      (filePath) => filePath.endsWith('.wxml')
    );

    pageWxmlFiles.forEach((filePath) => {
      const relativePath = path.relative(miniprogramRoot, filePath);
      const pageJsonPath = relativePath.replace(/\.wxml$/, '.json');
      const pageJson = fs.existsSync(path.join(miniprogramRoot, pageJsonPath))
        ? readJson(pageJsonPath)
        : {};
      const pageComponents = pageJson.usingComponents || {};
      const availableComponents = { ...globalComponents, ...pageComponents };
      const content = fs.readFileSync(filePath, 'utf8');

      Array.from(content.matchAll(/<\s*([a-z][\w-]*)\b/g)).forEach((match) => {
        const tagName = match[1];
        if (!tagName.includes('-') || builtInHyphenTags.has(tagName)) return;
        expect(availableComponents[tagName]).toBeTruthy();
        expectComponentFilesExist(availableComponents[tagName], relativePath);
      });
    });
  });
});
