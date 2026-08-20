import React, { useState, useEffect, useCallback } from 'react';
import {
  Sparkles,
  Sliders,
  Key,
  ShieldCheck,
  Activity,
  RotateCcw,
  Check,
  AlertCircle,
  Eye,
  EyeOff,
  RefreshCw,
  Trash2,
  Cpu,
  Zap,
  Layers,
  Palette,
  CheckCircle2,
  XCircle,
  HelpCircle,
} from 'lucide-react';
import {
  loadAppearanceSettings,
  saveAppearanceSettings,
  resetAppearanceSettings,
  loadModelPolicySettings,
  saveModelPolicySettings,
  resetModelPolicySettings,
  ACCENT_COLOR_PRESETS,
} from '../services/settingsStorage';
import {
  aiFetchHealth,
  aiRefreshModels,
  aiTestProvider,
  aiSaveProviderKeys,
  aiSaveCustomEndpoint,
  aiFetchCustomEndpoint,
  aiClearTelemetry,
  HealthResponse,
} from '../services/aiGatewayClient';
import type { AppearanceSettings, ModelPolicySettings, ProviderName } from '../server/ai/types';

interface SettingsProps {
  currentTheme?: 'light' | 'dark';
  onThemeChange?: (theme: 'light' | 'dark') => void;
}

