/**
 * API Service 单元测试
 * 测试 API 导出对象和方法的存在性及正确性
 *
 * 注：由于 axios 实例在模块加载时创建，这里测试的是
 * API 方法的定义和调用接口，而不是 HTTP 请求本身
 */

import { describe, it, expect } from 'vitest';
import {
  authApi,
  enrollmentApi,
  paymentApi,
  periodApi,
  userApi,
  statsApi,
  insightApi,
  uploadApi,
  backupApi,
} from '../api';

describe('API Service', () => {
  describe('API 对象导出', () => {
    it('应该导出 authApi 对象', () => {
      expect(authApi).toBeDefined();
      expect(typeof authApi).toBe('object');
    });

    it('应该导出 enrollmentApi 对象', () => {
      expect(enrollmentApi).toBeDefined();
      expect(typeof enrollmentApi).toBe('object');
    });

    it('应该导出 paymentApi 对象', () => {
      expect(paymentApi).toBeDefined();
      expect(typeof paymentApi).toBe('object');
    });

    it('应该导出 periodApi 对象', () => {
      expect(periodApi).toBeDefined();
      expect(typeof periodApi).toBe('object');
    });

    it('应该导出 userApi 对象', () => {
      expect(userApi).toBeDefined();
      expect(typeof userApi).toBe('object');
    });

    it('应该导出 statsApi 对象', () => {
      expect(statsApi).toBeDefined();
      expect(typeof statsApi).toBe('object');
    });

    it('应该导出 insightApi 对象', () => {
      expect(insightApi).toBeDefined();
      expect(typeof insightApi).toBe('object');
    });

    it('应该导出 uploadApi 对象', () => {
      expect(uploadApi).toBeDefined();
      expect(typeof uploadApi).toBe('object');
    });

    it('应该导出 backupApi 对象', () => {
      expect(backupApi).toBeDefined();
      expect(typeof backupApi).toBe('object');
    });
  });

  describe('Auth API 方法', () => {
    it('应该导出 login 方法', () => {
      expect(authApi.login).toBeDefined();
      expect(typeof authApi.login).toBe('function');
    });

    it('应该导出 logout 方法', () => {
      expect(authApi.logout).toBeDefined();
      expect(typeof authApi.logout).toBe('function');
    });

    it('应该导出 getProfile 方法', () => {
      expect(authApi.getProfile).toBeDefined();
      expect(typeof authApi.getProfile).toBe('function');
    });

    it('应该导出 verifyDbAccess 方法', () => {
      expect(authApi.verifyDbAccess).toBeDefined();
      expect(typeof authApi.verifyDbAccess).toBe('function');
    });
  });

  describe('Enrollment API 方法', () => {
    it('应该导出 getEnrollments 方法', () => {
      expect(enrollmentApi.getEnrollments).toBeDefined();
      expect(typeof enrollmentApi.getEnrollments).toBe('function');
    });

    it('应该导出 getEnrollmentDetail 方法', () => {
      expect(enrollmentApi.getEnrollmentDetail).toBeDefined();
      expect(typeof enrollmentApi.getEnrollmentDetail).toBe('function');
    });

    it('应该导出 approveEnrollment 方法', () => {
      expect(enrollmentApi.approveEnrollment).toBeDefined();
      expect(typeof enrollmentApi.approveEnrollment).toBe('function');
    });

    it('应该导出 rejectEnrollment 方法', () => {
      expect(enrollmentApi.rejectEnrollment).toBeDefined();
      expect(typeof enrollmentApi.rejectEnrollment).toBe('function');
    });

    it('应该导出 updateEnrollment 方法', () => {
      expect(enrollmentApi.updateEnrollment).toBeDefined();
      expect(typeof enrollmentApi.updateEnrollment).toBe('function');
    });
  });

  describe('Payment API 方法', () => {
    it('应该导出 getPayments 方法', () => {
      expect(paymentApi.getPayments).toBeDefined();
      expect(typeof paymentApi.getPayments).toBe('function');
    });

    it('应该导出 getPaymentDetail 方法', () => {
      expect(paymentApi.getPaymentDetail).toBeDefined();
      expect(typeof paymentApi.getPaymentDetail).toBe('function');
    });

    it('应该导出 cancelPayment 方法', () => {
      expect(paymentApi.cancelPayment).toBeDefined();
      expect(typeof paymentApi.cancelPayment).toBe('function');
    });

    it('应该导出 getUserPayments 方法', () => {
      expect(paymentApi.getUserPayments).toBeDefined();
      expect(typeof paymentApi.getUserPayments).toBe('function');
    });
  });

  describe('Period API 方法', () => {
    it('应该导出 getPeriods 方法', () => {
      expect(periodApi.getPeriods).toBeDefined();
      expect(typeof periodApi.getPeriods).toBe('function');
    });

    it('应该导出 getPeriodDetail 方法', () => {
      expect(periodApi.getPeriodDetail).toBeDefined();
      expect(typeof periodApi.getPeriodDetail).toBe('function');
    });

    it('应该导出 createPeriod 方法', () => {
      expect(periodApi.createPeriod).toBeDefined();
      expect(typeof periodApi.createPeriod).toBe('function');
    });

    it('应该导出 updatePeriod 方法', () => {
      expect(periodApi.updatePeriod).toBeDefined();
      expect(typeof periodApi.updatePeriod).toBe('function');
    });

    it('应该导出 deletePeriod 方法', () => {
      expect(periodApi.deletePeriod).toBeDefined();
      expect(typeof periodApi.deletePeriod).toBe('function');
    });
  });

  describe('User API 方法', () => {
    it('应该导出 getUsers 方法', () => {
      expect(userApi.getUsers).toBeDefined();
      expect(typeof userApi.getUsers).toBe('function');
    });

    it('应该导出 getUserDetail 方法', () => {
      expect(userApi.getUserDetail).toBeDefined();
      expect(typeof userApi.getUserDetail).toBe('function');
    });

    it('应该导出 updateUser 方法', () => {
      expect(userApi.updateUser).toBeDefined();
      expect(typeof userApi.updateUser).toBe('function');
    });

    it('应该导出 deleteUser 方法', () => {
      expect(userApi.deleteUser).toBeDefined();
      expect(typeof userApi.deleteUser).toBe('function');
    });
  });

  describe('Stats API 方法', () => {
    it('应该导出 getDashboardStats 方法', () => {
      expect(statsApi.getDashboardStats).toBeDefined();
      expect(typeof statsApi.getDashboardStats).toBe('function');
    });

    it('应该导出 getEnrollmentStats 方法', () => {
      expect(statsApi.getEnrollmentStats).toBeDefined();
      expect(typeof statsApi.getEnrollmentStats).toBe('function');
    });

    it('应该导出 getPaymentStats 方法', () => {
      expect(statsApi.getPaymentStats).toBeDefined();
      expect(typeof statsApi.getPaymentStats).toBe('function');
    });
  });

  describe('Insight API 方法', () => {
    it('应该导出 getInsights 方法', () => {
      expect(insightApi.getInsights).toBeDefined();
      expect(typeof insightApi.getInsights).toBe('function');
    });

    it('应该导出 getInsightsByPeriod 方法', () => {
      expect(insightApi.getInsightsByPeriod).toBeDefined();
      expect(typeof insightApi.getInsightsByPeriod).toBe('function');
    });

    it('应该导出 getInsightDetail 方法', () => {
      expect(insightApi.getInsightDetail).toBeDefined();
      expect(typeof insightApi.getInsightDetail).toBe('function');
    });

    it('应该导出 createInsight 方法', () => {
      expect(insightApi.createInsight).toBeDefined();
      expect(typeof insightApi.createInsight).toBe('function');
    });

    it('应该导出 updateInsight 方法', () => {
      expect(insightApi.updateInsight).toBeDefined();
      expect(typeof insightApi.updateInsight).toBe('function');
    });

    it('应该导出 deleteInsight 方法', () => {
      expect(insightApi.deleteInsight).toBeDefined();
      expect(typeof insightApi.deleteInsight).toBe('function');
    });

    it('应该导出 publishInsight 方法', () => {
      expect(insightApi.publishInsight).toBeDefined();
      expect(typeof insightApi.publishInsight).toBe('function');
    });

    it('应该导出 unpublishInsight 方法', () => {
      expect(insightApi.unpublishInsight).toBeDefined();
      expect(typeof insightApi.unpublishInsight).toBe('function');
    });
  });

  describe('Upload API 方法', () => {
    it('应该导出 uploadFile 方法', () => {
      expect(uploadApi.uploadFile).toBeDefined();
      expect(typeof uploadApi.uploadFile).toBe('function');
    });

    it('应该导出 uploadMultiple 方法', () => {
      expect(uploadApi.uploadMultiple).toBeDefined();
      expect(typeof uploadApi.uploadMultiple).toBe('function');
    });

    it('应该导出 deleteFile 方法', () => {
      expect(uploadApi.deleteFile).toBeDefined();
      expect(typeof uploadApi.deleteFile).toBe('function');
    });
  });

  describe('Backup API 方法', () => {
    it('应该导出 getMongodbStats 方法', () => {
      expect(backupApi.getMongodbStats).toBeDefined();
      expect(typeof backupApi.getMongodbStats).toBe('function');
    });

    it('应该导出 getMysqlStats 方法', () => {
      expect(backupApi.getMysqlStats).toBeDefined();
      expect(typeof backupApi.getMysqlStats).toBe('function');
    });

    it('应该导出 compareBackup 方法', () => {
      expect(backupApi.compareBackup).toBeDefined();
      expect(typeof backupApi.compareBackup).toBe('function');
    });

    it('应该导出 compareFieldsDetail 方法', () => {
      expect(backupApi.compareFieldsDetail).toBeDefined();
      expect(typeof backupApi.compareFieldsDetail).toBe('function');
    });

    it('应该导出 getMongodbTableData 方法', () => {
      expect(backupApi.getMongodbTableData).toBeDefined();
      expect(typeof backupApi.getMongodbTableData).toBe('function');
    });

    it('应该导出 fullSync 方法', () => {
      expect(backupApi.fullSync).toBeDefined();
      expect(typeof backupApi.fullSync).toBe('function');
    });

    it('应该导出 recoverFull 方法', () => {
      expect(backupApi.recoverFull).toBeDefined();
      expect(typeof backupApi.recoverFull).toBe('function');
    });

    it('应该导出 updateMongodbRecord 方法', () => {
      expect(backupApi.updateMongodbRecord).toBeDefined();
      expect(typeof backupApi.updateMongodbRecord).toBe('function');
    });

    it('应该导出 deleteMongodbRecord 方法', () => {
      expect(backupApi.deleteMongodbRecord).toBeDefined();
      expect(typeof backupApi.deleteMongodbRecord).toBe('function');
    });
  });
});
