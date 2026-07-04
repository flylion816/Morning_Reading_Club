#!/usr/bin/env node
/**
 * Initialize course periods and sections for one tenant only.
 *
 * This script is intentionally tenant-scoped and idempotent:
 * - finds Tenant by slug
 * - upserts Period by tenantId + name
 * - upserts Section by tenantId + periodId + day
 * - never deletes existing data
 *
 * Usage:
 *   NODE_ENV=production node backend/scripts/init-tenant-periods.js starry --execute
 *   node backend/scripts/init-tenant-periods.js starry --dry-run
 */

const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');

const envFile = process.env.NODE_ENV === 'production'
  ? path.join(__dirname, '../.env.production')
  : path.join(__dirname, '../.env');
require('dotenv').config({ path: envFile });

try {
  const envConfig = require(path.resolve(__dirname, '../../.env.config.js'));
  process.env.MONGODB_URI = process.env.MONGODB_URI || envConfig.config.backend.mongodbUri;
} catch (error) {
  // Optional local config.
}

const Tenant = require('../src/models/Tenant');
const Period = require('../src/models/Period');
const Section = require('../src/models/Section');
const { withSystemContext } = require('../src/utils/tenantContext');
const {
  calculatePeriodStatus
} = require('../src/services/period-status.service');

const SCRIPTS_DIR = __dirname;
const DEFAULT_MONGO_URL = 'mongodb://127.0.0.1:27017/morning_reading_db';

const TEMPLATE_PERIODS = [
  {
    name: '平衡之道',
    subtitle: '七个习惯晨读营',
    title: '平衡之道 - 七个习惯晨读营',
    description: '21天养成阅读习惯，培养品德成功论思维',
    icon: '⛰️',
    coverColor: 'linear-gradient(135deg, #448426 0%, #2f611b 100%)',
    coverEmoji: '⛰️',
    startDate: new Date('2026-07-10T00:00:00+08:00'),
    endDate: new Date('2026-08-01T23:59:59+08:00'),
    totalDays: 23,
    price: 9900,
    originalPrice: 19900,
    maxEnrollment: 100,
    sortOrder: 1,
    isPublished: true,
    enrollmentOpen: true,
    visibilityType: 'all'
  },
  {
    name: '勇敢的心',
    subtitle: '七个习惯晨读营',
    title: '勇敢的心 - 七个习惯晨读营',
    description: '21天养成阅读习惯，培养品德成功论思维',
    icon: '💪',
    coverColor: 'linear-gradient(135deg, #448426 0%, #5fa53a 100%)',
    coverEmoji: '💪',
    startDate: new Date('2026-06-01T00:00:00+08:00'),
    endDate: new Date('2026-06-23T23:59:59+08:00'),
    totalDays: 23,
    price: 9900,
    originalPrice: 19900,
    maxEnrollment: 100,
    sortOrder: 2,
    isPublished: true,
    enrollmentOpen: false,
    visibilityType: 'all'
  },
  {
    name: '能量之泉',
    subtitle: '七个习惯晨读营',
    title: '能量之泉 - 七个习惯晨读营',
    description: '探索内在能量，提升自我效能',
    icon: '🌊',
    coverColor: 'linear-gradient(135deg, #448426 0%, #7ab85c 100%)',
    coverEmoji: '🌊',
    startDate: new Date('2026-05-01T00:00:00+08:00'),
    endDate: new Date('2026-05-23T23:59:59+08:00'),
    totalDays: 23,
    price: 9900,
    originalPrice: 19900,
    maxEnrollment: 100,
    sortOrder: 3,
    isPublished: true,
    enrollmentOpen: false,
    visibilityType: 'all'
  },
  {
    name: '静心之镜',
    subtitle: '七个习惯晨读营',
    title: '静心之镜 - 七个习惯晨读营',
    description: '深层心灵成长之旅',
    icon: '🪞',
    coverColor: 'linear-gradient(135deg, #448426 0%, #94c77d 100%)',
    coverEmoji: '🪞',
    startDate: new Date('2026-04-01T00:00:00+08:00'),
    endDate: new Date('2026-04-23T23:59:59+08:00'),
    totalDays: 23,
    price: 9900,
    originalPrice: 19900,
    maxEnrollment: 100,
    sortOrder: 4,
    isPublished: true,
    enrollmentOpen: false,
    visibilityType: 'all'
  }
];

