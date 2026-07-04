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
});
