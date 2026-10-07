import webpush from "web-push";
import { randomUUID } from "node:crypto";
import { database, check } from "./cloud.js";
export function pushReady() {
  return !!(
    process.env.VAPID_SUBJECT &&
    process.env.VAPID_PRIVATE_KEY &&
    process.env.VAPID_PUBLIC_KEY
  );
}
export function validEndpoint(endpoint) {
  try {
    const u = new URL(endpoint);
    return (
      u.protocol === "https:" &&
      [
        "fcm.googleapis.com",
        "updates.push.services.mozilla.com",
        "web.push.apple.com",
        "wns.windows.com",
        "notify.windows.com",
      ].some((h) => u.hostname === h || u.hostname.endsWith("." + h))
    );
  } catch {
    return false;
  }
}
export async function sendUser(db, uid, data) {
  if (!pushReady()) throw Error("Настрой VAPID-ключи");
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT,
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY,
  );
  const rows = check(
    await db.from("push_subscriptions").select("*").eq("owner_id", uid),
  );
  let retry = false,
    sent = 0;
  for (const row of rows) {
    if (!validEndpoint(row.endpoint)) {
      await db.from("push_subscriptions").delete().eq("id", row.id);
      continue;
    }
    try {
      await webpush.sendNotification(row.subscription, JSON.stringify(data), {
        TTL: 86400,
      });
      sent++;
    } catch (e) {
      if ([404, 410].includes(e.statusCode))
        await db.from("push_subscriptions").delete().eq("id", row.id);
      else retry = true;
    }
  }
  return { retry, sent };
}
export async function deliverItem(db, worker, item, kind) {
  const payload =
    kind === "message"
      ? {
          title: item.title,
          body: item.body,
          url: item.url,
          tag: item.tag,
          type: "chat",
        }
      : {
          title: item.payload.title,
          body: item.payload.body || "Пора записать расходы",
          url: "/events",
          tag: "reminder-" + item.id + "-" + item.next_due,
          type: "reminder",
          id: item.id,
        };
  const result = await sendUser(db, item.owner_id, payload);
  if (!result.retry)
    check(
      await db.rpc("complete_notification", { worker, item: item.id, kind }),
    );
  return result.sent;
}
export async function dispatchAll() {
  if (!pushReady()) throw Error("Настрой VAPID-ключи");
  const db = database(),
    worker = randomUUID(),
    batch = check(await db.rpc("claim_notifications", { worker }));
  let sent = 0;
  for (const r of batch.reminders)
    sent += await deliverItem(db, worker, r, "reminder");
  for (const m of batch.messages)
    sent += await deliverItem(db, worker, m, "message");
  return sent;
}
export async function dispatchMessage(db, id) {
  const worker = randomUUID(),
    item = check(await db.rpc("claim_message", { worker, msg: id }));
  return item ? deliverItem(db, worker, item, "message") : 0;
}
