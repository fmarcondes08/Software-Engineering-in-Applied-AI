import { Router } from "express";
import { HuggingFaceTransformersEmbeddings } from "@langchain/community/embeddings/huggingface_transformers";
import { Neo4jVectorStore } from "@langchain/community/vectorstores/neo4j_vector";
import type { PretrainedOptions } from "@huggingface/transformers";
import { CONFIG } from "../config.ts";
import { getState, setState } from "../state.ts";
import { DocumentProcessor } from "../documentProcessor.ts";

export const trainRouter = Router();

trainRouter.post("/", async (_req, res) => {
    const state = getState();

    if (!state.uploadedFilePath || !state.uploadedFileType) {
        res.status(400).json({ error: "No file uploaded. Please upload a file first." });
        return;
    }

    if (state.status === "training") {
        res.status(409).json({ error: "Training already in progress." });
        return;
    }

    // Close previous vector store before re-training
    if (state.vectorStore) {
        await state.vectorStore.close().catch(() => {});
        setState({ vectorStore: null });
    }

    setState({ status: "training", errorMessage: null });

    try {
        const processor = new DocumentProcessor(
            state.uploadedFilePath,
            state.uploadedFileType,
            CONFIG.textSplitter
        );
        const documents = await processor.loadAndSplit();

        console.log("🔧 Initializing embeddings model...");
        const embeddings = new HuggingFaceTransformersEmbeddings({
            model: CONFIG.embedding.modelName,
            pretrainedOptions: CONFIG.embedding.pretrainedOptions as PretrainedOptions,
        });

        console.log("📡 Connecting to Neo4j Vector Store...");
        const vectorStore = await Neo4jVectorStore.fromExistingGraph(embeddings, CONFIG.neo4j);

        console.log("🗑️  Removing previous chunks...");
        await vectorStore.query(
            `MATCH (n:\`${CONFIG.neo4j.nodeLabel}\`) DETACH DELETE n`
        );

        console.log(`✅ Adding ${documents.length} chunks to Neo4j...`);
        for (const [index, doc] of documents.entries()) {
            console.log(`  → Chunk ${index + 1}/${documents.length}`);
            await vectorStore.addDocuments([doc]);
        }

        console.log("✅ Training complete!");
        setState({ status: "ready", vectorStore, trainedAt: new Date() });

        res.json({ success: true, chunks: documents.length });
    } catch (err) {
        console.error("❌ Training error:", err);
        setState({ status: "error", errorMessage: String(err) });
        res.status(500).json({ error: String(err) });
    }
});
