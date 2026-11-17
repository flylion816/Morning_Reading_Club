const fs = require('fs');
const path = require('path');

const miniprogramRoot = path.resolve(__dirname, '../..');
const appJson = JSON.parse(
  fs.readFileSync(path.join(miniprogramRoot, 'app.json'), 'utf8')
);

const expectedSubPackages = [
  {
    name: 'zaichang',
    root: 'pages/zaichang',
    pages: ['list/list', 'detail/detail', 'publish/publish']
  },
  {
    name: 'admin-analytics',
    root: 'pages/admin-analytics',
    pages: ['admin-analytics']
  },
  {
    name: 'admin-workbench',
    root: 'pages/admin-workbench',
    pages: [
      'admin-workbench',
      'activity-registrations/activity-registrations'
    ]
  },
  {
    name: 'admin-section-insights',
    root: 'pages/admin-section-insights',
    pages: ['admin-section-insights']
  },
  {
    name: 'community-activity-detail',
    root: 'pages/community-activity-detail',
    pages: ['community-activity-detail']
  },
  {
    name: 'my-community-activities',
    root: 'pages/my-community-activities',
    pages: ['my-community-activities']
  },
  {
    name: 'activities',
    root: 'pages/activities',
    pages: ['activities']
  },
  {
    name: 'my-coupons',
    root: 'pages/my-coupons',
    pages: ['my-coupons']
  },
  {
    name: 'insight-detail',
    root: 'pages/insight-detail',
    pages: ['insight-detail']
  },
  {
    name: 'course-detail',
    root: 'pages/course-detail',
    pages: ['course-detail']
  },
  {
    name: 'reading-mode',
    root: 'pages/reading-mode',
    pages: ['reading-mode']
  },
  {
    name: 'insights',
    root: 'pages/insights',
    pages: ['insights']
  },
  {
    name: 'insight-edit',
    root: 'pages/insight-edit',
    pages: ['insight-edit']
  },
  {
    name: 'enrollment',
    root: 'pages/enrollment',
    pages: ['enrollment']
  },
  {
    name: 'payment',
    root: 'pages/payment',
    pages: ['payment']
  },
  {
    name: 'invite',
    root: 'pages/invite',
    pages: ['invite']
  },
  {
    name: 'notifications',
    root: 'pages/notifications',
    pages: ['notifications']
  },
  {
    name: 'notification-settings',
    root: 'pages/notification-settings',
    pages: ['notification-settings']
  },
  {
    name: 'completion-reports',
    root: 'pages/completion-reports',
    pages: ['completion-reports']
  },
  {
    name: 'completion-report-detail',
    root: 'pages/completion-report-detail',
    pages: ['completion-report-detail']
  },
  {
    name: 'checkin-records',
    root: 'pages/checkin-records',
    pages: ['checkin-records']
  },
  {
    name: 'profile-others',
    root: 'pages/profile-others',
    pages: ['profile-others']
  },
  {
    name: 'ranking',
    root: 'pages/ranking',
    pages: ['ranking']
  },
  {
    name: 'members',
    root: 'pages/members',
    pages: ['members']
  },
  {
    name: 'slow-mail',
    root: 'pages/slow-mail',
    pages: ['slow-mail']
  },
  {
    name: 'keepsake',
    root: 'pages/keepsake',
    pages: ['keepsake']
  },
  {
    name: 'highlights',
    root: 'pages/highlights',
    pages: ['highlights']
  },
  {
    name: 'joy-notes',
    root: 'pages/joy-notes',
    pages: ['joy-notes', 'awareness/awareness', 'detail/detail', 'shared/shared']
  },
  {
    name: 'seen-received',
    root: 'pages/seen-received',
    pages: ['seen-received']
  },
  {
    name: 'companion-notes',
    root: 'pages/companion-notes',
    pages: ['list/list', 'detail/detail']
  },
  {
    name: 'practice',
    root: 'pages/practice',
    pages: ['practice']
  },
  {
    name: 'buddy',
    root: 'pages/buddy',
    pages: ['buddy']
  },
  {
    name: 'daily-card',
    root: 'pages/daily-card',
    pages: ['daily-card']
  },
  {
    name: 'landing',
    root: 'pages/landing',
    pages: ['landing']
  },
  {
    name: 'admin-leads',
    root: 'pages/admin-leads',
    pages: ['admin-leads', 'detail/detail']
  }
];

