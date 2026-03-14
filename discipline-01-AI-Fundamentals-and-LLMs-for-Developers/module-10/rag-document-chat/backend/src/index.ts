import express from "express";
import cors from "cors";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { CONFIG } from "./config.ts";
import { uploadRouter } from "./routes/upload.ts";
import { trainRouter } from "./routes/train.ts";
import { chatRouter } from "./routes/chat.ts";
import { statusRouter } from "./routes/status.ts";

// Ensure uploads directory exists (relative to backend root, not src/)
const backendRoot = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const uploadDir = path.resolve(backendRoot, CONFIG.server.uploadDir);
await mkdir(uploadDir, { recursive: true });

const app = express();

app.use(
    cors({
        origin: ["http://localhost:5173", "http://127.0.0.1:5173"],
        methods: ["GET", "POST"],
    })
);
app.use(express.json());

app.use("/api/upload", uploadRouter);
app.use("/api/train", trainRouter);
app.use("/api/chat", chatRouter);
app.use("/api/status", statusRouter);

app.listen(CONFIG.server.port, () => {
    console.log(`🚀 Backend running at http://localhost:${CONFIG.server.port}`);
    console.log(`📁 Upload directory: ${uploadDir}`);
});
