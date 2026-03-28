import {
  StateGraph,
  START,
  END,
  MessagesZodMeta,
} from "@langchain/langgraph";
import { withLangGraph } from "@langchain/langgraph/zod";
import type { BaseMessage } from '@langchain/core/messages';

import { createIdentifyIntentNode } from './nodes/identifyIntentNode.ts';
import { createReservationNode } from './nodes/reservationNode.ts';
import { createCancellationNode } from './nodes/cancellationNode.ts';
import { createMessageGeneratorNode } from './nodes/messageGeneratorNode.ts';

import { z } from "zod/v3";
import { OpenRouterService } from "../services/openRouterService.ts";
import { ReservationService } from "../services/reservationService.ts";

const ReservationStateAnnotation = z.object({
  messages: withLangGraph(
    z.custom<BaseMessage[]>(),
    MessagesZodMeta),

  // Intent
  intent: z.enum(['reserve', 'cancel', 'unknown']).optional(),

  // Extracted details
  guestName: z.string().optional(),
  partySize: z.number().optional(),
  datetime: z.string().optional(),
  seatingPreference: z.enum(['indoor', 'outdoor', 'bar', 'private']).optional(),
  specialOccasion: z.string().optional(),

  // Action outcome
  actionSuccess: z.boolean().optional(),
  actionError: z.string().optional(),
  reservationData: z.any().optional(),

  error: z.string().optional(),
});

export type GraphState = z.infer<typeof ReservationStateAnnotation>;

export function buildReservationGraph(
  llmClient: OpenRouterService,
  reservationService: ReservationService,
) {
  const workflow = new StateGraph({
    stateSchema: ReservationStateAnnotation,
  })
    .addNode('identifyIntent', createIdentifyIntentNode(llmClient))
    .addNode('reserve', createReservationNode(reservationService))
    .addNode('cancel', createCancellationNode(reservationService))
    .addNode('message', createMessageGeneratorNode(llmClient))

    // Flow
    .addEdge(START, 'identifyIntent')

    // Route based on intent
    .addConditionalEdges(
      'identifyIntent',
      (state: GraphState): string => {
        if (state.error || !state.intent || state.intent === 'unknown') {
          return 'message';
        }

        console.log(`➡️  Routing based on intent: ${state.intent}`);
        return state.intent;
      },
      {
        reserve: 'reserve',
        cancel: 'cancel',
        message: 'message',
      }
    )

    .addEdge('reserve', 'message')
    .addEdge('cancel', 'message')
    .addEdge('message', END);

  return workflow.compile();
}
