import { type Neo4jVectorStore } from "@langchain/community/vectorstores/neo4j_vector";
import { StringOutputParser } from "@langchain/core/output_parsers";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { RunnableSequence } from "@langchain/core/runnables";
import { ChatOpenAI } from "@langchain/openai";

type DebugLog = (...args: unknown[]) => void;
type Params = {
    debugLog: DebugLog;
    vectorStore: Neo4jVectorStore;
    nlpModel: ChatOpenAI;
    promptConfig: any;
    templateText: string;
    topK: number;
};

interface ChainState {
    question: string;
    context?: string;
    topScore?: number;
    error?: string;
    answer?: string;
}

export class AI {
    private params: Params;

    constructor(params: Params) {
        this.params = params;
    }

    async retrieveVectorSearchResults(input: ChainState): Promise<ChainState> {
        this.params.debugLog("🔍 Searching Neo4j vector store...");
        const vectorResults = await this.params.vectorStore.similaritySearchWithScore(
            input.question,
            this.params.topK
        );

        if (!vectorResults.length) {
            this.params.debugLog("⚠️  No results found in vector store.");
            return {
                ...input,
                error: "Sorry, I couldn't find relevant information about this question in the knowledge base.",
            };
        }

        const topScore = vectorResults[0]![1];
        this.params.debugLog(
            `✅ Found ${vectorResults.length} relevant results (best score: ${topScore.toFixed(3)})`
        );

        const contexts = vectorResults
            .filter(([, score]) => score > 0.5)
            .map(([doc]) => doc.pageContent)
            .join("\n\n---\n\n");

        return {
            ...input,
            context: contexts,
            topScore,
        };
    }

    async generateNLPResponse(input: ChainState): Promise<ChainState> {
        if (input.error) return input;
        this.params.debugLog("🤖 Generating AI response...");

        const responsePrompt = ChatPromptTemplate.fromTemplate(this.params.templateText);
        const responseChain = responsePrompt
            .pipe(this.params.nlpModel)
            .pipe(new StringOutputParser());

        const rawResponse = await responseChain.invoke({
            role: this.params.promptConfig.role,
            task: this.params.promptConfig.task,
            tone: this.params.promptConfig.constraints.tone,
            language: this.params.promptConfig.constraints.language,
            format: this.params.promptConfig.constraints.format,
            instructions: this.params.promptConfig.instructions
                .map((instruction: string, idx: number) => `${idx + 1}. ${instruction}`)
                .join("\n"),
            question: input.question,
            context: input.context,
        });

        return {
            ...input,
            answer: rawResponse,
        };
    }

    async answerQuestion(question: string) {
        const chain = RunnableSequence.from([
            this.retrieveVectorSearchResults.bind(this),
            this.generateNLPResponse.bind(this),
        ]);
        const result = await chain.invoke({ question });
        return result;
    }

    async *answerQuestionStream(question: string): AsyncGenerator<string> {
        const chainState = await this.retrieveVectorSearchResults({ question });

        if (chainState.error) {
            yield chainState.error;
            return;
        }

        const responsePrompt = ChatPromptTemplate.fromTemplate(this.params.templateText);
        const stream = await responsePrompt
            .pipe(this.params.nlpModel)
            .pipe(new StringOutputParser())
            .stream({
                role: this.params.promptConfig.role,
                task: this.params.promptConfig.task,
                tone: this.params.promptConfig.constraints.tone,
                language: this.params.promptConfig.constraints.language,
                format: this.params.promptConfig.constraints.format,
                instructions: this.params.promptConfig.instructions
                    .map((instruction: string, idx: number) => `${idx + 1}. ${instruction}`)
                    .join("\n"),
                question,
                context: chainState.context,
            });

        for await (const chunk of stream) {
            yield chunk;
        }
    }
}
