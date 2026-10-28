import express from "express";
import { login, verifyOtp, resendOtp, getMe } from "../controllers/authController.js";
import { requireAuth } from "../middleware/authMiddleware.js";

const router = express.Router();

// Public login endpoints (Credentials + OTP verification)
router.post("/login", login);
router.post("/verify-otp", verifyOtp);
router.post("/resend-otp", resendOtp);

// Protected session check
router.get("/me", requireAuth, getMe);

export default router;
