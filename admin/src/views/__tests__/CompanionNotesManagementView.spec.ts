import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const source = readFileSync(resolve(__dirname, '../CompanionNotesManagementView.vue'), 'utf8');

// 这些测试锁住管理页最容易被误删的行为边界；具体网络请求由后台 API 集成测试覆盖。
describe('CompanionNotesManagementView', () => {
  it('keeps PDF rendering lazy and renders 1080px JPEG pages', () => {
    expect(source).toContain("import(/* @vite-ignore */ pdfjsModuleUrl)");
    expect(source).toContain("new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url)");
    expect(source).toContain('1080 / baseViewport.width');
    expect(source).toContain("'image/jpeg', quality");
  });

  it('validates period and section linkage before saving', () => {
    expect(source).toContain('function validateSectionLinkage');
    expect(source).toContain('选了课次就必须先选择期次');
    expect(source).toContain('所选课次不属于当前期次，请重新选择');
  });

  it('supports page-level retry and moderation actions', () => {
    expect(source).toContain('function retryPage');
    expect(source).toContain('部分页图上传失败');
    expect(source).toContain('function togglePinned');
    expect(source).toContain('function toggleHidden');
    expect(source).toContain('function deleteReply');
  });

  it('keeps the large-file reminder and draft/publish actions visible', () => {
    expect(source).toContain('超过 20 MB');
    expect(source).toContain("saveNote('draft')");
    expect(source).toContain("saveNote('published')");
    expect(source).toContain('页图不完整');
  });
});
