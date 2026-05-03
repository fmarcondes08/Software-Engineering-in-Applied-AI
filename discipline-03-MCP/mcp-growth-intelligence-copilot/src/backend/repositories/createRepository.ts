import { config } from '../config.ts';
import type { GrowthRepository } from './growthRepository.ts';
import { InMemoryGrowthRepository } from './inMemoryGrowthRepository.ts';
import { MongoGrowthRepository } from './mongoGrowthRepository.ts';

export async function createRepository(): Promise<GrowthRepository> {
  if (!config.mongodbUri || process.env.USE_IN_MEMORY_DB === 'true' || process.env.NODE_ENV === 'test') {
    return new InMemoryGrowthRepository();
  }

  return new MongoGrowthRepository(config.mongodbUri, config.dbName).connect();
}
