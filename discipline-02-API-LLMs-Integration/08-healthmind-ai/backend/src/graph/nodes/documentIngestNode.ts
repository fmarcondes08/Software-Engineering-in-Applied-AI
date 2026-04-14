import type { LLMService } from '../../services/llmService.ts';
import { storeDocument } from '../../services/documentService.ts';
import type { GraphState } from '../state.ts';

const SUMMARIZATION_PROMPT = `You are a medical document analyzer.
Given the extracted text from a medical document, produce a concise but comprehensive summary.
Include: patient info (if present), diagnoses, key test results with values, medications, dates, and any critical findings.
Keep the summary under 400 words and preserve all important numbers and units.`;

const VISION_EXTRACTION_PROMPT = `You are a medical document analyzer.
This is a scanned medical document (image-based PDF). Read everything you can see.
Extract and summarize: patient info, diagnoses, test results with values and reference ranges,
medications, dates, doctor names, and any critical findings.
Keep the summary under 400 words and preserve all important numbers and units.`;

export function createDocumentIngestNode(llm: LLMService) {
  return async (state: GraphState): Promise<Partial<GraphState>> => {
    const rawText = state.documentText ?? '';
    const filename = state.documentFilename ?? 'document.pdf';

    if (!rawText && !state.documentBase64) {
      return {
        immediateAnswer: 'No document received. Please attach a PDF file.',
        documentStored: false,
      };
    }

    console.log(`📄 Processing document: ${filename}`);

    let extractedText = '';
    let method = '';

    if (rawText.length > 50) {
      // ✅ Path 1: pdf-parse extracted usable text — summarise with LLM
      console.log(`📝 Summarising ${rawText.length} chars of pre-extracted text...`);
      extractedText = await llm.generate(SUMMARIZATION_PROMPT, rawText);
      method = 'text extraction';
    } else if (state.documentBase64) {
      // ✅ Path 2: Scanned / image-based PDF — try vision LLM
      console.log('🔍 pdf-parse returned no text. Trying vision-based extraction (Gemini)...');
      extractedText = await llm.analyzeDocument(VISION_EXTRACTION_PROMPT, state.documentBase64);
      method = 'vision (OCR)';

      if (!extractedText || extractedText.length < 30) {
        // Vision also failed — store a minimal placeholder so the user gets an honest reply
        console.warn('⚠️  Vision extraction also returned empty. Storing placeholder.');
        extractedText = `Medical document uploaded: ${filename}. ` +
          'The file appears to be a heavily encrypted or corrupted scanned image that could not be processed. ' +
          'Please try a clearer scan or a text-based PDF.';
        method = 'placeholder (unreadable)';
      }
    }

    await storeDocument(state.user.id, filename, extractedText);
    console.log(`✅ Document stored via ${method}`);

    // Build a short preview for the confirmation message
    const preview = extractedText.slice(0, 280).replace(/\n+/g, ' ').trim();
    const confirmationMessage =
      `✅ Document **"${filename}"** uploaded and analysed (${method}).\n\n` +
      `**Preview:**\n> ${preview}${extractedText.length > 280 ? '…' : ''}\n\n` +
      `You can now ask me questions about this document, such as:\n` +
      `• "Explain my exam results"\n` +
      `• "Are there any abnormal values in my report?"\n` +
      `• "What do my blood test results mean?"`;

    return {
      documentText: extractedText,
      documentStored: true,
      immediateAnswer: confirmationMessage,
    };
  };
}
