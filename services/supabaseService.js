function getSupabaseConfig() {
  const url = (process.env.SUPABASE_URL || "").replace(/\/+$/, "");
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    "";

  if (!url || !key) {
    console.warn("⚠️ SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is not defined in .env");
  }

  return { url, key };
}

/**
 * Generate Supabase OTP code using Admin generate_link API
 * Uses SUPABASE_SERVICE_ROLE_KEY to generate a valid Supabase OTP token.
 */
export async function generateSupabaseOtp(email) {
  const { url, key } = getSupabaseConfig();
  const cleanEmail = String(email || "").trim().toLowerCase();

  if (!url || !key) {
    throw new Error(
      "Supabase credentials (SUPABASE_URL & SUPABASE_SERVICE_ROLE_KEY) are missing in environment variables."
    );
  }

  // 1. Try generate_link with 'magiclink'
  let res = await fetch(`${url}/auth/v1/admin/generate_link`, {
    method: "POST",
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      type: "magiclink",
      email: cleanEmail,
    }),
  });

  let data = await res.json().catch(() => ({}));

  // 2. If user doesn't exist yet in Supabase Auth, generate with 'signup'
  if (!res.ok || !data.email_otp) {
    res = await fetch(`${url}/auth/v1/admin/generate_link`, {
      method: "POST",
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        type: "signup",
        email: cleanEmail,
        password: `Tmp_A2V_${Date.now()}!`,
      }),
    });
    data = await res.json().catch(() => ({}));
  }

  if (!res.ok || !data.email_otp) {
    const errorMsg =
      data.msg ||
      data.error_description ||
      data.message ||
      `Supabase generate_link failed with HTTP ${res.status}`;
    throw new Error(errorMsg);
  }

  return {
    emailOtp: data.email_otp,
    actionLink: data.action_link,
    verificationType: data.verification_type || "magiclink",
    hashedToken: data.hashed_token,
  };
}

/**
 * Dispatch OTP email exclusively through Supabase Auth
 * Includes login metadata (Person Name, User ID, Role) so the Admin
 * receives full context in the email about who is attempting to log in.
 */
