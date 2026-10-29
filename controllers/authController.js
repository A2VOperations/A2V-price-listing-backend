import mongoose from "mongoose";
import User from "../models/User.js";
import {
  verifyPassword,
  createToken,
  createTempAuthToken,
  verifyToken,
  maskEmail,
} from "../utils/authUtils.js";
import { sendEmailOtp, verifyEmailOtp } from "../services/supabaseService.js";

function ensureDbConnected(res) {
  if (mongoose.connection.readyState !== 1) {
    res.status(503).json({
      success: false,
      message: "MongoDB connection is not active. Database is required for authentication.",
    });
    return false;
  }
  return true;
}

/**
 * POST /api/auth/login
 * Step 1: Validates credentials and sends OTP via Supabase to user's email
 */
export async function login(req, res) {
  try {
    if (!ensureDbConnected(res)) return;

    const { username, password } = req.body || {};

    if (!username || !password) {
      return res.status(400).json({
        success: false,
        message: "Please enter both User ID / Email and password.",
      });
    }

    const cleanIdentifier = String(username).trim().toLowerCase();
    const cleanPassword = String(password).trim();

    // Query user record from MongoDB by username OR email
    const user = await User.findOne({
      $or: [{ username: cleanIdentifier }, { email: cleanIdentifier }],
    });

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Invalid credentials. Please verify your User ID and password.",
      });
    }

    // Verify hashed password
    const isPasswordValid = verifyPassword(
      cleanPassword,
      user.passwordHash,
      user.passwordSalt
    );

    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: "Invalid credentials. Please verify your User ID and password.",
      });
    }

    // For all users, the OTP verification code is ALWAYS dispatched exclusively to the Administrator email
    const destinationEmail = (process.env.ADMIN_EMAIL || "operation.a2vgroups@gmail.com").trim().toLowerCase();
    const loginPerson = user.name || user.username;
    const loginUsername = user.username;
    const loginRole = user.role === "admin" ? "Administrator" : "Standard User";

    console.log(`🔐 [Login Security] User '${loginUsername}' (${loginPerson} / ${loginRole}) initiated sign-in. Dispatching OTP to Admin: ${destinationEmail}`);

    // Send OTP via Supabase to admin's email with login identity metadata
    let otpResult = null;
    try {
      otpResult = await sendEmailOtp(destinationEmail, {
        loginPerson,
        loginUsername,
        loginRole,
      });
    } catch (otpErr) {
      console.error("Supabase OTP Error:", otpErr.message);
      return res.status(502).json({
        success: false,
        message: `Failed to dispatch OTP email via Supabase: ${otpErr.message}`,
      });
    }

    // Issue temporary token for OTP pending stage (valid 10 mins)
    const tempToken = createTempAuthToken({
      userId: user._id.toString(),
      username: user.username,
      name: user.name,
      email: destinationEmail,
      role: user.role,
      verificationType: otpResult?.verificationType || "magiclink",
    });

    return res.json({
      success: true,
      requireOtp: true,
      tempToken,
      email: maskEmail(destinationEmail),
      targetUser: user.username,
      emailDelivered: otpResult?.emailDelivered,
      message:
        otpResult?.message ||
        `Verification code sent to Administrator (${maskEmail(destinationEmail)}). Please check the admin inbox.`,
    });
  } catch (error) {
    console.error("MongoDB Login Error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "An unexpected error occurred during login. Please try again.",
    });
  }
}

/**
 * POST /api/auth/verify-otp
 * Step 2: Verifies OTP with Supabase and issues final session token
 */
export async function verifyOtp(req, res) {
  try {
    if (!ensureDbConnected(res)) return;

    const { tempToken, otp } = req.body || {};

    if (!tempToken || !otp) {
      return res.status(400).json({
        success: false,
        message: "Verification token and OTP code are required.",
      });
    }

    // Verify temporary pre-auth token
    const payload = verifyToken(tempToken);
    if (!payload || payload.stage !== "otp_pending" || !payload.userId) {
      return res.status(401).json({
        success: false,
        message: "Verification session expired. Please sign in again.",
      });
    }

    const cleanOtp = String(otp).trim();

    // Verify OTP with Supabase
    try {
      await verifyEmailOtp(payload.email, cleanOtp, payload.verificationType);
    } catch (verifyErr) {
      return res.status(400).json({
        success: false,
        message: verifyErr.message || "Invalid or expired OTP code. Please try again.",
      });
    }

    // Retrieve user from MongoDB to ensure current role/data
    const user = await User.findById(payload.userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User account not found in database.",
      });
    }

    // Generate Final Session Token (7 days)
    const safeUser = user.toSafeObject();
    const token = createToken({
      id: safeUser.id,
      username: safeUser.username,
      name: safeUser.name,
      role: safeUser.role,
      email: safeUser.email,
    });

    return res.json({
      success: true,
      message: `Authentication successful! Welcome, ${safeUser.name || safeUser.username}.`,
      token,
      user: safeUser,
    });
  } catch (error) {
    console.error("Verify OTP Error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "An error occurred while verifying the code.",
    });
  }
}

/**
 * POST /api/auth/resend-otp
 * Resends OTP code to the email associated with the temporary session
 */
export async function resendOtp(req, res) {
  try {
    const { tempToken } = req.body || {};

    if (!tempToken) {
      return res.status(400).json({
        success: false,
        message: "Session token is required to resend OTP.",
      });
    }

    const payload = verifyToken(tempToken);
    if (!payload || payload.stage !== "otp_pending" || !payload.email) {
      return res.status(401).json({
        success: false,
        message: "Session expired. Please sign in again.",
      });
    }

    // Call Supabase to re-dispatch OTP to admin email with user metadata
    const destinationEmail = (process.env.ADMIN_EMAIL || payload.email || "operation.a2vgroups@gmail.com").trim().toLowerCase();
    const loginPerson = payload.name || payload.username || "Authorized User";
    const loginUsername = payload.username || "N/A";
    const loginRole = payload.role === "admin" ? "Administrator" : "Standard User";

    await sendEmailOtp(destinationEmail, {
      loginPerson,
      loginUsername,
      loginRole,
    });

    return res.json({
      success: true,
      message: `A fresh OTP code has been dispatched to Administrator (${maskEmail(destinationEmail)}).`,
    });
  } catch (error) {
    console.error("Resend OTP Error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to resend OTP. Please try again.",
    });
  }
}

/**
 * GET /api/auth/me
 * Retrieves current authenticated user record directly from MongoDB
 */
export async function getMe(req, res) {
  try {
    if (!ensureDbConnected(res)) return;

    const userId = req.user.id;
    const user = await User.findById(userId).select("-passwordHash -passwordSalt");

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User account not found in database.",
      });
    }

    return res.json({
      success: true,
      user: user.toSafeObject(),
    });
  } catch (error) {
    console.error("MongoDB getMe Error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to retrieve user profile from database.",
    });
  }
}
