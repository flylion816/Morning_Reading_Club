const AuditLog = require('../models/AuditLog');

/**
 * 审计日志服务 - 记录所有管理员操作
 */
class AuditService {
  /**
   * 创建审计日志
   * @param {Object} options 审计日志参数
   * @returns {Promise<Object>} 创建的审计日志
   */
  async createLog(options) {
    try {
      const {
        adminId,
        adminName,
        actionType,
        resourceType,
        resourceId = null,
        resourceName = null,
        description = null,
        changes = null,
        reason = null,
        batchCount = null,
        ipAddress = null,
        userAgent = null,
        status = 'success',
        errorMessage = null
      } = options;

      const log = new AuditLog({
        adminId,
        adminName,
        actionType,
        resourceType,
        resourceId,
        resourceName,
        details: {
          description,
          changes: changes ? new Map(Object.entries(changes)) : null,
          reason,
          batchCount
        },
        ipAddress,
        userAgent,
        status,
        errorMessage,
        timestamp: new Date()
      });

      await log.save();
      return log;
    } catch (error) {
      logger.error('创建审计日志失败:', error);
      throw error;
    }
  }

  /**
   * 批量创建审计日志
   * @param {Array} logs 日志数组
   * @returns {Promise<Array>} 创建的日志
   */
  async createBatchLogs(logs) {
    try {
      const auditLogs = logs.map(log => ({
        ...log,
        details: {
          ...log.details,
          changes: log.details?.changes ? new Map(Object.entries(log.details.changes)) : null
        },
        timestamp: new Date()
      }));
      return await AuditLog.insertMany(auditLogs);
    } catch (error) {
      logger.error('批量创建审计日志失败:', error);
      throw error;
    }
  }

  /**
   * 获取审计日志列表
   * @param {Object} query 查询条件
   * @param {number} page 页码（默认1）
   * @param {number} pageSize 每页数量（默认20）
   * @returns {Promise<Object>} 审计日志列表和分页信息
   */
  async getLogs(query = {}, page = 1, pageSize = 20) {
    try {
      const skip = (page - 1) * pageSize;

      // 构建查询条件
      const filter = {};

      if (query.adminId) {
        filter.adminId = query.adminId;
      }

      if (query.actionType) {
        filter.actionType = query.actionType;
      }

      if (query.resourceType) {
        filter.resourceType = query.resourceType;
      }

      if (query.resourceId) {
        filter.resourceId = query.resourceId;
      }

      if (query.startDate || query.endDate) {
        filter.timestamp = {};
        if (query.startDate) {
          filter.timestamp.$gte = new Date(query.startDate);
        }
        if (query.endDate) {
          filter.timestamp.$lte = new Date(query.endDate);
        }
      }

      if (query.status) {
        filter.status = query.status;
      }

      // 执行查询
      const [logs, total] = await Promise.all([
        AuditLog.find(filter)
          .populate('adminId', 'name email role')
          .sort({ timestamp: -1 })
          .skip(skip)
          .limit(pageSize),
        AuditLog.countDocuments(filter)
      ]);

      return {
        data: logs,
        total,
        page,
        pageSize,
        pages: Math.ceil(total / pageSize)
      };
    } catch (error) {
      logger.error('获取审计日志列表失败:', error);
      throw error;
    }
  }

  /**
   * 获取管理员的操作记录
   * @param {string} adminId 管理员ID
   * @param {number} page 页码
   * @param {number} pageSize 每页数量
   * @returns {Promise<Object>} 该管理员的操作记录
   */
  async getAdminLogs(adminId, page = 1, pageSize = 20) {
    return this.getLogs({ adminId }, page, pageSize);
  }

  /**
   * 获取指定资源的操作记录
   * @param {string} resourceType 资源类型
   * @param {string} resourceId 资源ID
   * @param {number} page 页码
   * @param {number} pageSize 每页数量
   * @returns {Promise<Object>} 该资源的操作记录
   */
  async getResourceLogs(resourceType, resourceId, page = 1, pageSize = 20) {
    return this.getLogs({ resourceType, resourceId }, page, pageSize);
  }

