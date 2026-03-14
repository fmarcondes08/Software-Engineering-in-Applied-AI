import type { AppStatus } from "../types.ts";

const labels: Record<AppStatus, string> = {
    idle: "Waiting",
    uploading: "Uploading...",
    training: "Training...",
    ready: "Ready",
    error: "Error",
};

const colors: Record<AppStatus, string> = {
    idle: "#6b7280",
    uploading: "#f59e0b",
    training: "#3b82f6",
    ready: "#10b981",
    error: "#ef4444",
};

export function StatusBadge({ status }: { status: AppStatus }) {
    return (
        <span className="status-badge" style={{ backgroundColor: colors[status] }}>
            {status === "training" && <span className="spinner" />}
            {labels[status]}
        </span>
    );
}