export const Settings: React.FC<SettingsProps> = () => {
  const [activeTab, setActiveTab] = useState<'appearance' | 'providers' | 'policy' | 'diagnostics'>('appearance');

  // Appearance State
  const [appearance, setAppearance] = useState<AppearanceSettings>(loadAppearanceSettings);
  const [appearanceSavedMessage, setAppearanceSavedMessage] = useState('');

  // Model Policy State
  const [modelPolicy, setModelPolicy] = useState<ModelPolicySettings>(loadModelPolicySettings);
  const [policySavedMessage, setPolicySavedMessage] = useState('');

  // Provider Keys Input State (Inputs are strictly temporary for submitting to the server; NEVER saved in localStorage)
  const [customEndpoint, setCustomEndpoint] = useState('');
  const [customModel, setCustomModel] = useState('');
  const [customKey, setCustomKey] = useState('');
  const [openrouterKeyInput, setOpenrouterKeyInput] = useState('');
  const [nimKeyInput, setNimKeyInput] = useState('');
  const [huggingfaceKeyInput, setHuggingfaceKeyInput] = useState('');
  const [cloudflareKeyInput, setCloudflareKeyInput] = useState('');

  // Show/Hide Key visibility toggles
  const [showOpenrouterKey, setShowOpenrouterKey] = useState(false);
  const [showNimKey, setShowNimKey] = useState(false);
  const [showHuggingfaceKey, setShowHuggingfaceKey] = useState(false);
  const [showCloudflareKey, setShowCloudflareKey] = useState(false);

  // Provider Save & Test Statuses
  const [savingProvider, setSavingProvider] = useState<string | null>(null);
  const [testingProvider, setTestingProvider] = useState<string | null>(null);
  const [providerFeedback, setProviderFeedback] = useState<Record<string, { type: 'success' | 'error' | 'info'; message: string }>>({});

  // Health & Diagnostics Data
  const [healthData, setHealthData] = useState<HealthResponse | null>(null);
  const [isLoadingHealth, setIsLoadingHealth] = useState(false);
  const [isRefreshingCatalog, setIsRefreshingCatalog] = useState(false);
  const [catalogRefreshMsg, setCatalogRefreshMsg] = useState('');

  const fetchHealthData = useCallback(async () => {
    setIsLoadingHealth(true);
    try {
      const data = await aiFetchHealth();
      setHealthData(data);
    } catch (err) {
      console.warn('[Settings] Health fetch error:', err);
    } finally {
      setIsLoadingHealth(false);
    }
  }, []);

  useEffect(() => {
    fetchHealthData();
    aiFetchCustomEndpoint().then((data) => {
      setCustomEndpoint(data.endpoint);
      setCustomModel(data.model);
    }).catch(() => undefined);
  }, [fetchHealthData]);

  // Handle Appearance Changes
  const handleUpdateAppearance = (updates: Partial<AppearanceSettings>) => {
    const updated = saveAppearanceSettings(updates);
    setAppearance(updated);
    setAppearanceSavedMessage('Appearance updated');
    setTimeout(() => setAppearanceSavedMessage(''), 2500);
  };

  const handleResetAppearance = () => {
    const reset = resetAppearanceSettings();
    setAppearance(reset);
    setAppearanceSavedMessage('Appearance reset to defaults');
    setTimeout(() => setAppearanceSavedMessage(''), 2500);
  };

  // Handle Model Policy Changes
  const handleUpdatePolicy = (updates: Partial<ModelPolicySettings>) => {
    const updated = saveModelPolicySettings(updates);
    setModelPolicy(updated);
    setPolicySavedMessage('Policy preferences saved');
    setTimeout(() => setPolicySavedMessage(''), 2500);
  };

  const handleResetPolicy = () => {
    const reset = resetModelPolicySettings();
    setModelPolicy(reset);
    setPolicySavedMessage('Model policy reset to defaults');
    setTimeout(() => setPolicySavedMessage(''), 2500);
  };

  // Save Provider Keys to Server
  const handleSaveKeys = async (provider: ProviderName, keysInput: string) => {
    if (!keysInput.trim()) return;
    setSavingProvider(provider);
    setProviderFeedback((prev) => ({ ...prev, [provider]: { type: 'info', message: 'Saving securely to server...' } }));

    try {
      const res = await aiSaveProviderKeys(provider, keysInput);
      if (res.success) {
        setProviderFeedback((prev) => ({
          ...prev,
          [provider]: {
            type: 'success',
            message: `Saved ${res.totalKeys} key(s) to server. Active: ${res.activeKeys}`,
          },
        }));
        // Clear input to not retain raw key in memory
        if (provider === 'openrouter') setOpenrouterKeyInput('');
        if (provider === 'nim') setNimKeyInput('');
        if (provider === 'huggingface') setHuggingfaceKeyInput('');
        if (provider === 'cloudflare') setCloudflareKeyInput('');

        // Refresh health data
        fetchHealthData();
      } else {
        setProviderFeedback((prev) => ({
          ...prev,
          [provider]: { type: 'error', message: res.message || 'Failed to save keys' },
        }));
      }
    } catch (err: any) {
      setProviderFeedback((prev) => ({
        ...prev,
        [provider]: { type: 'error', message: err.message || 'Server connection error' },
      }));
    } finally {
      setSavingProvider(null);
    }
  };

  // Test Provider Connection
  const handleTestProvider = async (provider: ProviderName, keyInput?: string) => {
    setTestingProvider(provider);
    setProviderFeedback((prev) => ({ ...prev, [provider]: { type: 'info', message: 'Testing connection...' } }));

    try {
      const res = await aiTestProvider(provider, keyInput?.trim() || undefined);
      if (res.success) {
        setProviderFeedback((prev) => ({
          ...prev,
          [provider]: {
            type: 'success',
            message: `${res.message} (Latency: ${res.latencyMs}ms)`,
          },
        }));
      } else {
        setProviderFeedback((prev) => ({
          ...prev,
          [provider]: {
            type: 'error',
            message: res.message || res.error || 'Provider connection test failed',
          },
        }));
      }
      fetchHealthData();
    } catch (err: any) {
      setProviderFeedback((prev) => ({
        ...prev,
        [provider]: { type: 'error', message: err.message || 'Test failed' },
      }));
    } finally {
      setTestingProvider(null);
    }
  };

  const handleSaveCustomEndpoint = async () => {
    setSavingProvider('custom');
    try {
      const res = await aiSaveCustomEndpoint({ endpoint: customEndpoint, model: customModel, key: customKey });
      setProviderFeedback((prev) => ({ ...prev, custom: { type: res.success ? 'success' : 'error', message: res.message } }));
      if (res.success) setCustomKey('');
      fetchHealthData();
    } catch (err: any) {
      setProviderFeedback((prev) => ({ ...prev, custom: { type: 'error', message: err.message || 'Failed to save endpoint' } }));
    } finally { setSavingProvider(null); }
  };

  // Refresh AI Model Catalog
  const handleRefreshCatalog = async () => {
    setIsRefreshingCatalog(true);
    setCatalogRefreshMsg('Discovering provider models...');
    try {
      const res = await aiRefreshModels({ freeOnly: modelPolicy.freeModelsOnly });
      setCatalogRefreshMsg(`Catalog refreshed: ${res.count} models available.`);
      fetchHealthData();
    } catch (err: any) {
      setCatalogRefreshMsg(`Refresh failed: ${err.message}`);
    } finally {
      setIsRefreshingCatalog(false);
      setTimeout(() => setCatalogRefreshMsg(''), 4000);
    }
  };

  // Clear Local Telemetry
  const handleClearTelemetry = async () => {
    try {
      await aiClearTelemetry();
      fetchHealthData();
      alert('Local telemetry and recent failure logs cleared.');
    } catch (err: any) {
      alert(`Failed to clear telemetry: ${err.message}`);
    }
  };

  const getProviderStatusBadge = (provider: string) => {
    const statusData = healthData?.providerStatuses?.[provider];
    if (!statusData) {
      return <span className="editorial-badge">UNKNOWN</span>;
    }

    switch (statusData.status) {
      case 'healthy':
        return <span className="editorial-badge bg-emerald-500/20 text-emerald-400 border-emerald-500/30">HEALTHY</span>;
      case 'configured':
        return <span className="editorial-badge bg-cyan-500/20 text-cyan-400 border-cyan-500/30">CONFIGURED</span>;
      case 'degraded':
        return <span className="editorial-badge bg-amber-500/20 text-amber-400 border-amber-500/30">DEGRADED</span>;
      case 'invalid_key':
        return <span className="editorial-badge bg-rose-500/20 text-rose-400 border-rose-500/30">INVALID KEY</span>;
      case 'no_models':
      default:
        return <span className="editorial-badge bg-zinc-500/20 text-zinc-400 border-zinc-500/30">NO MODELS</span>;
    }
  };

  return (
    <div className="editorial-page max-w-6xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-2 mb-2">
          <span className="editorial-badge editorial-badge--coral">SYSTEM / PREFERENCES</span>
          <span className="font-mono text-xs text-[var(--editorial-muted)]">v1.2.0 • AGENT CORE</span>
        </div>
        <h1 className="editorial-page__title text-3xl md:text-4xl font-bold tracking-tight">
          Settings & Orchestration
        </h1>
        <p className="editorial-page__subtitle text-sm text-[var(--editorial-muted)] mt-1">
          Configure visual workspace aesthetics, AI provider key pools, fallback policies, and system diagnostics.
        </p>
      </div>

      {/* Tabs Navigation */}
      <div className="horizontal-scroll-ribbon border-b border-[var(--editorial-rule)] mb-8 pb-1 gap-2 max-w-full">
        <button
          type="button"
          onClick={() => setActiveTab('appearance')}
          className={`flex items-center gap-2 px-4 py-2.5 font-mono text-xs font-bold uppercase tracking-wider border-b-2 transition-all whitespace-nowrap flex-shrink-0 ${
            activeTab === 'appearance'
              ? 'border-[var(--editorial-coral)] text-[var(--editorial-ink)] bg-[var(--editorial-surface)]'
              : 'border-transparent text-[var(--editorial-muted)] hover:text-[var(--editorial-ink)]'
          }`}
        >
          <Palette className="w-4 h-4" />
          <span>Appearance</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('providers')}
          className={`flex items-center gap-2 px-4 py-2.5 font-mono text-xs font-bold uppercase tracking-wider border-b-2 transition-all whitespace-nowrap flex-shrink-0 ${
            activeTab === 'providers'
              ? 'border-[var(--editorial-coral)] text-[var(--editorial-ink)] bg-[var(--editorial-surface)]'
              : 'border-transparent text-[var(--editorial-muted)] hover:text-[var(--editorial-ink)]'
          }`}
        >
          <Key className="w-4 h-4" />
          <span>AI Providers</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('policy')}
          className={`flex items-center gap-2 px-4 py-2.5 font-mono text-xs font-bold uppercase tracking-wider border-b-2 transition-all whitespace-nowrap flex-shrink-0 ${
            activeTab === 'policy'
              ? 'border-[var(--editorial-coral)] text-[var(--editorial-ink)] bg-[var(--editorial-surface)]'
              : 'border-transparent text-[var(--editorial-muted)] hover:text-[var(--editorial-ink)]'
          }`}
        >
          <ShieldCheck className="w-4 h-4" />
          <span>Model Policy</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('diagnostics')}
          className={`flex items-center gap-2 px-4 py-2.5 font-mono text-xs font-bold uppercase tracking-wider border-b-2 transition-all whitespace-nowrap flex-shrink-0 ${
            activeTab === 'diagnostics'
              ? 'border-[var(--editorial-coral)] text-[var(--editorial-ink)] bg-[var(--editorial-surface)]'
              : 'border-transparent text-[var(--editorial-muted)] hover:text-[var(--editorial-ink)]'
          }`}
        >
          <Activity className="w-4 h-4" />
          <span>Diagnostics</span>
        </button>
      </div>

      {/* SECTION A: APPEARANCE */}
      {activeTab === 'appearance' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 motion-fade">
          {/* Theme & Palette Panel */}
          <div className="editorial-panel">
            <div className="editorial-panel__header">
              <div className="flex items-center gap-2">
                <span className="editorial-badge editorial-badge--coral">01 / THEME</span>
                <h2 className="editorial-panel__title m-0 text-base">Color & Theme</h2>
              </div>
            </div>
            <div className="editorial-panel__body flex flex-col gap-6">
              {/* Theme Selector */}
              <div>
                <label className="block font-mono text-xs font-bold uppercase tracking-wider text-[var(--editorial-muted)] mb-2">
                  Color Mode
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {(['dark', 'light', 'system'] as const).map((mode) => (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => handleUpdateAppearance({ theme: mode })}
                      className={`py-2 px-3 border text-xs font-mono font-bold uppercase tracking-wider transition-all ${
                        appearance.theme === mode
                          ? 'border-[var(--editorial-coral)] bg-[var(--editorial-ink)] text-[var(--editorial-paper)] shadow-[2px_2px_0_var(--editorial-coral)]'
                          : 'border-[var(--editorial-rule)] bg-[var(--editorial-surface)] text-[var(--editorial-ink)] hover:border-[var(--editorial-coral)]'
                      }`}
                    >
                      {mode}
                    </button>
                  ))}
                </div>
              </div>

              {/* Accent Color Presets */}
              <div>
                <label className="block font-mono text-xs font-bold uppercase tracking-wider text-[var(--editorial-muted)] mb-2">
                  Accent Color
                </label>
                <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                  {ACCENT_COLOR_PRESETS.map((preset) => {
                    const isSelected = appearance.accentColor === preset.value;
                    return (
                      <button
                        key={preset.value}
                        type="button"
                        onClick={() => handleUpdateAppearance({ accentColor: preset.value })}
                        className={`flex flex-col items-center gap-1.5 p-2 border transition-all ${
                          isSelected
                            ? 'border-[var(--editorial-coral)] bg-[var(--editorial-surface)] ring-1 ring-[var(--editorial-coral)]'
                            : 'border-[var(--editorial-rule)] bg-[var(--editorial-paper)] hover:border-[var(--editorial-coral)]'
                        }`}
                      >
                        <div
                          className="w-5 h-5 rounded-full border border-black/20"
                          style={{ backgroundColor: preset.value }}
                        />
                        <span className="font-mono text-[9px] text-[var(--editorial-muted)] truncate w-full text-center">
                          {preset.name.split(' ')[0]}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* UI Density */}
              <div>
                <label className="block font-mono text-xs font-bold uppercase tracking-wider text-[var(--editorial-muted)] mb-2">
                  UI Density
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {(['compact', 'comfortable', 'spacious'] as const).map((density) => (
                    <button
                      key={density}
                      type="button"
                      onClick={() => handleUpdateAppearance({ uiDensity: density })}
                      className={`py-2 px-3 border text-xs font-mono font-bold uppercase tracking-wider transition-all ${
                        appearance.uiDensity === density
                          ? 'border-[var(--editorial-coral)] bg-[var(--editorial-ink)] text-[var(--editorial-paper)] shadow-[2px_2px_0_var(--editorial-coral)]'
                          : 'border-[var(--editorial-rule)] bg-[var(--editorial-surface)] text-[var(--editorial-ink)] hover:border-[var(--editorial-coral)]'
                      }`}
                    >
                      {density}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Typography & Motion Panel */}
          <div className="editorial-panel flex flex-col justify-between">
            <div>
              <div className="editorial-panel__header">
                <div className="flex items-center gap-2">
                  <span className="editorial-badge editorial-badge--coral">02 / MOTION & TEXT</span>
                  <h2 className="editorial-panel__title m-0 text-base">Typography & Performance</h2>
                </div>
              </div>
              <div className="editorial-panel__body flex flex-col gap-6">
                {/* Font Scale */}
                <div>
                  <label className="block font-mono text-xs font-bold uppercase tracking-wider text-[var(--editorial-muted)] mb-2">
                    Typography Scale
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {(['small', 'normal', 'large'] as const).map((scale) => (
                      <button
                        key={scale}
                        type="button"
                        onClick={() => handleUpdateAppearance({ fontScale: scale })}
                        className={`py-2 px-3 border text-xs font-mono font-bold uppercase tracking-wider transition-all ${
                          appearance.fontScale === scale
                            ? 'border-[var(--editorial-coral)] bg-[var(--editorial-ink)] text-[var(--editorial-paper)] shadow-[2px_2px_0_var(--editorial-coral)]'
                            : 'border-[var(--editorial-rule)] bg-[var(--editorial-surface)] text-[var(--editorial-ink)] hover:border-[var(--editorial-coral)]'
                        }`}
                      >
                        {scale}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Animation Toggle */}
                <div className="flex items-center justify-between p-3 border border-[var(--editorial-rule)] bg-[var(--editorial-surface)]">
                  <div>
                    <div className="font-mono text-xs font-bold text-[var(--editorial-ink)]">Interface Animations</div>
                    <div className="font-mono text-[11px] text-[var(--editorial-muted)]">
                      Enable smooth micro-animations and transitions
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={appearance.animationsEnabled}
                    onChange={(e) => handleUpdateAppearance({ animationsEnabled: e.target.checked })}
                    className="w-4 h-4 accent-[var(--editorial-coral)] cursor-pointer"
                  />
                </div>

                {/* Reduced Motion */}
                <div className="flex items-center justify-between p-3 border border-[var(--editorial-rule)] bg-[var(--editorial-surface)]">
                  <div>
                    <div className="font-mono text-xs font-bold text-[var(--editorial-ink)]">Reduced Motion</div>
                    <div className="font-mono text-[11px] text-[var(--editorial-muted)]">
                      Minimizes all viewport animation effects (WCAG compliant)
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={appearance.reducedMotion}
                    onChange={(e) => handleUpdateAppearance({ reducedMotion: e.target.checked })}
                    className="w-4 h-4 accent-[var(--editorial-coral)] cursor-pointer"
                  />
                </div>
              </div>
            </div>

            {/* Bottom Actions */}
            <div className="p-4 border-t border-[var(--editorial-rule)] bg-[var(--editorial-surface)] flex items-center justify-between">
              <span className="font-mono text-xs text-[var(--editorial-coral)]">
                {appearanceSavedMessage}
              </span>
              <button
                type="button"
                onClick={handleResetAppearance}
                className="editorial-button editorial-button--secondary editorial-button--sm flex items-center gap-1.5"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Reset Appearance</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SECTION B: AI PROVIDERS */}
      {activeTab === 'providers' && (
        <div className="flex flex-col gap-6 motion-fade">
          {/* Security Alert Banner */}
          <div className="p-4 border border-[var(--editorial-coral)]/40 bg-[var(--editorial-coral)]/10 flex items-start gap-3">
            <ShieldCheck className="w-5 h-5 text-[var(--editorial-coral)] flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="font-mono text-xs font-bold uppercase tracking-wider text-[var(--editorial-ink)] m-0">
                Zero-Leak Credential Protocol
              </h3>
              <p className="font-mono text-xs text-[var(--editorial-muted)] m-0 mt-1">
                API credentials are strictly transmitted to the secure server handler and held in server-side key pools.
                Keys are never saved in <code className="text-[var(--editorial-ink)] font-bold">localStorage</code>,
                browser caches, or network response bodies.
              </p>
            </div>
          </div>

          {/* Provider Cards */}
          <div className="grid grid-cols-1 gap-6">
            {/* 1. Custom endpoint */}
            <div className="editorial-panel">
              <div className="editorial-panel__header">
                <div className="flex items-center gap-2">
                  <span className="editorial-badge editorial-badge--coral">CUSTOM</span>
                  <h3 className="editorial-panel__title m-0 text-base">Custom AI Endpoint</h3>
                </div>
                <div className="flex items-center gap-2">
                  {getProviderStatusBadge('custom')}
                </div>
              </div>

              <div className="editorial-panel__body flex flex-col gap-4">
                <div className="flex flex-col gap-1.5">
                  <div className="flex justify-between items-center">
                    <label className="font-mono text-xs font-bold text-[var(--editorial-muted)] uppercase">
                      OpenAI-compatible endpoint URL
                    </label>
                    {healthData?.providerStatuses?.custom?.maskedKeys?.length ? (
                      <span className="font-mono text-[11px] text-[var(--editorial-muted)]">
                        Server configured
                      </span>
                    ) : null}
                  </div>
                  <div className="relative">
                    <input
                      type="url"
                      value={customEndpoint}
                      onChange={(e) => setCustomEndpoint(e.target.value)}
                      placeholder="https://your-host/v1/chat/completions"
                      className="w-full bg-[var(--editorial-surface)] border border-[var(--editorial-rule)] px-3 py-2 text-xs font-mono text-[var(--editorial-ink)] focus:border-[var(--editorial-coral)] outline-none pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => undefined}
                      className="absolute right-2.5 top-2.5 text-[var(--editorial-muted)] hover:text-[var(--editorial-ink)]"
                      title="Custom endpoint"
                    >
                      <span className="text-[10px]">URL</span>
                    </button>
                  </div>
                  <p className="font-mono text-[10.5px] text-[var(--editorial-muted)] m-0">
                    Any OpenAI-compatible endpoint is supported.
                  </p>
                </div>

                <input value={customModel} onChange={(e) => setCustomModel(e.target.value)} placeholder="Model name" className="w-full bg-[var(--editorial-surface)] border border-[var(--editorial-rule)] px-3 py-2 text-xs font-mono text-[var(--editorial-ink)] outline-none" />
                <input type="password" value={customKey} onChange={(e) => setCustomKey(e.target.value)} placeholder="Optional bearer token" className="w-full bg-[var(--editorial-surface)] border border-[var(--editorial-rule)] px-3 py-2 text-xs font-mono text-[var(--editorial-ink)] outline-none" />
                {providerFeedback.custom && (
                  <div
                    className={`p-2.5 text-xs font-mono border ${
                      providerFeedback.custom.type === 'success'
                        ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400'
                        : providerFeedback.custom.type === 'error'
                        ? 'border-rose-500/30 bg-rose-500/10 text-rose-400'
                        : 'border-zinc-500/30 bg-zinc-500/10 text-zinc-300'
                    }`}
                  >
                    {providerFeedback.custom.message}
                  </div>
                )}

                <div className="flex items-center gap-2 pt-2">
                  <button
                    type="button"
                    onClick={handleSaveCustomEndpoint}
                    disabled={!customEndpoint.trim() || !customModel.trim() || savingProvider === 'custom'}
                    className="editorial-button editorial-button--primary editorial-button--sm"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>{savingProvider === 'custom' ? 'Saving...' : 'Save Endpoint'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleTestProvider('custom', customKey)}
                    disabled={testingProvider === 'custom'}
                    className="editorial-button editorial-button--secondary editorial-button--sm"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${testingProvider === 'custom' ? 'animate-spin' : ''}`} />
                    <span>{testingProvider === 'custom' ? 'Testing...' : 'Test Connection'}</span>
                  </button>
                </div>
              </div>
            </div>

            {/* 2. OpenRouter */}
            <div className="editorial-panel">
              <div className="editorial-panel__header">
                <div className="flex items-center gap-2">
                  <span className="editorial-badge editorial-badge--coral">OPENROUTER</span>
                  <h3 className="editorial-panel__title m-0 text-base">OpenRouter</h3>
                </div>
                <div className="flex items-center gap-2">
                  {getProviderStatusBadge('openrouter')}
                </div>
              </div>

              <div className="editorial-panel__body flex flex-col gap-4">
                <div className="flex flex-col gap-1.5">
                  <div className="flex justify-between items-center">
                    <label className="font-mono text-xs font-bold text-[var(--editorial-muted)] uppercase">
                      OpenRouter API Key(s)
                    </label>
                    {healthData?.providerStatuses?.openrouter?.maskedKeys?.length ? (
                      <span className="font-mono text-[11px] text-[var(--editorial-muted)]">
                        Server configured: {healthData.providerStatuses.openrouter.maskedKeys.join(', ')}
                      </span>
                    ) : null}
                  </div>
                  <div className="relative">
                    <input
                      type={showOpenrouterKey ? 'text' : 'password'}
                      value={openrouterKeyInput}
                      onChange={(e) => setOpenrouterKeyInput(e.target.value)}
                      placeholder="Paste OpenRouter API key (sk-or-v1-...)"
                      className="w-full bg-[var(--editorial-surface)] border border-[var(--editorial-rule)] px-3 py-2 text-xs font-mono text-[var(--editorial-ink)] focus:border-[var(--editorial-coral)] outline-none pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowOpenrouterKey((prev) => !prev)}
                      className="absolute right-2.5 top-2.5 text-[var(--editorial-muted)] hover:text-[var(--editorial-ink)]"
                      title={showOpenrouterKey ? 'Hide key' : 'Show key'}
                    >
                      {showOpenrouterKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  <p className="font-mono text-[10.5px] text-[var(--editorial-muted)] m-0">
                    Auto-discovers verified <code>:free</code> models on OpenRouter with zero token charges.
                  </p>
                </div>

                {providerFeedback.openrouter && (
                  <div
                    className={`p-2.5 text-xs font-mono border ${
                      providerFeedback.openrouter.type === 'success'
                        ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400'
                        : providerFeedback.openrouter.type === 'error'
                        ? 'border-rose-500/30 bg-rose-500/10 text-rose-400'
                        : 'border-zinc-500/30 bg-zinc-500/10 text-zinc-300'
                    }`}
                  >
                    {providerFeedback.openrouter.message}
                  </div>
                )}

                <div className="flex items-center gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => handleSaveKeys('openrouter', openrouterKeyInput)}
                    disabled={!openrouterKeyInput.trim() || savingProvider === 'openrouter'}
                    className="editorial-button editorial-button--primary editorial-button--sm"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>{savingProvider === 'openrouter' ? 'Saving...' : 'Save OpenRouter Key'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleTestProvider('openrouter', openrouterKeyInput)}
                    disabled={testingProvider === 'openrouter'}
                    className="editorial-button editorial-button--secondary editorial-button--sm"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${testingProvider === 'openrouter' ? 'animate-spin' : ''}`} />
                    <span>{testingProvider === 'openrouter' ? 'Testing...' : 'Test Connection'}</span>
                  </button>
                </div>
              </div>
            </div>

            {/* 3. NVIDIA NIM */}
            <div className="editorial-panel">
              <div className="editorial-panel__header">
                <div className="flex items-center gap-2">
                  <span className="editorial-badge editorial-badge--coral">NVIDIA NIM</span>
                  <h3 className="editorial-panel__title m-0 text-base">NVIDIA NIM Microservices</h3>
                </div>
                <div className="flex items-center gap-2">
                  {getProviderStatusBadge('nim')}
                </div>
              </div>

              <div className="editorial-panel__body flex flex-col gap-4">
                <div className="flex flex-col gap-1.5">
                  <div className="flex justify-between items-center">
                    <label className="font-mono text-xs font-bold text-[var(--editorial-muted)] uppercase">
                      NVIDIA NIM API Key(s)
                    </label>
                    {healthData?.providerStatuses?.nim?.maskedKeys?.length ? (
                      <span className="font-mono text-[11px] text-[var(--editorial-muted)]">
                        Server configured: {healthData.providerStatuses.nim.maskedKeys.join(', ')}
                      </span>
                    ) : null}
                  </div>
                  <div className="relative">
                    <input
                      type={showNimKey ? 'text' : 'password'}
                      value={nimKeyInput}
                      onChange={(e) => setNimKeyInput(e.target.value)}
                      placeholder="Paste NVIDIA NIM API key (nvapi-...)"
                      className="w-full bg-[var(--editorial-surface)] border border-[var(--editorial-rule)] px-3 py-2 text-xs font-mono text-[var(--editorial-ink)] focus:border-[var(--editorial-coral)] outline-none pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowNimKey((prev) => !prev)}
                      className="absolute right-2.5 top-2.5 text-[var(--editorial-muted)] hover:text-[var(--editorial-ink)]"
                      title={showNimKey ? 'Hide key' : 'Show key'}
                    >
                      {showNimKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  <p className="font-mono text-[10.5px] text-[var(--editorial-muted)] m-0">
                    Supports high-speed vision & reasoning models (Llama 3.2 Vision, Nemotron).
                  </p>
                </div>

                {providerFeedback.nim && (
                  <div
                    className={`p-2.5 text-xs font-mono border ${
                      providerFeedback.nim.type === 'success'
                        ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400'
                        : providerFeedback.nim.type === 'error'
                        ? 'border-rose-500/30 bg-rose-500/10 text-rose-400'
                        : 'border-zinc-500/30 bg-zinc-500/10 text-zinc-300'
                    }`}
                  >
                    {providerFeedback.nim.message}
                  </div>
                )}

                <div className="flex items-center gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => handleSaveKeys('nim', nimKeyInput)}
                    disabled={!nimKeyInput.trim() || savingProvider === 'nim'}
                    className="editorial-button editorial-button--primary editorial-button--sm"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>{savingProvider === 'nim' ? 'Saving...' : 'Save NIM Key'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleTestProvider('nim', nimKeyInput)}
                    disabled={testingProvider === 'nim'}
                    className="editorial-button editorial-button--secondary editorial-button--sm"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${testingProvider === 'nim' ? 'animate-spin' : ''}`} />
                    <span>{testingProvider === 'nim' ? 'Testing...' : 'Test Connection'}</span>
                  </button>
                </div>
              </div>
            </div>

            {/* 4. Hugging Face */}
            <div className="editorial-panel">
              <div className="editorial-panel__header">
                <div className="flex items-center gap-2">
                  <span className="editorial-badge editorial-badge--coral">HUGGING FACE</span>
                  <h3 className="editorial-panel__title m-0 text-base">Hugging Face Serverless</h3>
                </div>
                <div className="flex items-center gap-2">
                  {getProviderStatusBadge('huggingface')}
                </div>
              </div>

              <div className="editorial-panel__body flex flex-col gap-4">
                <div className="flex flex-col gap-1.5">
                  <div className="flex justify-between items-center">
                    <label className="font-mono text-xs font-bold text-[var(--editorial-muted)] uppercase">
                      Hugging Face API Token(s)
                    </label>
                    {healthData?.providerStatuses?.huggingface?.maskedKeys?.length ? (
                      <span className="font-mono text-[11px] text-[var(--editorial-muted)]">
                        Server configured: {healthData.providerStatuses.huggingface.maskedKeys.join(', ')}
                      </span>
                    ) : null}
                  </div>
                  <div className="relative">
                    <input
                      type={showHuggingfaceKey ? 'text' : 'password'}
                      value={huggingfaceKeyInput}
                      onChange={(e) => setHuggingfaceKeyInput(e.target.value)}
                      placeholder="Paste Hugging Face API Token (hf_...)"
                      className="w-full bg-[var(--editorial-surface)] border border-[var(--editorial-rule)] px-3 py-2 text-xs font-mono text-[var(--editorial-ink)] focus:border-[var(--editorial-coral)] outline-none pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowHuggingfaceKey((prev) => !prev)}
                      className="absolute right-2.5 top-2.5 text-[var(--editorial-muted)] hover:text-[var(--editorial-ink)]"
                      title={showHuggingfaceKey ? 'Hide key' : 'Show key'}
                    >
                      {showHuggingfaceKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  <p className="font-mono text-[10.5px] text-[var(--editorial-muted)] m-0">
                    Powers free vision models (Qwen 2.5 VL, GLM 4.6V, Aya Vision) with zero token costs.
                  </p>
                </div>

                {providerFeedback.huggingface && (
                  <div
                    className={`p-2.5 text-xs font-mono border ${
                      providerFeedback.huggingface.type === 'success'
                        ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400'
                        : providerFeedback.huggingface.type === 'error'
                        ? 'border-rose-500/30 bg-rose-500/10 text-rose-400'
                        : 'border-zinc-500/30 bg-zinc-500/10 text-zinc-300'
                    }`}
                  >
                    {providerFeedback.huggingface.message}
                  </div>
                )}

                <div className="flex items-center gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => handleSaveKeys('huggingface', huggingfaceKeyInput)}
                    disabled={!huggingfaceKeyInput.trim() || savingProvider === 'huggingface'}
                    className="editorial-button editorial-button--primary editorial-button--sm"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>{savingProvider === 'huggingface' ? 'Saving...' : 'Save Hugging Face Key'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleTestProvider('huggingface', huggingfaceKeyInput)}
                    disabled={testingProvider === 'huggingface'}
                    className="editorial-button editorial-button--secondary editorial-button--sm"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${testingProvider === 'huggingface' ? 'animate-spin' : ''}`} />
                    <span>{testingProvider === 'huggingface' ? 'Testing...' : 'Test Connection'}</span>
                  </button>
                </div>
              </div>
            </div>

            {/* 5. Cloudflare */}
            <div className="editorial-panel">
              <div className="editorial-panel__header">
                <div className="flex items-center gap-2">
                  <span className="editorial-badge editorial-badge--coral">CLOUDFLARE</span>
                  <h3 className="editorial-panel__title m-0 text-base">Cloudflare AI</h3>
                </div>
                <div className="flex items-center gap-2">
                  {getProviderStatusBadge('cloudflare')}
                </div>
              </div>

              <div className="editorial-panel__body flex flex-col gap-4">
                <div className="flex flex-col gap-1.5">
                  <div className="flex justify-between items-center">
                    <label className="font-mono text-xs font-bold text-[var(--editorial-muted)] uppercase">
                      Cloudflare API Token
                    </label>
                    {healthData?.providerStatuses?.cloudflare?.maskedKeys?.length ? (
                      <span className="font-mono text-[11px] text-[var(--editorial-muted)]">
                        Server configured: {healthData.providerStatuses.cloudflare.maskedKeys.join(', ')}
                      </span>
                    ) : null}
                  </div>
                  <div className="relative">
                    <input
                      type={showCloudflareKey ? 'text' : 'password'}
                      value={cloudflareKeyInput}
                      onChange={(e) => setCloudflareKeyInput(e.target.value)}
                      placeholder="Paste Cloudflare API Token (cfut_...)"
                      className="w-full bg-[var(--editorial-surface)] border border-[var(--editorial-rule)] px-3 py-2 text-xs font-mono text-[var(--editorial-ink)] focus:border-[var(--editorial-coral)] outline-none pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowCloudflareKey((prev) => !prev)}
                      className="absolute right-2.5 top-2.5 text-[var(--editorial-muted)] hover:text-[var(--editorial-ink)]"
                      title={showCloudflareKey ? 'Hide key' : 'Show key'}
                    >
                      {showCloudflareKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  <p className="font-mono text-[10.5px] text-[var(--editorial-muted)] m-0">
                    Fast edge-based AI with Workers AI models.
                  </p>
                </div>

                {providerFeedback.cloudflare && (
                  <div
                    className={`p-2.5 text-xs font-mono border ${
                      providerFeedback.cloudflare.type === 'success'
                        ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400'
                        : providerFeedback.cloudflare.type === 'error'
                        ? 'border-rose-500/30 bg-rose-500/10 text-rose-400'
                        : 'border-zinc-500/30 bg-zinc-500/10 text-zinc-300'
                    }`}
                  >
                    {providerFeedback.cloudflare.message}
                  </div>
                )}

                <div className="flex items-center gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => handleSaveKeys('cloudflare', cloudflareKeyInput)}
                    disabled={!cloudflareKeyInput.trim() || savingProvider === 'cloudflare'}
                    className="editorial-button editorial-button--primary editorial-button--sm"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>{savingProvider === 'cloudflare' ? 'Saving...' : 'Save Cloudflare Token'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleTestProvider('cloudflare', cloudflareKeyInput)}
                    disabled={testingProvider === 'cloudflare'}
                    className="editorial-button editorial-button--secondary editorial-button--sm"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${testingProvider === 'cloudflare' ? 'animate-spin' : ''}`} />
                    <span>{testingProvider === 'cloudflare' ? 'Testing...' : 'Test Connection'}</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SECTION C: MODEL POLICY */}
      {activeTab === 'policy' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 motion-fade">
          <div className="editorial-panel">
            <div className="editorial-panel__header">
              <div className="flex items-center gap-2">
                <span className="editorial-badge editorial-badge--coral">01 / ROUTING RULES</span>
                <h2 className="editorial-panel__title m-0 text-base">Cost & Discovery Rules</h2>
              </div>
            </div>

            <div className="editorial-panel__body flex flex-col gap-6">
              {/* Free Models Only Toggle */}
              <div className="flex items-center justify-between p-3.5 border border-[var(--editorial-rule)] bg-[var(--editorial-surface)]">
                <div>
                  <div className="font-mono text-xs font-bold text-[var(--editorial-ink)]">
                    Free Models Only (Recommended)
                  </div>
                  <div className="font-mono text-[11px] text-[var(--editorial-muted)] mt-0.5">
                    Strictly routes only to models with <code>verifiedFree === true</code> ($0 cost).
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={modelPolicy.freeModelsOnly}
                  onChange={(e) => handleUpdatePolicy({ freeModelsOnly: e.target.checked })}
                  className="w-4 h-4 accent-[var(--editorial-coral)] cursor-pointer"
                />
              </div>

              {/* Allow Paid Models Toggle */}
              <div className="flex items-center justify-between p-3.5 border border-[var(--editorial-rule)] bg-[var(--editorial-surface)]">
                <div>
                  <div className="font-mono text-xs font-bold text-[var(--editorial-ink)]">
                    Allow Paid Models
                  </div>
                  <div className="font-mono text-[11px] text-[var(--editorial-muted)] mt-0.5">
                    Permits routing to premium paid endpoints if keys are funded.
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={modelPolicy.allowPaidModels}
                  onChange={(e) => handleUpdatePolicy({ allowPaidModels: e.target.checked })}
                  className="w-4 h-4 accent-[var(--editorial-coral)] cursor-pointer"
                />
              </div>

              {/* Auto Refresh Interval */}
              <div>
                <label className="block font-mono text-xs font-bold uppercase tracking-wider text-[var(--editorial-muted)] mb-2">
                  Catalog Auto-Refresh Interval
                </label>
                <select
                  value={modelPolicy.autoRefreshInterval}
                  onChange={(e) => handleUpdatePolicy({ autoRefreshInterval: e.target.value as any })}
                  className="w-full bg-[var(--editorial-surface)] border border-[var(--editorial-rule)] px-3 py-2 text-xs font-mono font-bold uppercase text-[var(--editorial-ink)] focus:border-[var(--editorial-coral)] outline-none"
                >
                  <option value="15m">Every 15 Minutes</option>
                  <option value="30m">Every 30 Minutes</option>
                  <option value="1h">Every 1 Hour (Default)</option>
                  <option value="6h">Every 6 Hours</option>
                  <option value="24h">Every 24 Hours</option>
                  <option value="manual">Manual Refresh Only</option>
                </select>
              </div>
            </div>
          </div>

          <div className="editorial-panel flex flex-col justify-between">
            <div>
              <div className="editorial-panel__header">
                <div className="flex items-center gap-2">
                  <span className="editorial-badge editorial-badge--coral">02 / QUALITY & RESILIENCE</span>
                  <h2 className="editorial-panel__title m-0 text-base">Execution Preferences</h2>
                </div>
              </div>

              <div className="editorial-panel__body flex flex-col gap-6">
                {/* Preferred Quality Tier */}
                <div>
                  <label className="block font-mono text-xs font-bold uppercase tracking-wider text-[var(--editorial-muted)] mb-2">
                    Default Quality Tier
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { id: 'fast', label: 'Fast / Efficient' },
                      { id: 'balanced', label: 'Balanced / Standard' },
                      { id: 'quality', label: 'High Quality / Deep' },
                    ].map((tier) => (
                      <button
                        key={tier.id}
                        type="button"
                        onClick={() => handleUpdatePolicy({ preferredQuality: tier.id as any })}
                        className={`py-2 px-2 border text-[11px] font-mono font-bold uppercase tracking-wider transition-all text-center ${
                          modelPolicy.preferredQuality === tier.id
                            ? 'border-[var(--editorial-coral)] bg-[var(--editorial-ink)] text-[var(--editorial-paper)] shadow-[2px_2px_0_var(--editorial-coral)]'
                            : 'border-[var(--editorial-rule)] bg-[var(--editorial-surface)] text-[var(--editorial-ink)] hover:border-[var(--editorial-coral)]'
                        }`}
                      >
                        {tier.label.split(' / ')[0]}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Maximum Fallback Attempts */}
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <label className="font-mono text-xs font-bold uppercase tracking-wider text-[var(--editorial-muted)]">
                      Max Fallback Attempts
                    </label>
                    <span className="font-mono text-xs font-bold text-[var(--editorial-coral)]">
                      {modelPolicy.maxFallbackAttempts} Attempts
                    </span>
                  </div>
                  <input
                    type="range"
                    min="1"
                    max="10"
                    value={modelPolicy.maxFallbackAttempts}
                    onChange={(e) => handleUpdatePolicy({ maxFallbackAttempts: parseInt(e.target.value, 10) })}
                    className="w-full accent-[var(--editorial-coral)] cursor-pointer"
                  />
                  <div className="flex justify-between font-mono text-[10px] text-[var(--editorial-muted)] mt-1">
                    <span>1 (Fast Fail)</span>
                    <span>6 (Default)</span>
                    <span>10 (Max Resilience)</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Bottom Actions */}
            <div className="p-4 border-t border-[var(--editorial-rule)] bg-[var(--editorial-surface)] flex items-center justify-between">
              <span className="font-mono text-xs text-[var(--editorial-coral)]">{policySavedMessage}</span>
              <button
                type="button"
                onClick={handleResetPolicy}
                className="editorial-button editorial-button--secondary editorial-button--sm flex items-center gap-1.5"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Reset Policy</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SECTION D: DIAGNOSTICS */}
      {activeTab === 'diagnostics' && (
        <div className="flex flex-col gap-6 motion-fade">
          {/* Quick Metrics */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="p-4 border border-[var(--editorial-rule)] bg-[var(--editorial-surface)] flex flex-col gap-1">
              <span className="font-mono text-[10px] uppercase tracking-wider text-[var(--editorial-muted)]">
                TOTAL MODELS
              </span>
              <span className="font-mono text-2xl font-bold text-[var(--editorial-ink)]">
                {healthData?.registryStats?.totalModels ?? '-'}
              </span>
            </div>

            <div className="p-4 border border-[var(--editorial-rule)] bg-[var(--editorial-surface)] flex flex-col gap-1">
              <span className="font-mono text-[10px] uppercase tracking-wider text-[var(--editorial-coral)]">
                VERIFIED FREE
              </span>
              <span className="font-mono text-2xl font-bold text-[var(--editorial-coral)]">
                {healthData?.registryStats?.verifiedFreeModels ?? '-'}
              </span>
            </div>

            <div className="p-4 border border-[var(--editorial-rule)] bg-[var(--editorial-surface)] flex flex-col gap-1">
              <span className="font-mono text-[10px] uppercase tracking-wider text-emerald-400">
                VISION CAPABLE
              </span>
              <span className="font-mono text-2xl font-bold text-emerald-400">
                {healthData?.registryStats?.visionModels ?? '-'}
              </span>
            </div>

            <div className="p-4 border border-[var(--editorial-rule)] bg-[var(--editorial-surface)] flex flex-col gap-1">
              <span className="font-mono text-[10px] uppercase tracking-wider text-indigo-400">
                LAST CATALOG SYNC
              </span>
              <span className="font-mono text-xs font-bold text-indigo-400 truncate mt-1.5">
                {healthData?.registryStats?.lastRefreshed
                  ? new Date(healthData.registryStats.lastRefreshed).toLocaleTimeString()
                  : 'N/A'}
              </span>
            </div>
          </div>

          {/* Action Bar */}
          <div className="flex flex-wrap items-center justify-between gap-4 p-4 border border-[var(--editorial-rule)] bg-[var(--editorial-surface)]">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleRefreshCatalog}
                disabled={isRefreshingCatalog}
                className="editorial-button editorial-button--primary editorial-button--sm flex items-center gap-1.5"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isRefreshingCatalog ? 'animate-spin' : ''}`} />
                <span>{isRefreshingCatalog ? 'Refreshing Catalog...' : 'Manual Refresh Catalog'}</span>
              </button>
              <button
                type="button"
                onClick={fetchHealthData}
                disabled={isLoadingHealth}
                className="editorial-button editorial-button--secondary editorial-button--sm flex items-center gap-1.5"
              >
                <Activity className="w-3.5 h-3.5" />
                <span>Poll Health</span>
              </button>
            </div>

            <div className="flex items-center gap-3">
              {catalogRefreshMsg && (
                <span className="font-mono text-xs text-[var(--editorial-coral)] font-bold">
                  {catalogRefreshMsg}
                </span>
              )}
              <button
                type="button"
                onClick={handleClearTelemetry}
                className="editorial-button editorial-button--secondary editorial-button--sm text-rose-400 hover:text-rose-300"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Clear Local Telemetry</span>
              </button>
            </div>
          </div>

          {/* Recent Failures Log */}
          <div className="editorial-panel">
            <div className="editorial-panel__header">
              <div className="flex items-center gap-2">
                <span className="editorial-badge editorial-badge--coral">TELEMETRY</span>
                <h3 className="editorial-panel__title m-0 text-base">Recent Execution Failures (Sanitized)</h3>
              </div>
              <span className="font-mono text-xs text-[var(--editorial-muted)]">
                {healthData?.recentFailures?.length || 0} event(s) recorded
              </span>
            </div>

            <div className="editorial-panel__body p-0">
              {healthData?.recentFailures && healthData.recentFailures.length > 0 ? (
                <div className="divide-y divide-[var(--editorial-rule)] max-h-72 overflow-y-auto font-mono text-xs">
                  {healthData.recentFailures.map((failure) => (
                    <div key={failure.id} className="p-3 hover:bg-[var(--editorial-surface)] flex flex-col gap-1">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="font-bold text-[var(--editorial-coral)]">
                          [{failure.provider.toUpperCase()}] {failure.modelId}
                        </span>
                        <span className="text-[var(--editorial-muted)]">
                          {new Date(failure.timestamp).toLocaleTimeString()}
                          {failure.statusCode ? ` • Status ${failure.statusCode}` : ''}
                        </span>
                      </div>
                      <div className="text-[var(--editorial-muted)] text-[11px] truncate">
                        {failure.error}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-8 text-center font-mono text-xs text-[var(--editorial-muted)]">
                  Zero failure events logged. All recent model requests succeeded.
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Settings;
