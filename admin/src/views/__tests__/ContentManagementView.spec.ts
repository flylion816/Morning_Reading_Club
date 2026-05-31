import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const source = readFileSync(
  resolve(__dirname, '../ContentManagementView.vue'),
  'utf8'
);

describe('ContentManagementView closing video support', () => {
  it('renders closing video upload controls', () => {
    expect(source).toContain('结营视频');
    expect(source).toContain('triggerClosingVideoInput');
    expect(source).toContain('handleClosingVideoChange');
    expect(source).toContain('accept="video/mp4,video/quicktime,video/webm,video/*"');
  });

  it('persists closingVideo in section form payload', () => {
    expect(source).toContain('closingVideo?:');
    expect(source).toContain('closingVideo: section.closingVideo ?? null');
    expect(source).toContain('closingVideo: normalized.closingVideo');
    expect(source).toContain('uploadApi.uploadClosingVideo(file)');
  });
});
