import { config } from '../config.ts';
import { ReservationService } from '../services/reservationService.ts';
import { OpenRouterService } from '../services/openRouterService.ts';
import { buildReservationGraph } from './graph.ts';

export function buildGraph() {
  const llmClient = new OpenRouterService(config);
  const reservationService = new ReservationService();
  return buildReservationGraph(llmClient, reservationService);
}

export const graph = async () => {
  return buildGraph();
};
