import { useCallback, useRef, useState } from 'react';
import { aiAnalyzeVisionStream, VisionStreamEvent } from '../services/aiGatewayClient';

export interface UseVisionStreamState {
  isStreaming: boolean;
  streamedText: string;
  stage: string;
  progress: number;
  model: string | null;
  provider: string | null;
  error: string | null;
  isCached: boolean;
}

export function useVisionStream() {
  const [state, setState] = useState<UseVisionStreamState>({
    isStreaming: false,
    streamedText: '',
    stage: '',
    progress: 0,
    model: null,
    provider: null,
    error: null,
    isCached: false,
  });
  const abortRef = useRef<AbortController | null>(null);

  const start = useCallback(async (opts: {
    imageBase64: string;
    mimeType: string;
    prompt: string;
    preferredModel?: string;
    preferFree?: boolean;
  }) => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setState(s => ({ ...s, isStreaming: true, streamedText: '', stage: 'Routing to fastest vision model...', progress: 15, error: null }));

    try {
      const result = await aiAnalyzeVisionStream(
        {
          prompt: opts.prompt,
          imageBase64: opts.imageBase64,
          mimeType: opts.mimeType,
          preferredModel: opts.preferredModel,
          preferFree: opts.preferFree,
          signal: controller.signal,
        },
        (ev: VisionStreamEvent) => {
          if (ev.event === 'status') {
            setState(s => ({ ...s, stage: ev.data.stage || s.stage, progress: Math.max(s.progress, ev.data.progress || 20) }));
          } else if (ev.event === 'meta') {
            setState(s => ({ ...s, model: ev.data.model || s.model, provider: ev.data.provider || s.provider, stage: 'Analyzing visual composition...', progress: 50 }));
          } else if (ev.event === 'token') {
            setState(s => ({ ...s, streamedText: ev.data.accumulated || s.streamedText + (ev.data.text || ''), progress: Math.min(90, s.progress + 0.4) }));
          } else if (ev.event === 'structured') {
            // structured object available — could hydrate breakdown progressively
          }
        }
      );
      setState(s => ({ ...s, isStreaming: false, streamedText: result.result, progress: 100, stage: 'Complete', model: result.model || s.model }));
      return result;
    } catch (e: any) {
      if (e.message?.toLowerCase().includes('cancelled') || controller.signal.aborted) {
        setState(s => ({ ...s, isStreaming: false }));
        throw e;
      }
      setState(s => ({ ...s, isStreaming: false, error: e.message || 'Vision stream failed' }));
      throw e;
    }
  }, []);

  const cancel = useCallback(() => {
    abortRef.current?.abort();
    setState(s => ({ ...s, isStreaming: false, stage: '' }));
  }, []);

  const reset = useCallback(() => {
    setState({ isStreaming: false, streamedText: '', stage: '', progress: 0, model: null, provider: null, error: null, isCached: false });
  }, []);

  return { ...state, start, cancel, reset, abortRef };
}
