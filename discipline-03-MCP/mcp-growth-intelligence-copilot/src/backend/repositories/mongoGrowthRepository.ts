import { randomUUID } from 'node:crypto';
import { MongoClient, type Db } from 'mongodb';
import type {
  CampaignReport,
  Customer,
  CustomerInput,
  Outreach,
} from '../domain/types.ts';
import type { GrowthRepository } from './growthRepository.ts';

const now = () => new Date().toISOString();

export class MongoGrowthRepository implements GrowthRepository {
  #client: MongoClient;
  #db: Db;

  constructor(uri: string, dbName: string) {
    this.#client = new MongoClient(uri);
    this.#db = this.#client.db(dbName);
  }

  async connect() {
    await this.#client.connect();
    await this.#db.collection<Customer>('customers').createIndex({ name: 1 });
    await this.#db.collection<Outreach>('outreach').createIndex({ customerId: 1, createdAt: -1 });
    await this.#db.collection<CampaignReport>('reports').createIndex({ createdAt: -1 });
    return this;
  }

  async close() {
    await this.#client.close();
  }

  async listCustomers() {
    return this.#db.collection<Customer>('customers').find({}).sort({ name: 1 }).toArray();
  }

  async findCustomerById(id: string) {
    return this.#db.collection<Customer>('customers').findOne({ id });
  }

  async findCustomers(query: string) {
    const matcher = new RegExp(query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    return this.#db.collection<Customer>('customers').find({
      $or: [
        { name: matcher },
        { phone: matcher },
        { email: matcher },
        { segment: matcher },
        { interests: matcher },
      ],
    }).sort({ name: 1 }).toArray();
  }

  async createCustomer(input: CustomerInput) {
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
    await this.#db.collection<Customer>('customers').insertOne(customer);
    return customer;
  }

  async updateCustomer(id: string, input: Partial<CustomerInput>) {
    const update = { ...input, updatedAt: now() };
    await this.#db.collection<Customer>('customers').updateOne({ id }, { $set: update });
    return this.findCustomerById(id);
  }

  async deleteCustomer(id: string) {
    const result = await this.#db.collection<Customer>('customers').deleteOne({ id });
    return result.deletedCount > 0;
  }

  async recordOutreach(input: Omit<Outreach, 'id' | 'createdAt'>) {
    const outreach: Outreach = { ...input, id: randomUUID(), createdAt: now() };
    await this.#db.collection<Outreach>('outreach').insertOne(outreach);
    await this.#db.collection<Customer>('customers').updateOne(
      { id: input.customerId },
      { $set: { lastContactAt: outreach.createdAt, updatedAt: now() } },
    );
    return outreach;
  }

  async listOutreach(customerId?: string) {
    return this.#db.collection<Outreach>('outreach')
      .find(customerId ? { customerId } : {})
      .sort({ createdAt: -1 })
      .toArray();
  }

  async saveReport(report: CampaignReport) {
    await this.#db.collection<CampaignReport>('reports').insertOne(report);
    return report;
  }

  async listReports() {
    return this.#db.collection<CampaignReport>('reports').find({}).sort({ createdAt: -1 }).toArray();
  }
}
