#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');
const mongoose = require('mongoose');

const User = require('../src/models/User');

function parseArgs(argv) {
  const options = {
    env: '.env.production',
    sample: 10,
    json: false
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--env' && argv[index + 1]) {
      options.env = argv[index + 1];
      index += 1;
    } else if (arg === '--sample' && argv[index + 1]) {
      const value = parseInt(argv[index + 1], 10);
      if (Number.isFinite(value) && value > 0) {
        options.sample = value;
      }
      index += 1;
    } else if (arg === '--json') {
      options.json = true;
    }
  }

  return options;
}

function resolveEnvPath(envOption) {
  const normalized = envOption || '.env.production';
  if (path.isAbsolute(normalized)) {
    return normalized;
  }
  return path.join(__dirname, '..', normalized);
}

function maskMongoUri(uri = '') {
  return String(uri).replace(/:\/\/([^:@]+):([^@]+)@/, '://$1:***@');
}

function maskOpenid(openid = '') {
  const value = String(openid || '');
  if (!value) {
    return '(empty)';
  }
  if (value.length <= 8) {
    return value;
  }
  return `${value.slice(0, 4)}***${value.slice(-4)}`;
}

function formatDateTime(value) {
  if (!value) {
    return '-';
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return String(value);
  }

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hour = String(date.getHours()).padStart(2, '0');
  const minute = String(date.getMinutes()).padStart(2, '0');
  const second = String(date.getSeconds()).padStart(2, '0');
  return `${year}-${month}-${day} ${hour}:${minute}:${second}`;
}

function printHumanReadable(report) {
  console.log('OpenID health report');
  console.log('='.repeat(72));
  console.log(`Env file:      ${report.using.envPath}`);
  console.log(`MongoDB URI:   ${report.using.mongodbUri}`);
  console.log(`Wechat AppID:  ${report.using.wechatAppid || '(missing)'}`);
  console.log('');
  console.log('User stats');
  console.log('-'.repeat(72));
  console.log(`Total users:               ${report.stats.totalUsers}`);
  console.log(`Distinct openids:          ${report.stats.distinctOpenids}`);
  console.log(`Missing openid:            ${report.stats.missingOpenid}`);
  console.log(`mock_* openid:             ${report.stats.mockPrefix}`);
  console.log(`mock_user_* openid:        ${report.stats.mockUserPrefix}`);
  console.log(`Looks real format:         ${report.stats.looksReal}`);
  console.log(`Duplicate openid groups:   ${report.stats.duplicateGroupCount}`);
  console.log('');
  console.log('Pattern breakdown');
  console.log('-'.repeat(72));
  report.patternBreakdown.forEach(item => {
    console.log(`${String(item._id).padEnd(24)} ${item.count}`);
  });

  console.log('');
  console.log('Recent users');
  console.log('-'.repeat(72));
  report.recentUsers.forEach((user, index) => {
    console.log(
      `${String(index + 1).padStart(2, '0')}. ${user.nickname || '(no nickname)'} | ${user.openid} | created ${formatDateTime(user.createdAt)} | lastLogin ${formatDateTime(user.lastLoginAt)}`
    );
  });

  if (report.duplicateOpenids.length > 0) {
    console.log('');
    console.log('Duplicate openids');
    console.log('-'.repeat(72));
    report.duplicateOpenids.forEach((item, index) => {
      console.log(`${String(index + 1).padStart(2, '0')}. ${maskOpenid(item.openid)} | users=${item.count}`);
    });
  }

  console.log('');
  console.log('Subscribe grants by scene');
  console.log('-'.repeat(72));
  if (report.grantsByScene.length === 0) {
    console.log('(empty)');
  } else {
    report.grantsByScene.forEach(item => {
      console.log(
        `${String(item._id).padEnd(24)} users=${item.users} available=${item.totalAvailableCount}`
      );
    });
  }

  console.log('');
  console.log('Recent subscribe deliveries');
  console.log('-'.repeat(72));
  if (report.recentDeliveries.length === 0) {
    console.log('(empty)');
  } else {
    report.recentDeliveries.forEach((item, index) => {
      console.log(
        `${String(index + 1).padStart(2, '0')}. ${item.scene} | ${item.status} | ${formatDateTime(item.createdAt)} | ${item.errorMessage || '-'}`
      );
    });
  }
}

