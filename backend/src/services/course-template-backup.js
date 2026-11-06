const COURSE_TEMPLATE_TABLE_SQL = `CREATE TABLE IF NOT EXISTS course_templates (
  id VARCHAR(24) PRIMARY KEY,
  tenant_id VARCHAR(24) NOT NULL,
  raw_json LONGTEXT NOT NULL,
  created_at DATETIME NULL,
  updated_at DATETIME NULL,
  INDEX course_templates_tenant (tenant_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`;

async function ensureCourseTemplateTable(connection) {
  await connection.query(COURSE_TEMPLATE_TABLE_SQL);
}

module.exports = { COURSE_TEMPLATE_TABLE_SQL, ensureCourseTemplateTable };
