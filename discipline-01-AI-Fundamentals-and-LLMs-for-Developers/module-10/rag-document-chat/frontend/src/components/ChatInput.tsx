import { useState } from "react";

interface Props {
    disabled: boolean;
    onSend: (question: string) => void;
}

export function ChatInput({ disabled, onSend }: Props) {
    const [value, setValue] = useState("");

    function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        const trimmed = value.trim();
        if (!trimmed) return;
        onSend(trimmed);
        setValue("");
    }

    return (
        <form className="chat-input-form" onSubmit={handleSubmit}>
            <textarea
                className="chat-textarea"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                placeholder={
                    disabled
                        ? "Train the model first to enable chat..."
                        : "Ask a question about the document... (Enter to send, Shift+Enter for new line)"
                }
                disabled={disabled}
                rows={2}
                onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        handleSubmit(e as unknown as React.FormEvent);
                    }
                }}
            />
            <button
                type="submit"
                className="btn btn-primary send-btn"
                disabled={disabled || !value.trim()}
                title="Send question (Enter)"
            >
                <span>Send</span>
                <span className="send-icon">→</span>
            </button>
        </form>
    );
}
