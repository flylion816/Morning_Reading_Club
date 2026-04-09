const { expect } = require('chai');

const {
  classifyIssue,
  buildDiagnosis,
} = require('../../../src/services/daily-report-diagnosis.service');

describe('Daily Report Diagnosis Service', () => {
  it('should classify MySQL missing column errors as actionable high priority', () => {
    const issue = classifyIssue("Failed to sync insights/abc to MySQL Unknown column 'period_name' in 'field list'");

    expect(issue.ruleId).to.equal('mysql-missing-column');
    expect(issue.category).to.equal('actionable');
    expect(issue.severity).to.equal('high');
    expect(issue.summary).to.include('period_name');
    expect(issue.autoRepairEligible).to.equal(true);
  });

  it('should classify IP-based CORS blocks as low-priority noise', () => {
    const issue = classifyIssue('Error: Origin https://118.25.145.179:443 not allowed by CORS');

    expect(issue.ruleId).to.equal('cors-ip-origin');
    expect(issue.category).to.equal('noise');
    expect(issue.severity).to.equal('low');
  });

  it('should build grouped diagnosis counts from top errors', () => {
    const diagnosis = buildDiagnosis({
      reportId: 'report-1',
      timeRange: {
        from: '2026-04-08T09:00:00.000Z',
        to: '2026-04-09T09:00:00.000Z',
      },
      topErrors: [
        {
          message: "Failed to sync periods/abc to MySQL Unknown column 'meeting_join_url' in 'field list'",
          count: 3,
          samples: ['sample-1'],
        },
        {
          message: 'Sync failed after 3 retries, giving up',
          count: 2,
          samples: ['sample-2'],
        },
        {
          message: 'Error: Origin https://118.25.145.179:443 not allowed by CORS',
          count: 1,
          samples: ['sample-3'],
        }
      ]
    });

    expect(diagnosis.counts.total).to.equal(3);
    expect(diagnosis.counts.actionable).to.equal(1);
    expect(diagnosis.counts.derived).to.equal(1);
    expect(diagnosis.counts.noise).to.equal(1);
    expect(diagnosis.summary.shouldEscalate).to.equal(true);
    expect(diagnosis.autoRepairEligibleIssues).to.have.lengthOf(1);
  });
});
