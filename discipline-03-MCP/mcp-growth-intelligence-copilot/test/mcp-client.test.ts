import { describe, it, mock, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { GrowthHttpClient } from '../src/mcp/growthHttpClient.ts';

describe('GrowthHttpClient', () => {
  afterEach(() => mock.restoreAll());

  it('calls the Growth API with the service token', async () => {
    const fetchMock = mock.method(globalThis, 'fetch', async (url, init) => {
      assert.equal(url, 'http://localhost:9999/v1/customers');
      assert.equal((init?.headers as Record<string, string>).Authorization, 'Bearer service-token');
      return Response.json([{ id: '1', name: 'Ada' }]);
    });

    const client = new GrowthHttpClient('http://localhost:9999/v1', 'service-token');
    const customers = await client.listCustomers();

    assert.equal(fetchMock.mock.callCount(), 1);
    assert.equal(customers.at(0).name, 'Ada');
  });

  it('surfaces non-2xx API responses as errors', async () => {
    mock.method(globalThis, 'fetch', async () => new Response('nope', { status: 403 }));

    const client = new GrowthHttpClient('http://localhost:9999/v1', 'service-token');
    await assert.rejects(client.listCustomers(), /HTTP 403/);
  });
});
