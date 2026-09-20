/**
 * LocalModelsPanel — Settings tab for managing local GGUF models.
 *
 * Features:
 *  - Health & RAM Memory Status (node-llama-cpp readiness, models in RAM, 1-click Free All RAM)
 *  - Real-time Active Download tracking (progress bar, speed, ETA, cancel button)
 *  - Curated Recommended Models for Mobile & Low-End Devices (one-click download, memory specs)
 *  - Installed Models with clear LOADED IN RAM vs NOT LOADED ON DISK indicators + Load/Unload actions
 *  - HuggingFace search (find GGUF models) with download progress
 *  - Test-inference box (run a prompt against any installed model)
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  HardDrive,
  Search,
  Download,
  Trash2,
  Play,
  RefreshCw,
  CheckCircle2,
  XCircle,
  Loader2,
  Cpu,
  Eye,
  AlertTriangle,
  Sparkles,
  Smartphone,
  Zap,
  Flame,
  Shield,
  X,
  Layers,
  Activity,
  ArrowDownCircle,
  Square,
  Globe,
  Wifi,
  Server,
  Check,
  ArrowRight,
} from 'lucide-react';
import {
  getCustomBackendUrl,
  setCustomBackendUrl,
  resetCustomBackendUrl,
  apiBase,
} from '../../lib/apiBase';
import {
  listLocalModels,
  searchLocalModels,
  downloadLocalModel,
  removeLocalModel,
  inferLocalModel,
  checkLocalHealth,
  loadLocalModel,
  unloadLocalModel,
  unloadAllLocalModels,
  getActiveDownloads,
  cancelDownload,
  getLocalMemoryStatus,
  formatBytes,
  subscribeDownloadProgress,
  RECOMMENDED_MODELS,
  type LocalModelInfo,
  type LocalSearchResult,
  type LocalHealthStatus,
  type DownloadTaskState,
  type LocalMemoryStatus,
  type RecommendedModel,
} from '../../services/localAiService';
import { isNativeMobile } from '../../services/nativeMedia';

interface Feedback {
  type: 'success' | 'error' | 'info';
  message: string;
}

const LocalModelsPanel: React.FC = () => {
  // State
  const [health, setHealth] = useState<LocalHealthStatus | null>(null);
  const [models, setModels] = useState<LocalModelInfo[]>([]);
  const [memoryStatus, setMemoryStatus] = useState<LocalMemoryStatus | null>(null);
  const [isLoadingModels, setIsLoadingModels] = useState(true);

  // Active Downloads
  const [activeDownloads, setActiveDownloads] = useState<DownloadTaskState[]>([]);
  const [downloadingKeys, setDownloadingKeys] = useState<Set<string>>(new Set());

  // Search
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<LocalSearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searched, setSearched] = useState(false);

  // Filter for Recommended Models
  const [recommendedFilter, setRecommendedFilter] = useState<'all' | 'mobile' | 'ultra-light' | 'balanced' | 'vision'>('all');

  // Memory operations
  const [operatingModelId, setOperatingModelId] = useState<string | null>(null);
  const [isUnloadingAll, setIsUnloadingAll] = useState(false);

  // Feedback & Testing
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [testModelId, setTestModelId] = useState('');
  const [testPrompt, setTestPrompt] = useState('Write a short creative tagline for a coffee shop called Morning Brew.');
  const [testResult, setTestResult] = useState<string>('');
  const [isTesting, setIsTesting] = useState(false);

  // Mobile & LAN Connection State
  const [backendUrlInput, setBackendUrlInput] = useState(getCustomBackendUrl());
  const [currentBackend, setCurrentBackend] = useState(apiBase());
  const [isTestingConnection, setIsTestingConnection] = useState(false);
  const [connectionPing, setConnectionPing] = useState<string | null>(null);

  // Polling ref
  const pollingTimerRef = useRef<number | null>(null);

  // ── data loading ──────────────────────────────────────────────────────────

  const refreshAll = useCallback(async () => {
    setIsLoadingModels(true);
    try {
      const [h, m, mem, dls] = await Promise.all([
        checkLocalHealth(),
        listLocalModels().catch(() => [] as LocalModelInfo[]),
        getLocalMemoryStatus().catch(() => null),
        getActiveDownloads().catch(() => [] as DownloadTaskState[]),
      ]);
      setHealth(h);
      setModels(m);
      setMemoryStatus(mem);
      setActiveDownloads(dls);

      // Sync downloadingKeys
      const activeKeys = new Set(
        dls.filter(d => d.status === 'downloading' || d.status === 'pending' || d.status === 'verifying').map(d => d.id)
      );
      setDownloadingKeys(activeKeys);

      // Preselect first model for test box if none selected
      if (m.length > 0 && !testModelId) {
        // Prefer a loaded model if available
        const loadedModel = m.find(x => x.isLoaded);
        setTestModelId(loadedModel ? loadedModel.id : m[0].id);
      }
    } finally {
      setIsLoadingModels(false);
    }
  }, [testModelId]);

  // Initial load & real-time progress subscription
  useEffect(() => {
    refreshAll();

    const unsub = subscribeDownloadProgress((task) => {
      setActiveDownloads((prev) => {
        const idx = prev.findIndex((d) => d.id === task.id);
        if (idx >= 0) {
          const next = [...prev];
          next[idx] = task;
          return next;
        }
        return [...prev, task];
      });

      if (task.status === 'downloading' || task.status === 'pending' || task.status === 'verifying') {
        setDownloadingKeys((prev) => new Set(prev).add(task.id));
      } else {
        setDownloadingKeys((prev) => {
          const next = new Set(prev);
          next.delete(task.id);
          return next;
        });
      }

      if (task.status === 'completed') {
        refreshAll();
      }
    });

    const handleModelChange = () => {
      refreshAll();
    };

    window.addEventListener('jugaad:localmodelchange', handleModelChange);

    return () => {
      unsub();
      window.removeEventListener('jugaad:localmodelchange', handleModelChange);
    };
  }, [refreshAll]);

  // Poll for downloads & memory while active downloads exist
  useEffect(() => {
    const checkDownloads = async () => {
      try {
        const dls = await getActiveDownloads();
        setActiveDownloads(dls);
        const activeKeys = new Set(
          dls.filter(d => d.status === 'downloading' || d.status === 'pending' || d.status === 'verifying').map(d => d.id)
        );
        setDownloadingKeys(activeKeys);

        // If any download completed recently, refresh models
        const anyCompleted = dls.some(d => d.status === 'completed');
        if (anyCompleted) {
          const freshModels = await listLocalModels();
          setModels(freshModels);
        }
      } catch {
        // silent poll failure
      }
    };

    if (downloadingKeys.size > 0 || activeDownloads.some(d => d.status === 'downloading')) {
      pollingTimerRef.current = window.setInterval(checkDownloads, 800);
    } else {
      if (pollingTimerRef.current) clearInterval(pollingTimerRef.current);
    }

    return () => {
      if (pollingTimerRef.current) clearInterval(pollingTimerRef.current);
    };
  }, [downloadingKeys.size, activeDownloads]);

  const showFeedback = (type: Feedback['type'], message: string) => {
    setFeedback({ type, message });
    setTimeout(() => setFeedback(null), 5000);
  };

  const handleApplyBackend = (url: string) => {
    setCustomBackendUrl(url);
    setBackendUrlInput(url);
    setCurrentBackend(apiBase());
    setConnectionPing(null);
    showFeedback('info', `Server URL set to: ${url || 'Default Cloud (Vercel)'}. Refreshing models…`);
    setTimeout(() => refreshAll(), 100);
  };

  const handleTestBackend = async () => {
    setIsTestingConnection(true);
    setConnectionPing(null);
    const start = Date.now();
    try {
      const h = await checkLocalHealth();
      const latency = Date.now() - start;
      if (h.ready) {
        setConnectionPing(`Connected (${latency}ms) — ${h.modelsAvailable} local model(s) available`);
        showFeedback('success', `Connection healthy! Latency: ${latency}ms`);
      } else {
        setConnectionPing(`Connected (${latency}ms) — ${h.reason || 'Engine not initialized'}`);
        showFeedback('info', `Connected (${latency}ms), ${h.reason || 'ready'}`);
      }
    } catch (e: any) {
      setConnectionPing(`Failed: ${e.message}`);
      showFeedback('error', `Connection error: ${e.message}`);
    } finally {
      setIsTestingConnection(false);
    }
  };

  // ── download action ───────────────────────────────────────────────────────

  const handleDownload = async (repoId: string, fileName: string) => {
    const key = `${repoId}/${fileName}`;
    if (downloadingKeys.has(key)) return;

    setDownloadingKeys(prev => new Set(prev).add(key));
    showFeedback('info', `Starting download for ${fileName}… tracking live progress below.`);

    try {
      const model = await downloadLocalModel(repoId, fileName, (p) => {
        if (p.event === 'error') {
          showFeedback('error', `Download error: ${p.error}`);
        }
      });
      showFeedback('success', `Downloaded and registered: ${model?.name || fileName}`);
      await refreshAll();
      if (model?.id) setTestModelId(model.id);
    } catch (err: any) {
      if (!err.message?.includes('cancelled')) {
        showFeedback('error', `Download failed: ${err.message}`);
      }
    } finally {
      setDownloadingKeys(prev => {
        const next = new Set(prev);
        next.delete(key);
        return next;
      });
      // Re-fetch downloads list
      getActiveDownloads().then(setActiveDownloads).catch(() => undefined);
    }
  };

  const handleCancelDownload = async (taskId: string) => {
    try {
      const res = await cancelDownload(taskId);
      if (res.success) {
        showFeedback('info', 'Download cancelled');
        setDownloadingKeys(prev => {
          const next = new Set(prev);
          next.delete(taskId);
          return next;
        });
        const fresh = await getActiveDownloads();
        setActiveDownloads(fresh);
      }
    } catch (err: any) {
      showFeedback('error', `Failed to cancel: ${err.message}`);
    }
  };

  const handleDownloadAndLoad = async (repoId: string, fileName: string, modelName: string) => {
    await handleDownload(repoId, fileName);
    setTimeout(async () => {
      const fresh = await listLocalModels();
      const match = fresh.find(
        (m) =>
          m.sourceRepo.toLowerCase() === repoId.toLowerCase() ||
          m.fileName.toLowerCase() === fileName.toLowerCase()
      );
      if (match) {
        await handleLoadModel(match.id, modelName);
      }
    }, 600);
  };

  // ── memory actions (load / unload) ────────────────────────────────────────

  const handleLoadModel = async (id: string, name: string) => {
    setOperatingModelId(id);
    showFeedback('info', `Loading "${name}" into memory (RAM)...`);
    try {
      const res = await loadLocalModel(id);
      if (res.success) {
        showFeedback('success', `Loaded "${name}" in ${res.loadDurationMs}ms. Ready for instant response.`);
        await refreshAll();
        setTestModelId(id);
      } else {
        showFeedback('error', res.message || 'Failed to load model into memory');
      }
    } catch (err: any) {
      showFeedback('error', `Load failed: ${err.message}`);
    } finally {
      setOperatingModelId(null);
    }
  };

  const handleUnloadModel = async (id: string, name: string) => {
    setOperatingModelId(id);
    try {
      const res = await unloadLocalModel(id);
      if (res.success) {
        showFeedback('success', `Unloaded "${name}" from memory. System RAM freed.`);
        await refreshAll();
      } else {
        showFeedback('error', res.message || 'Failed to unload model');
      }
    } catch (err: any) {
      showFeedback('error', `Unload failed: ${err.message}`);
    } finally {
      setOperatingModelId(null);
    }
  };

  const handleUnloadAll = async () => {
    setIsUnloadingAll(true);
    try {
      const res = await unloadAllLocalModels();
      if (res.success) {
        showFeedback('success', 'All local models unloaded. Maximum system RAM restored.');
        await refreshAll();
      }
    } catch (err: any) {
      showFeedback('error', `Unload all failed: ${err.message}`);
    } finally {
      setIsUnloadingAll(false);
    }
  };

  // ── model management ──────────────────────────────────────────────────────

  const handleRemove = async (id: string, name: string) => {
    if (!window.confirm(`Remove "${name}"? This deletes the model file from disk and frees storage.`)) return;
    try {
      const res = await removeLocalModel(id);
      if (res.success) {
        showFeedback('success', `Removed: ${name}`);
        await refreshAll();
        if (testModelId === id) setTestModelId('');
      } else {
        showFeedback('error', res.message || 'Failed to remove model');
      }
    } catch (err: any) {
      showFeedback('error', `Remove failed: ${err.message}`);
    }
  };

  const handleSearch = async () => {
    const q = searchQuery.trim();
    if (!q) return;
    setIsSearching(true);
    setSearched(true);
    try {
      const results = await searchLocalModels(q, 20);
      setSearchResults(results);
      if (results.length === 0) {
        showFeedback('info', `No GGUF models found for "${q}". Try "qwen2.5", "smollm2", "llama 3.2", or "danube3".`);
      }
    } catch (err: any) {
      showFeedback('error', `Search failed: ${err.message}`);
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  const handleTestInference = async () => {
    if (!testModelId || !testPrompt.trim()) return;
    setIsTesting(true);
    setTestResult('');
    try {
      const result = await inferLocalModel(testModelId, testPrompt, {
        maxTokens: 200,
        temperature: 0.7,
      });
      if (result.success && result.content) {
        setTestResult(result.content);
        // Refresh models list since inference loads the model
        refreshAll();
      } else {
        setTestResult(`❌ ${result.error || 'Inference returned empty content'}`);
      }
    } catch (err: any) {
      setTestResult(`❌ ${err.message}`);
    } finally {
      setIsTesting(false);
    }
  };

  // ── helpers ───────────────────────────────────────────────────────────────

  const getModelMatch = (repoId: string, fileName: string): LocalModelInfo | undefined => {
    return models.find(m => m.sourceRepo.toLowerCase() === repoId.toLowerCase() && m.fileName.toLowerCase() === fileName.toLowerCase());
  };

  const isModelInstalled = (repoId: string, fileName: string): boolean => {
    return !!getModelMatch(repoId, fileName);
  };

  const getDownloadTaskState = (repoId: string, fileName: string): DownloadTaskState | undefined => {
    const key = `${repoId}/${fileName}`;
    return activeDownloads.find(d => d.id === key);
  };

  const filteredRecommended = RECOMMENDED_MODELS.filter(m => {
    if (recommendedFilter === 'all') return true;
    if (recommendedFilter === 'mobile') return m.badgeVariant === 'mobile';
    if (recommendedFilter === 'ultra-light') return m.badgeVariant === 'ultra-light';
    if (recommendedFilter === 'balanced') return m.badgeVariant === 'balanced';
    if (recommendedFilter === 'vision') return m.badgeVariant === 'vision';
    return true;
  });

  const loadedCount = models.filter(m => m.isLoaded).length;

  return (
    <div className="grid grid-cols-1 gap-6 motion-fade">
      {/* ── 01 / STATUS & MEMORY BAR ── */}
      <div className="editorial-panel">
        <div className="editorial-panel__header flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <span className="editorial-badge editorial-badge--coral">01 / STATUS</span>
            <h2 className="editorial-panel__title m-0 text-base">Local AI Inference Engine & Memory Status</h2>
          </div>
          <div className="flex items-center gap-2">
            {loadedCount > 0 && (
              <button
                type="button"
                onClick={handleUnloadAll}
                disabled={isUnloadingAll}
                className="editorial-button editorial-button--sm bg-amber-500/15 border-amber-500/40 text-amber-300 hover:bg-amber-500/25 flex items-center gap-1.5"
                title="Unload all models from RAM to free system memory for mobile/low-end devices"
              >
                {isUnloadingAll ? <Loader2 className="w-3 h-3 animate-spin" /> : <Layers className="w-3 h-3" />}
                Free All RAM ({loadedCount} loaded)
              </button>
            )}
            <button
              type="button"
              onClick={refreshAll}
              disabled={isLoadingModels}
              className="editorial-button editorial-button--sm editorial-button--secondary flex items-center gap-1"
            >
              <RefreshCw className={`w-3 h-3 ${isLoadingModels ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>
        </div>

        <div className="editorial-panel__body flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-3 font-mono text-xs">
            {/* Engine readiness */}
            <span className="flex items-center gap-1.5 px-2 py-1 bg-[var(--editorial-surface)] border border-[var(--editorial-rule)]">
              {health?.ready ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              ) : (
                <XCircle className="w-4 h-4 text-rose-400" />
              )}
              <strong>ENGINE: {health?.ready ? 'READY' : 'NOT READY'}</strong>
            </span>

            {/* RAM residency indicator */}
            <span className="flex items-center gap-1.5 px-2 py-1 bg-[var(--editorial-surface)] border border-[var(--editorial-rule)]">
              <span className={`w-2.5 h-2.5 rounded-full ${loadedCount > 0 ? 'bg-emerald-400 animate-pulse' : 'bg-slate-500'}`} />
              <strong>RAM RESIDENCY: {loadedCount} / 2 models active</strong>
            </span>

            {/* Storage count */}
            <span className="flex items-center gap-1 px-2 py-1 bg-[var(--editorial-surface)] border border-[var(--editorial-rule)] text-[var(--editorial-muted)]">
              <HardDrive className="w-3.5 h-3.5 text-[var(--editorial-coral)]" />
              <span>{models.length} model(s) stored on disk</span>
            </span>

            {/* Runtime engine */}
            <span className="flex items-center gap-1 px-2 py-1 bg-[var(--editorial-surface)] border border-[var(--editorial-rule)] text-[var(--editorial-muted)]">
              <Cpu className="w-3.5 h-3.5 text-cyan-400" />
              <span>Engine: {health?.nodeLlamaCppAvailable ? 'native acceleration' : 'mobile edge hybrid'}</span>
            </span>

            {/* Platform indicator */}
            <span className={`flex items-center gap-1 px-2 py-1 bg-[var(--editorial-surface)] border ${
              isNativeMobile() ? 'border-emerald-500/40 text-emerald-400 font-bold' : 'border-[var(--editorial-rule)] text-[var(--editorial-muted)]'
            }`}>
              <Smartphone className="w-3.5 h-3.5" />
              <span>Platform: {isNativeMobile() ? 'Capacitor Android Native' : 'Web / PWA'}</span>
            </span>
          </div>

          {health && !health.ready && health.reason && (
            <div className="flex items-start gap-2 p-2.5 bg-amber-500/10 border border-amber-500/30 text-amber-400 font-mono text-xs">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{health.reason}</span>
            </div>
          )}

          {/* Mobile & Low-End Device Tip */}
          <div className="p-3 bg-cyan-500/5 border border-cyan-500/20 text-xs font-mono text-[var(--editorial-muted)] flex items-start gap-2">
            <Smartphone className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
            <div>
              <strong className="text-cyan-300">Tips for Mobile & Low-End Hardware:</strong> Models on disk consume zero RAM. When you run inference, the model loads into RAM (~200MB–1.2GB). On phones or laptops with limited RAM, click <em>"UNLOAD"</em> when finished to reclaim memory. Recommended models below are tuned for fast CPU inference and modest memory footprints.
            </div>
          </div>

          {/* Mobile & LAN Server Connectivity */}
          <div className="p-3.5 bg-[var(--editorial-surface)] border border-[var(--editorial-rule)] rounded flex flex-col gap-3 font-mono text-xs">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <Wifi className="w-4 h-4 text-[var(--editorial-coral)]" />
                <span className="font-bold text-[var(--editorial-ink)] uppercase tracking-wider">Mobile & Server Connection</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleTestBackend}
                  disabled={isTestingConnection}
                  className="editorial-button editorial-button--xs editorial-button--secondary flex items-center gap-1"
                >
                  {isTestingConnection ? <Loader2 className="w-3 h-3 animate-spin" /> : <Activity className="w-3 h-3" />}
                  <span>Test Connection</span>
                </button>
              </div>
            </div>

            <div className="text-[11px] text-[var(--editorial-muted)]">
              Current API Endpoint:{' '}
              <code className="text-cyan-400 bg-black/20 px-1.5 py-0.5 rounded">
                {currentBackend || 'Default Cloud (jugaadvision.vercel.app)'}
              </code>
            </div>

            {connectionPing && (
              <div className="text-[11px] p-2 bg-black/20 border border-[var(--editorial-rule)] text-emerald-400">
                {connectionPing}
              </div>
            )}

            {/* Quick Switch Presets */}
            <div className="flex flex-wrap items-center gap-1.5 pt-1">
              <span className="text-[10px] text-[var(--editorial-muted)] uppercase tracking-wider mr-1">Quick Presets:</span>
              <button
                type="button"
                onClick={() => handleApplyBackend('')}
                className={`px-2 py-1 border text-[11px] font-mono transition-colors ${
                  !backendUrlInput ? 'border-[var(--editorial-coral)] bg-[var(--editorial-coral)]/10 text-[var(--editorial-coral)] font-bold' : 'border-[var(--editorial-rule)] hover:bg-[var(--editorial-surface-elevated)]'
                }`}
              >
                Default Cloud
              </button>
              <button
                type="button"
                onClick={() => handleApplyBackend('http://10.0.2.2:3000')}
                className={`px-2 py-1 border text-[11px] font-mono transition-colors ${
                  backendUrlInput === 'http://10.0.2.2:3000' ? 'border-[var(--editorial-coral)] bg-[var(--editorial-coral)]/10 text-[var(--editorial-coral)] font-bold' : 'border-[var(--editorial-rule)] hover:bg-[var(--editorial-surface-elevated)]'
                }`}
                title="Android Emulator localhost alias"
              >
                Android Emulator (10.0.2.2)
              </button>
              <button
                type="button"
                onClick={() => handleApplyBackend('http://localhost:3000')}
                className={`px-2 py-1 border text-[11px] font-mono transition-colors ${
                  backendUrlInput === 'http://localhost:3000' ? 'border-[var(--editorial-coral)] bg-[var(--editorial-coral)]/10 text-[var(--editorial-coral)] font-bold' : 'border-[var(--editorial-rule)] hover:bg-[var(--editorial-surface-elevated)]'
                }`}
              >
                Localhost (PC)
              </button>
            </div>

            {/* Custom IP Input for Mobile Phone on WiFi */}
            <div className="flex items-center gap-2 pt-1">
              <input
                type="text"
                value={backendUrlInput}
                onChange={(e) => setBackendUrlInput(e.target.value)}
                placeholder="e.g. http://192.168.1.5:3000 (Computer's WiFi IP)"
                className="editorial-input flex-1 !text-xs !py-1 font-mono"
              />
              <button
                type="button"
                onClick={() => handleApplyBackend(backendUrlInput)}
                className="editorial-button editorial-button--sm editorial-button--primary !py-1 !px-3"
              >
                Set URL
              </button>
            </div>
            <p className="text-[10px] text-[var(--editorial-muted)] m-0">
              Tip for Android: run <code>npm run dev</code> on your computer, connect your phone to the same WiFi network, and set your computer's local IP address above to download and run local models directly!
            </p>
          </div>
        </div>
      </div>

      {/* ── ACTIVE DOWNLOADS PROGRESS BAR ── */}
      {activeDownloads.filter(d => d.status === 'downloading' || d.status === 'pending' || d.status === 'verifying').length > 0 && (
        <div className="editorial-panel border-cyan-500/40 bg-cyan-500/5">
          <div className="editorial-panel__header bg-cyan-500/10">
            <div className="flex items-center gap-2">
              <span className="editorial-badge bg-cyan-500 text-slate-950 font-bold flex items-center gap-1">
                <ArrowDownCircle className="w-3.5 h-3.5 animate-bounce" /> LIVE DOWNLOAD IN PROGRESS
              </span>
              <span className="font-mono text-xs text-cyan-300 font-bold">
                {activeDownloads.filter(d => d.status === 'downloading' || d.status === 'pending' || d.status === 'verifying').length} active
              </span>
            </div>
          </div>
          <div className="editorial-panel__body flex flex-col gap-4">
            {activeDownloads
              .filter(d => d.status === 'downloading' || d.status === 'pending' || d.status === 'verifying')
              .map((dl) => (
                <div key={dl.id} className="p-3.5 bg-[var(--editorial-paper)] border border-cyan-500/30 rounded flex flex-col gap-2.5">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-2">
                      <Loader2 className="w-4 h-4 text-cyan-400 animate-spin" />
                      <span className="font-mono text-xs font-bold text-[var(--editorial-ink)]">
                        {dl.fileName}
                      </span>
                      <span className="editorial-badge bg-cyan-500/20 text-cyan-300 border-cyan-500/40 font-mono text-[10px]">
                        {dl.status.toUpperCase()}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleCancelDownload(dl.id)}
                      className="editorial-button editorial-button--sm text-rose-400 hover:border-rose-400 flex items-center gap-1"
                      title="Cancel download"
                    >
                      <X className="w-3 h-3" /> Cancel
                    </button>
                  </div>

                  {/* Visual Progress Bar */}
                  <div className="w-full bg-[var(--editorial-surface)] border border-[var(--editorial-rule)] h-3 rounded-full overflow-hidden relative">
                    <div
                      className="h-full bg-gradient-to-r from-cyan-500 via-emerald-400 to-amber-400 transition-all duration-300"
                      style={{ width: `${Math.max(2, dl.progress)}%` }}
                    />
                  </div>

                  {/* Transfer statistics */}
                  <div className="flex items-center justify-between font-mono text-[11px] text-[var(--editorial-muted)] flex-wrap gap-2">
                    <span className="text-[var(--editorial-ink)] font-bold">
                      {dl.progress}% · {formatBytes(dl.loadedBytes)} / {dl.totalBytes > 0 ? formatBytes(dl.totalBytes) : 'calculating...'}
                    </span>
                    <span className="flex items-center gap-3">
                      {dl.speedBps > 0 && (
                        <span>Speed: <strong>{formatBytes(dl.speedBps)}/s</strong></span>
                      )}
                      {dl.etaSeconds > 0 && (
                        <span>ETA: <strong>{dl.etaSeconds}s remaining</strong></span>
                      )}
                      <span>Repo: {dl.repoId}</span>
                    </span>
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* ── 02 / RECOMMENDED MODELS FOR MOBILE & LOW-END HARDWARE ── */}
      <div className="editorial-panel">
        <div className="editorial-panel__header flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <span className="editorial-badge editorial-badge--coral">02 / RECOMMENDED</span>
            <h2 className="editorial-panel__title m-0 text-base flex items-center gap-1.5">
              <Smartphone className="w-4 h-4 text-cyan-400" />
              Recommended Models for Mobile & Low-End Devices
            </h2>
          </div>
          {/* Category Filter Pills */}
          <div className="flex items-center gap-1 flex-wrap font-mono text-[11px]">
            {(['all', 'mobile', 'ultra-light', 'balanced', 'vision'] as const).map((filterKey) => (
              <button
                key={filterKey}
                type="button"
                onClick={() => setRecommendedFilter(filterKey)}
                className={`px-2.5 py-1 border transition-colors ${
                  recommendedFilter === filterKey
                    ? 'border-[var(--editorial-coral)] bg-[var(--editorial-coral)] text-slate-950 font-bold'
                    : 'border-[var(--editorial-rule)] bg-[var(--editorial-paper)] text-[var(--editorial-muted)] hover:text-[var(--editorial-ink)]'
                }`}
              >
                {filterKey === 'all' && 'ALL'}
                {filterKey === 'mobile' && '📱 MOBILE READY'}
                {filterKey === 'ultra-light' && '⚡ ULTRA-LIGHT (<300MB)'}
                {filterKey === 'balanced' && '⭐ BALANCED QUALITY'}
                {filterKey === 'vision' && '👁️ ON-DEVICE VISION'}
              </button>
            ))}
          </div>
        </div>

        <div className="editorial-panel__body p-3">
          <p className="text-xs text-[var(--editorial-muted)] font-mono mb-3">
            Pre-configured, battle-tested GGUF models optimized for mobile phones (via Capacitor Android / PWA) and resource-constrained PCs. Runs 100% offline with zero API costs.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {filteredRecommended.map((rec) => {
              const installedModel = getModelMatch(rec.repoId, rec.fileName);
              const installed = !!installedModel;
              const isLoaded = installedModel?.isLoaded ?? false;
              const taskState = getDownloadTaskState(rec.repoId, rec.fileName);
              const isCurrentlyDownloading = downloadingKeys.has(`${rec.repoId}/${rec.fileName}`) || taskState?.status === 'downloading';
              const isOperating = operatingModelId === installedModel?.id;

              return (
                <div
                  key={rec.id}
                  className={`p-3.5 border flex flex-col justify-between gap-3 transition-all ${
                    isLoaded
                      ? 'border-emerald-500/50 bg-emerald-500/5'
                      : installed
                      ? 'border-[var(--editorial-coral)]/40 bg-[var(--editorial-surface)]'
                      : 'border-[var(--editorial-rule)] bg-[var(--editorial-paper)] hover:border-[var(--editorial-coral)]/30'
                  }`}
                >
                  <div className="flex flex-col gap-2">
                    {/* Header: Title + Badges */}
                    <div className="flex items-start justify-between gap-2 flex-wrap">
                      <div>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-mono text-sm font-bold text-[var(--editorial-ink)]">
                            {rec.name}
                          </span>
                          <span className="editorial-badge">{rec.quantization}</span>
                          {rec.modality === 'vision' && (
                            <span className="editorial-badge bg-cyan-500/20 text-cyan-400 border-cyan-500/30 flex items-center gap-1">
                              <Eye className="w-3 h-3" /> VISION
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] font-mono text-[var(--editorial-coral)] mt-0.5">
                          {rec.tagline}
                        </div>
                      </div>

                      {/* Status Badge */}
                      <div>
                        {isCurrentlyDownloading ? (
                          <span className="editorial-badge bg-cyan-500/20 text-cyan-300 border-cyan-500/40 flex items-center gap-1 font-mono">
                            <Loader2 className="w-3 h-3 animate-spin" /> DOWNLOADING {taskState?.progress ? `(${taskState.progress}%)` : ''}
                          </span>
                        ) : installed ? (
                          isLoaded ? (
                            <span className="editorial-badge bg-emerald-500/20 text-emerald-400 border-emerald-500/40 flex items-center gap-1 font-mono">
                              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                              LOADED IN RAM
                            </span>
                          ) : (
                            <span className="editorial-badge bg-slate-500/20 text-slate-300 border-slate-500/30 flex items-center gap-1 font-mono">
                              <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                              READY ON DISK
                            </span>
                          )
                        ) : (
                          <span className="editorial-badge bg-[var(--editorial-surface)] text-[var(--editorial-muted)] font-mono">
                            NOT DOWNLOADED
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Description */}
                    <p className="text-xs text-[var(--editorial-muted)] m-0 leading-relaxed">
                      {rec.description}
                    </p>

                    {/* Specs Table */}
                    <div className="grid grid-cols-2 gap-1.5 font-mono text-[11px] p-2 bg-[var(--editorial-surface)] border border-[var(--editorial-rule)]">
                      <div>
                        <span className="text-[var(--editorial-muted)]">Size: </span>
                        <strong>{rec.fileSizeHuman}</strong>
                      </div>
                      <div>
                        <span className="text-[var(--editorial-muted)]">Min RAM: </span>
                        <strong className="text-amber-400">{rec.minRam}</strong>
                      </div>
                      <div className="col-span-2 truncate">
                        <span className="text-[var(--editorial-muted)]">Speed: </span>
                        <span className="text-emerald-400 font-bold">{rec.speedEstimate}</span>
                      </div>
                      <div className="col-span-2 truncate text-[10px] text-[var(--editorial-muted)]">
                        Target: {rec.targetDevice}
                      </div>
                    </div>

                    {/* Live Progress Bar if downloading */}
                    {isCurrentlyDownloading && taskState && (
                      <div className="flex flex-col gap-1 mt-1">
                        <div className="w-full bg-[var(--editorial-surface)] h-2 rounded-full overflow-hidden border border-[var(--editorial-rule)]">
                          <div
                            className="h-full bg-cyan-400 transition-all duration-300"
                            style={{ width: `${taskState.progress || 2}%` }}
                          />
                        </div>
                        <div className="flex justify-between font-mono text-[10px] text-[var(--editorial-muted)]">
                          <span>{taskState.progress}% · {formatBytes(taskState.loadedBytes)} / {formatBytes(taskState.totalBytes)}</span>
                          {taskState.speedBps > 0 && <span>{formatBytes(taskState.speedBps)}/s</span>}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Actions Footer */}
                  <div className="flex items-center justify-between gap-2 pt-2 border-t border-[var(--editorial-rule)] flex-wrap">
                    <span className="font-mono text-[10px] text-[var(--editorial-muted)] truncate max-w-[170px]">
                      {rec.repoId.split('/')[1] || rec.repoId}
                    </span>

                    <div className="flex items-center gap-1.5">
                      {isCurrentlyDownloading ? (
                        <button
                          type="button"
                          onClick={() => handleCancelDownload(`${rec.repoId}/${rec.fileName}`)}
                          className="editorial-button editorial-button--sm text-rose-400 hover:border-rose-400 flex items-center gap-1"
                        >
                          <X className="w-3 h-3" /> Cancel
                        </button>
                      ) : installed ? (
                        <>
                          {/* Load / Unload Toggle */}
                          {isLoaded ? (
                            <button
                              type="button"
                              onClick={() => handleUnloadModel(installedModel.id, installedModel.name)}
                              disabled={isOperating}
                              className="editorial-button editorial-button--sm bg-amber-500/10 text-amber-300 border-amber-500/30 hover:bg-amber-500/20 flex items-center gap-1"
                              title="Unload from RAM to free system memory"
                            >
                              {isOperating ? <Loader2 className="w-3 h-3 animate-spin" /> : <Layers className="w-3 h-3" />}
                              UNLOAD (FREE RAM)
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleLoadModel(installedModel.id, installedModel.name)}
                              disabled={isOperating}
                              className="editorial-button editorial-button--sm bg-emerald-500/10 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/20 flex items-center gap-1"
                              title="Pre-load into RAM for instant inference"
                            >
                              {isOperating ? <Loader2 className="w-3 h-3 animate-spin" /> : <Cpu className="w-3 h-3" />}
                              LOAD TO RAM
                            </button>
                          )}

                          {/* Test button */}
                          <button
                            type="button"
                            onClick={() => {
                              setTestModelId(installedModel.id);
                              // Smooth scroll to test panel
                              document.getElementById('test-inference-panel')?.scrollIntoView({ behavior: 'smooth' });
                            }}
                            className={`editorial-button editorial-button--sm ${
                              testModelId === installedModel.id ? 'editorial-button--primary' : 'editorial-button--secondary'
                            }`}
                          >
                            TEST
                          </button>

                          {/* Remove button */}
                          <button
                            type="button"
                            onClick={() => handleRemove(installedModel.id, installedModel.name)}
                            className="editorial-button editorial-button--sm text-rose-400 hover:border-rose-400 p-1.5"
                            title="Remove model from device storage"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </>
                      ) : (
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <button
                            type="button"
                            onClick={() => handleDownload(rec.repoId, rec.fileName)}
                            disabled={downloadingKeys.size > 0}
                            className="editorial-button editorial-button--sm editorial-button--primary flex items-center gap-1.5"
                          >
                            <Download className="w-3.5 h-3.5" />
                            DOWNLOAD ({rec.fileSizeHuman})
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDownloadAndLoad(rec.repoId, rec.fileName, rec.name)}
                            disabled={downloadingKeys.size > 0}
                            className="editorial-button editorial-button--sm bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/25 flex items-center gap-1 font-mono text-[11px]"
                            title="Download and immediately pre-warm model into RAM"
                          >
                            <Cpu className="w-3 h-3" />
                            DOWNLOAD & LOAD
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── 03 / INSTALLED MODELS (WITH LOADED/NOT LOADED STATUS) ── */}
      <div className="editorial-panel">
        <div className="editorial-panel__header">
          <div className="flex items-center gap-2">
            <span className="editorial-badge editorial-badge--coral">03 / INSTALLED</span>
            <h2 className="editorial-panel__title m-0 text-base">Downloaded Models on Disk</h2>
          </div>
          <div className="flex items-center gap-2 font-mono text-xs text-[var(--editorial-muted)]">
            <span className="text-emerald-400 font-bold">{loadedCount} in RAM</span>
            <span>·</span>
            <span>{models.length} total on disk</span>
          </div>
        </div>

        <div className="editorial-panel__body p-0">
          {isLoadingModels ? (
            <div className="p-8 text-center font-mono text-xs text-[var(--editorial-muted)]">
              <Loader2 className="w-4 h-4 animate-spin inline mr-2" />
              Loading installed models…
            </div>
          ) : models.length === 0 ? (
            <div className="p-8 text-center font-mono text-xs text-[var(--editorial-muted)]">
              No local models downloaded yet. Choose one from the <strong>Recommended Models</strong> above for mobile & low-end devices, or search HuggingFace below.
            </div>
          ) : (
            <div className="divide-y divide-[var(--editorial-rule)]">
              {models.map((m) => {
                const isOperating = operatingModelId === m.id;
                return (
                  <div
                    key={m.id}
                    className={`p-3.5 flex items-center justify-between gap-3 transition-colors ${
                      m.isLoaded ? 'bg-emerald-500/5 hover:bg-emerald-500/10' : 'hover:bg-[var(--editorial-surface)]'
                    }`}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono text-xs font-bold text-[var(--editorial-ink)] truncate">
                          {m.name}
                        </span>
                        <span className="editorial-badge">{m.quantization?.toUpperCase() || 'GGUF'}</span>
                        {m.modality === 'vision' && (
                          <span className="editorial-badge bg-cyan-500/20 text-cyan-400 border-cyan-500/30 flex items-center gap-1">
                            <Eye className="w-3 h-3" /> VISION
                          </span>
                        )}

                        {/* LOADED VS NOT LOADED STATUS BADGE */}
                        {m.isLoaded ? (
                          <span className="editorial-badge bg-emerald-500/20 text-emerald-400 border-emerald-500/40 flex items-center gap-1 font-bold">
                            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                            LOADED IN RAM
                          </span>
                        ) : (
                          <span className="editorial-badge bg-slate-500/15 text-slate-400 border-slate-500/30 flex items-center gap-1">
                            <span className="w-2 h-2 rounded-full bg-slate-500" />
                            NOT LOADED (ON DISK)
                          </span>
                        )}

                        {!m.isValid && (
                          <span className="editorial-badge bg-rose-500/20 text-rose-400 border-rose-500/30">FILE MISSING</span>
                        )}
                      </div>

                      <div className="font-mono text-[11px] text-[var(--editorial-muted)] mt-1 truncate">
                        {formatBytes(m.fileSizeBytes)} · {m.sourceRepo} · loaded {m.loadCount}×
                        {m.isLoaded ? (
                          <span className="text-emerald-400 font-bold ml-1">· Active in memory (instant response)</span>
                        ) : (
                          <span className="text-[var(--editorial-muted)] ml-1">· 0 MB RAM used (loads on first prompt)</span>
                        )}
                        {m.lastLoadedAt ? ` · last: ${new Date(m.lastLoadedAt).toLocaleDateString()}` : ''}
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      {/* Load / Unload Memory Button */}
                      {m.isLoaded ? (
                        <button
                          type="button"
                          onClick={() => handleUnloadModel(m.id, m.name)}
                          disabled={isOperating}
                          className="editorial-button editorial-button--sm bg-amber-500/15 text-amber-300 border-amber-500/40 hover:bg-amber-500/25 flex items-center gap-1 font-mono text-[11px]"
                          title="Unload from RAM to free system memory for mobile/low-end devices"
                        >
                          {isOperating ? <Loader2 className="w-3 h-3 animate-spin" /> : <Layers className="w-3 h-3" />}
                          UNLOAD
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleLoadModel(m.id, m.name)}
                          disabled={isOperating}
                          className="editorial-button editorial-button--sm bg-emerald-500/10 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/20 flex items-center gap-1 font-mono text-[11px]"
                          title="Pre-warm model into RAM for instant generation"
                        >
                          {isOperating ? <Loader2 className="w-3 h-3 animate-spin" /> : <Cpu className="w-3 h-3" />}
                          LOAD
                        </button>
                      )}

                      {/* Select for testing */}
                      <button
                        type="button"
                        onClick={() => {
                          setTestModelId(m.id);
                          document.getElementById('test-inference-panel')?.scrollIntoView({ behavior: 'smooth' });
                        }}
                        className={`editorial-button editorial-button--sm ${testModelId === m.id ? 'editorial-button--primary' : 'editorial-button--secondary'}`}
                        title="Select for testing"
                      >
                        {testModelId === m.id ? 'SELECTED' : 'SELECT'}
                      </button>

                      {/* Delete */}
                      <button
                        type="button"
                        onClick={() => handleRemove(m.id, m.name)}
                        className="editorial-button editorial-button--sm editorial-button--secondary text-rose-400 hover:border-rose-400"
                        title="Delete model file from disk"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ── 04 / SEARCH HUGGINGFACE ── */}
      <div className="editorial-panel">
        <div className="editorial-panel__header">
          <div className="flex items-center gap-2">
            <span className="editorial-badge editorial-badge--coral">04 / FIND MODELS</span>
            <h2 className="editorial-panel__title m-0 text-base">Search HuggingFace for Custom GGUF Models</h2>
          </div>
        </div>
        <div className="editorial-panel__body flex flex-col gap-4">
          {/* Search bar */}
          <div className="flex gap-2">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              placeholder='e.g. "qwen2.5 0.5b", "smollm2", "llama 3.2 1b", "danube3"'
              className="flex-1 h-9 px-3 border border-[var(--editorial-rule)] bg-[var(--editorial-paper)] font-mono text-xs text-[var(--editorial-ink)] outline-none focus:border-[var(--editorial-coral)]"
            />
            <button
              type="button"
              onClick={handleSearch}
              disabled={isSearching || !searchQuery.trim()}
              className="editorial-button editorial-button--sm editorial-button--primary flex items-center gap-1.5"
            >
              {isSearching ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />}
              {isSearching ? 'SEARCHING' : 'SEARCH'}
            </button>
          </div>

          {/* Search results */}
          {isSearching && (
            <div className="p-4 text-center font-mono text-xs text-[var(--editorial-muted)]">
              <Loader2 className="w-4 h-4 animate-spin inline mr-2" />
              Searching HuggingFace Hub for compatible GGUF files…
            </div>
          )}
          {!isSearching && searched && searchResults.length === 0 && (
            <div className="p-4 text-center font-mono text-xs text-[var(--editorial-muted)]">
              No results. Try a broader query like "qwen2.5", "smol", or check the recommended models above.
            </div>
          )}
          {!isSearching && searchResults.length > 0 && (
            <div className="border border-[var(--editorial-rule)] divide-y divide-[var(--editorial-rule)] max-h-96 overflow-y-auto">
              {searchResults.map((r) => {
                const key = `${r.repoId}/${r.fileName}`;
                const installed = isModelInstalled(r.repoId, r.fileName);
                const taskState = getDownloadTaskState(r.repoId, r.fileName);
                const isDownloadingThis = downloadingKeys.has(key) || taskState?.status === 'downloading';

                return (
                  <div key={key} className="p-3 flex items-center justify-between gap-3 hover:bg-[var(--editorial-surface)]">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono text-xs font-bold text-[var(--editorial-ink)] truncate">
                          {r.modelId}
                        </span>
                        <span className="editorial-badge">{r.quantization?.toUpperCase() || 'GGUF'}</span>
                        {r.modality === 'vision' && (
                          <span className="editorial-badge bg-cyan-500/20 text-cyan-400 border-cyan-500/30 flex items-center gap-1">
                            <Eye className="w-3 h-3" /> VISION
                          </span>
                        )}
                      </div>
                      <div className="font-mono text-[11px] text-[var(--editorial-muted)] mt-1 truncate">
                        {formatBytes(r.fileSize)} · {r.repoId} · {r.license}
                      </div>

                      {/* Download Progress Bar if downloading */}
                      {isDownloadingThis && taskState && (
                        <div className="w-full mt-2">
                          <div className="w-full bg-[var(--editorial-surface)] h-2 rounded-full overflow-hidden border border-[var(--editorial-rule)]">
                            <div className="h-full bg-cyan-400" style={{ width: `${taskState.progress || 2}%` }} />
                          </div>
                          <div className="font-mono text-[10px] text-cyan-400 mt-0.5">
                            {taskState.progress}% · {formatBytes(taskState.loadedBytes)} / {formatBytes(taskState.totalBytes)}
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="shrink-0">
                      {installed ? (
                        <span className="editorial-badge bg-emerald-500/20 text-emerald-400 border-emerald-500/30 flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3" /> INSTALLED
                        </span>
                      ) : isDownloadingThis ? (
                        <button
                          type="button"
                          onClick={() => handleCancelDownload(key)}
                          className="editorial-button editorial-button--sm text-rose-400 hover:border-rose-400 flex items-center gap-1"
                        >
                          <X className="w-3 h-3" /> CANCEL
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleDownload(r.repoId, r.fileName)}
                          disabled={downloadingKeys.size > 0}
                          className="editorial-button editorial-button--sm editorial-button--primary flex items-center gap-1.5"
                        >
                          <Download className="w-3.5 h-3.5" />
                          DOWNLOAD
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <p className="text-[11px] text-[var(--editorial-muted)] font-mono">
            Tip: smaller quantizations (Q4_K_M, Q4_0) and models ≤ 1.5B parameters run best on mobile and modest laptops.
          </p>
        </div>
      </div>

      {/* ── 05 / TEST INFERENCE ── */}
      <div id="test-inference-panel" className="editorial-panel">
        <div className="editorial-panel__header">
          <div className="flex items-center gap-2">
            <span className="editorial-badge editorial-badge--coral">05 / TEST</span>
            <h2 className="editorial-panel__title m-0 text-base">Test Local Inference</h2>
          </div>
        </div>
        <div className="editorial-panel__body flex flex-col gap-4">
          {/* Model selector */}
          <div>
            <label className="block font-mono text-xs font-bold uppercase tracking-wider text-[var(--editorial-muted)] mb-2">
              Select Installed Model
            </label>
            <select
              value={testModelId}
              onChange={(e) => setTestModelId(e.target.value)}
              disabled={models.length === 0 || isTesting}
              className="w-full h-9 px-2 border border-[var(--editorial-rule)] bg-[var(--editorial-paper)] font-mono text-xs text-[var(--editorial-ink)] outline-none focus:border-[var(--editorial-coral)] cursor-pointer"
            >
              {models.length === 0 ? (
                <option value="">No models installed</option>
              ) : (
                models.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name} ({m.modality}) — {m.isLoaded ? '● LOADED IN RAM' : '○ ON DISK'}
                  </option>
                ))
              )}
            </select>
          </div>

          {/* Prompt */}
          <div>
            <label className="block font-mono text-xs font-bold uppercase tracking-wider text-[var(--editorial-muted)] mb-2">
              Prompt
            </label>
            <textarea
              value={testPrompt}
              onChange={(e) => setTestPrompt(e.target.value)}
              disabled={isTesting || models.length === 0}
              rows={3}
              className="w-full p-3 border border-[var(--editorial-rule)] bg-[var(--editorial-paper)] font-mono text-xs text-[var(--editorial-ink)] outline-none focus:border-[var(--editorial-coral)] resize-y"
            />
          </div>

          <button
            type="button"
            onClick={handleTestInference}
            disabled={isTesting || !testModelId || !testPrompt.trim()}
            className="editorial-button editorial-button--sm editorial-button--primary flex items-center gap-1.5 self-start"
          >
            {isTesting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
            {isTesting ? 'RUNNING INFERENCE…' : 'RUN INFERENCE'}
          </button>

          {testResult && (
            <div className="p-3 border border-[var(--editorial-rule)] bg-[var(--editorial-surface)] font-mono text-xs whitespace-pre-wrap break-words">
              {testResult}
            </div>
          )}
        </div>
      </div>

      {/* ── Feedback toast ── */}
      {feedback && (
        <div
          className={`fixed bottom-4 right-4 z-50 p-3 border font-mono text-xs max-w-sm shadow-lg ${
            feedback.type === 'success'
              ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-400'
              : feedback.type === 'error'
              ? 'bg-rose-500/15 border-rose-500/40 text-rose-400'
              : 'bg-[var(--editorial-surface)] border-[var(--editorial-rule)] text-[var(--editorial-ink)]'
          }`}
        >
          {feedback.message}
        </div>
      )}
    </div>
  );
};

export default LocalModelsPanel;
