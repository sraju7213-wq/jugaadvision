import type { HealthReport, HealthState, ProviderName } from '../types';
import { modelHealthManager } from './modelHealthManager';

export class HealthTracker {
  public recordSuccess(provider: ProviderName, modelId: string, durationMs: number): void {
    modelHealthManager.recordModelSuccess(provider, modelId, durationMs);
  }

  public recordError(provider: ProviderName, modelId: string, statusCode?: number, errorMessage?: string): void {
    modelHealthManager.recordModelFailure(provider, modelId, errorMessage || 'Model error', statusCode);
  }

  public isHealthy(provider: ProviderName, modelId: string): boolean {
    return modelHealthManager.isModelAvailable(provider, modelId);
  }

  public getHealthScore(provider: ProviderName, modelId: string): number {
    const health = modelHealthManager.getModelHealth(provider, modelId);
    if (health.state === 'disabled' || health.state === 'quota_exhausted') return 0;
    if (health.state === 'rate_limited' || health.state === 'temporarily_unavailable') return 10;
    if (health.state === 'degraded') return 50;

    const total = health.successCount + health.failureCount;
    const rate = total > 0 ? (health.successCount / total) : 1.0;
    return Math.round(rate * 100);
  }

  public getModelHealthState(provider: ProviderName, modelId: string): HealthState {
    return modelHealthManager.getModelHealth(provider, modelId).state;
  }

  public generateReport(
    keyStats?: Record<string, { active: number; total: number }>,
    modelCounts?: Record<string, number>
  ): HealthReport {
    return modelHealthManager.generateReport(keyStats, modelCounts);
  }
}

export const healthTracker = new HealthTracker();
