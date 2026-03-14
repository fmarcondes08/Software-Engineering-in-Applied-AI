import { useEffect, useRef } from "react";
import { MessageBubble } from "./MessageBubble.tsx";
import type { Message, AppStatus } from "../types.ts";

interface Props {
    messages: Message[];
    status: AppStatus;
}


function getPlaceholder(status: AppStatus, hasFile: boolean): string {
    if (status === "idle" && hasFile) {
        return "File loaded. Click **Train** to index the document.";
    }
    if (status === "idle") {
        return "Click **Choose file** to load a document (PDF, DOCX, XLSX, or image).";
    }
    if (status === "uploading") return "Uploading file...";
    if (status === "training") return "Processing document and creating embeddings in Neo4j. This may take a few minutes on the first run.";
    if (status === "error") return "An error occurred. Check the file and try again.";
    return "";
}

function renderMarkdownBold(text: string) {
    const parts = text.split(/\*\*(.*?)\*\*/g);
    return parts.map((part, i) =>
        i % 2 === 1 ? <strong key={i}>{part}</strong> : part
    );
}

export function ChatWindow({ messages, status }: Props) {
    const endRef = useRef<HTMLDivElement>(null);
    const hasFile = status !== "idle" || messages.length > 0;

    useEffect(() => {
        endRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages]);

    return (
        <div className="chat-window">
            {messages.length === 0 && (
                <div className="chat-placeholder">
                    <div className="placeholder-icon">
                        {status === "training" ? "⚙️" : status === "error" ? "❌" : "🎓"}
                    </div>
                    <p>{renderMarkdownBold(getPlaceholder(status, hasFile))}</p>
                    {status === "training" && (
                        <p className="placeholder-hint">
                            The embedding model <code>Xenova/all-MiniLM-L6-v2</code> will be downloaded on first run (~23 MB).
                        </p>
                    )}
                </div>
            )}
            {messages.map((m) => (
                <MessageBubble key={m.id} message={m} />
            ))}
            <div ref={endRef} />
        </div>
    );
}
