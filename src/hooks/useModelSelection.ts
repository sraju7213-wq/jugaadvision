import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  listLocalModels,
  RECOMMENDED_MODELS,
  type LocalModelInfo,
  type RecommendedModel,
} from '../services/localAiService';
import { aiFetchModels } from '../services/aiGatewayClient';
import { loadSelectedModel, saveSelectedModel } from '../services/settingsStorage';

export interface UnifiedModelOption {
  id: string;
  name: string;
  group: 'auto' | 'offline' | 'cloud';
  isOffline: boolean;
  isLoaded?: boolean;
  fileSizeHuman?: string;
  badge?: string;
  modality: 'text' | 'vision' | 'unknown';
  description?: string;
}

export function useModelSelection(filterModality?: 'text' | 'vision' | 'all') {
  const [selectedModel, setSelectedModelState] = useState<string>(() => loadSelectedModel());
  const [localModels, setLocalModels] = useState<LocalModelInfo[]>([]);
  const [cloudModels, setCloudModels] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Sync state with storage and other tabs / components
  useEffect(() => {
    const handleModelChange = (e: Event) => {
      const detail = (e as CustomEvent).detail as { modelId?: string };
      if (typeof detail?.modelId === 'string') {
        setSelectedModelState(detail.modelId);
      }
    };

    const handleStorage = (e: StorageEvent) => {
      if (e.key === 'jugaad_selected_model_v1') {
        setSelectedModelState(e.newValue || '');
      }
    };

    window.addEventListener('jugaad:modelchange', handleModelChange as EventListener);
    window.addEventListener('storage', handleStorage);
    return () => {
      window.removeEventListener('jugaad:modelchange', handleModelChange as EventListener);
      window.removeEventListener('storage', handleStorage);
    };
  }, []);

  const setSelectedModel = useCallback((modelId: string) => {
    setSelectedModelState(modelId);
    saveSelectedModel(modelId);
  }, []);

  // Fetch local & cloud models
  const refreshModels = useCallback(async () => {
    setIsLoading(true);
    try {
      const [locals, clouds] = await Promise.allSettled([
        listLocalModels(),
        aiFetchModels({ freeOnly: true }),
      ]);

      if (locals.status === 'fulfilled' && Array.isArray(locals.value)) {
        setLocalModels(locals.value);
      }
      if (clouds.status === 'fulfilled' && Array.isArray(clouds.value)) {
        setCloudModels(clouds.value);
      }
    } catch (err) {
      console.warn('[useModelSelection] Error refreshing models:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshModels();
  }, [refreshModels]);

  // Build list of offline models (combining installed local models + curated recommended models)
  const offlineModelOptions = useMemo<UnifiedModelOption[]>(() => {
    const map = new Map<string, UnifiedModelOption>();

    // 1. First add installed local models on disk
    for (const m of localModels) {
      const globalId = m.id.startsWith('local:') ? m.id : `local:${m.id}`;
      map.set(globalId, {
        id: globalId,
        name: `[OFFLINE] ${m.name}`,
        group: 'offline',
        isOffline: true,
        isLoaded: m.isLoaded,
        fileSizeHuman: m.fileSizeHuman,
        badge: m.isLoaded ? 'IN RAM' : 'ON DISK',
        modality: m.modality,
        description: m.note || `${m.fileName} · On-Device GGUF`,
      });
    }

    // 2. Add curated recommended models if not already installed
    for (const r of RECOMMENDED_MODELS) {
      const globalId = `local:${r.id}`;
      if (!map.has(globalId)) {
        map.set(globalId, {
          id: globalId,
          name: `[OFFLINE] ${r.name}`,
          group: 'offline',
          isOffline: true,
          isLoaded: false,
          fileSizeHuman: r.fileSizeHuman,
          badge: r.badge,
          modality: r.modality,
          description: `${r.tagline} (${r.fileSizeHuman})`,
        });
      }
    }

    let list = Array.from(map.values());
    if (filterModality && filterModality !== 'all') {
      list = list.filter((m) => m.modality === filterModality || m.modality === 'unknown');
    }
    return list;
  }, [localModels, filterModality]);

  // Build cloud models options
  const cloudModelOptions = useMemo<UnifiedModelOption[]>(() => {
    let list = cloudModels.map((m) => ({
      id: m.id,
      name: m.name || m.id,
      group: 'cloud' as const,
      isOffline: false,
      badge: m.verifiedFree ? 'FREE' : undefined,
      modality: (m.capabilities?.includes('vision') ? 'vision' : 'text') as 'text' | 'vision',
      description: m.description || m.provider,
    }));

    if (filterModality === 'vision') {
      list = list.filter((m) => m.modality === 'vision');
    } else if (filterModality === 'text') {
      list = list.filter((m) => m.modality === 'text');
    }
    return list;
  }, [cloudModels, filterModality]);

  // Is current selection an offline model?
  const isOffline = useMemo(() => {
    if (!selectedModel) return false;
    return selectedModel.startsWith('local:') || offlineModelOptions.some((m) => m.id === selectedModel);
  }, [selectedModel, offlineModelOptions]);

  // Human-readable active model name
  const activeModelName = useMemo(() => {
    if (!selectedModel) return 'Auto (Best Free AI)';
    const foundOffline = offlineModelOptions.find((m) => m.id === selectedModel);
    if (foundOffline) return foundOffline.name;
    const foundCloud = cloudModelOptions.find((m) => m.id === selectedModel);
    if (foundCloud) return foundCloud.name;
    if (selectedModel.startsWith('local:')) {
      const clean = selectedModel.replace(/^local:/, '');
      return `[OFFLINE] ${clean}`;
    }
    return selectedModel;
  }, [selectedModel, offlineModelOptions, cloudModelOptions]);

  return {
    selectedModel,
    setSelectedModel,
    localModels,
    recommendedModels: RECOMMENDED_MODELS,
    cloudModels,
    offlineModelOptions,
    cloudModelOptions,
    isOffline,
    activeModelName,
    isLoading,
    refreshModels,
  };
}
