import type { CustomerInput } from '../backend/domain/types.ts';

export class GrowthHttpClient {
  private readonly baseUrl: string;
  private readonly serviceToken: string;

  constructor(
    baseUrl = process.env.GROWTH_API_BASE_URL ?? 'http://localhost:9999/v1',
    serviceToken = process.env.SERVICE_TOKEN ?? '',
  ) {
    this.baseUrl = baseUrl;
    this.serviceToken = serviceToken;
  }

  private get headers() {
    return {
      Authorization: `Bearer ${this.serviceToken}`,
      'Content-Type': 'application/json',
    };
  }

  async listCustomers() {
    return this.request('/customers');
  }

  async findCustomer(query: string) {
    return this.request(`/customers?q=${encodeURIComponent(query)}`);
  }

  async createCustomer(customer: CustomerInput) {
    return this.request('/customers', { method: 'POST', body: JSON.stringify(customer) });
  }

  async updateCustomer(id: string, customer: Partial<CustomerInput>) {
    return this.request(`/customers/${id}`, { method: 'PUT', body: JSON.stringify(customer) });
  }

  async recordOutreach(input: { customerId: string; channel: string; note: string }) {
    return this.request('/outreach', { method: 'POST', body: JSON.stringify(input) });
  }

  async recommendNextAction(message: string) {
    return this.request('/agent/chat', { method: 'POST', body: JSON.stringify({ message }) });
  }

  private async request(path: string, init: RequestInit = {}) {
    if (!this.serviceToken) throw new Error('SERVICE_TOKEN environment variable is required');
    const response = await fetch(`${this.baseUrl}${path}`, { ...init, headers: this.headers });
    if (!response.ok) throw new Error(`HTTP ${response.status}: ${await response.text()}`);
    return response.json();
  }
}
