import OpenAI, { toFile } from 'openai';

export class WhisperService {
    private client: OpenAI;

    constructor(apiKey: string) {
        this.client = new OpenAI({ apiKey });
    }

    async transcribe(buffer: Buffer, filename: string, mimeType = 'audio/webm'): Promise<string> {
        const file = await toFile(buffer, filename, { type: mimeType });

        const response = await this.client.audio.transcriptions.create({
            file,
            model: 'whisper-1',
            language: 'pt',
        });

        return response.text;
    }
}
