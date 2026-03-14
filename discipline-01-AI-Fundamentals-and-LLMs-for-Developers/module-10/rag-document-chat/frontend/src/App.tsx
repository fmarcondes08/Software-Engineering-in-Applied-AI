import { useState, useEffect, useRef } from "react";
import { ChatWindow } from "./components/ChatWindow.tsx";
import { ChatInput } from "./components/ChatInput.tsx";
import { FileUploadPanel } from "./components/FileUploadPanel.tsx";
import { uploadFile, trainModel, streamChat, getStatus } from "./api.ts";
import type { Message, AppStatus } from "./types.ts";

export function App() {
    const [messages, setMessages] = useState<Message[]>([]);
    const [status, setStatus] = useState<AppStatus>("idle");
    const [fileName, setFileName] = useState<string | null>(null);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);
    const abortRef = useRef<AbortController | null>(null);

    // Restore state on mount
    useEffect(() => {
        getStatus().then((s) => {
            setStatus(s.status);
            setFileName(s.fileName);
            if (s.errorMessage) setErrorMsg(s.errorMessage);
        });
    }, []);

    async function handleUpload(file: File) {
        setStatus("uploading");
        setErrorMsg(null);
        try {
            await uploadFile(file);
            setFileName(file.name);
            setStatus("idle");
        } catch (err) {
            setStatus("error");
            setErrorMsg(String(err));
        }
    }

    async function handleTrain() {
        setStatus("training");
        setErrorMsg(null);
        try {
            const { chunks } = await trainModel();
            setStatus("ready");
            setMessages((prev) => [
                ...prev,
                {
                    id: crypto.randomUUID(),
                    role: "assistant",
                    content: `Document trained successfully! ${chunks} chunks indexed in Neo4j. You can now ask questions about the content.`,
                },
            ]);
        } catch (err) {
            setStatus("error");
            setErrorMsg(String(err));
        }
    }

    function handleSend(question: string) {
        // Cancel any ongoing stream
        abortRef.current?.abort();

        const userMsg: Message = {
            id: crypto.randomUUID(),
            role: "user",
            content: question,
        };
        const assistantId = crypto.randomUUID();
        const assistantMsg: Message = {
            id: assistantId,
            role: "assistant",
            content: "",
            isStreaming: true,
        };

        setMessages((prev) => [...prev, userMsg, assistantMsg]);

        abortRef.current = streamChat(
            question,
            (chunk) => {
                setMessages((prev) =>
                    prev.map((m) =>
                        m.id === assistantId ? { ...m, content: m.content + chunk } : m
                    )
                );
            },
            () => {
                setMessages((prev) =>
                    prev.map((m) =>
                        m.id === assistantId ? { ...m, isStreaming: false } : m
                    )
                );
            },
            (err) => {
                setMessages((prev) =>
                    prev.map((m) =>
                        m.id === assistantId
                            ? { ...m, content: `Error: ${err}`, isStreaming: false }
                            : m
                    )
                );
            }
        );
    }

    const canTrain = fileName !== null && status !== "training" && status !== "uploading";
    const alreadyTrained = status === "ready";

    return (
        <div className="app">
            <header className="app-header">
                <div className="app-brand">
                    <span className="app-logo">🎓</span>
                    <h1 className="app-title">RAG Chat</h1>
                    <span className="app-subtitle">Study any document with AI</span>
                </div>
                <FileUploadPanel
                    status={status}
                    fileName={fileName}
                    errorMsg={errorMsg}
                    canTrain={canTrain}
                    alreadyTrained={alreadyTrained}
                    onUpload={handleUpload}
                    onTrain={handleTrain}
                />
            </header>
            <main className="chat-area">
                <ChatWindow messages={messages} status={status} />
            </main>
            <footer className="chat-footer">
                <ChatInput disabled={status !== "ready"} onSend={handleSend} />
            </footer>
        </div>
    );
}
