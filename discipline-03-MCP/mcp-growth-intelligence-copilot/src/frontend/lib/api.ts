import type {
  CampaignReport,
  ChatResult,
  Customer,
  ImportResult,
  Outreach,
  Role,
} from '../../backend/domain/types.ts';

export type Session = {
  token: string;
  role: Role;
  username: string;
};

export class ApiClient {
  private readonly getToken: () => string | undefined;

  constructor(getToken: () => string | undefined) {
    this.getToken = getToken;
  }

  async login(username: string, password: string): Promise<Session> {
    return this.request('/v1/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
      publicRequest: true,
    });
  }

  async listCustomers(query = ''): Promise<Customer[]> {
    const suffix = query ? `?q=${encodeURIComponent(query)}` : '';
    return this.request(`/v1/customers${suffix}`);
  }

  async createCustomer(input: Partial<Customer>): Promise<Customer> {
    return this.request('/v1/customers', { method: 'POST', body: JSON.stringify(input) });
  }

  async deleteCustomer(id: string): Promise<{ deleted: boolean }> {
    return this.request(`/v1/customers/${id}`, { method: 'DELETE' });
  }

  async listOutreach(customerId?: string): Promise<Outreach[]> {
    const suffix = customerId ? `?customerId=${encodeURIComponent(customerId)}` : '';
    return this.request(`/v1/outreach${suffix}`);
  }

  async importCustomers(csvText: string): Promise<ImportResult> {
    return this.request('/v1/import/customers', { method: 'POST', body: JSON.stringify({ csvText }) });
  }

  async chat(message: string): Promise<ChatResult> {
    return this.request('/v1/agent/chat', { method: 'POST', body: JSON.stringify({ message }) });
  }

  async listReports(): Promise<CampaignReport[]> {
    return this.request('/v1/reports');
  }

  private async request<T>(path: string, init: RequestInit & { publicRequest?: boolean } = {}): Promise<T> {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    const token = this.getToken();
    if (!init.publicRequest && token) headers.Authorization = `Bearer ${token}`;

    const response = await fetch(path, { ...init, headers });
    if (!response.ok) {
      const body = await response.json().catch(() => ({ message: response.statusText }));
      throw new Error(body.message ?? `HTTP ${response.status}`);
    }
    return response.json();
  }
}
