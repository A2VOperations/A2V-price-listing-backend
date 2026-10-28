/**
 * Supabase Authentication & OTP Service
 * Uses Supabase GoTrue Auth REST API to send and verify email OTP codes
 */

function getSupabaseConfig() {
  const url = (process.env.SUPABASE_URL || "").replace(/\/+$/, "");
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || "";

  if (!url || !key) {
    console.warn("⚠️ SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is not defined in .env");
  }

  return { url, key };
}

/**
 * Send an OTP code to user's email via Supabase Auth
 * @param {string} email - Destination email address
 * @returns {Promise<{ success: boolean, message: string }>}
 */
export async function sendEmailOtp(email) {
  const { url, key } = getSupabaseConfig();

  if (!url || !key) {
    throw new Error(
      "Supabase credentials (SUPABASE_URL & SUPABASE_SERVICE_ROLE_KEY) are missing in environment variables."
    );
  }

  const cleanEmail = String(email || "").trim().toLowerCase();
  console.log(`📡 [Supabase Auth] Dispatching OTP email to: ${cleanEmail}`);

  try {
    const res = await fetch(`${url}/auth/v1/otp`, {
      method: "POST",
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email: cleanEmail,
        create_user: true,
      }),
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      const errorMsg =
        data.msg ||
        data.error_description ||
        data.message ||
        `Supabase returned error HTTP ${res.status}`;
      console.error(`❌ [Supabase Auth] Failed to dispatch OTP to ${cleanEmail}:`, errorMsg);
      throw new Error(errorMsg);
    }

    console.log(`✅ [Supabase Auth] OTP email successfully sent to ${cleanEmail}`);
    return {
      success: true,
      message: `OTP has been dispatched to ${cleanEmail}`,
    };
  } catch (err) {
    console.error("❌ [Supabase Auth] sendEmailOtp exception:", err.message);
    throw err;
  }
}

/**
 * Verify OTP code entered by the user via Supabase Auth
 * @param {string} email - User email
 * @param {string} token - 6-digit OTP code entered
 * @returns {Promise<{ success: boolean, data?: any }>}
 */
export async function verifyEmailOtp(email, token) {
  const { url, key } = getSupabaseConfig();

  if (!url || !key) {
    throw new Error(
      "Supabase credentials (SUPABASE_URL & SUPABASE_SERVICE_ROLE_KEY) are missing in environment variables."
    );
  }

  const cleanEmail = String(email || "").trim().toLowerCase();
  const cleanToken = String(token || "").trim();

  console.log(`🔍 [Supabase Auth] Verifying OTP code for email: ${cleanEmail}`);

  try {
    const res = await fetch(`${url}/auth/v1/verify`, {
      method: "POST",
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        type: "email",
        email: cleanEmail,
        token: cleanToken,
      }),
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      const errorMsg =
        data.msg ||
        data.error_description ||
        data.message ||
        "The OTP code is invalid or has expired.";
      console.warn(`⚠️ [Supabase Auth] Verification failed for ${cleanEmail}:`, errorMsg);
      throw new Error(errorMsg);
    }

    console.log(`✅ [Supabase Auth] OTP verified successfully for ${cleanEmail}`);
    return {
      success: true,
      data,
    };
  } catch (err) {
    console.error("❌ [Supabase Auth] verifyEmailOtp exception:", err.message);
    throw err;
  }
}

