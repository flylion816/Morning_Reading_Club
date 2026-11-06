const DEFAULT_READONLY_FIELDS = new Set(['_id', '__v', 'createdAt', 'updatedAt']);

function stableValue(value: unknown): string {
  if (value === undefined) return 'undefined';
  return JSON.stringify(value);
}

export function buildMaintenanceRecordPatch(
  current: Record<string, unknown>,
  original: Record<string, unknown>,
  readonlyFields: Iterable<string> = DEFAULT_READONLY_FIELDS
): Record<string, unknown> {
  const readonly = new Set(readonlyFields);
  const patch: Record<string, unknown> = {};
  const keys = new Set([...Object.keys(original), ...Object.keys(current)]);

  for (const key of keys) {
    if (readonly.has(key)) continue;
    if (stableValue(current[key]) !== stableValue(original[key])) patch[key] = current[key];
  }
  return patch;
}
