import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, test } from 'vitest';

describe('InsightsManagementView', () => {
  test('imports every Vue reactivity API used by the setup script', () => {
    const source = readFileSync(resolve(__dirname, '../InsightsManagementView.vue'), 'utf8');
    const setupScript = source.match(/<script setup[\s\S]*<\/script>/)?.[0] || '';
    const vueImport = setupScript.match(/import\s+\{([^}]+)\}\s+from\s+'vue'/)?.[1] || '';
    const importedApis = new Set(vueImport.split(',').map(item => item.trim()).filter(Boolean));

    expect(setupScript).toContain('computed(() =>');
    expect(importedApis).toContain('computed');
  });
});
