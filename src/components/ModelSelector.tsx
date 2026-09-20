import React, { useState, useEffect } from 'react';
import {
  Cpu,
  Cloud,
  Sparkles,
  ChevronDown,
  HardDrive,
  RefreshCw,
  Download,
  Loader2,
  Layers,
  CheckCircle2,
  AlertCircle,
  X,
} from 'lucide-react';
import { useModelSelection, type UnifiedModelOption } from '../hooks/useModelSelection';
import {
  downloadLocalModel,
  loadLocalModel,
  unloadLocalModel,
  isModelLoadedInRam,
  subscribeDownloadProgress,
  formatBytes,
  type DownloadTaskState,
} from '../services/localAiService';
import { triggerHaptic } from '../services/nativeMedia';
import { Link } from 'react-router-dom';

interface ModelSelectorProps {
  variant?: 'navbar' | 'header' | 'inline' | 'card';
  filterModality?: 'text' | 'vision' | 'all';
  className?: string;
  showManageLink?: boolean;
  onModelChange?: (modelId: string) => void;
  disabled?: boolean;
}

// ── Interactive Offline Controller Subcomponent ──────────────────────────────

interface OfflineControllerProps {
  option: UnifiedModelOption;
  onRefresh: () => void;
  compact?: boolean;
}

