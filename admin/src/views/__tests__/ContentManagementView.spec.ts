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

  it('generates a non-black closing video cover from multiple candidate frames', () => {
    expect(source).toContain('getVideoCoverCandidateTimes');
    expect(source).toContain('preferredTimes = [0.1, 0.5, 1, 2, 3, 5, 8, 12]');
    expect(source).toContain('isFrameLikelyBlack');
    expect(source).toContain('return fallbackCoverFile');
    expect(source).not.toContain('video.currentTime = Math.min(0.1');
  });

  it('allows regenerating a closing video cover without reuploading the video', () => {
    expect(source).toContain('重生成封面');
    expect(source).toContain('handleRegenerateClosingVideoCover');
    expect(source).toContain('resolveClosingVideoSourceUrl');
    expect(source).toContain('封面已重新生成，请保存课节');
  });
});
