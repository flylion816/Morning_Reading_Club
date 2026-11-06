import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const source = readFileSync(resolve(__dirname, '../EnrollmentTemplatesView.vue'), 'utf8');

describe('EnrollmentTemplatesView', () => {
  it('exposes the template lifecycle and rule copy', () => {
    expect(source).toContain('新建模板');
    expect(source).toContain('编辑');
    expect(source).toContain('复制');
    expect(source).toContain('停用');
    expect(source).toContain('已绑定期次保留创建时的快照');
    expect(source).toContain('手机预览');
  });
});
