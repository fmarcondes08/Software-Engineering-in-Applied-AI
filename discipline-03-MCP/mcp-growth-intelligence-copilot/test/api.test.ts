import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../src/backend/http/createApp.ts';
import { InMemoryGrowthRepository } from '../src/backend/repositories/inMemoryGrowthRepository.ts';

describe('Growth CRM API', () => {
  let repository: InMemoryGrowthRepository;
  let app: ReturnType<typeof createApp>;
  let adminToken: string;
  let memberToken: string;

  beforeEach(async () => {
    repository = new InMemoryGrowthRepository(false);
    app = createApp(repository);
    await app.ready();

    const [adminLogin, memberLogin] = await Promise.all([
      app.inject({ method: 'POST', url: '/v1/auth/login', payload: { username: 'admin', password: '123123' } }),
      app.inject({ method: 'POST', url: '/v1/auth/login', payload: { username: 'johndoe', password: '1234' } }),
    ]);
    adminToken = adminLogin.json().token;
    memberToken = memberLogin.json().token;
  });

  afterEach(async () => {
    await app.close();
  });

  it('protects customer routes and allows public health checks', async () => {
    const health = await app.inject({ method: 'GET', url: '/v1/health' });
    assert.equal(health.statusCode, 200);

    const customers = await app.inject({ method: 'GET', url: '/v1/customers' });
    assert.equal(customers.statusCode, 401);
  });

  it('allows Postman-style login requests with a trailing slash', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/v1/auth/login/',
      headers: { 'content-type': 'application/json' },
      payload: { username: 'admin', password: '123123' },
    });

    assert.equal(response.statusCode, 200);
    assert.equal(response.json().username, 'admin');
    assert.equal(response.json().role, 'admin');
    assert.ok(response.json().token);
  });

  it('allows Postman-style login requests with query params', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/v1/auth/login?username=admin&password=123123',
    });

    assert.equal(response.statusCode, 200);
    assert.equal(response.json().username, 'admin');
    assert.equal(response.json().role, 'admin');
    assert.ok(response.json().token);
  });

  it('does not throw when login credentials are missing', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/v1/auth/login',
    });

    assert.equal(response.statusCode, 401);
    assert.equal(response.json().message, 'Invalid credentials');
  });

  it('allows admins to create customers and members to read them', async () => {
    const created = await app.inject({
      method: 'POST',
      url: '/v1/customers',
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { name: 'Katherine Johnson', phone: '+1 555-3030', segment: 'Education', interests: ['AI'] },
    });
    assert.equal(created.statusCode, 201);

    const listed = await app.inject({
      method: 'GET',
      url: '/v1/customers',
      headers: { authorization: `Bearer ${memberToken}` },
    });
    assert.equal(listed.statusCode, 200);
    assert.equal(listed.json().at(0).name, 'Katherine Johnson');
  });

  it('blocks member mutations with RBAC', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/v1/customers',
      headers: { authorization: `Bearer ${memberToken}` },
      payload: { name: 'Forbidden User', phone: '+1 555-0000' },
    });

    assert.equal(response.statusCode, 403);
    assert.equal(response.json().message, 'Forbidden: insufficient permissions');
  });

  it('imports customers from CSV and reports skipped invalid rows', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/v1/import/customers',
      headers: { authorization: `Bearer ${adminToken}` },
      payload: {
        csvText: 'name,phone,email,segment,interests\nAda,+1 555,ada@example.com,AI,"mcp; agents"\nNo Phone,,,',
      },
    });

    assert.equal(response.statusCode, 200);
    assert.equal(response.json().inserted, 1);
    assert.equal(response.json().skipped, 1);
  });

  it('generates and persists a campaign report through the agent endpoint', async () => {
    await repository.createCustomer({
      name: 'Mina Developer',
      phone: '+1 555-9090',
      segment: 'Developer Tools',
      interests: ['MCP', 'testing'],
    });

    const response = await app.inject({
      method: 'POST',
      url: '/v1/agent/chat',
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { message: 'Who should I contact about MCP automation?' },
    });

    assert.equal(response.statusCode, 200);
    assert.match(response.json().answer, /customer actions/i);
    assert.equal(response.json().report.recommendedActions.length, 1);
    assert.equal((await repository.listReports()).length, 1);
  });
});
