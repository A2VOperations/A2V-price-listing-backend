import express from "express";
import categoryRoutes from "./categoryRoutes.js";
import productRoutes from "./productRoutes.js";
import uploadRoutes from "./uploadRoutes.js";
import authRoutes from "./authRoutes.js";
import userRoutes from "./userRoutes.js";
import masterRoutes from "./masterRoutes.js";
import quotationRoutes from "./quotationRoutes.js";

const router = express.Router();

router.use("/auth", authRoutes);
router.use("/users", userRoutes);
router.use("/categories", categoryRoutes);
router.use("/products", productRoutes);
router.use("/upload", uploadRoutes);
router.use("/masters", masterRoutes);
router.use("/quotations", quotationRoutes);

export default router;
