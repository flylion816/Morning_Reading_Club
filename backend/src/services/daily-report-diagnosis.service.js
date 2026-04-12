const DIAGNOSIS_RULES = [
  {
    id: 'mysql-missing-column',
    pattern: /Unknown column '([^']+)' in 'field list'/i,
    severity: 'high',
    category: 'actionable',
    summary: match => `MySQL 备份表缺列：${match[1]}`,
    likelyCause: 'Mongo → MySQL 同步字段已扩展，但 MySQL 备份表结构未及时补齐。',
    recommendedAction: '为对应表补列，更新 init-mysql/schema，并回放失败记录。',
    autoRepairEligible: true,
  },
  {
    id: 'mysql-reserved-keyword',
    pattern: /You have an error in your SQL syntax.*near 'order/i,
    severity: 'high',
    category: 'actionable',
    summary: () => 'MySQL 保留字导致 upsert 语法错误',
    likelyCause: '同步 SQL 未对列名进行反引号转义，命中了 MySQL 保留字。',
    recommendedAction: '统一对 upsert 的表名和列名加反引号，并回放失败记录。',
    autoRepairEligible: true,
  },
  {
    id: 'mysql-data-too-long',
    pattern: /Data too long for column '([^']+)'/i,
    severity: 'high',
    category: 'actionable',
    summary: match => `MySQL 列长度/类型不匹配：${match[1]}`,
    likelyCause: 'ObjectId、枚举值或文本字段在同步前未做兼容转换。',
    recommendedAction: '检查同步层字段映射与序列化逻辑，必要时调整 MySQL 列类型。',
    autoRepairEligible: true,
  },
  {
    id: 'mysql-duplicate-entry',
    pattern: /ER_DUP_ENTRY|duplicate entry/i,
    severity: 'medium',
    category: 'actionable',
    summary: () => 'MySQL 唯一键冲突',
    likelyCause: '同步 upsert 逻辑未正确命中主键/唯一键，或历史脏数据占用唯一索引。',
    recommendedAction: '确认唯一索引设计和 upsert 条件，必要时先清理历史脏数据。',
    autoRepairEligible: false,
  },
  {
    id: 'sync-retries-exhausted',
    pattern: /Sync failed after 3 retries, giving up/i,
    severity: 'low',
    category: 'derived',
    summary: () => '同步重试达到上限',
    likelyCause: '这是上游同步错误的派生结果，不是首个根因。',
    recommendedAction: '优先定位首条 “Failed to sync …” 错误，修复后再回放失败记录。',
    autoRepairEligible: false,
  },
  {
    id: 'api-error-rate-alert',
    pattern: /API错误率达到|CRITICAL告警: API错误率达到/i,
    severity: 'low',
    category: 'derived',
    summary: () => 'API 错误率派生告警',
    likelyCause: '少量请求在短窗口内失败，触发监控阈值告警。',
    recommendedAction: '将它与同一时间窗内的真实业务错误一起分析，不要单独处理。',
    autoRepairEligible: false,
  },
  {
    id: 'cors-ip-origin',
    pattern: /Origin https?:\/\/\d{1,3}(?:\.\d{1,3}){3}(?::\d+)? not allowed by CORS/i,
    severity: 'low',
    category: 'noise',
    summary: () => '非白名单来源被 CORS 拦截',
    likelyCause: '有人直接用服务器 IP 访问，或外部扫描器探测接口。',
    recommendedAction: '保持拦截即可；如日报噪音过多，可在报告层降权或过滤。',
    autoRepairEligible: false,
  },
  {
    id: 'jwt-expired',
    pattern: /TokenExpiredError|jwt expired/i,
    severity: 'low',
    category: 'normal',
    summary: () => '用户 Token 过期',
    likelyCause: '用户登录态自然过期。',
    recommendedAction: '无需处理，用户重新登录即可。',
    autoRepairEligible: false,
  },
  {
    id: 'null-property-access',
    pattern: /Cannot read propert|Cannot read properties of null|Cannot read properties of undefined/i,
    severity: 'medium',
    category: 'actionable',
    summary: () => '空值引用错误',
    likelyCause: '代码在 null/undefined 上访问属性，通常是上游数据缺失或分支漏判。',
    recommendedAction: '补空值保护，必要时增加容错分支和定向回归测试。',
    autoRepairEligible: false,
  },
  {
    id: 'generic-sync-failure',
    pattern: /Failed to sync ([^/]+)\/([a-f0-9]{24,}) to MySQL/i,
    severity: 'medium',
    category: 'actionable',
    summary: match => `MySQL 实时同步失败：${match[1]}`,
    likelyCause: '同步层与 MySQL 表结构、字段类型或数据格式存在不一致。',
    recommendedAction: '检查首条失败记录的字段映射、表结构和最近一次结构变更。',
    autoRepairEligible: false,
  },
];

