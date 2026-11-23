import express from "express";
import {
  getPaperMasters,
  updatePaperRate,
  getPrintingRates,
  updatePrintingRate,
  getBindingRates,
  updateBindingRate,
  getFinishingRates,
  updateFinishingRate,
} from "../controllers/masterController.js";
import { requireAdmin } from "../middleware/authMiddleware.js";

const router = express.Router();

// Papers & Rates
router.get("/papers", getPaperMasters);
router.post("/papers/rate", requireAdmin, updatePaperRate);

// Printing Rates (Mini Offset & Digital)
router.get("/printing-rates", getPrintingRates);
router.put("/printing-rates/:rateKey", requireAdmin, updatePrintingRate);

// Binding Rates
router.get("/binding-rates", getBindingRates);
router.put("/binding-rates/:bindingCode", requireAdmin, updateBindingRate);

// Finishing Rates (Numbering & Punching)
router.get("/finishing-rates", getFinishingRates);
router.put("/finishing-rates/:serviceKey", requireAdmin, updateFinishingRate);

export default router;
