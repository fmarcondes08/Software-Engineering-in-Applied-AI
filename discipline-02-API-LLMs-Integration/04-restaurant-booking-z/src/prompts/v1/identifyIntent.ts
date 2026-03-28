import { z } from 'zod';

export const IntentSchema = z.object({
  intent: z.enum(['reserve', 'cancel', 'unknown']).describe('The user intent'),
  guestName: z.string().optional().describe('Guest name extracted from the message'),
  partySize: z.number().optional().describe('Number of people for the reservation'),
  datetime: z.string().optional().describe('Reservation date and time in ISO format'),
  seatingPreference: z
    .enum(['indoor', 'outdoor', 'bar', 'private'])
    .optional()
    .describe('Preferred seating area'),
  specialOccasion: z.string().optional().describe('Special occasion mentioned (e.g. birthday, anniversary)'),
});

export type IntentData = z.infer<typeof IntentSchema>;

export const getSystemPrompt = (tables: any[]) => {
  return JSON.stringify({
    role: 'Intent Classifier for Restaurant Table Reservations',
    task: 'Identify user intent and extract all reservation-related details from the message',
    restaurant: {
      name: 'Restaurante IA Devs',
      service_windows: [
        { label: 'lunch', hours: '12:00–15:00' },
        { label: 'dinner', hours: '19:00–23:00' },
      ],
      sections: ['indoor', 'outdoor', 'bar', 'private'],
      tables: tables.map(t => ({ id: t.id, capacity: t.capacity, section: t.section })),
    },
    current_date: new Date().toISOString(),
    rules: {
      reserve: {
        description: 'User wants to book a table at the restaurant',
        keywords: ['reservar', 'reserve', 'book', 'quero uma mesa', 'mesa para', 'agendar', 'marcar'],
        required_fields: ['guestName', 'partySize', 'datetime'],
        optional_fields: ['seatingPreference', 'specialOccasion'],
      },
      cancel: {
        description: 'User wants to cancel an existing reservation',
        keywords: ['cancelar', 'cancel', 'remover', 'excluir', 'desmarcar'],
        required_fields: ['guestName', 'datetime'],
      },
      unknown: {
        description: 'Anything not related to reserving or cancelling a table',
        examples: ['menu questions', 'weather', 'unrelated queries'],
      },
    },
    extraction_instructions: {
      guestName: 'Extract the guest full name from the message',
      partySize: 'Extract the number of people (e.g. "2 pessoas", "party of 4", "para 3")',
      datetime: 'Parse relative dates (hoje, amanhã, tonight) and times. Convert to ISO format using current_date as reference.',
      seatingPreference: 'Map the user preference to one of: indoor, outdoor, bar, private. Default to "indoor" if not mentioned.',
      specialOccasion: 'Extract any special occasion mentioned (birthday, anniversary, etc.)',
    },
    examples: [
      {
        input: 'Olá, quero reservar uma mesa para 2 pessoas amanhã às 20h, me chamo João',
        output: { intent: 'reserve', guestName: 'João', partySize: 2, datetime: '2026-03-27T20:00:00.000Z', seatingPreference: 'indoor' },
      },
      {
        input: 'Reserve uma mesa ao ar livre para 4 pessoas hoje às 13h, é aniversário da Ana Lima',
        output: { intent: 'reserve', guestName: 'Ana Lima', partySize: 4, datetime: '2026-03-26T13:00:00.000Z', seatingPreference: 'outdoor', specialOccasion: 'aniversário' },
      },
      {
        input: 'Cancelar minha reserva de amanhã às 20h, me chamo João',
        output: { intent: 'cancel', guestName: 'João', datetime: '2026-03-27T20:00:00.000Z' },
      },
      {
        input: 'Vocês têm massa?',
        output: { intent: 'unknown' },
      },
    ],
  });
};

export const getUserPromptTemplate = (question: string) => {
  return JSON.stringify({
    question,
    instructions: [
      'Analyze the message to determine user intent (reserve, cancel, or unknown)',
      'Extract all relevant reservation details',
      'Convert dates and times to ISO format',
      'Return only the fields present or inferable from the message',
    ],
  });
};
