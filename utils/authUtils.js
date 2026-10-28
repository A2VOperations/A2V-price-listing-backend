import crypto from "crypto";

const JWT_SECRET = process.env.JWT_SECRET || "a2v_secure_jwt_secret_token_key_2026_@!";

/**
 * Hash password using scrypt with random salt
 */
export function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(password, salt, 64).toString("hex");
  return { hash, salt };
}

/**
 * Verify password against stored hash and salt
 */
export function verifyPassword(password, storedHash, salt) {
  try {
    const hashBuffer = Buffer.from(storedHash, "hex");
    const testBuffer = crypto.scryptSync(password, salt, 64);
    return crypto.timingSafeEqual(hashBuffer, testBuffer);
  } catch (err) {
    return false;
  }
}

/**
 * Helper: Base64Url encode/decode
 */
function base64UrlEncode(str) {
  return Buffer.from(str)
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

function base64UrlDecode(str) {
  str = str.replace(/-/g, "+").replace(/_/g, "/");
  while (str.length % 4) {
    str += "=";
  }
  return Buffer.from(str, "base64").toString();
}

/**
 * Create a cryptographically signed HMAC-SHA256 session token
 * Expiry: 7 days
 */
export function createToken(payload) {
  const header = { alg: "HS256", typ: "JWT" };
  const exp = Date.now() + 7 * 24 * 60 * 60 * 1000; // 7 days
  const tokenPayload = { ...payload, exp };

  const headerB64 = base64UrlEncode(JSON.stringify(header));
  const payloadB64 = base64UrlEncode(JSON.stringify(tokenPayload));
  const dataToSign = `${headerB64}.${payloadB64}`;

  const signature = crypto
    .createHmac("sha256", JWT_SECRET)
    .update(dataToSign)
    .digest("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");

  return `${dataToSign}.${signature}`;
}

/**
 * Create temporary token for OTP pending stage (valid for 10 minutes)
 */
export function createTempAuthToken(payload) {
  const header = { alg: "HS256", typ: "JWT" };
  const exp = Date.now() + 10 * 60 * 1000; // 10 minutes
  const tokenPayload = { ...payload, stage: "otp_pending", exp };

  const headerB64 = base64UrlEncode(JSON.stringify(header));
  const payloadB64 = base64UrlEncode(JSON.stringify(tokenPayload));
  const dataToSign = `${headerB64}.${payloadB64}`;

  const signature = crypto
    .createHmac("sha256", JWT_SECRET)
    .update(dataToSign)
    .digest("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");

  return `${dataToSign}.${signature}`;
}

/**
 * Verify HMAC-SHA256 signed session token
 */
export function verifyToken(token) {
  if (!token || typeof token !== "string") return null;

  const parts = token.split(".");
  if (parts.length !== 3) return null;

  const [headerB64, payloadB64, signature] = parts;
  const dataToSign = `${headerB64}.${payloadB64}`;

  const expectedSignature = crypto
    .createHmac("sha256", JWT_SECRET)
    .update(dataToSign)
    .digest("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");

  try {
    const isSigValid = crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature)
    );
    if (!isSigValid) return null;

    const payload = JSON.parse(base64UrlDecode(payloadB64));
    if (payload.exp && Date.now() > payload.exp) {
      return null; // Expired
    }
    return payload;
  } catch (err) {
    return null;
  }
}

/**
 * Mask an email address for safe display (e.g. op***ps@gmail.com)
 */
export function maskEmail(email) {
  if (!email || !email.includes("@")) return email || "";
  const [local, domain] = email.split("@");
  if (local.length <= 2) {
    return `${local[0]}***@${domain}`;
  }
  const prefix = local.slice(0, 2);
  const suffix = local.slice(-1);
  return `${prefix}***${suffix}@${domain}`;
}
