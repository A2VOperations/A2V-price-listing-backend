import express from "express";
import {
  calculatePrintJob,
  createQuotation,
  getQuotations,
  createJobCardFromQuote,
} from "../controllers/quotationController.js";
import { requireAuth } from "../middleware/authMiddleware.js";

const router = express.Router();

// Calculation endpoint (can be called by authenticated users or public quotation calculator)
router.post("/calculate", calculatePrintJob);

// Quotation management (requires login)
router.post("/", requireAuth, createQuotation);
router.get("/", requireAuth, getQuotations);

// Production Job Card generation
router.post("/:quoteRef/job-card", requireAuth, createJobCardFromQuote);

export default router;
