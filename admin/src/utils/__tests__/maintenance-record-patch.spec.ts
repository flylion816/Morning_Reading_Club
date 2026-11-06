import { describe, expect, it } from 'vitest';
import { buildMaintenanceRecordPatch } from '../maintenanceRecordPatch';

describe('buildMaintenanceRecordPatch', () => {
  it('omits unchanged identity and security fields when saving a normal record', () => {
    const before = {
      _id: 'record-1',
      tenantId: 'tenant-1',
      role: 'user',
      status: 'active',
      nickname: 'Before',
      createdAt: '2026-10-12T00:00:00.000Z'
    };
    const after = { ...before, nickname: 'After' };
    expect(buildMaintenanceRecordPatch(after, before)).to.deep.equal({ nickname: 'After' });
  });

  it('omits readonly fields and returns an empty patch when no editable value changed', () => {
    const record = { _id: 'record-1', __v: 0, createdAt: 'today', nickname: 'Same' };
    expect(buildMaintenanceRecordPatch(record, record)).to.deep.equal({});
  });

  it('keeps a changed nested business field intact for the server allowlist to review', () => {
    const before = { profile: { nickname: 'Before', city: 'X' } };
    const after = { profile: { nickname: 'After', city: 'X' } };
    expect(buildMaintenanceRecordPatch(after, before)).to.deep.equal({ profile: { nickname: 'After', city: 'X' } });
  });
});
