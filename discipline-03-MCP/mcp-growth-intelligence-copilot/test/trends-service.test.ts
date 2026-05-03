import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  DeterministicTrendsService,
  FallbackTrendsService,
  SerpApiTrendsService,
  createTrendsService,
} from '../src/backend/services/trendsService.ts';

describe('trends service factory', () => {
  it('uses deterministic trends when SERPAPI_API_KEY is missing', () => {
    const service = createTrendsService();
    assert.ok(service instanceof DeterministicTrendsService);
  });

  it('uses SerpAPI with fallback when SERPAPI_API_KEY exists', () => {
    const service = createTrendsService('test-api-key');
    assert.ok(service instanceof FallbackTrendsService);
  });
});

describe('FallbackTrendsService', () => {
  it('falls back to deterministic signals when the primary service fails', async () => {
    const service = new FallbackTrendsService({
      async getTrendSignals() {
        throw new Error('SerpAPI unavailable');
      },
    });

    const [signal] = await service.getTrendSignals(['mcp']);
    assert.equal(signal.source, 'deterministic-local-signal');
  });
});

describe('SerpApiTrendsService', () => {
  it('can be constructed with an API key', () => {
    assert.ok(new SerpApiTrendsService('test-api-key'));
  });
});
