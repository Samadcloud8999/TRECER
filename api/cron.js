import { dispatchAll } from "../server/delivery.js";
import { equal } from "../server/cloud.js";
export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (
    !process.env.CRON_SECRET ||
    !equal(req.headers.authorization, "Bearer " + process.env.CRON_SECRET)
  )
    return res.status(401).end();
  try {
    return res.json({ sent: await dispatchAll() });
  } catch (e) {
    return res.status(503).json({ error: e.message });
  }
}
