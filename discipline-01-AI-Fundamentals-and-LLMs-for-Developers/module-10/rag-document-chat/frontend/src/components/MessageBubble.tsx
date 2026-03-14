import type { Message } from "../types.ts";

export function MessageBubble({ message }: { message: Message }) {
    return (
        <div className={`message message--${message.role}`}>
            <div className="message-avatar">
                {message.role === "user" ? "👤" : "🤖"}
            </div>
            <div className="message-content">
                <div className="message-text">
                    {message.content || (message.isStreaming ? "" : "…")}
                    {message.isStreaming && <span className="cursor-blink">▌</span>}
                </div>
            </div>
        </div>
    );
}
