import type { AIModel, ModelCapabilityType, TaskType } from '../types';

export interface FilterCriteria {
  taskType: TaskType;
  requiredCapability?: ModelCapabilityType;
  preferFree?: boolean;
  allowEligibleUnknown?: boolean;
  minContextLength?: number;
  tierPreference?: 'fast' | 'balanced' | 'quality';
}

export class ModelFilterService {
  /**
   * Filter and rank models for a task.
   * Strictly verifies that the required capability is 'supported' (never guesses unknown/unsupported).
   * By default, only routes to verified free models (verifiedFree: true).
   */
  public filterAndRankModels(models: AIModel[], criteria: FilterCriteria): AIModel[] {
    const requiredCap = criteria.requiredCapability || this.getRequiredCapabilityForTask(criteria.taskType);
    const preferFree = criteria.preferFree !== undefined ? criteria.preferFree : true;

    // 1. Filter ONLY models where the required capability is strictly 'supported'
    let candidates = models.filter(m => {
      // Must have verified capability
      if (!m.capabilityMap || m.capabilityMap[requiredCap] !== 'supported') {
        return false;
      }

      if (criteria.minContextLength && (m.contextWindow || 0) < criteria.minContextLength) {
        return false;
      }

      if (criteria.taskType === 'structured_json' && m.capabilityMap.structured_output !== 'supported') {
        return false;
      }

      return true;
    });

    // 2. Verified Free filtering
    if (preferFree) {
      const verifiedFree = candidates.filter(m => m.verifiedFree && m.eligibilityStatus === 'free');
      if (verifiedFree.length > 0) {
        candidates = verifiedFree;
      } else if (criteria.allowEligibleUnknown) {
        const unknownEligible = candidates.filter(m => m.eligibilityStatus === 'eligible_unknown');
        if (unknownEligible.length > 0) {
          candidates = unknownEligible;
        }
      }
    }

    // 3. Score and rank candidates
    return candidates.sort((a, b) => {
      const scoreA = this.calculateModelScore(a, criteria, requiredCap);
      const scoreB = this.calculateModelScore(b, criteria, requiredCap);
      return scoreB - scoreA;
    });
  }

  public getVerifiedFreeModels(models: AIModel[], capability?: ModelCapabilityType): AIModel[] {
    return models.filter(m => {
      if (!m.verifiedFree || m.eligibilityStatus !== 'free') return false;
      if (capability && (!m.capabilityMap || m.capabilityMap[capability] !== 'supported')) return false;
      return true;
    });
  }

  public getRequiredCapabilityForTask(taskType: TaskType): ModelCapabilityType {
    switch (taskType) {
      case 'vision':
      case 'image_analysis':
      case 'advanced_image_analysis':
        return 'vision';
      case 'structured_json':
        return 'structured_output';
      case 'coding':
        return 'coding';
      case 'reasoning':
        return 'reasoning';
      case 'prompt_enhancement':
      case 'text_generation':
      default:
        return 'chat';
    }
  }

  private calculateModelScore(model: AIModel, criteria: FilterCriteria, requiredCap: ModelCapabilityType): number {
    let score = 50;

    // Verified free bonus
    if (model.verifiedFree && model.eligibilityStatus === 'free') {
      score += 40;
    } else if (model.eligibilityStatus === 'eligible_unknown') {
      score += 10;
    }

    // Capability depth bonus: if model supports secondary helpful capabilities
    if (requiredCap === 'chat' && model.capabilityMap?.reasoning === 'supported') {
      score += 15;
    }
    if (requiredCap === 'structured_output' && model.capabilityMap?.coding === 'supported') {
      score += 10;
    }

    // Tier alignment
    const targetTier = criteria.tierPreference || this.getDefaultTierForTask(criteria.taskType);
    if (model.tier === targetTier) {
      score += 20;
    }

    // Context length bonus
    if (model.contextWindow !== undefined && model.contextWindow >= 32768) {
      score += 10;
    }

    // Quality reputation heuristics
    const lowerId = model.id.toLowerCase();
    if (lowerId.includes('llama-3.3') || lowerId.includes('gemini-2.0') || lowerId.includes('qwen') || lowerId.includes('nemotron')) {
      score += 15;
    }

    return score;
  }

  private getDefaultTierForTask(taskType: TaskType): 'fast' | 'balanced' | 'quality' {
    switch (taskType) {
      case 'prompt_enhancement':
        return 'fast';
      case 'structured_json':
        return 'balanced';
      case 'vision':
        return 'balanced';
      case 'text_generation':
      default:
        return 'fast';
    }
  }
}

export const modelFilterService = new ModelFilterService();
