import { StateGraph, START, END } from '@langchain/langgraph';
import type { SqliteSaver } from '@langchain/langgraph-checkpoint-sqlite';

import { HealthMindStateAnnotation, type GraphState } from './state.ts';
import { createSafeguardNode } from './nodes/safeguardNode.ts';
import { createIntentNode } from './nodes/intentNode.ts';
import { createAppointmentNode } from './nodes/appointmentNode.ts';
import { createSymptomCheckerNode } from './nodes/symptomCheckerNode.ts';
import { createCypherExecutorNode } from './nodes/cypherExecutorNode.ts';
import { createCypherCorrectionNode } from './nodes/cypherCorrectionNode.ts';
import { createDocumentIngestNode } from './nodes/documentIngestNode.ts';
import { createHistoryRagNode } from './nodes/historyRagNode.ts';
import { createEmergencyNode } from './nodes/emergencyNode.ts';
import { createResponseNode } from './nodes/responseNode.ts';
import { blockedNode } from './nodes/blockedNode.ts';
import { LLMService } from '../services/llmService.ts';
import { Neo4jService } from '../services/neo4jService.ts';

function routeAfterSafeguard(state: GraphState): string {
  if (!state.guardrailCheck?.safe) return 'blocked';
  return 'intent_classifier';
}

function routeByIntent(state: GraphState): string {
  switch (state.intent) {
    case 'schedule_appointment':
    case 'cancel_appointment':
      return 'appointment';
    case 'symptom_query':
      return 'symptom_checker';
    case 'document_upload':
      return 'document_ingest';
    case 'history_query':
      return 'history_rag';
    case 'emergency':
      return 'emergency';
    default:
      return 'response';
  }
}

function routeAfterCypherExecutor(state: GraphState): string {
  if (
    state.needsCorrection &&
    (state.correctionAttempts ?? 0) < 1
  ) {
    return 'cypher_correction';
  }
  return 'response';
}

export function buildHealthMindGraph(
  llm: LLMService,
  neo4j: Neo4jService,
  checkpointer: SqliteSaver,
) {
  const workflow = new StateGraph({ stateSchema: HealthMindStateAnnotation })

    // Security layer
    .addNode('safeguard', createSafeguardNode(llm))
    .addNode('blocked', blockedNode)

    // Intent routing
    .addNode('intent_classifier', createIntentNode(llm))

    // Intent-specific nodes
    .addNode('appointment', createAppointmentNode(llm))
    .addNode('symptom_checker', createSymptomCheckerNode(llm, neo4j))
    .addNode('cypher_executor', createCypherExecutorNode(neo4j))
    .addNode('cypher_correction', createCypherCorrectionNode(llm, neo4j))
    .addNode('document_ingest', createDocumentIngestNode(llm))
    .addNode('history_rag', createHistoryRagNode())
    .addNode('emergency', createEmergencyNode())

    // Final response synthesizer
    .addNode('response', createResponseNode(llm))

    // Entry point
    .addEdge(START, 'safeguard')

    // After safeguard: block or classify intent
    .addConditionalEdges('safeguard', routeAfterSafeguard, {
      blocked: 'blocked',
      intent_classifier: 'intent_classifier',
    })

    // After intent: route to specialized node
    .addConditionalEdges('intent_classifier', routeByIntent, {
      appointment: 'appointment',
      symptom_checker: 'symptom_checker',
      document_ingest: 'document_ingest',
      history_rag: 'history_rag',
      emergency: 'emergency',
      response: 'response',
    })

    // Appointment and document ingest → response (answer already set)
    .addEdge('appointment', 'response')
    .addEdge('document_ingest', 'response')
    .addEdge('history_rag', 'response')

    // Emergency → END (no further processing)
    .addEdge('emergency', 'response')

    // Symptom checker → cypher executor → optional correction → response
    .addEdge('symptom_checker', 'cypher_executor')
    .addConditionalEdges('cypher_executor', routeAfterCypherExecutor, {
      cypher_correction: 'cypher_correction',
      response: 'response',
    })
    .addEdge('cypher_correction', 'cypher_executor')

    // Terminal edges
    .addEdge('blocked', END)
    .addEdge('response', END);

  return workflow.compile({ checkpointer });
}
