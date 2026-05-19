-- ============================================================================
-- 多租户字段迁移：给既有 MySQL 备份表补 tenant_id
-- ============================================================================
-- 用法：
--   mysql -u <user> -p morning_reading < backend/database/mysql-tenant-migration.sql
--
-- 说明：
--   mysql-schema.sql 里的 CREATE TABLE IF NOT EXISTS 不会修改已有表。
--   在线上旧备份库部署多租户代码前，必须先执行本迁移，否则备份同步会因为
--   Unknown column 'tenant_id' 失败。

USE morning_reading;

DELIMITER //

DROP PROCEDURE IF EXISTS add_tenant_id_if_missing//
CREATE PROCEDURE add_tenant_id_if_missing(IN p_table_name VARCHAR(64))
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = p_table_name
      AND COLUMN_NAME = 'tenant_id'
  ) THEN
    SET @sql = CONCAT(
      'ALTER TABLE `', p_table_name,
      '` ADD COLUMN tenant_id CHAR(24) NULL COMMENT ''租户 ID'' AFTER id'
    );
    PREPARE stmt FROM @sql;
    EXECUTE stmt;
    DEALLOCATE PREPARE stmt;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.STATISTICS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = p_table_name
      AND INDEX_NAME = 'idx_tenant_id'
  ) THEN
    SET @sql = CONCAT('ALTER TABLE `', p_table_name, '` ADD INDEX idx_tenant_id (tenant_id)');
    PREPARE stmt FROM @sql;
    EXECUTE stmt;
    DEALLOCATE PREPARE stmt;
  END IF;
END//

DELIMITER ;

CALL add_tenant_id_if_missing('users');
CALL add_tenant_id_if_missing('admins');
CALL add_tenant_id_if_missing('periods');
CALL add_tenant_id_if_missing('sections');
CALL add_tenant_id_if_missing('checkins');
CALL add_tenant_id_if_missing('enrollments');
CALL add_tenant_id_if_missing('payments');
CALL add_tenant_id_if_missing('insights');
CALL add_tenant_id_if_missing('insight_likes');
CALL add_tenant_id_if_missing('insight_requests');
CALL add_tenant_id_if_missing('insight_request_audit_logs');
CALL add_tenant_id_if_missing('comments');
CALL add_tenant_id_if_missing('comment_replies');
CALL add_tenant_id_if_missing('notifications');

DROP PROCEDURE IF EXISTS add_tenant_id_if_missing;

ALTER TABLE admins
  MODIFY role ENUM('platform_superadmin', 'tenant_admin', 'superadmin', 'admin', 'operator')
  DEFAULT 'operator'
  COMMENT '角色';