async function buildReport(sampleSize) {
  const [
    totalUsers,
    missingOpenid,
    mockPrefix,
    mockUserPrefix,
    looksReal,
    distinctOpenids,
    patternBreakdown,
    recentUsers,
    duplicateOpenids,
    grantsByScene,
    recentDeliveries
  ] = await Promise.all([
    User.countDocuments({}),
    User.countDocuments({
      $or: [{ openid: { $exists: false } }, { openid: null }, { openid: '' }]
    }),
    User.countDocuments({ openid: /^mock_/i }),
    User.countDocuments({ openid: /^mock_user_/i }),
    User.countDocuments({ openid: { $regex: /^[A-Za-z0-9_-]{20,64}$/ } }),
    User.distinct('openid').then(list => list.length),
    User.aggregate([
      {
        $project: {
          pattern: {
            $switch: {
              branches: [
                {
                  case: {
                    $or: [{ $eq: ['$openid', null] }, { $eq: ['$openid', ''] }]
                  },
                  then: 'missing'
                },
                {
                  case: { $regexMatch: { input: '$openid', regex: /^mock_user_/i } },
                  then: 'mock_user_*'
                },
                {
                  case: { $regexMatch: { input: '$openid', regex: /^mock_/i } },
                  then: 'mock_*'
                },
                {
                  case: {
                    $regexMatch: { input: '$openid', regex: /^[A-Za-z0-9_-]{20,64}$/ }
                  },
                  then: 'looks_real_format'
                }
              ],
              default: 'other_format'
            }
          }
        }
      },
      { $group: { _id: '$pattern', count: { $sum: 1 } } },
      { $sort: { count: -1, _id: 1 } }
    ]),
    User.find({}, { nickname: 1, openid: 1, createdAt: 1, lastLoginAt: 1 })
      .sort({ lastLoginAt: -1, createdAt: -1 })
      .limit(sampleSize)
      .lean(),
    User.aggregate([
      {
        $match: {
          openid: { $exists: true, $nin: [null, ''] }
        }
      },
      {
        $group: {
          _id: '$openid',
          count: { $sum: 1 }
        }
      },
      {
        $match: {
          count: { $gt: 1 }
        }
      },
      { $sort: { count: -1, _id: 1 } },
      { $limit: 20 }
    ]).then(items =>
      items.map(item => ({
        openid: item._id,
        count: item.count
      }))
    ),
    mongoose.connection
      .collection('subscribemessagegrants')
      .aggregate([
        {
          $group: {
            _id: '$scene',
            users: { $sum: 1 },
            totalAvailableCount: { $sum: '$availableCount' }
          }
        },
        { $sort: { _id: 1 } }
      ])
      .toArray()
      .catch(() => []),
    mongoose.connection
      .collection('subscribemessagedeliveries')
      .find({}, { projection: { scene: 1, status: 1, errorMessage: 1, createdAt: 1 } })
      .sort({ createdAt: -1 })
      .limit(20)
      .toArray()
      .catch(() => [])
  ]);

  return {
    stats: {
      totalUsers,
      distinctOpenids,
      missingOpenid,
      mockPrefix,
      mockUserPrefix,
      looksReal,
      duplicateGroupCount: duplicateOpenids.length
    },
    patternBreakdown,
    recentUsers: recentUsers.map(user => ({
      nickname: user.nickname,
      openid: maskOpenid(user.openid),
      createdAt: user.createdAt,
      lastLoginAt: user.lastLoginAt
    })),
    duplicateOpenids,
    grantsByScene,
    recentDeliveries
  };
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const envPath = resolveEnvPath(options.env);

  if (!fs.existsSync(envPath)) {
    throw new Error(`环境文件不存在: ${envPath}`);
  }

  dotenv.config({ path: envPath });

  if (!process.env.MONGODB_URI) {
    throw new Error(`环境文件未配置 MONGODB_URI: ${envPath}`);
  }

  await mongoose.connect(process.env.MONGODB_URI, {
    serverSelectionTimeoutMS: 5000
  });

  const report = await buildReport(options.sample);
  const output = {
    using: {
      envPath,
      mongodbUri: maskMongoUri(process.env.MONGODB_URI),
      wechatAppid: process.env.WECHAT_APPID || null
    },
    ...report
  };

  if (options.json) {
    console.log(JSON.stringify(output, null, 2));
    return;
  }

  printHumanReadable(output);
}

main()
  .catch(error => {
    console.error('check-openid-health failed');
    console.error(error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    try {
      await mongoose.disconnect();
    } catch (error) {}
  });
