import type {
  CampaignReport,
  Customer,
  CustomerInput,
  Outreach,
} from '../domain/types.ts';

export interface GrowthRepository {
  listCustomers(): Promise<Customer[]>;
  findCustomerById(id: string): Promise<Customer | null>;
  findCustomers(query: string): Promise<Customer[]>;
  createCustomer(input: CustomerInput): Promise<Customer>;
  updateCustomer(id: string, input: Partial<CustomerInput>): Promise<Customer | null>;
  deleteCustomer(id: string): Promise<boolean>;
  recordOutreach(input: Omit<Outreach, 'id' | 'createdAt'>): Promise<Outreach>;
  listOutreach(customerId?: string): Promise<Outreach[]>;
  saveReport(report: CampaignReport): Promise<CampaignReport>;
  listReports(): Promise<CampaignReport[]>;
  reset?(): Promise<void>;
}
