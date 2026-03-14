import type { Neo4jVectorStore } from "@langchain/community/vectorstores/neo4j_vector";

export type AppStatus = "idle" | "uploading" | "training" | "ready" | "error";

export interface AppState {
    status: AppStatus;
    uploadedFilePath: string | null;
    uploadedFileName: string | null;
    uploadedFileType: string | null;
    vectorStore: Neo4jVectorStore | null;
    errorMessage: string | null;
    trainedAt: Date | null;
}

const state: AppState = {
    status: "idle",
    uploadedFilePath: null,
    uploadedFileName: null,
    uploadedFileType: null,
    vectorStore: null,
    errorMessage: null,
    trainedAt: null,
};

export function getState(): AppState {
    return state;
}

export function setState(partial: Partial<AppState>): void {
    Object.assign(state, partial);
}
