export type Role = 'admin' | 'member';

export type Customer = {
  id: string;
  name: string;
  phone: string;
  email?: string;
  segment?: string;
  interests: string[];
  lastContactAt?: string;
  createdAt: string;
  updatedAt: string;
};

export type CustomerInput = {
  name: string;
  phone: string;
  email?: string;
  segment?: string;
  interests?: string[];
};

export type Outreach = {
  id: string;
  customerId: string;
  channel: 'email' | 'phone' | 'whatsapp' | 'linkedin' | 'other';
  note: string;
  createdAt: string;
};

export type CampaignReport = {
  id: string;
  title: string;
  question: string;
  summary: string;
  markdown: string;
  trendSignals: TrendSignal[];
  recommendedActions: RecommendedAction[];
  createdAt: string;
};

export type TrendSignal = {
  keyword: string;
  score: number;
  direction: 'rising' | 'stable' | 'declining';
  source: string;
};

export type RecommendedAction = {
  customerId?: string;
  title: string;
  rationale: string;
  priority: 'high' | 'medium' | 'low';
};

export type UserSession = {
  username: string;
  role: Role;
};

export type ImportResult = {
  inserted: number;
  skipped: number;
  customers: Customer[];
  errors: string[];
};

export type ChatResult = {
  answer: string;
  report: CampaignReport;
};
