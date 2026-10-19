import { describe, it, expect } from 'vitest';
import {
  calculateVariationDiversity,
  detectCreativeConflicts,
  validateExactTextPreservation,
  validateJsonSchema,
} from '@jugaad/api/ai/qualityGates';

describe('validateJsonSchema', () => {
  it('accepts a plain JSON object', () => {
    const result = validateJsonSchema('{"subject":"a lighthouse"}');

    expect(result.valid).toBe(true);
    expect(result.parsed).toEqual({ subject: 'a lighthouse' });
    expect(result.diagnostics).toHaveLength(0);
  });

  it('extracts JSON wrapped in a markdown code fence', () => {
    const result = validateJsonSchema('```json\n{"subject":"a lighthouse"}\n```');

    expect(result.valid).toBe(true);
    expect(result.parsed.subject).toBe('a lighthouse');
  });

  it('recovers from a trailing comma', () => {
    const result = validateJsonSchema('{"subject":"a lighthouse","camera":"wide",}');

    expect(result.valid).toBe(true);
    expect(result.parsed.camera).toBe('wide');
  });

  it('rejects malformed JSON with an INVALID_JSON diagnostic', () => {
    const result = validateJsonSchema('{"subject": ');

    expect(result.valid).toBe(false);
    expect(result.diagnostics[0].code).toBe('INVALID_JSON');
  });

  it('rejects non-string input', () => {
    const result = validateJsonSchema(undefined as unknown as string);

    expect(result.valid).toBe(false);
    expect(result.diagnostics[0].code).toBe('INVALID_JSON');
  });

  it('reports a missing required field', () => {
    const result = validateJsonSchema('{"composition":"centered"}', {
      required: ['subject', 'assembledPrompt'],
    });

    expect(result.valid).toBe(false);
    expect(result.diagnostics.map(d => d.code)).toContain('MISSING_REQUIRED_FIELD');
  });

  it('accepts a payload that satisfies every required field', () => {
    const result = validateJsonSchema('{"subject":"a lighthouse","assembledPrompt":"a lighthouse at dawn"}', {
      required: ['subject', 'assembledPrompt'],
    });

    expect(result.valid).toBe(true);
  });
});

describe('validateExactTextPreservation', () => {
  it('stays silent when every protected token survives', () => {
    const diagnostics = validateExactTextPreservation(
      'Keep "ACME Corp" exactly',
      'A billboard for ACME Corp at noon',
    );

    expect(diagnostics).toHaveLength(0);
  });

  it('warns when a quoted token is dropped', () => {
    const diagnostics = validateExactTextPreservation(
      'Keep "ACME Corp" exactly',
      'A billboard for a generic company',
    );

    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0].code).toBe('EXACT_TEXT_CHANGED');
    expect(diagnostics[0].details.missingToken).toBe('ACME Corp');
  });

  it('ignores empty input', () => {
    expect(validateExactTextPreservation('', 'anything')).toHaveLength(0);
  });
});

describe('calculateVariationDiversity', () => {
  it('returns full diversity for a single prompt', () => {
    expect(calculateVariationDiversity(['a lighthouse at dawn']).diversityScore).toBe(1);
  });

  it('flags near-identical variations', () => {
    const result = calculateVariationDiversity([
      'a lighthouse at dawn, cinematic',
      'a lighthouse at dawn, cinematic',
      'a lighthouse at dawn, cinematic',
    ]);

    expect(result.diversityScore).toBeLessThan(0.25);
    expect(result.diagnostics[0].code).toBe('LOW_VARIATION_DIVERSITY');
  });

  it('scores clearly different prompts as diverse', () => {
    const result = calculateVariationDiversity([
      'a lighthouse at dawn, cinematic, teal grade',
      'a neon arcade cabinet in a rainy alley, cyberpunk',
    ]);

    expect(result.diversityScore).toBeGreaterThan(0.5);
    expect(result.diagnostics).toHaveLength(0);
  });
});

describe('detectCreativeConflicts', () => {
  it('detects contradictory style pairings', () => {
    const diagnostics = detectCreativeConflicts(['Minimalist', 'Baroque'], []);

    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0].code).toBe('CONSTRAINT_CONFLICT');
    expect(diagnostics[0].details.conflict).toEqual(['minimalist', 'baroque']);
  });

  it('detects conflicts between a style and a mood', () => {
    const diagnostics = detectCreativeConflicts(['Photorealistic'], ['Flat Illustration']);

    expect(diagnostics.length).toBeGreaterThan(0);
  });

  it('stays silent for a coherent selection', () => {
    expect(detectCreativeConflicts(['Cinematic', 'Moody'], ['Tranquil'])).toHaveLength(0);
  });
});
