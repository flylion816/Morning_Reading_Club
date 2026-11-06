export type EnrollmentTemplatePreset = 'simple' | 'full' | 'custom';

export type EnrollmentFieldKey =
  | 'name'
  | 'phone'
  | 'gender'
  | 'province'
  | 'detailedAddress'
  | 'age'
  | 'referrer'
  | 'hasReadBook'
  | 'readTimes'
  | 'enrollReason'
  | 'expectation'
  | 'commitment';

export type EnrollmentTemplateField = {
  key: EnrollmentFieldKey;
  label: string;
  required: boolean;
  help?: string;
};

export type EnrollmentTemplateDraft = {
  name: string;
  preset: EnrollmentTemplatePreset;
  fields: EnrollmentTemplateField[];
  revision?: number;
};

export type EnrollmentTemplate = EnrollmentTemplateDraft & {
  _id?: string;
  id?: string;
  active: boolean;
  builtIn?: boolean;
  revision: number;
  usageCount?: number;
};

export const ENROLLMENT_FIELD_CATALOG: Array<EnrollmentTemplateField & { group: string }> = [
  { key: 'name', label: '姓名', required: true, group: '基本信息' },
  { key: 'phone', label: '手机号', required: true, group: '基本信息' },
  { key: 'gender', label: '性别', required: false, group: '基本信息' },
  { key: 'province', label: '所在地区', required: false, group: '基本信息' },
  { key: 'detailedAddress', label: '详细地址', required: false, group: '基本信息' },
  { key: 'age', label: '年龄', required: false, group: '关于你' },
  { key: 'referrer', label: '推荐人', required: false, group: '关于你' },
  { key: 'hasReadBook', label: '是否读过相关书籍', required: false, group: '关于你' },
  { key: 'readTimes', label: '阅读次数', required: false, help: '仅在选择读过书籍时显示', group: '关于你' },
  { key: 'enrollReason', label: '参加缘起', required: false, group: '课程期待' },
  { key: 'expectation', label: '课程期待', required: false, group: '课程期待' },
  { key: 'commitment', label: '参与承诺', required: false, group: '课程期待' }
];

export const SIMPLE_ENROLLMENT_FIELDS: EnrollmentTemplateField[] = ENROLLMENT_FIELD_CATALOG
  .filter(field => field.key === 'name' || field.key === 'phone')
  .map(({ group: _group, ...field }) => field);

export const FULL_ENROLLMENT_FIELDS: EnrollmentTemplateField[] = ENROLLMENT_FIELD_CATALOG
  .filter(field => field.key !== 'detailedAddress')
  .map(({ group: _group, ...field }) => ({ ...field, required: ['name', 'phone', 'gender', 'province', 'age', 'enrollReason', 'expectation', 'commitment'].includes(field.key) }));
