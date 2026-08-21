import type {
  AIModel,
  AIRequest,
  ModelCapabilityType,
  ScoringWeights,
  TaskType,
} from '../types';

export const DEFAULT_SCORING_WEIGHTS: ScoringWeights = {
  verifiedFreeBonus: 50,
  capabilityMatchWeight: 35,
  tierAlignmentWeight: 40,
  tierMismatchPenalty: 20,
  healthScoreWeight: 25,
  successRateWeight: 30,
  latencyBonusWeight: 20,
  failurePenaltyWeight: 15,
  contextWindowBonus: 10,
};

export class ModelScoringEngine {
  private defaultWeights: ScoringWeights = { ...DEFAULT_SCORING_WEIGHTS };

  public setWeights(weights: Partial<ScoringWeights>): void {
    this.defaultWeights = { ...this.defaultWeights, ...weights };
  }

  public getWeights(): ScoringWeights {
    return { ...this.defaultWeights };
  }

  /**
   * Scores a model dynamically for a specific request.
   * Simple tasks prioritize lightweight ('fast') models.
   * Complex tasks prioritize high-capacity ('quality') models.
   */
  public scoreModel(model: AIModel, request: AIRequest): number {
    const weights: ScoringWeights = {
      ...this.defaultWeights,
      ...(request.scoringWeightsOverride || {}),
    };

    let score = 100;

    // 1. Verified Free Status
    if (model.verifiedFree && model.eligibilityStatus === 'free') {
      score += weights.verifiedFreeBonus;
    } else if (model.eligibilityStatus === 'eligible_unknown') {
      score += Math.round(weights.verifiedFreeBonus * 0.2);
    }

    // 2. Task Tier Alignment (Lightweight vs Heavyweight Model Selection)
    const targetTier = this.getTargetTierForTask(request.taskType, request.preferredQuality);

    if (model.tier === targetTier) {
      score += weights.tierAlignmentWeight;
    } else if (targetTier === 'fast' && model.tier === 'quality') {
      // Simple task trying to use an oversized model -> apply mismatch penalty
      score -= weights.tierMismatchPenalty;
    } else if (targetTier === 'quality' && model.tier === 'fast') {
      // Complex task trying to use an underpowered model -> apply mismatch penalty
      score -= weights.tierMismatchPenalty;
    }

    // 3. Capability Match Depth
    const requiredCap = this.getPrimaryCapabilityForTask(request.taskType);
    const capMap = model.capabilityMap;
    if (capMap && capMap[requiredCap] === 'supported') {
      score += weights.capabilityMatchWeight;
    }

    // Task-specific secondary capability bonuses
    if (request.taskType === 'reasoning' && capMap?.reasoning === 'supported') {
      score += 25;
    }
    if (request.taskType === 'coding' && capMap?.coding === 'supported') {
      score += 25;
    }
    if (request.taskType === 'advanced_image_analysis' && capMap?.vision === 'supported') {
      score += 20;
    }

    // 4. Live Health & Success Rate
    if (model.status === 'available') {
      score += weights.healthScoreWeight;
    } else if (model.status === 'degraded') {
      score -= Math.round(weights.healthScoreWeight * 0.5);
    }

    if (model.successRate !== undefined) {
      score += Math.round(model.successRate * weights.successRateWeight);
    }

    // 5. Recent Failure Penalty
    if (model.failureCount !== undefined && model.failureCount > 0) {
      score -= Math.min(45, model.failureCount * weights.failurePenaltyWeight);
    }

    // 6. Latency & Speed Preference
    if (model.averageLatency !== undefined && model.averageLatency > 0) {
      if (model.averageLatency < 1200) {
        score += weights.latencyBonusWeight;
      } else if (model.averageLatency > 5000) {
        score -= weights.latencyBonusWeight;
      }
    }

    if (request.speedPreference === 'fastest' && model.tier === 'fast') {
      score += 20;
    }

    // 7. Context Window Size
    if (model.contextWindow !== undefined && model.contextWindow >= 65536) {
      score += weights.contextWindowBonus;
    }

    // 8. Explicit User Preferences
    if (request.preferredProvider && model.provider === request.preferredProvider) {
      score += 40;
    }
    if (request.preferredModel && (model.providerModelId === request.preferredModel || model.id === request.preferredModel)) {
      score += 60;
    }

    return score;
  }

  /**
   * Identifies the optimal model tier for a given task type.
   * Simple tasks -> 'fast' (lightweight)
   * Complex tasks -> 'quality' (stronger)
   * Balanced / default -> 'balanced'
   */
  public getTargetTierForTask(taskType: TaskType, qualityPref?: 'high' | 'balanced' | 'speed'): 'fast' | 'balanced' | 'quality' {
    if (qualityPref === 'high') return 'quality';
    if (qualityPref === 'speed') return 'fast';

    switch (taskType) {
      // Simple Tasks -> Lightweight ('fast')
      case 'rewriting':
      case 'captions':
      case 'prompt_formatting':
      case 'extracting_structured_information':
      case 'simple_creative_suggestions':
      case 'prompt_enhancement':
      case 'text_generation':
        return 'fast';

      // Complex Tasks -> Heavyweight / Stronger ('quality')
      case 'complex_reasoning' as any:
      case 'reasoning':
      case 'coding':
      case 'multi_step_tasks':
        return 'quality';

      // Intermediate / Balanced
      case 'creative_prompt':
      case 'chat':
      case 'vision':
      case 'image_analysis':
      case 'advanced_image_analysis':
      case 'structured_json':
      default:
        return 'balanced';
    }
  }

  public getPrimaryCapabilityForTask(taskType: TaskType): ModelCapabilityType {
    switch (taskType) {
      case 'vision':
      case 'image_analysis':
      case 'advanced_image_analysis':
        return 'vision';
      case 'coding':
        return 'coding';
      case 'reasoning':
        return 'reasoning';
      case 'structured_json':
      case 'extracting_structured_information':
        return 'structured_output';
      case 'rewriting':
      case 'captions':
      case 'prompt_formatting':
      case 'simple_creative_suggestions':
      case 'creative_prompt':
      case 'chat':
      case 'text_generation':
      case 'prompt_enhancement':
      case 'multi_step_tasks':
      default:
        return 'chat';
    }
  }
}

export const modelScoringEngine = new ModelScoringEngine();
