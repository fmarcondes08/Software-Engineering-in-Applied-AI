import { Router } from "express";
import { ChatOpenAI } from "@langchain/openai";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { getState } from "../state.ts";
import { AI } from "../ai.ts";
import { CONFIG } from "../config.ts";

const promptsDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "../prompts");
const promptConfig = JSON.parse(readFileSync(path.join(promptsDir, "answerPrompt.json"), "utf-8"));
const templateText = readFileSync(path.join(promptsDir, "template.txt"), "utf-8");

export const chatRouter = Router();

chatRouter.post("/", async (req, res) => {
    const { question } = req.body as { question?: string };

    if (!question?.trim()) {
        res.status(400).json({ error: "Question cannot be empty." });
        return;
    }

    const state = getState();

    if (state.status !== "ready" || !state.vectorStore) {
        res.status(400).json({
            error: "System not ready. Please upload and train the model first.",
        });
        return;
    }

    const nlpModel = new ChatOpenAI({
        temperature: CONFIG.openRouter.temperature,
        maxRetries: CONFIG.openRouter.maxRetries,
        modelName: CONFIG.openRouter.nlpModel,
        openAIApiKey: CONFIG.openRouter.apiKey,
        configuration: {
            baseURL: CONFIG.openRouter.url,
            defaultHeaders: CONFIG.openRouter.defaultHeaders,
        },
    });

    const ai = new AI({
        nlpModel,
        debugLog: console.log,
        vectorStore: state.vectorStore,
        promptConfig,
        templateText,
        topK: CONFIG.similarity.topK,
    });

    // SSE headers
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders();

    try {
        for await (const chunk of ai.answerQuestionStream(question)) {
            res.write(`data: ${JSON.stringify({ chunk })}\n\n`);
        }
        res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
    } catch (err) {
        console.error("❌ Chat error:", err);
        res.write(`data: ${JSON.stringify({ error: String(err) })}\n\n`);
    } finally {
        res.end();
    }
});
