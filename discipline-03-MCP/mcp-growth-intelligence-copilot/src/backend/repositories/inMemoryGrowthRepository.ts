import { randomUUID } from 'node:crypto';
import type {
  CampaignReport,
  Customer,
  CustomerInput,
  Outreach,
} from '../domain/types.ts';
import type { GrowthRepository } from './growthRepository.ts';

const now = () => new Date().toISOString();

export class InMemoryGrowthRepository implements GrowthRepository {
  #customers = new Map<string, Customer>();
  #outreach = new Map<string, Outreach>();
  #reports = new Map<string, CampaignReport>();

  constructor(seed = true) {
    if (seed) {
      this.createCustomerSync({
        name: 'Ada Lovelace',
        phone: '+1 555-0101',
        email: 'ada@example.com',
        segment: 'AI Education',
        interests: ['LangGraph', 'MCP', 'automation'],
      });
      this.createCustomerSync({
        name: 'Grace Hopper',
        phone: '+1 555-0102',
        email: 'grace@example.com',
        segment: 'Developer Tools',
        interests: ['testing', 'security', 'developer experience'],
      });
    }
  }

  async listCustomers() {
    return [...this.#customers.values()].sort((a, b) => a.name.localeCompare(b.name));
  }

  async findCustomerById(id: string) {
    return this.#customers.get(id) ?? null;
  }

  async findCustomers(query: string) {
    const normalized = query.toLowerCase();
    const customers = await this.listCustomers();
    return customers.filter((customer) =>
      [customer.name, customer.email, customer.phone, customer.segment, ...customer.interests]
        .filter(Boolean)
        .some((field) => field!.toLowerCase().includes(normalized)),
    );
  }

  async createCustomer(input: CustomerInput) {
    return this.createCustomerSync(input);
  }

  async updateCustomer(id: string, input: Partial<CustomerInput>) {
    const current = this.#customers.get(id);
    if (!current) return null;

    const updated: Customer = {
      ...current,
      ...input,
      interests: input.interests ?? current.interests,
      updatedAt: now(),
    };
    this.#customers.set(id, updated);
    return updated;
  }

  async deleteCustomer(id: string) {
    return this.#customers.delete(id);
  }

  async recordOutreach(input: Omit<Outreach, 'id' | 'createdAt'>) {
    const outreach: Outreach = { ...input, id: randomUUID(), createdAt: now() };
    this.#outreach.set(outreach.id, outreach);
    const customer = this.#customers.get(input.customerId);
    if (customer) {
      this.#customers.set(customer.id, { ...customer, lastContactAt: outreach.createdAt, updatedAt: now() });
    }
    return outreach;
  }

  async listOutreach(customerId?: string) {
    return [...this.#outreach.values()]
      .filter((item) => !customerId || item.customerId === customerId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  async saveReport(report: CampaignReport) {
    this.#reports.set(report.id, report);
    return report;
  }

  async listReports() {
    return [...this.#reports.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  async reset() {
    this.#customers.clear();
    this.#outreach.clear();
    this.#reports.clear();
  }

  private createCustomerSync(input: CustomerInput) {
    const timestamp = now();
    const customer: Customer = {
      id: randomUUID(),
      name: input.name,
      phone: input.phone,
      email: input.email,
      segment: input.segment,
      interests: input.interests ?? [],
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    this.#customers.set(customer.id, customer);
    return customer;
  }
}
