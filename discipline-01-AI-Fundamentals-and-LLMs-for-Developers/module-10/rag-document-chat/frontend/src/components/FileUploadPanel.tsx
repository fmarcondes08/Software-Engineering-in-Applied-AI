import { useRef } from "react";
import { StatusBadge } from "./StatusBadge.tsx";
import type { AppStatus } from "../types.ts";

interface Props {
    status: AppStatus;
    fileName: string | null;
    errorMsg: string | null;
    canTrain: boolean;
    alreadyTrained: boolean;
    onUpload: (file: File) => void;
    onTrain: () => void;
}

const ACCEPTED = ".pdf,.docx,.xlsx,.jpg,.jpeg,.png,.webp";

const FILE_TYPE_ICONS: Record<string, string> = {
    "application/pdf": "📄",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "📝",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "📊",
};

function getFileIcon(fileName: string | null): string {
    if (!fileName) return "📁";
    const ext = fileName.split(".").pop()?.toLowerCase();
    if (ext === "pdf") return "📄";
    if (ext === "docx") return "📝";
    if (ext === "xlsx") return "📊";
    if (["jpg", "jpeg", "png", "webp"].includes(ext ?? "")) return "🖼️";
    return "📁";
}

export function FileUploadPanel({
    status,
    fileName,
    errorMsg,
    canTrain,
    alreadyTrained,
    onUpload,
    onTrain,
}: Props) {
    const inputRef = useRef<HTMLInputElement>(null);

    const isDisabled = status === "uploading" || status === "training";

    return (
        <div className="upload-panel">
            <StatusBadge status={status} />

            <input
                ref={inputRef}
                type="file"
                accept={ACCEPTED}
                style={{ display: "none" }}
                onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                        onUpload(file);
                        e.target.value = ""; // reset so same file can be re-uploaded
                    }
                }}
            />

            <button
                className="btn btn-secondary"
                onClick={() => inputRef.current?.click()}
                disabled={isDisabled}
                title="Supported: PDF, DOCX, XLSX, images"
            >
                {fileName ? "Change file" : "Choose file"}
            </button>

            {fileName && (
                <span className="file-name" title={fileName}>
                    {getFileIcon(fileName)} {fileName}
                </span>
            )}

            <button
                className="btn btn-primary"
                onClick={onTrain}
                disabled={!canTrain || isDisabled}
                title={alreadyTrained ? "Already trained — click to retrain with a new file" : "Process document and create embeddings"}
            >
                {status === "training" ? "Training..." : alreadyTrained ? "Retrain" : "Train"}
            </button>

            {errorMsg && <p className="error-text" title={errorMsg}>⚠️ {errorMsg}</p>}

        </div>
    );
}
