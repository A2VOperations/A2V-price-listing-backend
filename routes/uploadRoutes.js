import express from "express";
import multer from "multer";
import { uploadImages } from "../controllers/uploadController.js";

// Use in-memory storage so uploads don't write temp files inside backend/ to prevent node --watch from restarting the server mid-upload
const storage = multer.memoryStorage();

const upload = multer({
  storage,
  limits: { fileSize: 25 * 1024 * 1024 }, // 25MB per file
});

const router = express.Router();

// Support single "image", multiple "images", or any array of files
router.post("/", upload.any(), uploadImages);
router.post("/multiple", upload.array("images", 20), uploadImages);

export default router;
