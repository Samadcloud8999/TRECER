import {
  ready,
  redis,
  deviceKey,
  cleanReminders,
  schedule,
} from "../server/push.js";
export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (!ready())
    return res.status(503).json({ error: "Push server not configured" });
  if (req.method === "GET" && req.query.action === "key")
    return res.json({ publicKey: process.env.VAPID_PUBLIC_KEY });
  if (!["POST", "PUT", "DELETE"].includes(req.method))
    return res.status(405).end();
  const origin = req.headers.origin;
  const host = req.headers.host;
  if (origin && new URL(origin).host !== host)
    return res.status(403).json({ error: "Invalid origin" });
  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
    if (
      !body ||
      typeof body.token !== "string" ||
      !/^[a-zA-Z0-9-]{60,100}$/.test(body.token)
    )
      return res.status(400).json({ error: "Invalid device token" });
    const key = deviceKey(body.token);
    const previous = JSON.parse((await redis("GET", key)) || "null");
    if (req.method === "DELETE") {
      if (previous) {
        for (const r of previous.reminders)
          await redis("ZREM", "karman:queue", key + ":" + r.id);
        await redis("DEL", key);
      }
      return res.json({ ok: true });
    }
    const reminders = cleanReminders(body.reminders);
    const subscription =
      req.method === "POST" ? body.subscription : previous?.subscription;
    if (!subscription)
      return res.status(404).json({ error: "Device not registered" });
    const endpoint = new URL(subscription.endpoint);
    const allowed = [
      "fcm.googleapis.com",
      "updates.push.services.mozilla.com",
      "web.push.apple.com",
      "wns.windows.com",
      "notify.windows.com",
    ];
    if (
      endpoint.protocol !== "https:" ||
      !allowed.some(
        (h) => endpoint.hostname === h || endpoint.hostname.endsWith("." + h),
      ) ||
      !subscription.keys?.p256dh ||
      !subscription.keys?.auth
    )
      return res.status(400).json({ error: "Unsupported push endpoint" });
    if (req.method === "POST") {
      const bucket =
        "karman:limit:" +
        String(req.headers["x-forwarded-for"] || "local").split(",")[0];
      const n = await redis("INCR", bucket);
      if (n === 1) await redis("EXPIRE", bucket, 3600);
      if (n > 20)
        return res.status(429).json({ error: "Too many subscriptions" });
    }
    await redis(
      "SET",
      key,
      JSON.stringify({ subscription, reminders }),
      "EX",
      31536000,
    );
    if (previous)
      for (const r of previous.reminders)
        await redis("ZREM", "karman:queue", key + ":" + r.id);
    await schedule(key, reminders);
    return res.json({ ok: true });
  } catch (e) {
    console.error("Push update failed", e.message);
    return res.status(400).json({ error: "Unable to update push settings" });
  }
}
