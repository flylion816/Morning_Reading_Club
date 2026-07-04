import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const source = readFileSync(resolve(__dirname, '../HomeConfigView.vue'), 'utf8');

describe('HomeConfigView', () => {
  it('supports showing and hiding homepage sections', () => {
    expect(source).toContain('label="状态"');
    expect(source).toContain("row.hidden ? '已隐藏' : '显示中'");
    expect(source).toContain("row.hidden ? '显示' : '隐藏'");
    expect(source).toContain('toggleSection(row.key)');
    expect(source).toContain('hidden: item.hidden');
  });

  it('saves immediately after a section visibility toggle', () => {
    expect(source).toContain('async function toggleSection');
    expect(source).toContain('await saveConfig({ silent: true })');
    expect(source).toContain("ElMessage.success(nextHidden ? '板块已隐藏' : '板块已显示')");
  });
});
