import { getJson } from 'serpapi';
import type { TrendSignal } from '../domain/types.ts';

export interface TrendsService {
  getTrendSignals(keywords: string[]): Promise<TrendSignal[]>;
}

export class DeterministicTrendsService implements TrendsService {
  async getTrendSignals(keywords: string[]) {
    return keywords.map((keyword, index) => ({
      keyword,
      score: Math.max(35, 88 - index * 9),
      direction: index % 3 === 2 ? 'stable' as const : 'rising' as const,
      source: 'deterministic-local-signal',
    }));
  }
}

export class SerpApiTrendsService implements TrendsService {
  private readonly apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async getTrendSignals(keywords: string[]) {
    const signals = await Promise.all(keywords.map((keyword) => this.getTrendSignal(keyword)));
    return signals.filter((signal): signal is TrendSignal => Boolean(signal));
  }

  private async getTrendSignal(keyword: string): Promise<TrendSignal | null> {
    const data = await getJson({
      engine: 'google_trends',
      q: keyword,
      api_key: this.apiKey,
      date: 'now 7-d',
      data_type: 'TIMESERIES',
    });

    const values = data?.interest_over_time?.timeline_data
      ?.map((item: any) => item.values?.[0]?.extracted_value ?? 0)
      ?.filter((value: unknown) => typeof value === 'number') as number[] | undefined;

    if (!values?.length) return null;

    const score = Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
    const earlyAverage = average(values.slice(0, Math.min(3, values.length)));
    const recentAverage = average(values.slice(Math.max(0, values.length - 3)));

    return {
      keyword,
      score,
      direction: trendDirection(earlyAverage, recentAverage),
      source: 'serpapi-google-trends',
    };
  }
}

export class FallbackTrendsService implements TrendsService {
  private readonly primary: TrendsService;
  private readonly fallback: TrendsService;

  constructor(
    primary: TrendsService,
    fallback = new DeterministicTrendsService(),
  ) {
    this.primary = primary;
    this.fallback = fallback;
  }

  async getTrendSignals(keywords: string[]) {
    try {
      const signals = await this.primary.getTrendSignals(keywords);
      if (signals.length) return signals;
    } catch (error) {
      console.warn('[trends] primary trends service failed:', error);
    }

    return this.fallback.getTrendSignals(keywords);
  }
}

export function createTrendsService(apiKey?: string): TrendsService {
  if (!apiKey) return new DeterministicTrendsService();
  return new FallbackTrendsService(new SerpApiTrendsService(apiKey));
}

function average(values: number[]) {
  if (!values.length) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function trendDirection(earlyAverage: number, recentAverage: number): TrendSignal['direction'] {
  if (recentAverage > earlyAverage * 1.2) return 'rising';
  if (recentAverage < earlyAverage * 0.8) return 'declining';
  return 'stable';
}
