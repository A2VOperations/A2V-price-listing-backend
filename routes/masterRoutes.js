import express from "express";
import {
  getPaperMasters,
  createPaperMaster,
  updatePaperMaster,
  deletePaperMaster,
  updatePaperRate,
  getPrintingRates,
  updatePrintingRate,
  getBindingRates,
  updateBindingRate,
  getFinishingRates,
  updateFinishingRate,
} from "../controllers/masterController.js";
import { requireManagerOrAdmin } from "../middleware/authMiddleware.js";

const router = express.Router();

// Papers & Rates (Viewable by authenticated users; editable by Manager or Admin)
router.get("/papers", getPaperMasters);
router.post("/papers", requireManagerOrAdmin, createPaperMaster);
router.put("/papers/:id", requireManagerOrAdmin, updatePaperMaster);
router.delete("/papers/:id", requireManagerOrAdmin, deletePaperMaster);
router.post("/papers/rate", requireManagerOrAdmin, updatePaperRate);

// Printing Rates (Mini Offset & Digital)
router.get("/printing-rates", getPrintingRates);
router.put("/printing-rates/:rateKey", requireManagerOrAdmin, updatePrintingRate);

// Binding Rates
router.get("/binding-rates", getBindingRates);
router.put("/binding-rates/:bindingCode", requireManagerOrAdmin, updateBindingRate);

// Finishing Rates (Numbering & Punching)
router.get("/finishing-rates", getFinishingRates);
router.put("/finishing-rates/:serviceKey", requireManagerOrAdmin, updateFinishingRate);

export default router;
