import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { GrowthAgent } from '../src/backend/agent/growthAgent.ts';
import { InMemoryGrowthRepository } from '../src/backend/repositories/inMemoryGrowthRepository.ts';
import { DeterministicTrendsService } from '../src/backend/services/trendsService.ts';

describe('GrowthAgent', () => {
  it('uses customers and trend signals to generate structured recommendations', async () => {
    const repository = new InMemoryGrowthRepository(false);
    const customer = await repository.createCustomer({
      name: 'Test Customer',
      phone: '+1 555-1111',
      segment: 'AI Education',
      interests: ['LangGraph', 'MCP'],
    });

    const agent = new GrowthAgent(repository, new DeterministicTrendsService());
    const result = await agent.chat('Create a campaign for LangGraph and MCP automation');

    assert.equal(result.report.recommendedActions.at(0)?.customerId, customer.id);
    assert.match(result.report.markdown, /Trend Signals/);
    assert.match(result.answer, /1 customer actions/);
  });
});
