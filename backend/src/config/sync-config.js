/**
 * 同步配置文件
 * 
 * 定义所有需要触发 MongoDB→MySQL 同步的操作
 * 格式：{collection, operations: [create, update, delete]}
 */

const syncConfig = {
  users: {
    collection: 'users',
    operations: ['create', 'update', 'delete']
  },
  admins: {
    collection: 'admins',
    operations: ['create', 'update', 'delete']
  },
  periods: {
    collection: 'periods',
    operations: ['create', 'update', 'delete']
  },
  sections: {
    collection: 'sections',
    operations: ['create', 'update', 'delete']
  },
  checkins: {
    collection: 'checkins',
    operations: ['create', 'update', 'delete']
  },
  enrollments: {
    collection: 'enrollments',
    operations: ['create', 'update', 'delete']
  },
  payments: {
    collection: 'payments',
    operations: ['create', 'update', 'delete']
  },
  insights: {
    collection: 'insights',
    operations: ['create', 'update', 'delete']
  },
  insight_requests: {
    collection: 'insight_requests',
    operations: ['create', 'update', 'delete']
  },
  comments: {
    collection: 'comments',
    operations: ['create', 'update', 'delete']
  },
  notifications: {
    collection: 'notifications',
    operations: ['create', 'update', 'delete']
  }
};

module.exports = syncConfig;