describe('miniprogram package structure', () => {
  test('keeps tab and core learning pages in the main package', () => {
    expect(appJson.pages).toEqual(expect.arrayContaining([
      'pages/index/index',
      'pages/periods/periods',
      'pages/profile/profile',
      'pages/checkin/checkin'
    ]));
  });

  test('does not declare duplicate main package routes', () => {
    expect(new Set(appJson.pages).size).toBe(appJson.pages.length);
  });

  test('keeps subpackage-only admin services out of the main services directory', () => {
    expect(fs.existsSync(
      path.join(miniprogramRoot, 'services/adminAnalytics.service.js')
    )).toBe(false);
    expect(fs.existsSync(
      path.join(miniprogramRoot, 'services/adminWorkbench.service.js')
    )).toBe(false);
    expect(fs.existsSync(
      path.join(miniprogramRoot, 'pages/admin-analytics/adminAnalytics.service.js')
    )).toBe(true);
    expect(fs.existsSync(
      path.join(miniprogramRoot, 'pages/admin-workbench/adminWorkbench.service.js')
    )).toBe(true);
    expect(fs.existsSync(
      path.join(miniprogramRoot, 'services/danmaku.service.js')
    )).toBe(false);
    expect(fs.existsSync(
      path.join(miniprogramRoot, 'pages/insight-detail/danmaku.service.js')
    )).toBe(true);
    expect(fs.existsSync(
      path.join(miniprogramRoot, 'services/ranking.service.js')
    )).toBe(false);
    expect(fs.existsSync(
      path.join(miniprogramRoot, 'pages/ranking/ranking.service.js')
    )).toBe(true);
    expect(fs.existsSync(
      path.join(miniprogramRoot, 'services/payment.service.js')
    )).toBe(false);
    expect(fs.existsSync(
      path.join(miniprogramRoot, 'pages/payment/payment.service.js')
    )).toBe(true);
    expect(fs.existsSync(
      path.join(miniprogramRoot, 'pages/community-activity-detail/payment-confirmation.service.js')
    )).toBe(true);
    expect(fs.existsSync(
      path.join(miniprogramRoot, 'services/websocket.service.js')
    )).toBe(false);
    expect(fs.existsSync(
      path.join(miniprogramRoot, 'pages/notifications/websocket.service.js')
    )).toBe(true);
    expect(fs.existsSync(
      path.join(miniprogramRoot, 'components/notification-badge')
    )).toBe(false);
  });

  test('keeps subpackage-only helpers out of the main utils directory', () => {
    const subpackageOnlyHelpers = [
      'pages/course-detail/buddy-marks.js',
      'pages/notifications/notification-feed.js',
      'pages/landing/silent-login.js'
    ];

    subpackageOnlyHelpers.forEach(relativePath => {
      expect(fs.existsSync(path.join(miniprogramRoot, relativePath))).toBe(true);
    });
    expect(fs.existsSync(path.join(miniprogramRoot, 'utils/buddy-marks.js'))).toBe(false);
    expect(fs.existsSync(path.join(miniprogramRoot, 'utils/notification-feed.js'))).toBe(false);
    expect(fs.existsSync(path.join(miniprogramRoot, 'utils/silent-login.js'))).toBe(false);
  });

  test('keeps daily-card helpers inside the subpackages that use them', () => {
    // 日签分享码、封面只有 daily-card 和 landing 两个分包在用：各放各的分包，主包不留只给分包用的文件
    ['services/daily-card-share.service.js', 'utils/daily-card-cover.js'].forEach(relativePath => {
      expect(fs.existsSync(path.join(miniprogramRoot, relativePath))).toBe(false);
    });
    [
      'pages/daily-card/daily-card-share.service.js',
      'pages/daily-card/daily-card-cover.js',
      'pages/landing/daily-card-share.service.js',
      'pages/landing/daily-card-cover.js'
    ].forEach(relativePath => {
      expect(fs.existsSync(path.join(miniprogramRoot, relativePath))).toBe(true);
    });
    // 分包之间不能互相引用，封面只好两边各放一份，内容必须一致
    const read = relativePath => fs.readFileSync(path.join(miniprogramRoot, relativePath), 'utf8');
    expect(read('pages/landing/daily-card-cover.js')).toBe(read('pages/daily-card/daily-card-cover.js'));
  });

  test('keeps bundled images and audio within the 200K code-quality budget', () => {
    // 开发者工具「代码质量」：代码包里的图片和音频合计不超过 200K。按 project.config.json 的 packOptions.ignore 过滤后统计
    const projectRoot = path.resolve(miniprogramRoot, '..');
    const projectConfig = JSON.parse(fs.readFileSync(path.join(projectRoot, 'project.config.json'), 'utf8'));
    const ignores = ((projectConfig.packOptions && projectConfig.packOptions.ignore) || []).map(item => ({
      type: item.type,
      value: String(item.value).replace(/^\/+|\/+$/g, '')
    }));
    const isIgnored = relativePath =>
      ignores.some(item =>
        item.type === 'folder'
          ? relativePath === item.value || relativePath.startsWith(`${item.value}/`)
          : relativePath === item.value
      );
    const mediaPattern = /\.(png|jpe?g|gif|webp|svg|mp3|m4a|aac|wav)$/i;
    const skipDirs = new Set(['node_modules', 'miniprogram_npm', '__tests__']);
    const files = [];
    const walk = dir => {
      fs.readdirSync(dir, { withFileTypes: true }).forEach(entry => {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          if (!skipDirs.has(entry.name)) walk(full);
        } else if (mediaPattern.test(entry.name)) {
          const relativePath = path.relative(projectRoot, full).split(path.sep).join('/');
          if (!isIgnored(relativePath)) files.push({ relativePath, size: fs.statSync(full).size });
        }
      });
    };
    walk(miniprogramRoot);

    const total = files.reduce((sum, file) => sum + file.size, 0);
    const budget = 200 * 1024;
    if (total > budget) {
      const biggest = files
        .sort((a, b) => b.size - a.size)
        .slice(0, 5)
        .map(file => `${file.relativePath}（${(file.size / 1024).toFixed(1)}K）`);
      throw new Error(
        `代码包里的图片和音频合计 ${(total / 1024).toFixed(1)}K，超过 200K。最大的几个：${biggest.join('、')}。先压缩，或者用 packOptions.ignore 排除不用的。`
      );
    }
    expect(total).toBeLessThanOrEqual(budget);
  });

  test('declares low-frequency pages in their owning subpackages', () => {
    expect(appJson.subPackages).toEqual(expectedSubPackages);

    expectedSubPackages.forEach(subPackage => {
      subPackage.pages.forEach(page => {
        const route = path.posix.join(subPackage.root, page);
        expect(appJson.pages).not.toContain(route);
        expect(fs.existsSync(path.join(miniprogramRoot, `${route}.js`))).toBe(true);
        expect(fs.existsSync(path.join(miniprogramRoot, `${route}.wxml`))).toBe(true);
      });
    });
  });
});
