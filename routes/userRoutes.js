import express from "express";
import {
  getAllUsers,
  createUser,
  updateUser,
  deleteUser,
} from "../controllers/userController.js";
import { requireAdmin } from "../middleware/authMiddleware.js";

const router = express.Router();

// All user management routes require admin privileges
router.use(requireAdmin);

router.get("/", getAllUsers);
router.post("/", createUser);
router.put("/:id", updateUser);
router.delete("/:id", deleteUser);

export default router;

