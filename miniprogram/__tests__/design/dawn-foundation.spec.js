const fs = require('fs');
const path = require('path');

const ROOT = path.join(process.cwd(), 'miniprogram');
const read = file => fs.readFileSync(path.join(ROOT, file), 'utf8');

function collect(dir, ext, out = []) {
  fs.readdirSync(dir, { withFileTypes: true }).forEach(entry => {
    if (['node_modules', '__tests__', 'miniprogram_npm'].includes(entry.name)) return;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) collect(full, ext, out);
    else if (entry.name.endsWith(ext)) out.push(full);
  });
  return out;
}

describe('miniprogram dawn foundation', () => {
  const appStyles = read('app.wxss');

  test('neutral tokens are warm paper and warm ink', () => {
    expect(appStyles).toContain('--app-page-bg: #f6f1e7;');
    expect(appStyles).toContain('--app-paper: #fffdf8;');
    expect(appStyles).toContain('--app-text: #2b2622;');
    expect(appStyles).toContain('--app-text-muted: #776c5f;');
  });

  test('dawn accent and type tokens are shared by every tenant', () => {
    ['--app-dawn: #ee9b45;', '--app-dawn-soft: #fdf0dc;', '--app-dawn-ink: #8a4b12;', '--app-font-serif:', '--app-font-num:'].forEach(token => {
      expect(appStyles).toContain(token);
    });
    // 晨光色与租户无关：生成租户主题的脚本不应产出它
    expect(read('scripts/apply-tenant.js')).not.toContain('--app-dawn');
  });

  test('seal and line-icon primitives exist', () => {
    expect(appStyles).toContain('.app-seal {');
    expect(appStyles).toContain('.app-seal-dawn {');
    expect(appStyles).toContain('.app-icon {');
    expect(appStyles).toContain('-webkit-mask-image');
  });

  test('components define the shared classes they use (app.wxss does not reach into custom components)', () => {
    const componentsDir = path.join(ROOT, 'components');
    const problems = [];
    collect(componentsDir, '.wxml').forEach(file => {
      const markup = fs.readFileSync(file, 'utf8');
      const stylesFile = file.replace(/\.wxml$/, '.wxss');
      const styles = fs.existsSync(stylesFile) ? fs.readFileSync(stylesFile, 'utf8') : '';
      const used = new Set();
      (markup.match(/class="[^"]*"/g) || []).forEach(attr => {
        (attr.match(/app-(?:icon|seal|empty|skeleton|btn|chip|card)[a-z0-9-]*/g) || []).forEach(name => used.add(name));
      });
      used.forEach(name => {
        if (!styles.includes(`.${name}`)) problems.push(`${path.relative(ROOT, file)} uses .${name}`);
      });
    });
    expect(problems).toEqual([]);
  });

  test('status bar text matches the top color of custom-navigation pages', () => {
    const json = file => JSON.parse(read(file));
    // 顶部是租户主色或深色的自定义导航页用白字，顶部是纸色的用黑字
    expect(json('pages/login/login.json').navigationBarTextStyle).toBe('white');
    expect(json('pages/courses/courses.json').navigationBarTextStyle).toBe('black');
    expect(json('pages/checkin/checkin.json').navigationBarTextStyle).toBe('black');
    expect(json('pages/reading-mode/reading-mode.json').navigationBarTextStyle).toBe('black');
  });

  test('no page or component keeps the cool green-tinted neutrals', () => {
    const offenders = collect(ROOT, '.wxss').filter(file =>
      /rgba\((49,\s*72,\s*56|37,\s*60,\s*43)/.test(fs.readFileSync(file, 'utf8'))
    );
    expect(offenders.map(file => path.relative(ROOT, file))).toEqual([]);
  });
});