const OfflineController: React.FC<OfflineControllerProps> = ({
  option,
  onRefresh,
  compact = false,
}) => {
  const [downloadTask, setDownloadTask] = useState<DownloadTaskState | null>(null);
  const [isOperating, setIsOperating] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  // Subscribe to real-time download progress events
  useEffect(() => {
    const unsubscribe = subscribeDownloadProgress((task) => {
      const match =
        task.fileName.toLowerCase() === (option.fileName || '').toLowerCase() ||
        task.repoId.toLowerCase() === (option.repoId || '').toLowerCase() ||
        task.id.toLowerCase().includes(option.id.replace(/^local:/, '').toLowerCase());

      if (match) {
        setDownloadTask(task);
        if (task.status === 'completed') {
          onRefresh();
          setTimeout(() => setDownloadTask(null), 3000);
        }
      }
    });

    return () => unsubscribe();
  }, [option.fileName, option.repoId, option.id, onRefresh]);

  const isLoaded = option.isLoaded || isModelLoadedInRam(option.id);
  const isInstalled = option.isInstalled;
  const isDownloading = downloadTask && (downloadTask.status === 'downloading' || downloadTask.status === 'pending');

  const handleDownload = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!option.repoId || !option.fileName || isDownloading) return;

    triggerHaptic('medium');
    setStatusMessage('Starting download…');

    try {
      await downloadLocalModel(option.repoId, option.fileName, (p) => {
        if (p.message) setStatusMessage(p.message);
      });
      triggerHaptic('success');
      onRefresh();
      setStatusMessage('Downloaded!');
      setTimeout(() => setStatusMessage(null), 2500);
    } catch (err: any) {
      triggerHaptic('error');
      setStatusMessage(`Error: ${err.message || 'Download failed'}`);
      setTimeout(() => setStatusMessage(null), 3500);
    }
  };

  const handleLoad = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (isOperating) return;

    setIsOperating(true);
    triggerHaptic('selection');
    try {
      await loadLocalModel(option.id);
      triggerHaptic('success');
      onRefresh();
      setStatusMessage('Loaded in RAM!');
      setTimeout(() => setStatusMessage(null), 2000);
    } catch (err: any) {
      triggerHaptic('error');
      setStatusMessage(`Load failed: ${err.message}`);
      setTimeout(() => setStatusMessage(null), 3000);
    } finally {
      setIsOperating(false);
    }
  };

  const handleUnload = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (isOperating) return;

    setIsOperating(true);
    triggerHaptic('light');
    try {
      await unloadLocalModel(option.id);
      triggerHaptic('success');
      onRefresh();
      setStatusMessage('RAM freed!');
      setTimeout(() => setStatusMessage(null), 2000);
    } catch (err: any) {
      triggerHaptic('error');
      setStatusMessage(`Unload failed: ${err.message}`);
      setTimeout(() => setStatusMessage(null), 3000);
    } finally {
      setIsOperating(false);
    }
  };

  // Downloading State: display live progress bar + speed
  if (isDownloading && downloadTask) {
    return (
      <div className="flex items-center gap-1.5 px-2 py-0.5 bg-cyan-500/10 border border-cyan-500/30 rounded font-mono text-[9px] text-cyan-300">
        <Loader2 className="w-3 h-3 animate-spin text-cyan-400" />
        <span>
          {downloadTask.progress}% ({formatBytes(downloadTask.speedBps)}/s)
        </span>
        <div className="w-12 bg-black/40 h-1.5 rounded-full overflow-hidden border border-cyan-500/30 hidden sm:block">
          <div
            className="h-full bg-cyan-400 transition-all duration-200"
            style={{ width: `${downloadTask.progress || 2}%` }}
          />
        </div>
      </div>
    );
  }

  // Not Downloaded State: show Download button
  if (!isInstalled) {
    return (
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={handleDownload}
          title="Download model to device storage"
          className="editorial-button editorial-button--xs bg-[var(--editorial-coral)] text-white hover:opacity-90 flex items-center gap-1 font-mono text-[9px] font-bold !py-0.5 !px-2 shadow-xs"
        >
          <Download className="w-2.5 h-2.5" />
          <span>DOWNLOAD {option.fileSizeHuman ? `(${option.fileSizeHuman})` : ''}</span>
        </button>
        {statusMessage && (
          <span className="font-mono text-[8px] text-[var(--editorial-coral)] hidden sm:inline">
            {statusMessage}
          </span>
        )}
      </div>
    );
  }

  // Installed & Loaded in RAM: show UNLOAD button to free RAM
  if (isLoaded) {
    return (
      <div className="flex items-center gap-1">
        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 rounded font-mono text-[8.5px] font-bold">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          IN RAM
        </span>
        <button
          type="button"
          onClick={handleUnload}
          disabled={isOperating}
          title="Unload model from RAM to reclaim system memory"
          className="editorial-button editorial-button--xs bg-amber-500/15 text-amber-300 border border-amber-500/40 hover:bg-amber-500/25 flex items-center gap-1 font-mono text-[9px] font-bold !py-0.5 !px-1.5"
        >
          {isOperating ? <Loader2 className="w-2.5 h-2.5 animate-spin" /> : <Layers className="w-2.5 h-2.5" />}
          <span>{compact ? 'FREE' : 'UNLOAD (FREE RAM)'}</span>
        </button>
        {statusMessage && (
          <span className="font-mono text-[8px] text-amber-300 hidden sm:inline">
            {statusMessage}
          </span>
        )}
      </div>
    );
  }

  // Installed on Disk (Not in RAM): show LOAD TO RAM button
  return (
    <div className="flex items-center gap-1">
      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-slate-500/15 text-slate-400 border border-slate-500/30 rounded font-mono text-[8.5px]">
        <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
        ON DISK
      </span>
      <button
        type="button"
        onClick={handleLoad}
        disabled={isOperating}
        title="Pre-warm model into RAM for instant response"
        className="editorial-button editorial-button--xs bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/25 flex items-center gap-1 font-mono text-[9px] font-bold !py-0.5 !px-1.5"
      >
        {isOperating ? <Loader2 className="w-2.5 h-2.5 animate-spin" /> : <Cpu className="w-2.5 h-2.5" />}
        <span>{compact ? 'LOAD' : 'LOAD TO RAM'}</span>
      </button>
      {statusMessage && (
        <span className="font-mono text-[8px] text-emerald-400 hidden sm:inline">
          {statusMessage}
        </span>
      )}
    </div>
  );
};

