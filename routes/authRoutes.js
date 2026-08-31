import express from "express";

const router = express.Router();

// Default admin credentials (can be overridden via environment variables)
const ADMIN_USERNAME = process.env.ADMIN_USERNAME || "admin";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "admin@a2v";

// POST /api/auth/login
router.post("/login", (req, res) => {
  const { username, password } = req.body || {};

  if (!username || !password) {
    return res.status(400).json({
      success: false,
      message: "Please enter both Login ID and Password.",
    });
  }

  const cleanUser = String(username).trim();
  const cleanPass = String(password).trim();

  if (cleanUser === ADMIN_USERNAME && cleanPass === ADMIN_PASSWORD) {
    // Generate a simple token session identifier
    const token = `a2v_admin_token_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

    return res.json({
      success: true,
      message: "Admin login successful.",
      token,
      user: {
        username: cleanUser,
        role: "admin",
        loginTime: new Date().toISOString(),
      },
    });
  }

  return res.status(401).json({
    success: false,
    message: "Invalid Login ID or Password. Please try again.",
  });
});

// GET /api/auth/verify
router.get("/verify", (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({
      success: false,
      message: "No token provided.",
    });
  }

  const token = authHeader.split(" ")[1];
  if (token && token.startsWith("a2v_admin_token_")) {
    return res.json({
      success: true,
      user: { username: ADMIN_USERNAME, role: "admin" },
    });
  }

  return res.status(401).json({
    success: false,
    message: "Invalid session token.",
  });
});

export default router;
