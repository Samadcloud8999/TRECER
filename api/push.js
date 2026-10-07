import {
  database,
  check,
  authenticate,
  sameOrigin,
  body,
  limit,
} from "../server/cloud.js";
import { pushReady, validEndpoint } from "../server/delivery.js";
export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method === "GET" && req.query.action === "key") {
    if (!pushReady())
      return res.status(503).json({ error: "Настрой VAPID-ключи на Vercel" });
    return res.json({ publicKey: process.env.VAPID_PUBLIC_KEY });
  }
  if (!["POST", "DELETE", "PUT"].includes(req.method))
    return res.status(405).end();
  if (!sameOrigin(req))
    return res.status(403).json({ error: "Недопустимый источник" });
  try {
    const { db, user } = await authenticate(req);
    const data = body(req);
    if (req.method === "PUT") return res.json({ ok: true });
    if (req.method === "DELETE") {
      let query = db
        .from("push_subscriptions")
        .delete()
        .eq("owner_id", user.id);
      if (data.endpoint) query = query.eq("endpoint", data.endpoint);
      else if (!data.allDevice)
        return res.status(400).json({ error: "Укажи устройство" });
      check(await query);
      return res.json({ ok: true });
    }
    await limit(db, req, "push-register-" + user.id, 100);
    const sub = data.subscription;
    if (
      !validEndpoint(sub?.endpoint) ||
      !sub?.keys?.p256dh ||
      !sub?.keys?.auth ||
      JSON.stringify(sub).length > 8192
    )
      return res.status(400).json({ error: "Недопустимая push-подписка" });
    const existing = check(
      await db
        .from("push_subscriptions")
        .select("id,owner_id")
        .eq("endpoint", sub.endpoint)
        .maybeSingle(),
    );
    if (existing && existing.owner_id !== user.id)
      return res.status(409).json({
        error: "Отключи уведомления предыдущего аккаунта на этом устройстве",
      });
    check(
      await db.from("push_subscriptions").upsert(
        {
          ...(existing ? { id: existing.id } : {}),
          owner_id: user.id,
          endpoint: sub.endpoint,
          subscription: sub,
        },
        { onConflict: "endpoint" },
      ),
    );
    return res.json({ ok: true });
  } catch (e) {
    return res.status(400).json({ error: e.message });
  }
}
