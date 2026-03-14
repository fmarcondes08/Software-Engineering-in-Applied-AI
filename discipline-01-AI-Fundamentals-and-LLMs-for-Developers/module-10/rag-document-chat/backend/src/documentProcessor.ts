import { PDFLoader } from "@langchain/community/document_loaders/fs/pdf";
import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";
import { Document } from "@langchain/core/documents";
import { readFile } from "node:fs/promises";
import type { TextSplitterConfig } from "./config.ts";

export class DocumentProcessor {
    private filePath: string;
    private mimeType: string;
    private textSplitterConfig: TextSplitterConfig;

    constructor(filePath: string, mimeType: string, textSplitterConfig: TextSplitterConfig) {
        this.filePath = filePath;
        this.mimeType = mimeType;
        this.textSplitterConfig = textSplitterConfig;
    }

    async loadAndSplit(): Promise<Document[]> {
        const rawDocuments = await this.loadByType();
        console.log(`📄 Loaded ${rawDocuments.length} raw document(s) from ${this.mimeType}`);

        const splitter = new RecursiveCharacterTextSplitter(this.textSplitterConfig);
        const chunks = await splitter.splitDocuments(rawDocuments);
        console.log(`✂️  Split into ${chunks.length} chunks`);

        return chunks.map((doc) => ({
            ...doc,
            metadata: { source: this.filePath },
        }));
    }

    private async loadByType(): Promise<Document[]> {
        if (this.mimeType === "application/pdf") {
            const loader = new PDFLoader(this.filePath);
            return loader.load();
        }

        if (
            this.mimeType ===
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        ) {
            const mammoth = await import("mammoth");
            const result = await mammoth.default.extractRawText({ path: this.filePath });
            return [
                new Document({
                    pageContent: result.value,
                    metadata: { source: this.filePath },
                }),
            ];
        }

        if (
            this.mimeType ===
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        ) {
            const XLSX = await import("xlsx");
            const workbook = XLSX.default.readFile(this.filePath);
            const text = workbook.SheetNames.map((name: string) => {
                const sheet = workbook.Sheets[name]!;
                return `Sheet: ${name}\n${XLSX.default.utils.sheet_to_csv(sheet)}`;
            }).join("\n\n");
            return [
                new Document({
                    pageContent: text,
                    metadata: { source: this.filePath },
                }),
            ];
        }

        if (this.mimeType.startsWith("image/")) {
            const { createWorker } = await import("tesseract.js");
            const worker = await createWorker("por+eng");
            const buffer = await readFile(this.filePath);
            const {
                data: { text },
            } = await worker.recognize(buffer);
            await worker.terminate();
            return [
                new Document({
                    pageContent: text,
                    metadata: { source: this.filePath },
                }),
            ];
        }

        throw new Error(`Unsupported file type: ${this.mimeType}`);
    }
}
