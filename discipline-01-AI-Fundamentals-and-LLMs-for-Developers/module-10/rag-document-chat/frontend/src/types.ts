export type AppStatus = "idle" | "uploading" | "training" | "ready" | "error";

export interface Message {
    id: string;
    role: "user" | "assistant";
    content: string;
    isStreaming?: boolean;
}

export interface StatusResponse {
    status: AppStatus;
    fileName: string | null;
    fileType: string | null;
    trainedAt: string | null;
    errorMessage: string | null;
}
