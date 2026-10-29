import { verifyToken } from "../utils/authUtils.js";

/**
 * Authentication middleware to verify bearer token
 */
export function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({
      success: false,
      message: "Authentication required. Please sign in.",
    });
  }

  const token = authHeader.split(" ")[1];
  const payload = verifyToken(token);

  if (!payload) {
    return res.status(401).json({
      success: false,
      message: "Session expired after 8 hours or invalid token. Please sign in again.",
    });
  }

  req.user = payload;
  next();
}

/**
 * Admin authorization middleware - allows only users with role 'admin'
 */
export function requireAdmin(req, res, next) {
  requireAuth(req, res, () => {
    if (req.user && req.user.role === "admin") {
      return next();
    }
    return res.status(403).json({
      success: false,
      message: "Access forbidden. Admin privileges are required for this action.",
    });
  });
}