function parseArgs(argv) {
  const args = argv.slice(2);
  const options = {
    execute: false,
    dryRun: false,
    mongoUri: process.env.MONGODB_URI || null
  };
  const positionals = [];

  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === '--execute') {
      options.execute = true;
    } else if (arg === '--dry-run') {
      options.dryRun = true;
    } else if (arg === '--mongo-uri') {
      if (!args[i + 1]) throw new Error('--mongo-uri requires a value');
      options.mongoUri = args[i + 1];
      i += 1;
    } else if (arg.startsWith('--')) {
      throw new Error(`Unknown option: ${arg}`);
    } else {
      positionals.push(arg);
    }
  }

  if (!positionals[0]) {
    throw new Error('Usage: node backend/scripts/init-tenant-periods.js <tenant-slug> [--dry-run|--execute]');
  }
  if (options.execute && options.dryRun) {
    throw new Error('Use only one of --dry-run or --execute');
  }
  if (!options.execute && !options.dryRun) {
    options.dryRun = true;
  }
  if (!options.mongoUri && process.env.NODE_ENV !== 'production') {
    options.mongoUri = DEFAULT_MONGO_URL;
  }
  if (!options.mongoUri) {
    throw new Error('缺少 MongoDB 连接配置，请设置 MONGODB_URI 或传入 --mongo-uri');
  }

  return { slug: positionals[0], options };
}

function stripTenantUploadUrls(value) {
  if (typeof value !== 'string') return value || null;
  if (!value) return null;
  if (value.includes('/uploads/tenants/')) return null;
  return value;
}

function sanitizeHtmlContent(value) {
  if (!value) return '';
  return String(value)
    .replace(/<p[^>]*>\s*<img[^>]+src=["']https:\/\/wx\.shubai01\.com\/uploads\/tenants\/fanren\/[^"']+["'][^>]*>\s*<\/p>/g, '')
    .replace(/<img[^>]+src=["']https:\/\/wx\.shubai01\.com\/uploads\/tenants\/fanren\/[^"']+["'][^>]*>/g, '')
    .replace(/<p>\s*<\/p>/g, '');
}

function loadSectionTemplate(day) {
  const filepath = path.join(SCRIPTS_DIR, `day${day}-content.json`);
  if (!fs.existsSync(filepath)) {
    return {
      title: `第 ${day} 天`,
      subtitle: `Day ${day}`,
      icon: '📖',
      content: '<p>课程内容待配置</p>'
    };
  }

  const data = JSON.parse(fs.readFileSync(filepath, 'utf8'));
  return {
    title: data.title || `第 ${day} 天`,
    subtitle: data.subtitle || `Day ${day}`,
    icon: data.icon || '📖',
    meditation: data.meditation || null,
    question: data.question || null,
    content: sanitizeHtmlContent(data.content),
    description: data.description || '',
    reflection: data.reflection || null,
    action: data.action || null,
    learn: data.learn || null,
    extract: data.extract || null,
    say: data.say || null,
    audioUrl: stripTenantUploadUrls(data.audioUrl),
    lookImage: stripTenantUploadUrls(data.lookImage),
    podcastUrl: stripTenantUploadUrls(data.podcastUrl),
    podcastDescription: stripTenantUploadUrls(data.podcastUrl) ? data.podcastDescription || null : null,
    podcastDuration: stripTenantUploadUrls(data.podcastUrl) ? data.podcastDuration || null : null,
    videoCover: stripTenantUploadUrls(data.videoCover),
    duration: data.duration || null,
    sortOrder: day,
    order: data.order || 0,
    isPublished: data.isPublished !== false
  };
}

async function upsertPeriod(tenant, periodData, dryRun) {
  const tenantId = tenant._id;
  const existing = await withSystemContext(tenantId, () =>
    Period.findOne({ name: periodData.name }).exec()
  );

  const update = {
    ...periodData,
    status: calculatePeriodStatus(periodData),
    currentEnrollment: existing?.currentEnrollment || 0,
    enrollmentCount: existing?.enrollmentCount || 0,
    checkinCount: existing?.checkinCount || 0,
    totalCheckins: existing?.totalCheckins || 0,
    tenantId
  };

  if (dryRun) {
    return {
      period: existing || { _id: '(dry-run)', name: periodData.name },
      action: existing ? 'would-update' : 'would-create'
    };
  }

  const period = await withSystemContext(tenantId, () =>
    Period.findOneAndUpdate(
      { name: periodData.name },
      { $set: update },
      { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true }
    ).exec()
  );
  return { period, action: existing ? 'updated' : 'created' };
}

