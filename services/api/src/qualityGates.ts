import type { QualityGateDiagnostic, QualityGateCode } from './types';

/**
 * Validates whether a given string is valid JSON and adheres to required keys if a schema is provided.
 */
export function validateJsonSchema(raw: string, schema?: Record<string, any>): { valid: boolean; parsed?: any; diagnostics: QualityGateDiagnostic[] } {
  const diagnostics: QualityGateDiagnostic[] = [];

  if (!raw || typeof raw !== 'string') {
    diagnostics.push({
      passed: false,
      code: 'INVALID_JSON',
      message: 'Empty or non-string response received from AI model.',
      severity: 'error',
    });
    return { valid: false, diagnostics };
  }

  // Attempt extraction if wrapped in markdown codeblocks
  let cleaned = raw.trim();
  const jsonBlockMatch = cleaned.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (jsonBlockMatch) {
    cleaned = jsonBlockMatch[1].trim();
  }

  let parsed: any;
  try {
    parsed = JSON.parse(cleaned);
  } catch (err: any) {
    // Attempt relaxed recovery for common trailing comma issues
    try {
      const relaxed = cleaned.replace(/,\s*([}\]])/g, '$1');
      parsed = JSON.parse(relaxed);
    } catch {
      diagnostics.push({
        passed: false,
        code: 'INVALID_JSON',
        message: `Failed to parse structured JSON: ${err.message}`,
        severity: 'error',
      });
      return { valid: false, diagnostics };
    }
  }

  if (schema && typeof schema === 'object') {
    if (schema.required && Array.isArray(schema.required)) {
      for (const requiredKey of schema.required) {
        if (parsed[requiredKey] === undefined || parsed[requiredKey] === null) {
          diagnostics.push({
            passed: false,
            code: 'MISSING_REQUIRED_FIELD',
            message: `Missing required field: '${requiredKey}' in generated JSON.`,
            details: { missingField: requiredKey },
            severity: 'error',
          });
        }
      }
    }
  }

  return {
    valid: diagnostics.every(d => d.severity !== 'error'),
    parsed,
    diagnostics,
  };
}

/**
 * Validates that protected user tokens (e.g. brand names, exact typography copy) are intact in the generated text.
 */
export function validateExactTextPreservation(originalText: string, generatedText: string): QualityGateDiagnostic[] {
  const diagnostics: QualityGateDiagnostic[] = [];
  if (!originalText || !generatedText) return diagnostics;

  // Check quoted strings or uppercase brand tokens in original text
  const quotedTokens = originalText.match(/"([^"]+)"|'([^']+)'/g);
  if (quotedTokens) {
    for (const rawToken of quotedTokens) {
      const token = rawToken.replace(/['"]/g, '').trim();
      if (token.length > 2 && !generatedText.toLowerCase().includes(token.toLowerCase())) {
        diagnostics.push({
          passed: false,
          code: 'EXACT_TEXT_CHANGED',
          message: `Protected exact text "${token}" was not found in the generated prompt.`,
          details: { missingToken: token },
          severity: 'warning',
        });
      }
    }
  }

  return diagnostics;
}

/**
 * Calculates n-gram / Jaccard similarity between variations to detect duplicate/low-diversity outputs.
 */
export function calculateVariationDiversity(prompts: string[]): { diversityScore: number; diagnostics: QualityGateDiagnostic[] } {
  const diagnostics: QualityGateDiagnostic[] = [];
  if (!prompts || prompts.length <= 1) {
    return { diversityScore: 1.0, diagnostics };
  }

  const tokenSets = prompts.map(p => new Set(p.toLowerCase().replace(/[^a-z0-9\s]/g, '').split(/\s+/).filter(Boolean)));
  let totalJaccard = 0;
  let comparisons = 0;

  for (let i = 0; i < tokenSets.length; i++) {
    for (let j = i + 1; j < tokenSets.length; j++) {
      const setA = tokenSets[i];
      const setB = tokenSets[j];
      const intersection = new Set([...setA].filter(x => setB.has(x)));
      const union = new Set([...setA, ...setB]);
      const jaccard = union.size === 0 ? 1 : intersection.size / union.size;
      totalJaccard += jaccard;
      comparisons++;
    }
  }

  const avgSimilarity = comparisons > 0 ? totalJaccard / comparisons : 0;
  const diversityScore = Math.max(0, Math.min(1, 1 - avgSimilarity));

  if (diversityScore < 0.25) {
    diagnostics.push({
      passed: false,
      code: 'LOW_VARIATION_DIVERSITY',
      message: 'Generated batch variations have high similarity and low creative diversity.',
      details: { diversityScore },
      severity: 'warning',
    });
  }

  return { diversityScore, diagnostics };
}

/**
 * Detects conflicting styles and moods in user selections.
 */
export function detectCreativeConflicts(styles: string[], moods: string[]): QualityGateDiagnostic[] {
  const diagnostics: QualityGateDiagnostic[] = [];
  const allDescriptors = [...styles, ...moods].map(s => s.toLowerCase());

  const conflictPairs = [
    { a: 'minimalist', b: 'baroque', message: 'Minimalist and Baroque styles have contradictory density rules.' },
    { a: 'minimalist', b: 'maximalist', message: 'Minimalist and Maximalist are polar opposite aesthetics.' },
    { a: 'tranquil', b: 'explosive', message: 'Tranquil/Zen and Explosive/Action have conflicting energetic pacing.' },
    { a: 'dark & gritty', b: 'whimsical', message: 'Dark & Gritty and Whimsical mood pairing may produce jarring tone.' },
    { a: 'monochrome', b: 'vibrant', message: 'Monochrome and Vibrant have contradictory color saturation.' },
    { a: 'photorealistic', b: 'flat illustration', message: 'Photorealistic and Flat Illustration are conflicting visual media.' },
  ];

  for (const pair of conflictPairs) {
    const hasA = allDescriptors.some(d => d.includes(pair.a));
    const hasB = allDescriptors.some(d => d.includes(pair.b));
    if (hasA && hasB) {
      diagnostics.push({
        passed: false,
        code: 'CONSTRAINT_CONFLICT',
        message: pair.message,
        details: { conflict: [pair.a, pair.b] },
        severity: 'info',
      });
    }
  }

  return diagnostics;
}
