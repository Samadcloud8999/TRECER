import {
  authenticate,
  sameOrigin,
  body,
  UUID,
  check,
  limit,
} from "../server/cloud.js";
import { dispatchMessage } from "../server/delivery.js";
export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") return res.status(405).end();
  if (!sameOrigin(req)) return res.status(403).end();
  try {
    const { db, user } = await authenticate(req);
    await limit(db, req, "notify-" + user.id, 450);
    const { id, messageId } = body(req);
    if (!UUID.test(messageId || ""))
      return res.status(400).json({ error: "Неверное сообщение" });
    const row = check(
      await db
        .from("messages")
        .select("id")
        .eq("id", messageId)
        .eq("sender_id", user.id)
        .single(),
    );
    return res.json({ sent: await dispatchMessage(db, row.id) });
  } catch (e) {
    return res.status(400).json({ error: e.message });
  }
}