  /**
   * 获取操作统计
   * @returns {Promise<Object>} 统计数据
   */
  async getStatistics() {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const [totalLogs, todayLogs, actionTypeStats, resourceTypeStats, adminStats, failedLogs] =
        await Promise.all([
          AuditLog.countDocuments(),
          AuditLog.countDocuments({ timestamp: { $gte: today } }),
          AuditLog.aggregate([
            { $group: { _id: '$actionType', count: { $sum: 1 } } },
            { $sort: { count: -1 } }
          ]),
          AuditLog.aggregate([
            { $group: { _id: '$resourceType', count: { $sum: 1 } } },
            { $sort: { count: -1 } }
          ]),
          AuditLog.aggregate([
            { $group: { _id: '$adminName', count: { $sum: 1 } } },
            { $sort: { count: -1 } },
            { $limit: 10 }
          ]),
          AuditLog.countDocuments({ status: 'failure' })
        ]);

      return {
        total: totalLogs,
        today: todayLogs,
        failed: failedLogs,
        actionTypeStats: actionTypeStats.reduce((acc, item) => {
          acc[item._id] = item.count;
          return acc;
        }, {}),
        resourceTypeStats: resourceTypeStats.reduce((acc, item) => {
          acc[item._id] = item.count;
          return acc;
        }, {}),
        topAdmins: adminStats
      };
    } catch (error) {
      logger.error('获取操作统计失败:', error);
      throw error;
    }
  }

  /**
   * 计算字段变更
   * @param {Object} oldData 旧数据
   * @param {Object} newData 新数据
   * @returns {Object} 变更记录
   */
  static calculateChanges(oldData = {}, newData = {}) {
    const changes = {};

    // 获取所有可能的键
    const keys = new Set([...Object.keys(oldData), ...Object.keys(newData)]);

    keys.forEach(key => {
      const oldValue = oldData[key];
      const newValue = newData[key];

      // 忽略某些字段的变更
      if (['_id', 'createdAt', 'updatedAt', '__v'].includes(key)) {
        return;
      }

      // 如果值发生变化，记录下来
      if (JSON.stringify(oldValue) !== JSON.stringify(newValue)) {
        changes[key] = {
          before: oldValue,
          after: newValue
        };
      }
    });

    return Object.keys(changes).length > 0 ? changes : null;
  }

  /**
   * 清理过期日志（超过30天）
   * @returns {Promise<Object>} 删除结果
   */
  async cleanupExpiredLogs() {
    try {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const result = await AuditLog.deleteMany({
        timestamp: { $lt: thirtyDaysAgo }
      });

      return result;
    } catch (error) {
      logger.error('清理过期日志失败:', error);
      throw error;
    }
  }

  /**
   * 导出审计日志为CSV
   * @param {Object} query 查询条件
   * @returns {Promise<string>} CSV数据
   */
  async exportLogsToCSV(query = {}) {
    try {
      const logs = await AuditLog.find(query)
        .populate('adminId', 'name email')
        .sort({ timestamp: -1 })
        .limit(10000); // 限制导出数量

      // CSV头
      const headers = ['时间', '管理员', '操作类型', '资源类型', '资源名称', '状态', '描述'];

      // 构建CSV行
      const rows = logs.map(log => [
        new Date(log.timestamp).toLocaleString('zh-CN'),
        log.adminName || '未知',
        log.actionType,
        log.resourceType,
        log.resourceName || '无',
        log.status === 'success' ? '成功' : '失败',
        log.details?.description || ''
      ]);

      // 转换为CSV格式
      const csv = [
        headers.join(','),
        ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
      ].join('\n');

      return csv;
    } catch (error) {
      logger.error('导出审计日志失败:', error);
      throw error;
    }
  }
}

module.exports = new AuditService();
