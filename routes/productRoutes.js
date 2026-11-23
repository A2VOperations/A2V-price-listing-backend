import express from "express";
import {
  getProducts,
  getProductBySlug,
  createProduct,
  updateProduct,
  deleteProduct,
} from "../controllers/productController.js";
import { requireAdmin } from "../middleware/authMiddleware.js";

const router = express.Router();

router.get("/", getProducts);
router.get("/:slugOrId", getProductBySlug);

// Admin-only mutation endpoints
router.post("/", requireAdmin, createProduct);
router.put("/:id", requireAdmin, updateProduct);
router.delete("/:id", requireAdmin, deleteProduct);

export default router;
