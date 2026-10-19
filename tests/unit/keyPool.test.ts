import { describe, it, expect, beforeEach } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  KeyPoolManager,
  SUPPORTED_PROVIDERS,
  maskApiKey,
  redactSecrets,
} from '@jugaad/api/ai/pools/keyPool';

// setup-env.ts forces VERCEL=1, which pins the credential store to
// os.tmpdir()/jugaad-api-keys.json. That path is shared by every run of the
// suite, so each test has to start from a clean file or keys from an earlier
// run leak into the assertions.
const PERSISTED_KEYS = path.join(os.tmpdir(), 'jugaad-api-keys.json');

describe('maskApiKey', () => {
  it('masks an empty key', () => {
    expect(maskApiKey('')).toBe('***');
  });

  it('masks a very short key without leaking it', () => {
    expect(maskApiKey('abc')).toBe('****');
  });

  it('keeps only a prefix and a suffix of a long key', () => {
    const key = 'sk-or-v1-abcdef1234567890abcdef';
    const masked = maskApiKey(key);

    expect(masked).not.toContain('abcdef1234567890abcdef');
    expect(masked).toContain('...');
    expect(masked.startsWith('sk-or')).toBe(true);
  });
});

describe('redactSecrets', () => {
  it('redacts OpenAI-style keys', () => {
    expect(redactSecrets('failed with sk-abcdefghijklmnop1234')).toBe(
      'failed with sk-[REDACTED]',
    );
  });

  it('redacts bearer tokens', () => {
    expect(redactSecrets('Authorization: Bearer abcdef1234567890')).toBe(
      'Authorization: Bearer [REDACTED]',
    );
  });

  it('redacts key=value assignments', () => {
    expect(redactSecrets('api_key=abcdef1234567890')).toBe('api_key=[REDACTED]');
  });

  it('returns an empty string for empty input', () => {
    expect(redactSecrets('')).toBe('');
  });
});

describe('SUPPORTED_PROVIDERS', () => {
  it('only manages the two remaining providers', () => {
    expect(SUPPORTED_PROVIDERS).toEqual(['custom', 'openrouter']);
  });
});

describe('KeyPoolManager', () => {
  let pool: KeyPoolManager;

  beforeEach(() => {
    fs.rmSync(PERSISTED_KEYS, { force: true });
    pool = new KeyPoolManager();
  });

  it('returns null when the provider has no keys', () => {
    expect(pool.getAvailableKey('openrouter')).toBeNull();
  });

  it('splits comma/newline separated keys and de-duplicates them', () => {
    const result = pool.setProviderKeys(
      'openrouter',
      'sk-or-aaaa1111bbbb2222,sk-or-cccc3333dddd4444\nsk-or-aaaa1111bbbb2222',
    );

    expect(result.total).toBe(2);
    expect(new Set(result.maskedKeys).size).toBe(2);
  });

  it('hands out a different key once one is excluded from the attempt', () => {
    pool.setProviderKeys('openrouter', ['k-one', 'k-two']);

    const first = pool.getAvailableKey('openrouter');
    expect(first).not.toBeNull();

    const second = pool.getAvailableKey('openrouter', [first!]);
    expect(second).not.toBeNull();
    expect(second).not.toBe(first);
  });

  it('backs a key off after a 429 and reports it as in cooldown', () => {
    pool.setProviderKeys('openrouter', 'k-one');
    pool.reportError('openrouter', 'k-one', 429, 'rate limited');

    expect(pool.getAvailableKey('openrouter')).toBeNull();

    const stats = pool.getPoolStats('openrouter');
    expect(stats.inCooldown).toBe(1);
    expect(stats.keys[0].backoffReason).toBe('rate_limit_429');
  });

  it('treats 404/422 as retryable and clears the failure streak', () => {
    pool.setProviderKeys('openrouter', 'k-one');
    pool.reportError('openrouter', 'k-one', 500, 'server exploded');
    expect(pool.getPoolStats('openrouter').keys[0].consecutiveFailures).toBe(1);

    pool.reportError('openrouter', 'k-one', 404, 'model not found');

    expect(pool.getPoolStats('openrouter').keys[0].consecutiveFailures).toBe(0);
  });

  it('leaves a key usable after a 404 with no prior outage', () => {
    pool.setProviderKeys('openrouter', 'k-one');
    pool.reportError('openrouter', 'k-one', 404, 'model not found');

    expect(pool.getAvailableKey('openrouter')).toBe('k-one');
  });

  it('marks a key exhausted after repeated quota errors', () => {
    pool.setProviderKeys('openrouter', 'k-one');
    for (let i = 0; i < 3; i++) {
      pool.reportError('openrouter', 'k-one', 403, 'insufficient quota');
    }

    expect(pool.getAvailableKey('openrouter')).toBeNull();
    expect(pool.getPoolStats('openrouter').exhausted).toBe(1);
  });

  it('clears the backoff after a success', () => {
    pool.setProviderKeys('openrouter', 'k-one');
    pool.reportError('openrouter', 'k-one', 429, 'rate limited');
    expect(pool.getAvailableKey('openrouter')).toBeNull();

    pool.reportSuccess('openrouter', 'k-one');

    expect(pool.getAvailableKey('openrouter')).toBe('k-one');
    expect(pool.getPoolStats('openrouter').keys[0].consecutiveFailures).toBe(0);
  });

  it('re-enables an exhausted key when keys are set again', () => {
    pool.setProviderKeys('openrouter', 'k-one');
    for (let i = 0; i < 3; i++) {
      pool.reportError('openrouter', 'k-one', 403, 'quota exhausted');
    }
    expect(pool.getAvailableKey('openrouter')).toBeNull();

    pool.setProviderKeys('openrouter', 'k-one');

    expect(pool.getAvailableKey('openrouter')).toBe('k-one');
    expect(pool.getPoolStats('openrouter').exhausted).toBe(0);
  });

  it('ignores reports for keys it does not hold', () => {
    pool.reportError('openrouter', 'unknown-key', 429, 'rate limited');
    pool.reportSuccess('openrouter', 'unknown-key');

    expect(pool.getPoolStats('openrouter').total).toBe(0);
  });
});
