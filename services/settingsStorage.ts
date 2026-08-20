/**
 * Client-Side Versioned Settings Storage
 * 
 * Manages local preferences for Appearance and Model Policy.
 * SECURITY DIRECTIVE: Zero API keys or secrets are EVER stored in localStorage.
 * Provider credentials remain strictly server-side.
 */

import type { AppearanceSettings, ModelPolicySettings } from '../server/ai/types';

export const SETTINGS_STORAGE_VERSION = 1;

const STORAGE_KEYS = {
  VERSION: 'jugaad_settings_version',
  APPEARANCE: 'jugaad_appearance_settings_v1',
  MODEL_POLICY: 'jugaad_model_policy_v1',
  LOCAL_TELEMETRY: 'jugaad_local_telemetry_v1',
} as const;

export const DEFAULT_APPEARANCE_SETTINGS: AppearanceSettings = {
  theme: 'light',
  accentColor: '#f43f5e', // Coral default
  uiDensity: 'comfortable',
  animationsEnabled: true,
  reducedMotion: false,
  fontScale: 'normal',
};

export const DEFAULT_MODEL_POLICY_SETTINGS: ModelPolicySettings = {
  freeModelsOnly: true,
  allowPaidModels: false,
  autoRefreshInterval: '1h',
  preferredQuality: 'balanced',
  maxFallbackAttempts: 6,
};

export const ACCENT_COLOR_PRESETS = [
  { name: 'Coral Flame', value: '#f43f5e', class: 'bg-rose-500' },
  { name: 'Electric Indigo', value: '#6366f1', class: 'bg-indigo-500' },
  { name: 'Emerald Flux', value: '#10b981', class: 'bg-emerald-500' },
  { name: 'Amber Glow', value: '#f59e0b', class: 'bg-amber-500' },
  { name: 'Ultra Violet', value: '#8b5cf6', class: 'bg-violet-500' },
  { name: 'Cyber Cyan', value: '#06b6d4', class: 'bg-cyan-500' },
] as const;

/**
 * Ensures storage migrations run on version change.
 */
export function initializeSettingsStorage(): void {
  try {
    const rawVersion = localStorage.getItem(STORAGE_KEYS.VERSION);
    const storedVersion = rawVersion ? parseInt(rawVersion, 10) : 0;

    if (storedVersion < SETTINGS_STORAGE_VERSION) {
      migrateSettings(storedVersion, SETTINGS_STORAGE_VERSION);
      localStorage.setItem(STORAGE_KEYS.VERSION, String(SETTINGS_STORAGE_VERSION));
    }
  } catch (err) {
    console.warn('[SettingsStorage] Failed to initialize settings storage:', err);
  }
}

function migrateSettings(fromVersion: number, toVersion: number): void {
  console.log(`[SettingsStorage] Migrating settings from v${fromVersion} to v${toVersion}...`);
  // Migration hooks for future version increments
  if (fromVersion === 0) {
    // Initial setup: clean any legacy key storage attempts if any existed in older forks
    try {
      localStorage.removeItem('openrouter_api_key');
      localStorage.removeItem('nim_api_key');
    } catch {
      // Ignore
    }
  }
}

export function loadAppearanceSettings(): AppearanceSettings {
  try {
    initializeSettingsStorage();
    const stored = localStorage.getItem(STORAGE_KEYS.APPEARANCE);
    if (stored) {
      const parsed = JSON.parse(stored);
      return { ...DEFAULT_APPEARANCE_SETTINGS, ...parsed };
    }
  } catch (err) {
    console.warn('[SettingsStorage] Error loading appearance settings:', err);
  }
  return { ...DEFAULT_APPEARANCE_SETTINGS };
}

function dispatchAppearanceChanged(updated: AppearanceSettings): void {
  try {
    window.dispatchEvent(new CustomEvent('jugaad:appearancechange', { detail: updated }));
  } catch {}
}