async function upsertMainSections(tenantId, period, dryRun) {
  const results = [];
  for (let day = 0; day <= 22; day += 1) {
    const sectionData = {
      ...loadSectionTemplate(day),
      periodId: period._id,
      tenantId,
      day,
      sortOrder: day
    };
    const existing = dryRun ? null : await withSystemContext(tenantId, () =>
      Section.findOne({ periodId: period._id, day }).exec()
    );

    if (dryRun) {
      results.push({ day, title: sectionData.title, action: 'would-upsert' });
      continue;
    }

    await withSystemContext(tenantId, () =>
      Section.findOneAndUpdate(
        { periodId: period._id, day },
        { $set: sectionData },
        { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true }
      ).exec()
    );
    results.push({ day, title: sectionData.title, action: existing ? 'updated' : 'created' });
  }
  return results;
}

async function ensurePlaceholderSections(tenantId, period, dryRun) {
  if (dryRun) {
    return Array.from({ length: 23 }, (_, day) => ({ day, title: `第 ${day} 天`, action: 'would-create-if-missing' }));
  }

  const existingCount = await withSystemContext(tenantId, () =>
    Section.countDocuments({ periodId: period._id }).exec()
  );
  if (existingCount > 0) {
    return [{ action: 'skipped-existing', count: existingCount }];
  }

  const docs = [];
  for (let day = 0; day <= 22; day += 1) {
    docs.push({
      periodId: period._id,
      tenantId,
      day,
      title: `第 ${day} 天`,
      subtitle: `Day ${day}`,
      icon: '📖',
      description: '',
      content: '<p>课程内容待配置</p>',
      isPublished: true,
      sortOrder: day,
      order: 0
    });
  }
  await withSystemContext(tenantId, () => Section.insertMany(docs));
  return docs.map(doc => ({ day: doc.day, title: doc.title, action: 'created' }));
}

async function initTenantPeriods(slug, options) {
  await mongoose.connect(options.mongoUri, {
    authSource: options.mongoUri.includes('authSource=') ? undefined : 'admin',
    retryWrites: false
  });

  try {
    const tenant = await Tenant.findOne({ slug }).exec();
    if (!tenant) throw new Error(`Tenant not found: ${slug}`);

    console.log('========================================');
    console.log(`Tenant period initialization: ${tenant.name} [${tenant.slug}]`);
    console.log(`Mode: ${options.dryRun ? 'dry-run' : 'execute'}`);
    console.log(`Tenant ID: ${tenant._id}`);
    console.log('========================================\n');

    const periodResults = [];
    let totalSectionActions = 0;

    for (const periodData of TEMPLATE_PERIODS) {
      const { period, action } = await upsertPeriod(tenant, periodData, options.dryRun);
      periodResults.push({ name: periodData.name, action, id: String(period._id) });
      console.log(`${action.padEnd(22)} ${periodData.name} ${period._id}`);

      const sectionResults = periodData.name === '平衡之道'
        ? await upsertMainSections(tenant._id, period, options.dryRun)
        : await ensurePlaceholderSections(tenant._id, period, options.dryRun);

      totalSectionActions += sectionResults.length;
      const summary = sectionResults.reduce((acc, item) => {
        acc[item.action] = (acc[item.action] || 0) + 1;
        return acc;
      }, {});
      console.log(`  sections: ${JSON.stringify(summary)}`);
    }

    if (!options.dryRun) {
      const periods = await withSystemContext(tenant._id, () =>
        Period.find({}).sort({ sortOrder: 1 }).lean().exec()
      );
      const periodIds = periods.map(period => period._id);
      const sectionCounts = await withSystemContext(tenant._id, () =>
        Section.aggregate([
          { $match: { periodId: { $in: periodIds } } },
          { $group: { _id: '$periodId', count: { $sum: 1 } } }
        ]).exec()
      );
      const countByPeriod = new Map(sectionCounts.map(item => [String(item._id), item.count]));
      console.log('\nVerification:');
      periods.forEach(period => {
        console.log(`  ${period.name}: sections=${countByPeriod.get(String(period._id)) || 0}, published=${period.isPublished}, enrollmentOpen=${period.enrollmentOpen}`);
      });
    }

    console.log('\nSummary:');
    console.log(`  periods: ${periodResults.length}`);
    console.log(`  section operations: ${totalSectionActions}`);
  } finally {
    await mongoose.disconnect();
  }
}

async function main() {
  try {
    const { slug, options } = parseArgs(process.argv);
    await initTenantPeriods(slug, options);
  } catch (error) {
    console.error(`Error: ${error.message}`);
    process.exitCode = 1;
  }
}

if (require.main === module) {
  main();
}

module.exports = {
  parseArgs,
  initTenantPeriods,
  sanitizeHtmlContent,
  stripTenantUploadUrls
};