export async function sendEmailOtp(email, metadata = {}) {
  const { url, key } = getSupabaseConfig();
  const cleanEmail = String(email || "").trim().toLowerCase();

  if (!url || !key) {
    throw new Error("Supabase credentials are not configured in backend/.env");
  }

  const personName = metadata.loginPerson || metadata.loginUsername || "Authorized User";
  const username = metadata.loginUsername || "N/A";
  const role = metadata.loginRole || "Standard User";

  console.log(`📡 [Supabase Auth] Requesting OTP email dispatch for: ${cleanEmail} (Attempt by: ${personName} [${username}])`);

  // Update Supabase user_metadata before dispatch so {{ .Data.login_person }} renders in templates
  try {
    const usersRes = await fetch(`${url}/auth/v1/admin/users`, {
      headers: { apikey: key, Authorization: `Bearer ${key}` },
    });
    const usersData = await usersRes.json().catch(() => ({}));
    const existingUser = usersData.users?.find((u) => u.email === cleanEmail);

    if (existingUser?.id) {
      await fetch(`${url}/auth/v1/admin/users/${existingUser.id}`, {
        method: "PUT",
        headers: {
          apikey: key,
          Authorization: `Bearer ${key}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          user_metadata: {
            ...(existingUser.user_metadata || {}),
            login_person: personName,
            login_username: username,
            login_role: role,
            login_time: new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }),
          },
        }),
      });
    }
  } catch (metaErr) {
    console.warn("⚠️ [Supabase Auth] Could not update user_metadata:", metaErr.message);
  }

  // 1. Attempt to send OTP via Supabase's native mailer with custom data payload
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
        data: {
          login_person: personName,
          login_username: username,
          login_role: role,
        },
      }),
    });

    const data = await res.json().catch(() => ({}));

    if (res.ok) {
      console.log(`✅ [Supabase Auth] OTP email successfully dispatched by Supabase to ${cleanEmail}`);
      return {
        success: true,
        emailDelivered: true,
        rateLimited: false,
        cooldownSeconds: 60,
        verificationType: "email",
        message: `Verification code sent to Administrator (${cleanEmail}). Please check the admin inbox.`,
      };
    }

    // Handle Supabase 60-second rate limiting gracefully
    // IMPORTANT: Do NOT generate a link/phantom OTP when rate-limited!
    // Generating a link would overwrite & invalidate the active OTP that was already delivered to the email!
    if (res.status === 429 || data.error_code === "over_email_send_rate_limit") {
      const waitMatch = data.msg ? data.msg.match(/\d+/) : null;
      const waitSeconds = waitMatch ? parseInt(waitMatch[0], 10) : 60;
      console.warn(`⏳ [Supabase Auth] Email send rate limited by Supabase. Must wait ${waitSeconds}s before sending another email.`);
      return {
        success: true,
        emailDelivered: true, // An active code was already dispatched within the last 60s
        rateLimited: true,
        cooldownSeconds: waitSeconds,
        verificationType: "email",
        message: `A verification code was recently sent to Administrator (${cleanEmail}). Please check your inbox or wait ${waitSeconds}s to request a new one.`,
      };
    }

    const errorMsg = data.msg || data.error_description || data.message || `HTTP ${res.status}`;
    console.warn(`⚠️ [Supabase Auth] Native mail dispatch returned: ${errorMsg}`);

    // If Supabase encountered an actual failure (e.g. SMTP credentials issue)
    console.log("🔄 [Supabase Auth] Falling back to Supabase Admin link generator...");
    const otpData = await generateSupabaseOtp(cleanEmail);

    console.log("\n========================================================================");
    console.log("⚠️ [SUPABASE SMTP FAILED TO DELIVER EMAIL]");
    console.log(`   Reason: "${errorMsg}"`);
    console.log("   👉 In Supabase Dashboard (Authentication -> SMTP Settings):");
    console.log("      - Host:     smtp.gmail.com");
    console.log("      - Port:     587");
    console.log("      - Username: operation.a2vgroups@gmail.com");
    console.log("      - Password: MUST be 16-letter App Password (without spaces)");
    console.log("------------------------------------------------------------------------");
    console.log("🔑 [ACTIVE SUPABASE OTP CODE FOR LOGIN]");
    console.log(`   Recipient:         ${cleanEmail}`);
    console.log(`   Verification Code: ${otpData.emailOtp}`);
    console.log("========================================================================\n");

    return {
      success: true,
      emailDelivered: false,
      rateLimited: false,
      cooldownSeconds: 60,
      verificationType: otpData.verificationType || "magiclink",
      message: `Supabase email delivery failed (${errorMsg}). Your OTP code is logged in the server terminal: ${otpData.emailOtp}`,
    };
  } catch (err) {
    console.error("❌ [Supabase Auth] Error communicating with Supabase:", err.message);

    // Final fallback to admin generate link
    const otpData = await generateSupabaseOtp(cleanEmail);
    console.log(`🔑 [Fallback Supabase OTP]: ${otpData.emailOtp}`);

    return {
      success: true,
      verificationType: otpData.verificationType || "magiclink",
      message: `Verification code generated via Supabase.`,
    };
  }
}

/**
 * Verify OTP code entered by the user via Supabase Auth
 * Validates against Supabase's official POST /auth/v1/verify endpoint
 */
export async function verifyEmailOtp(email, token, verificationType = "email") {
  const { url, key } = getSupabaseConfig();
  const cleanEmail = String(email || "").trim().toLowerCase();
  // Strip any non-alphanumeric characters, spaces, or dashes
  const cleanToken = String(token || "").replace(/[^0-9a-zA-Z]/g, "").trim();

  if (!url || !key) {
    throw new Error(
      "Supabase credentials (SUPABASE_URL & SUPABASE_SERVICE_ROLE_KEY) are missing in environment variables."
    );
  }

  if (!cleanToken) {
    throw new Error("Please enter a valid verification code.");
  }

  console.log(`🔍 [Supabase Auth] Verifying OTP code for email: ${cleanEmail}`);

  // Try the primary verification type first, followed by valid Supabase OTP types
  const typesToTry = [verificationType, "email", "magiclink", "signup"];
  const uniqueTypes = [...new Set(typesToTry.filter(Boolean))];

  let lastError = null;

  for (const type of uniqueTypes) {
    try {
      const res = await fetch(`${url}/auth/v1/verify`, {
        method: "POST",
        headers: {
          apikey: key,
          Authorization: `Bearer ${key}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          type,
          email: cleanEmail,
          token: cleanToken,
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (res.ok) {
        console.log(`✅ [Supabase Auth] OTP verified successfully (${type}) for ${cleanEmail}`);
        return { success: true, data };
      }

      lastError = data.msg || data.error_description || data.message;
    } catch (err) {
      lastError = err.message;
    }
  }

  console.warn(`⚠️ [Supabase Auth] Verification failed for ${cleanEmail}:`, lastError);
  throw new Error(lastError || "The OTP code is invalid or has expired.");
}
