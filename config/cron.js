import cron from "node-cron";

/**
 * Initializes scheduled cron jobs for the backend server.
 * Includes automated keep-alive pings to prevent free hosting
 * providers (Render, Railway, Koyeb, Glitch) from spinning down.
 */
export function initCronJobs() {
  const serverUrl = process.env.SERVER_URL || process.env.RENDER_EXTERNAL_URL;
  // Default to every 14 minutes (standard Render free-tier inactivity timeout is 15 minutes)
  const scheduleExpr = process.env.KEEP_ALIVE_SCHEDULE || "*/14 * * * *";

  if (!serverUrl) {
    console.log(
      "[Keep-Alive Cron] SERVER_URL or RENDER_EXTERNAL_URL is not set. Keep-alive pings are paused locally."
    );
    console.log(
      "[Keep-Alive Cron] To activate in production, add SERVER_URL=https://your-service.onrender.com to your .env"
    );
    return;
  }

  if (!cron.validate(scheduleExpr)) {
    console.error(`[Keep-Alive Cron] Invalid cron schedule expression: "${scheduleExpr}"`);
    return;
  }

  const endpoint = `${serverUrl.replace(/\/+$/, "")}/health`;
  console.log(`[Keep-Alive Cron] Scheduled keep-alive ping for ${endpoint} with schedule: "${scheduleExpr}"`);

  cron.schedule(scheduleExpr, async () => {
    try {
      const startTime = Date.now();
      const response = await fetch(endpoint, {
        headers: { "User-Agent": "A2V-KeepAlive-Cron/1.0" },
      });
      const duration = Date.now() - startTime;
      console.log(
        `[Keep-Alive Cron] Ping successful -> ${endpoint} [${response.status} ${response.statusText}] (${duration}ms)`
      );
    } catch (error) {
      console.warn(`[Keep-Alive Cron] Ping attempt encountered an issue: ${error.message}`);
    }
  });
}
