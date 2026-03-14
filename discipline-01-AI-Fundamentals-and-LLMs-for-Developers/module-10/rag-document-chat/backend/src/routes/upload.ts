import { Router } from "express";
import multer from "multer";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { unlink } from "node:fs/promises";
import { CONFIG } from "../config.ts";
import { getState, setState } from "../state.ts";

// Resolve uploads dir relative to backend root (not CWD), so it's stable regardless of how npm is invoked
const backendRoot = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const UPLOAD_DIR = path.resolve(backendRoot, CONFIG.server.uploadDir);

const ALLOWED_MIME_TYPES = [
    "application/pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "image/jpeg",
    "image/png",
    "image/webp",
];

const storage = multer.diskStorage({
    destination: UPLOAD_DIR,
    filename: (_req, file, cb) => {
        const unique = `${Date.now()}-${file.originalname.replace(/\s+/g, "_")}`;
        cb(null, unique);
    },
});

const upload = multer({
    storage,
    limits: { fileSize: 50 * 1024 * 1024 }, // 50 MB
    fileFilter: (_req, file, cb) => {
        if (ALLOWED_MIME_TYPES.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error(`Unsupported file type: ${file.mimetype}`));
        }
    },
});

export const uploadRouter = Router();

uploadRouter.post("/", upload.single("file"), async (req, res) => {
    try {
        if (!req.file) {
            res.status(400).json({ error: "No file uploaded." });
            return;
        }

        const state = getState();

        // Clean up previous upload
        if (state.uploadedFilePath) {
            await unlink(state.uploadedFilePath).catch(() => {});
        }

        // Close previous vector store
        if (state.vectorStore) {
            await state.vectorStore.close().catch(() => {});
        }

        setState({
            uploadedFilePath: req.file.path,
            uploadedFileName: req.file.originalname,
            uploadedFileType: req.file.mimetype,
            vectorStore: null,
            trainedAt: null,
            errorMessage: null,
            status: "idle",
        });

        res.json({
            success: true,
            fileName: req.file.originalname,
            fileType: req.file.mimetype,
        });
    } catch (err) {
        setState({ status: "error", errorMessage: String(err) });
        res.status(500).json({ error: String(err) });
    }
});
