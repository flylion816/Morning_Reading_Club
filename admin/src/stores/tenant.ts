import { defineStore } from 'pinia';
import { ref, computed } from 'vue';

const DEFAULT_ADMIN_PRIMARY = '#5b7f4a';

type Rgb = {
  r: number;
  g: number;
  b: number;
};

function normalizeHex(value?: string | null) {
  if (!value || typeof value !== 'string') return DEFAULT_ADMIN_PRIMARY;

  const clean = value.trim().replace(/^#/, '');
  if (/^[0-9a-fA-F]{3}$/.test(clean)) {
    return `#${clean.split('').map(char => char + char).join('')}`.toLowerCase();
  }
  if (/^[0-9a-fA-F]{6}$/.test(clean)) {
    return `#${clean}`.toLowerCase();
  }

  return DEFAULT_ADMIN_PRIMARY;
}

function hexToRgb(hex: string): Rgb {
  const normalized = normalizeHex(hex).slice(1);
  return {
    r: parseInt(normalized.slice(0, 2), 16),
    g: parseInt(normalized.slice(2, 4), 16),
    b: parseInt(normalized.slice(4, 6), 16)
  };
}

function toHexChannel(value: number) {
  return Math.round(Math.max(0, Math.min(255, value)))
    .toString(16)
    .padStart(2, '0');
}

function rgbToHex(rgb: Rgb) {
  return `#${toHexChannel(rgb.r)}${toHexChannel(rgb.g)}${toHexChannel(rgb.b)}`;
}

function mixRgb(from: Rgb, to: Rgb, amount: number): Rgb {
  return {
    r: from.r + (to.r - from.r) * amount,
    g: from.g + (to.g - from.g) * amount,
    b: from.b + (to.b - from.b) * amount
  };
}

function rgba(rgb: Rgb, alpha: number) {
  return `rgba(${Math.round(rgb.r)}, ${Math.round(rgb.g)}, ${Math.round(rgb.b)}, ${alpha})`;
}

function luminance({ r, g, b }: Rgb) {
  const convert = (channel: number) => {
    const value = channel / 255;
    return value <= 0.03928
      ? value / 12.92
      : Math.pow((value + 0.055) / 1.055, 2.4);
  };
  const rs = convert(r);
  const gs = convert(g);
  const bs = convert(b);
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
}

function deriveTheme(primaryColor?: string | null) {
  const primary = normalizeHex(primaryColor);
  const primaryRgb = hexToRgb(primary);
  const white = { r: 255, g: 255, b: 255 };
  const black = { r: 0, g: 0, b: 0 };
  const warmPage = { r: 244, g: 242, b: 236 };
  const isLight = luminance(primaryRgb) > 0.58;
  const darkAmount = isLight ? 0.46 : 0.24;

  const primaryDark = rgbToHex(mixRgb(primaryRgb, black, darkAmount));
  const primaryDeep = rgbToHex(mixRgb(primaryRgb, black, isLight ? 0.66 : 0.48));
  const primaryLight = rgbToHex(mixRgb(primaryRgb, white, 0.28));
  const primarySoft = rgbToHex(mixRgb(primaryRgb, white, 0.88));
  const primaryTint = rgbToHex(mixRgb(primaryRgb, white, 0.74));
  const sidebar = rgbToHex(mixRgb(primaryRgb, black, isLight ? 0.72 : 0.58));
  const sidebarDeep = rgbToHex(mixRgb(primaryRgb, black, isLight ? 0.82 : 0.72));
  const page = rgbToHex(mixRgb(warmPage, primaryRgb, 0.035));

  return {
    primary,
    primaryDark,
    primaryDeep,
    primaryLight,
    primarySoft,
    primaryTint,
    sidebar,
    sidebarDeep,
    page,
    primaryMuted: rgba(primaryRgb, 0.13),
    primaryShadow: rgba(primaryRgb, 0.24),
    primaryAlpha08: rgba(primaryRgb, 0.08),
    primaryAlpha12: rgba(primaryRgb, 0.12),
    primaryAlpha16: rgba(primaryRgb, 0.16),
    primaryAlpha24: rgba(primaryRgb, 0.24),
    primaryAlpha40: rgba(primaryRgb, 0.4),
    elLight3: rgbToHex(mixRgb(primaryRgb, white, 0.3)),
    elLight5: rgbToHex(mixRgb(primaryRgb, white, 0.5)),
    elLight7: rgbToHex(mixRgb(primaryRgb, white, 0.7)),
    elLight8: rgbToHex(mixRgb(primaryRgb, white, 0.8)),
    elLight9: rgbToHex(mixRgb(primaryRgb, white, 0.9))
  };
}

function setThemeVars(primaryColor?: string | null) {
  if (typeof document === 'undefined') return;

  const theme = deriveTheme(primaryColor);
  const root = document.documentElement.style;
  root.setProperty('--admin-primary', theme.primary);
  root.setProperty('--admin-primary-dark', theme.primaryDark);
  root.setProperty('--admin-primary-deep', theme.primaryDeep);
  root.setProperty('--admin-primary-light', theme.primaryLight);
  root.setProperty('--admin-primary-soft', theme.primarySoft);
  root.setProperty('--admin-primary-tint', theme.primaryTint);
  root.setProperty('--admin-primary-muted', theme.primaryMuted);
  root.setProperty('--admin-primary-shadow', theme.primaryShadow);
  root.setProperty('--admin-primary-alpha-08', theme.primaryAlpha08);
  root.setProperty('--admin-primary-alpha-12', theme.primaryAlpha12);
  root.setProperty('--admin-primary-alpha-16', theme.primaryAlpha16);
  root.setProperty('--admin-primary-alpha-24', theme.primaryAlpha24);
  root.setProperty('--admin-primary-alpha-40', theme.primaryAlpha40);
  root.setProperty('--admin-sidebar', theme.sidebar);
  root.setProperty('--admin-sidebar-deep', theme.sidebarDeep);
  root.setProperty('--admin-page', theme.page);
  root.setProperty('--el-color-primary', theme.primary);
  root.setProperty('--el-color-primary-light-3', theme.elLight3);
  root.setProperty('--el-color-primary-light-5', theme.elLight5);
  root.setProperty('--el-color-primary-light-7', theme.elLight7);
  root.setProperty('--el-color-primary-light-8', theme.elLight8);
  root.setProperty('--el-color-primary-light-9', theme.elLight9);
  root.setProperty('--el-color-primary-dark-2', theme.primaryDark);
}

export const useTenantStore = defineStore('tenant', () => {
  const tenants = ref<any[]>([]);
  const currentTenant = ref<any>(null);
  const activeTenantId = ref<string>(localStorage.getItem('admin_active_tenant') || '');

  function getTenantDisplayName(tenant: any) {
    return tenant?.branding?.brandName || tenant?.name || '管理后台';
  }

  const activeTenant = computed(() =>
    tenants.value.find(t => t._id === activeTenantId.value) ||
    (currentTenant.value?._id === activeTenantId.value ? currentTenant.value : null)
  );

  const activePrimaryColor = computed(() =>
    activeTenant.value?.branding?.primaryColor ||
    currentTenant.value?.branding?.primaryColor ||
    DEFAULT_ADMIN_PRIMARY
  );

  const displayName = computed(() => {
    if (activeTenant.value) return getTenantDisplayName(activeTenant.value);
    return '管理后台';
  });

  function applyActiveTenantTheme() {
    setThemeVars(activeTenant.value?.branding?.primaryColor || currentTenant.value?.branding?.primaryColor);
  }

  function setTenants(list: any[]) {
    tenants.value = list;
    applyActiveTenantTheme();
  }

  function setCurrentTenant(tenant: any) {
    currentTenant.value = tenant || null;
    applyActiveTenantTheme();
  }

  function setActiveTenant(id: string) {
    activeTenantId.value = id;
    if (id) {
      localStorage.setItem('admin_active_tenant', id);
    } else {
      localStorage.removeItem('admin_active_tenant');
    }
    applyActiveTenantTheme();
  }

  return {
    tenants,
    currentTenant,
    activeTenantId,
    activeTenant,
    activePrimaryColor,
    displayName,
    getTenantDisplayName,
    setTenants,
    setCurrentTenant,
    setActiveTenant,
    applyActiveTenantTheme
  };
});
