const { applyCourseTemplateExtensions } = require('../../utils/course-modules');

describe('course template extension capabilities', () => {
  test('hides disabled closing video and podcast resources', () => {
    const course = {
      courseTemplateSnapshot: { extensions: { duration: true, closingVideo: false, podcast: false } },
      closingVideo: { url: '/video.mp4' },
      closingVideoUrl: '/video.mp4',
      closingVideoCoverUrl: '/cover.jpg',
      podcastUrl: '/podcast.mp3',
      podcastDescription: '说明',
      podcastDuration: 120
    };
    expect(applyCourseTemplateExtensions(course)).toMatchObject({
      closingVideo: null,
      closingVideoUrl: '',
      closingVideoCoverUrl: '',
      podcastUrl: '',
      podcastDescription: '',
      podcastDuration: null
    });
  });

  test('keeps all legacy resources when the snapshot has no extension config', () => {
    const course = { closingVideo: { url: '/video.mp4' }, podcastUrl: '/podcast.mp3' };
    expect(applyCourseTemplateExtensions(course)).toEqual(course);
  });
});
