import { randomUUID } from 'node:crypto';
import { Annotation, END, START, StateGraph } from '@langchain/langgraph';
import { config } from '../config.ts';
import type {
  CampaignReport,
  ChatResult,
  RecommendedAction,
  TrendSignal,
} from '../domain/types.ts';
import type { GrowthRepository } from '../repositories/growthRepository.ts';
import { writeMarkdownReport } from '../services/reportWriter.ts';
import type { TrendsService } from '../services/trendsService.ts';

const GrowthState = Annotation.Root({
  question: Annotation<string>,
  customerQuery: Annotation<string>,
  keywords: Annotation<string[]>({
    reducer: (_, value) => value,
    default: () => [],
  }),
  trendSignals: Annotation<TrendSignal[]>({
    reducer: (_, value) => value,
    default: () => [],
  }),
  recommendedActions: Annotation<RecommendedAction[]>({
    reducer: (_, value) => value,
    default: () => [],
  }),
  report: Annotation<CampaignReport | undefined>,
});

type GrowthGraphState = typeof GrowthState.State;

function extractKeywords(question: string) {
  const stopwords = new Set(['which', 'what', 'with', 'should', 'this', 'week', 'customer', 'customers', 'contact']);
  return question
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((word) => word.length > 3 && !stopwords.has(word))
    .slice(0, 5);
}

function priorityFromTrend(signal?: TrendSignal) {
  if (!signal) return 'medium' as const;
  if (signal.direction === 'rising' && signal.score >= 70) return 'high' as const;
  if (signal.direction === 'declining') return 'low' as const;
  return 'medium' as const;
}

export class GrowthAgent {
  private readonly repository: GrowthRepository;
  private readonly trendsService: TrendsService;

  constructor(repository: GrowthRepository, trendsService: TrendsService) {
    this.repository = repository;
    this.trendsService = trendsService;
  }

  async chat(question: string): Promise<ChatResult> {
    const workflow = new StateGraph(GrowthState)
      .addNode('identifySignals', async (state: GrowthGraphState) => ({
        keywords: extractKeywords(state.question),
        customerQuery: state.question,
      }))
      .addNode('researchTrends', async (state: GrowthGraphState) => ({
        trendSignals: await this.trendsService.getTrendSignals(state.keywords.length ? state.keywords : ['mcp', 'ai automation']),
      }))
      .addNode('recommendActions', async (state: GrowthGraphState) => ({
        recommendedActions: await this.recommendActions(state),
      }))
      .addNode('persistReport', async (state: GrowthGraphState) => ({
        report: await this.persistReport(state),
      }))
      .addEdge(START, 'identifySignals')
      .addEdge('identifySignals', 'researchTrends')
      .addEdge('researchTrends', 'recommendActions')
      .addEdge('recommendActions', 'persistReport')
      .addEdge('persistReport', END);

    const result = await workflow.compile().invoke({ question });
    const report = result.report!;
    return { answer: report.summary, report };
  }

  private async recommendActions(state: GrowthGraphState) {
    const customers = await this.repository.listCustomers();
    const signals = state.trendSignals;

    return customers.slice(0, 5).map((customer, index) => {
      const signal = signals[index % Math.max(signals.length, 1)];
      const topic = signal?.keyword ?? customer.interests[0] ?? 'AI automation';
      return {
        customerId: customer.id,
        title: `Contact ${customer.name} about ${topic}`,
        rationale: `${customer.segment ?? 'This customer'} matches the ${topic} signal and has interests in ${customer.interests.join(', ') || 'growth automation'}.`,
        priority: priorityFromTrend(signal),
      };
    });
  }

  private async persistReport(state: GrowthGraphState) {
    const title = 'Growth Campaign Recommendation';
    const trendRows = state.trendSignals
      .map((signal) => `- ${signal.keyword}: ${signal.direction}, score ${signal.score} (${signal.source})`)
      .join('\n');
    const actionRows = state.recommendedActions
      .map((action) => `- [${action.priority}] ${action.title}: ${action.rationale}`)
      .join('\n');
    const summary = state.recommendedActions.length
      ? `I found ${state.recommendedActions.length} customer actions grounded in ${state.trendSignals.length} trend signals.`
      : 'I did not find enough customer data yet. Import customers first, then ask for a campaign recommendation.';

    const markdown = `# ${title}

Question: ${state.question}

## Summary

${summary}

## Trend Signals

${trendRows || '- No trend signals available.'}

## Recommended Actions

${actionRows || '- Import customers to receive account-level recommendations.'}
`;

    const report: CampaignReport = {
      id: randomUUID(),
      title,
      question: state.question,
      summary,
      markdown,
      trendSignals: state.trendSignals,
      recommendedActions: state.recommendedActions,
      createdAt: new Date().toISOString(),
    };

    await this.repository.saveReport(report);
    await writeMarkdownReport(config.reportsDir, report);
    return report;
  }
}