export function saveAppearanceSettings(settings: Partial<AppearanceSettings>): AppearanceSettings {
  try {
    const current = loadAppearanceSettings();
    const updated: AppearanceSettings = { ...current, ...settings };
    localStorage.setItem(STORAGE_KEYS.APPEARANCE, JSON.stringify(updated));
    // keep legacy key in sync for early-boot script + backwards compat
    if (settings.theme) localStorage.setItem('theme', settings.theme);
    applyAppearanceToDOM(updated);
    dispatchAppearanceChanged(updated);
    return updated;
  } catch (err) {
    console.warn('[SettingsStorage] Error saving appearance settings:', err);
    return { ...DEFAULT_APPEARANCE_SETTINGS, ...settings };
  }
}

export function resetAppearanceSettings(): AppearanceSettings {
  try {
    localStorage.setItem(STORAGE_KEYS.APPEARANCE, JSON.stringify(DEFAULT_APPEARANCE_SETTINGS));
    localStorage.setItem('theme', DEFAULT_APPEARANCE_SETTINGS.theme);
    applyAppearanceToDOM(DEFAULT_APPEARANCE_SETTINGS);
    dispatchAppearanceChanged(DEFAULT_APPEARANCE_SETTINGS);
  } catch (err) {
    console.warn('[SettingsStorage] Error resetting appearance settings:', err);
  }
  return { ...DEFAULT_APPEARANCE_SETTINGS };
}

export function loadModelPolicySettings(): ModelPolicySettings {
  try {
    initializeSettingsStorage();
    const stored = localStorage.getItem(STORAGE_KEYS.MODEL_POLICY);
    if (stored) {
      const parsed = JSON.parse(stored);
      return { ...DEFAULT_MODEL_POLICY_SETTINGS, ...parsed };
    }
  } catch (err) {
    console.warn('[SettingsStorage] Error loading model policy settings:', err);
  }
  return { ...DEFAULT_MODEL_POLICY_SETTINGS };
}

export function saveModelPolicySettings(settings: Partial<ModelPolicySettings>): ModelPolicySettings {
  try {
    const current = loadModelPolicySettings();
    const updated: ModelPolicySettings = { ...current, ...settings };
    localStorage.setItem(STORAGE_KEYS.MODEL_POLICY, JSON.stringify(updated));
    return updated;
  } catch (err) {
    console.warn('[SettingsStorage] Error saving model policy settings:', err);
    return { ...DEFAULT_MODEL_POLICY_SETTINGS, ...settings };
  }
}

export function resetModelPolicySettings(): ModelPolicySettings {
  try {
    localStorage.setItem(STORAGE_KEYS.MODEL_POLICY, JSON.stringify(DEFAULT_MODEL_POLICY_SETTINGS));
  } catch (err) {
    console.warn('[SettingsStorage] Error resetting model policy settings:', err);
  }
  return { ...DEFAULT_MODEL_POLICY_SETTINGS };
}

/**
 * Applies active appearance settings (CSS variables, root classes, datasets) to the DOM.
 */
export function applyAppearanceToDOM(settings: AppearanceSettings): void {
  const root = document.documentElement;

  // 1. Theme class
  let resolvedTheme: 'light' | 'dark' = 'light';
  if (settings.theme === 'dark') {
    root.classList.add('dark');
    resolvedTheme = 'dark';
  } else if (settings.theme === 'light') {
    root.classList.remove('dark');
    resolvedTheme = 'light';
  } else if (settings.theme === 'system') {
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    if (prefersDark) {
      root.classList.add('dark');
      resolvedTheme = 'dark';
    } else {
      root.classList.remove('dark');
      resolvedTheme = 'light';
    }
  }
  // Keep <meta name="theme-color"> in sync for PWA/browser chrome
  try {
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', resolvedTheme === 'dark' ? '#0c0d11' : '#f4f1ec');
  } catch {}

  // 2. Accent Color CSS variable
  if (settings.accentColor) {
    root.style.setProperty('--editorial-coral', settings.accentColor);
    root.style.setProperty('--editorial-accent', settings.accentColor);
  }

  // 3. UI Density dataset
  root.setAttribute('data-density', settings.uiDensity || 'comfortable');

  // 4. Font Scale dataset
  root.setAttribute('data-font-scale', settings.fontScale || 'normal');

  // 5. Animations & Reduced Motion
  if (!settings.animationsEnabled || settings.reducedMotion) {
    root.classList.add('reduce-motion');
  } else {
    root.classList.remove('reduce-motion');
  }
}
