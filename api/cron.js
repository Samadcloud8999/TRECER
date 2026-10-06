import { ready, redis, configurePush } from "../server/push.js";
export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (
    !process.env.CRON_SECRET ||
    req.headers.authorization !== "Bearer " + process.env.CRON_SECRET
  )
    return res.status(401).end();
  if (!ready())
    return res.status(503).json({ error: "Push server not configured" });
  try {
    const now = Date.now();
    const members = await redis(
      "ZRANGEBYSCORE",
      "karman:queue",
      "-inf",
      now,
      "LIMIT",
      0,
      100,
    );
    const push = configurePush();
    let sent = 0;
    for (const member of members) {
      const lock = "karman:lock:" + member;
      if (!(await redis("SET", lock, "1", "NX", "EX", 120))) continue;
      try {
        const split = member.lastIndexOf(":");
        const key = member.slice(0, split),
          id = member.slice(split + 1);
        const device = JSON.parse((await redis("GET", key)) || "null");
        const r = device?.reminders.find((r) => r.id === id);
        if (!r || !r.enabled) {
          await redis("ZREM", "karman:queue", member);
          continue;
        }
        const score = Number(await redis("ZSCORE", "karman:queue", member));
        if (score > now) continue;
        await push.sendNotification(
          device.subscription,
          JSON.stringify({
            id: r.id,
            title: r.title,
            body: r.body || "Пора записать расходы",
            tag: r.id + "-" + score,
          }),
          { TTL: 3600 },
        );
        sent++;
        if (r.repeat === "daily") {
          let next = score + 86400000;
          while (next <= now) next += 86400000;
          await redis("ZADD", "karman:queue", next, member);
        } else await redis("ZREM", "karman:queue", member);
      } catch (e) {
        if (e.statusCode === 410 || e.statusCode === 404)
          await redis("ZREM", "karman:queue", member);
        console.error("Delivery failed", e.statusCode || e.message);
      } finally {
        await redis("DEL", lock);
      }
    }
    return res.json({ sent });
  } catch (e) {
    console.error("Scheduler failed", e.message);
    return res.status(500).json({ error: "Scheduler unavailable" });
  }
}
