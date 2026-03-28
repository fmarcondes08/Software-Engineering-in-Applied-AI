export type ModelConfig = {
  apiKey: string;
  openAiApiKey: string;
  httpReferer: string;
  xTitle: string;

  provider: {
    sort: {
      by: string;
      partition: string;
    };
  };

  models: string[];
  temperature: number;
};

console.assert(process.env.OPENROUTER_API_KEY, 'OPENROUTER_API_KEY is not set in environment variables');
console.assert(process.env.OPENAI_API_KEY, 'OPENAI_API_KEY is not set in environment variables (required for Whisper voice transcription)');

export const config: ModelConfig = {
  apiKey: process.env.OPENROUTER_API_KEY!,
  openAiApiKey: process.env.OPENAI_API_KEY!,
  httpReferer: '',
  xTitle: 'IA Devs - Restaurant Booking Chatbot',
  models: [
    // https://openrouter.ai/models?fmt=cards&max_price=0&supported_parameters=response_format
    'arcee-ai/trinity-large-preview:free',
  ],
  provider: {
    sort: {
      by: 'throughput', // Route to model with highest throughput (fastest response)
      partition: 'none',
    },
  },
  temperature: 0.7,
};
