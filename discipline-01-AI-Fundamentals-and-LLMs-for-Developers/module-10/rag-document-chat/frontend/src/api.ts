import type { StatusResponse } from "./types.ts";

export async function uploadFile(file: File): Promise<void> {
    const fd = new FormData();
    fd.append("file", file);
    const res = await fetch("/api/upload", { method: "POST", body: fd });
    if (!res.ok) {
        const body = await res.json().catch(() => ({ error: "Unknown error" }));
        throw new Error(body.error ?? "Upload failed");
    }
}

export async function trainModel(): Promise<{ chunks: number }> {
    const res = await fetch("/api/train", { method: "POST" });
    if (!res.ok) {
        const body = await res.json().catch(() => ({ error: "Unknown error" }));
        throw new Error(body.error ?? "Training failed");
    }
    return res.json();
}

export async function getStatus(): Promise<StatusResponse> {
    const res = await fetch("/api/status");
    return res.json();
}

export function streamChat(
    question: string,
    onChunk: (chunk: string) => void,
    onDone: () => void,
    onError: (err: string) => void
): AbortController {
    const controller = new AbortController();

    (async () => {
        const res = await fetch("/api/chat", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ question }),
            signal: controller.signal,
        });

        if (!res.ok) {
            const body = await res.json().catch(() => ({ error: "Server error" }));
            onError(body.error ?? "Failed to connect to server");
            return;
        }

        const reader = res.body!.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });

            // Parse SSE: each event is "data: ...\n\n"
            const events = buffer.split("\n\n");
            buffer = events.pop() ?? "";

            for (const event of events) {
                if (!event.startsWith("data: ")) continue;
                try {
                    const json = JSON.parse(event.slice(6));
                    if (json.chunk !== undefined) onChunk(json.chunk);
                    if (json.done) onDone();
                    if (json.error) onError(json.error);
                } catch {
                    // ignore malformed events
                }
            }
        }
    })().catch((err: Error) => {
        if (err.name !== "AbortError") onError(String(err));
    });

    return controller;
}
