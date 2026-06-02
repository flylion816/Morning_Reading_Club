import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const source = readFileSync(
  resolve(__dirname, '../ImprintsManagementView.vue'),
  'utf8'
);

describe('ImprintsManagementView', () => {
  it('renders imprint management table and edit dialog', () => {
    expect(source).toContain('活动类型管理');
    expect(source).toContain('印记列表');
    expect(source).toContain(':data="imprints"');
    expect(source).toContain('drawerVisible');
    expect(source).toContain('saveEdit');
    expect(source).toContain('deleteImprint');
  });

  it('uses admin imprint APIs for list, edit, delete and upload', () => {
    expect(source).toContain('imprintApi.getImprints(params)');
    expect(source).toContain('imprintApi.updateImprint(editForm.value._id');
    expect(source).toContain('imprintApi.deleteImprint(row._id)');
    expect(source).toContain('imprintApi.uploadMedia(file)');
    expect(source).toContain('accept="image/*,video/*"');
  });

  it('supports dynamic activity type management', () => {
    expect(source).toContain('imprintActivityTypeApi.getTypes()');
    expect(source).toContain('imprintActivityTypeApi.createType');
    expect(source).toContain('imprintActivityTypeApi.updateType');
    expect(source).toContain('imprintActivityTypeApi.deleteType');
    expect(source).toContain('imprintActivityTypeApi.reorderTypes');
  });
});
