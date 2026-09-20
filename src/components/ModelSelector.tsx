import React from 'react';
import { Cpu, Cloud, Sparkles, ChevronDown, HardDrive, RefreshCw } from 'lucide-react';
import { useModelSelection } from '../hooks/useModelSelection';
import { Link } from 'react-router-dom';

interface ModelSelectorProps {
  variant?: 'navbar' | 'header' | 'inline' | 'card';
  filterModality?: 'text' | 'vision' | 'all';
  className?: string;
  showManageLink?: boolean;
  onModelChange?: (modelId: string) => void;
  disabled?: boolean;
}

export const ModelSelector: React.FC<ModelSelectorProps> = ({
  variant = 'inline',
  filterModality = 'all',
  className = '',
  showManageLink = false,
  onModelChange,
  disabled = false,
}) => {
  const {
    selectedModel,
    setSelectedModel,
    offlineModelOptions,
    cloudModelOptions,
    isOffline,
    activeModelName,
    isLoading,
    refreshModels,
  } = useModelSelection(filterModality);

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    setSelectedModel(val);
    onModelChange?.(val);
  };

  // 1. NAVBAR VARIANT: ultra-clean, minimal, fits perfectly into the desktop/mobile header
  if (variant === 'navbar') {
    return (
      <div className={`relative flex items-center ${className}`}>
        <div
          className={`flex items-center gap-1.5 h-8 px-2.5 rounded-sm border transition-all ${
            isOffline
              ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-400 hover:border-emerald-400'
              : selectedModel
              ? 'bg-[var(--editorial-surface)] border-[var(--editorial-rule)] text-[var(--editorial-ink)] hover:border-[var(--editorial-coral)]'
              : 'bg-[var(--editorial-surface)] border-[var(--editorial-rule)] text-[var(--editorial-muted)] hover:border-[var(--editorial-coral)]'
          }`}
          title={`Active AI Model: ${activeModelName}${isOffline ? ' (On-Device Offline)' : ''}`}
        >
          {isOffline ? (
            <Cpu className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0 animate-pulse" />
          ) : selectedModel ? (
            <Cloud className="w-3.5 h-3.5 text-[var(--editorial-coral)] flex-shrink-0" />
          ) : (
            <Sparkles className="w-3.5 h-3.5 text-[var(--editorial-muted)] flex-shrink-0" />
          )}

          <div className="relative flex items-center">
            <select
              value={selectedModel}
              onChange={handleChange}
              disabled={disabled || isLoading}
              aria-label="Select AI Model (Cloud or Offline)"
              className="appearance-none bg-transparent font-mono text-[10px] font-bold uppercase tracking-wider text-inherit outline-none cursor-pointer pr-4 max-w-[140px] sm:max-w-[170px] truncate"
            >
              <option value="" className="bg-[var(--editorial-paper)] text-[var(--editorial-ink)]">
                AUTO · BEST FREE
              </option>

              <optgroup label="⚡ OFFLINE / ON-DEVICE GGUF (NO INTERNET NEEDED)" className="bg-[var(--editorial-paper)] text-emerald-600 dark:text-emerald-400 font-bold">
                {offlineModelOptions.map((m) => (
                  <option
                    key={m.id}
                    value={m.id}
                    className="bg-[var(--editorial-paper)] text-[var(--editorial-ink)]"
                  >
                    {m.name} {m.isLoaded ? '[● RAM]' : m.fileSizeHuman ? `(${m.fileSizeHuman})` : ''}
                  </option>
                ))}
              </optgroup>

              {cloudModelOptions.length > 0 && (
                <optgroup label="☁ CLOUD VERIFIED FREE MODELS" className="bg-[var(--editorial-paper)] text-[var(--editorial-muted)] font-bold">
                  {cloudModelOptions.map((m) => (
                    <option
                      key={m.id}
                      value={m.id}
                      className="bg-[var(--editorial-paper)] text-[var(--editorial-ink)]"
                    >
                      {m.name} [FREE]
                    </option>
                  ))}
                </optgroup>
              )}
            </select>
            <ChevronDown className="w-2.5 h-2.5 opacity-60 pointer-events-none absolute right-0" />
          </div>

          {isOffline && (
            <span className="hidden lg:inline-flex items-center px-1 py-0.2 rounded-xs font-mono text-[8px] font-extrabold uppercase bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
              OFFLINE
            </span>
          )}
        </div>
      </div>
    );
  }

  // 2. HEADER VARIANT: used at the top of pages (e.g. FeatureHeader)
  if (variant === 'header') {
    return (
      <div className={`flex flex-wrap items-center gap-2 ${className}`}>
        <div
          className={`flex items-center gap-1.5 p-1 px-2 border transition-all ${
            isOffline
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
              : 'bg-[var(--editorial-surface)] border-[var(--editorial-rule)] text-[var(--editorial-ink)]'
          }`}
          aria-label="Active Model Controller"
        >
          {isOffline ? (
            <div className="flex items-center gap-1">
              <Cpu className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
              <span className="px-1.5 py-0.5 font-mono text-[9px] font-bold uppercase tracking-wider bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                OFFLINE ENGINE
              </span>
            </div>
          ) : (
            <div className="flex items-center gap-1">
              <Sparkles className="w-3.5 h-3.5 text-[var(--editorial-coral)] flex-shrink-0" />
              <span className="hidden sm:inline px-1.5 py-0.5 font-mono text-[9px] font-bold uppercase tracking-wider bg-[var(--editorial-paper)] border border-[var(--editorial-rule)] text-[var(--editorial-muted)]">
                AI MODEL
              </span>
            </div>
          )}

          <div className="relative flex items-center">
            <select
              value={selectedModel}
              onChange={handleChange}
              disabled={disabled || isLoading}
              aria-label="Select AI Model"
              className="appearance-none h-6 bg-[var(--editorial-paper)] border border-[var(--editorial-rule)] px-2 pr-5 font-mono text-[10px] font-bold uppercase tracking-wide text-[var(--editorial-ink)] outline-none focus:border-[var(--editorial-coral)] cursor-pointer max-w-[200px] sm:max-w-[260px] truncate"
            >
              <option value="">AUTO · BEST FREE</option>

              <optgroup label="⚡ OFFLINE / LOCAL GGUF MODELS (ON-DEVICE)">
                {offlineModelOptions.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name} {m.isLoaded ? '[● LOADED IN RAM]' : m.fileSizeHuman ? `(${m.fileSizeHuman})` : ''}
                  </option>
                ))}
              </optgroup>

              {cloudModelOptions.length > 0 && (
                <optgroup label="☁ CLOUD VERIFIED FREE MODELS">
                  {cloudModelOptions.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name} [FREE]
                    </option>
                  ))}
                </optgroup>
              )}
            </select>
            <ChevronDown className="w-3 h-3 text-[var(--editorial-muted)] pointer-events-none absolute right-1.5" />
          </div>

          <button
            type="button"
            onClick={() => refreshModels()}
            title="Refresh available models"
            className="p-1 hover:text-[var(--editorial-coral)] transition-colors text-[var(--editorial-muted)]"
            aria-label="Refresh models"
          >
            <RefreshCw className={`w-3 h-3 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {showManageLink && (
          <Link
            to="/settings"
            className="font-mono text-[9px] font-bold uppercase tracking-wider text-[var(--editorial-muted)] hover:text-[var(--editorial-coral)] underline transition-colors"
          >
            Manage Offline Models &rarr;
          </Link>
        )}
      </div>
    );
  }

  // 3. INLINE VARIANT: for action toolbars and generation panels
  if (variant === 'inline') {
    return (
      <div className={`flex items-center gap-1.5 ${className}`}>
        <div
          className={`flex items-center gap-1 p-0.5 px-1.5 border transition-all ${
            isOffline
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
              : 'bg-[var(--editorial-surface)] border-[var(--editorial-rule)] text-[var(--editorial-ink)]'
          }`}
        >
          {isOffline ? (
            <Cpu className="w-3 h-3 text-emerald-400 flex-shrink-0" />
          ) : (
            <Sparkles className="w-3 h-3 text-[var(--editorial-coral)] flex-shrink-0" />
          )}

          <div className="relative flex items-center">
            <select
              value={selectedModel}
              onChange={handleChange}
              disabled={disabled || isLoading}
              aria-label="Select AI Model"
              className="appearance-none h-6 bg-[var(--editorial-paper)] border border-[var(--editorial-rule)] px-1.5 pr-4 font-mono text-[9px] font-bold uppercase tracking-wide text-[var(--editorial-ink)] outline-none focus:border-[var(--editorial-coral)] cursor-pointer max-w-[180px] sm:max-w-[220px] truncate"
            >
              <option value="">AUTO · BEST FREE</option>

              <optgroup label="⚡ OFFLINE / ON-DEVICE MODELS">
                {offlineModelOptions.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name} {m.isLoaded ? '[● RAM]' : m.fileSizeHuman ? `(${m.fileSizeHuman})` : ''}
                  </option>
                ))}
              </optgroup>

              {cloudModelOptions.length > 0 && (
                <optgroup label="☁ CLOUD FREE MODELS">
                  {cloudModelOptions.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name}
                    </option>
                  ))}
                </optgroup>
              )}
            </select>
            <ChevronDown className="w-2.5 h-2.5 text-[var(--editorial-muted)] pointer-events-none absolute right-1" />
          </div>
        </div>
      </div>
    );
  }

  // 4. CARD / PANEL VARIANT: full-width bar with complete specs & offline status
  return (
    <div
      className={`p-3 border rounded-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
        isOffline
          ? 'bg-emerald-500/5 border-emerald-500/30'
          : 'bg-[var(--editorial-surface)] border-[var(--editorial-rule)]'
      } ${className}`}
    >
      <div className="flex items-center gap-2.5">
        <div
          className={`w-8 h-8 rounded-sm border flex items-center justify-center flex-shrink-0 ${
            isOffline
              ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-400'
              : 'bg-[var(--editorial-paper)] border-[var(--editorial-rule)] text-[var(--editorial-coral)]'
          }`}
        >
          {isOffline ? <Cpu className="w-4 h-4 animate-pulse" /> : <HardDrive className="w-4 h-4" />}
        </div>
        <div>
          <div className="flex items-center gap-2">
            <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-[var(--editorial-ink)]">
              {activeModelName}
            </span>
            {isOffline && (
              <span className="px-1.5 py-0.2 rounded-xs font-mono text-[8px] font-extrabold uppercase bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                OFFLINE ACTIVE
              </span>
            )}
          </div>
          <p className="m-0 font-mono text-[9px] text-[var(--editorial-muted)]">
            {isOffline
              ? 'Executing locally on device (node-llama-cpp GGUF) — zero cloud latency & private'
              : 'Multi-provider verified free cloud routing with automatic fallback'}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <div className="relative">
          <select
            value={selectedModel}
            onChange={handleChange}
            disabled={disabled || isLoading}
            aria-label="Switch AI model"
            className="appearance-none h-7 bg-[var(--editorial-paper)] border border-[var(--editorial-rule)] px-2 pr-6 font-mono text-[10px] font-bold uppercase tracking-wide text-[var(--editorial-ink)] outline-none focus:border-[var(--editorial-coral)] cursor-pointer"
          >
            <option value="">AUTO · BEST FREE</option>
            <optgroup label="⚡ OFFLINE / ON-DEVICE MODELS">
              {offlineModelOptions.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name} {m.isLoaded ? '[● LOADED]' : m.fileSizeHuman ? `(${m.fileSizeHuman})` : ''}
                </option>
              ))}
            </optgroup>
            {cloudModelOptions.length > 0 && (
              <optgroup label="☁ CLOUD FREE MODELS">
                {cloudModelOptions.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </optgroup>
            )}
          </select>
          <ChevronDown className="w-3 h-3 text-[var(--editorial-muted)] pointer-events-none absolute right-1.5 top-2" />
        </div>

        {showManageLink && (
          <Link
            to="/settings"
            className="px-2 py-1 border border-[var(--editorial-rule)] hover:border-[var(--editorial-coral)] text-[var(--editorial-muted)] hover:text-[var(--editorial-coral)] font-mono text-[9px] font-bold uppercase tracking-wider transition-colors"
          >
            Models
          </Link>
        )}
      </div>
    </div>
  );
};

export default ModelSelector;