// ── Main ModelSelector Component ─────────────────────────────────────────────

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

  const activeOfflineOption = isOffline
    ? offlineModelOptions.find((m) => m.id === selectedModel)
    : undefined;

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    setSelectedModel(val);
    onModelChange?.(val);
  };

  // 1. NAVBAR VARIANT: ultra-clean, fits desktop & mobile navbar
  if (variant === 'navbar') {
    return (
      <div className={`relative flex items-center gap-1.5 ${className}`}>
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
              className="appearance-none bg-transparent font-mono text-[10px] font-bold uppercase tracking-wider text-inherit outline-none cursor-pointer pr-4 max-w-[130px] sm:max-w-[160px] truncate"
            >
              <option value="" className="bg-[var(--editorial-paper)] text-[var(--editorial-ink)]">
                AUTO · BEST FREE
              </option>

              <optgroup
                label="⚡ OFFLINE / ON-DEVICE GGUF"
                className="bg-[var(--editorial-paper)] text-emerald-600 dark:text-emerald-400 font-bold"
              >
                {offlineModelOptions.map((m) => (
                  <option
                    key={m.id}
                    value={m.id}
                    className="bg-[var(--editorial-paper)] text-[var(--editorial-ink)]"
                  >
                    {m.name} {m.isLoaded ? '[● RAM]' : m.isInstalled ? '[○ DISK]' : m.fileSizeHuman ? `[↓ ${m.fileSizeHuman}]` : ''}
                  </option>
                ))}
              </optgroup>

              {cloudModelOptions.length > 0 && (
                <optgroup
                  label="☁ CLOUD VERIFIED FREE MODELS"
                  className="bg-[var(--editorial-paper)] text-[var(--editorial-muted)] font-bold"
                >
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
        </div>

        {/* Inline Load / Unload / Download Controller in Navbar */}
        {isOffline && activeOfflineOption && (
          <OfflineController option={activeOfflineOption} onRefresh={refreshModels} compact />
        )}
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
              className="appearance-none h-6 bg-[var(--editorial-paper)] border border-[var(--editorial-rule)] px-2 pr-5 font-mono text-[10px] font-bold uppercase tracking-wide text-[var(--editorial-ink)] outline-none focus:border-[var(--editorial-coral)] cursor-pointer max-w-[190px] sm:max-w-[240px] truncate"
            >
              <option value="">AUTO · BEST FREE</option>

              <optgroup label="⚡ OFFLINE / LOCAL GGUF MODELS (ON-DEVICE)">
                {offlineModelOptions.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name} {m.isLoaded ? '[● IN RAM]' : m.isInstalled ? '[○ ON DISK]' : m.fileSizeHuman ? `[↓ ${m.fileSizeHuman}]` : ''}
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

        {/* Direct Download & Load/Unload Options */}
        {isOffline && activeOfflineOption && (
          <OfflineController option={activeOfflineOption} onRefresh={refreshModels} />
        )}

        {showManageLink && (
          <Link
            to="/settings"
            className="font-mono text-[9px] font-bold uppercase tracking-wider text-[var(--editorial-muted)] hover:text-[var(--editorial-coral)] underline transition-colors ml-1"
          >
            Manage Models &rarr;
          </Link>
        )}
      </div>
    );
  }

  // 3. INLINE VARIANT: for toolbars, generation panels, and mixer actions
  if (variant === 'inline') {
    return (
      <div className={`flex flex-wrap items-center gap-1.5 ${className}`}>
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
              className="appearance-none h-6 bg-[var(--editorial-paper)] border border-[var(--editorial-rule)] px-1.5 pr-4 font-mono text-[9px] font-bold uppercase tracking-wide text-[var(--editorial-ink)] outline-none focus:border-[var(--editorial-coral)] cursor-pointer max-w-[170px] sm:max-w-[210px] truncate"
            >
              <option value="">AUTO · BEST FREE</option>

              <optgroup label="⚡ OFFLINE / ON-DEVICE MODELS">
                {offlineModelOptions.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name} {m.isLoaded ? '[● RAM]' : m.isInstalled ? '[○ DISK]' : m.fileSizeHuman ? `[↓ ${m.fileSizeHuman}]` : ''}
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

        {/* Load / Unload & Download actions */}
        {isOffline && activeOfflineOption && (
          <OfflineController option={activeOfflineOption} onRefresh={refreshModels} />
        )}
      </div>
    );
  }

  // 4. CARD / PANEL VARIANT: full-width bar with specs & status controls
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
          <div className="flex items-center gap-2 flex-wrap">
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
              ? 'Executing locally on device (node-llama-cpp / mobile edge) — private & zero cloud latency'
              : 'Multi-provider verified free cloud routing with automatic fallback'}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
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
                  {m.name} {m.isLoaded ? '[● RAM]' : m.isInstalled ? '[○ DISK]' : m.fileSizeHuman ? `[↓ ${m.fileSizeHuman}]` : ''}
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

        {/* Load / Unload & Download actions */}
        {isOffline && activeOfflineOption && (
          <OfflineController option={activeOfflineOption} onRefresh={refreshModels} />
        )}

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