function classifyIssue(message) {
  for (const rule of DIAGNOSIS_RULES) {
    const match = message.match(rule.pattern);
    if (match) {
      return {
        ruleId: rule.id,
        severity: rule.severity,
        category: rule.category,
        summary: rule.summary(match),
        likelyCause: rule.likelyCause,
        recommendedAction: rule.recommendedAction,
        autoRepairEligible: rule.autoRepairEligible,
      };
    }
  }

  return {
    ruleId: 'unknown',
    severity: 'medium',
    category: 'actionable',
    summary: '未归类错误，需要人工分析',
    likelyCause: '当前规则库未覆盖该问题模式。',
    recommendedAction: '查看原始日志样例和上下文，补充规则或人工修复。',
    autoRepairEligible: false,
  };
}

function buildDiagnosis(reportSummary) {
  const normalizedIssues = [
    ...(reportSummary.infrastructureAlerts || []).map(issue => ({ ...issue, source: 'infrastructure' })),
    ...(reportSummary.topErrors || []).map(issue => ({ ...issue, source: 'error' })),
    ...(reportSummary.topWarnings || []).map(issue => ({ ...issue, source: 'warning' })),
    ...(reportSummary.topExceptions || []).map(issue => ({ ...issue, source: 'exception' })),
  ];

  const issues = normalizedIssues.map(issue => {
    if (issue.source === 'infrastructure' && issue.summary && issue.likelyCause && issue.recommendedAction) {
      return {
        ruleId: issue.ruleId || issue.id || 'infrastructure',
        severity: issue.severity || 'medium',
        category: issue.category || 'actionable',
        summary: issue.summary,
        likelyCause: issue.likelyCause,
        recommendedAction: issue.recommendedAction,
        autoRepairEligible: issue.autoRepairEligible || false,
        ...issue,
      };
    }

    const classification = classifyIssue(issue.message);
    return {
      ...issue,
      ...classification,
    };
  });

  const actionableIssues = issues.filter(issue => issue.category === 'actionable');
  const derivedIssues = issues.filter(issue => issue.category === 'derived');
  const noiseIssues = issues.filter(issue => issue.category === 'noise');
  const normalIssues = issues.filter(issue => issue.category === 'normal');
  const criticalIssues = issues.filter(issue => issue.severity === 'high');
  const autoRepairEligibleIssues = issues.filter(issue => issue.autoRepairEligible);

  return {
    generatedAt: new Date().toISOString(),
    reportId: reportSummary.reportId,
    timeRange: reportSummary.timeRange,
    counts: {
      total: issues.length,
      actionable: actionableIssues.length,
      derived: derivedIssues.length,
      noise: noiseIssues.length,
      normal: normalIssues.length,
      critical: criticalIssues.length,
      autoRepairEligible: autoRepairEligibleIssues.length,
    },
    summary: {
      shouldEscalate: criticalIssues.length > 0 || actionableIssues.length > 0,
      autoRepairSuggested: autoRepairEligibleIssues.length > 0,
      headline: actionableIssues.length > 0
        ? `发现 ${actionableIssues.length} 类需要处理的问题`
        : noiseIssues.length > 0
          ? '报告窗口内主要为噪音/探测流量'
          : '报告窗口内未发现需要人工处理的问题',
    },
    issues,
    actionableIssues,
    derivedIssues,
    noiseIssues,
    normalIssues,
    autoRepairEligibleIssues,
  };
}

module.exports = {
  DIAGNOSIS_RULES,
  classifyIssue,
  buildDiagnosis,
};
