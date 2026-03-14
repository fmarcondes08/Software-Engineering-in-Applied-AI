import { Router } from "express";
import { getState } from "../state.ts";

export const statusRouter = Router();

statusRouter.get("/", (_req, res) => {
    const state = getState();
    res.json({
        status: state.status,
        fileName: state.uploadedFileName,
        fileType: state.uploadedFileType,
        trainedAt: state.trainedAt?.toISOString() ?? null,
        errorMessage: state.errorMessage,
    });
});
