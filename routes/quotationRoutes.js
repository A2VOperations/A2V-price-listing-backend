import express from "express";
import {
  calculatePrintJob,
  createQuotation,
  getQuotations,
  createJobCardFromQuote,
  getOptimalRawSheetFromDb,
} from "../controllers/quotationController.js";
import { requireAuth } from "../middleware/authMiddleware.js";

const router = express.Router();

// Calculation & least-wastage sheet selection endpoints
router.post("/calculate", calculatePrintJob);
router.post("/optimal-sheet", getOptimalRawSheetFromDb);

// Quotation management (requires login)
router.post("/", requireAuth, createQuotation);
router.get("/", requireAuth, getQuotations);

// Production Job Card generation
router.post("/:quoteRef/job-card", requireAuth, createJobCardFromQuote);

export default router;
