import webpush from "web-push";
import { createHash } from "node:crypto";
import { localStamp, asUTC } from "../src/core.js";
export function ready() {
  return [
    "UPSTASH_REDIS_REST_URL",
    "UPSTASH_REDIS_REST_TOKEN",
    "VAPID_PUBLIC_KEY",
    "VAPID_PRIVATE_KEY",
    "VAPID_SUBJECT",
  ].every((k) => process.env[k]);
}
export async function redis(...args) {
  const r = await fetch(process.env.UPSTASH_REDIS_REST_URL, {
    method: "POST",
    headers: {
      Authorization: "Bearer " + process.env.UPSTASH_REDIS_REST_TOKEN,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(args),
  });
  if (!r.ok) throw Error("Storage unavailable");
  const d = await r.json();
  if (d.error) throw Error(d.error);
  return d.result;
}
export const deviceKey = (token) =>
  "karman:device:" + createHash("sha256").update(token).digest("hex");
export function cleanReminders(rows) {
  if (!Array.isArray(rows) || rows.length > 100)
    throw Error("Maximum 100 reminders");
  return rows.map((r) => {
    if (
      typeof r.id !== "string" ||
      !r.id.match(/^[a-zA-Z0-9-]{1,80}$/) ||
      typeof r.title !== "string" ||
      r.title.length > 120 ||
      !/^\d{2}:\d{2}$/.test(r.time) ||
      +r.time.slice(0, 2) > 23 ||
      +r.time.slice(3) > 59 ||
      !["once", "daily"].includes(r.repeat) ||
      !/^\d{4}-\d{2}-\d{2}$/.test(r.date)
    )
      throw Error("Invalid reminder");
    return {
      id: r.id,
      title: r.title,
      body: String(r.body || "").slice(0, 400),
      date: r.date,
      time: r.time,
      repeat: r.repeat,
      enabled: !!r.enabled,
      fired: r.fired,
    };
  });
}
export function nextDue(r, now = Date.now()) {
  if (!r.enabled) return null;
  if (r.repeat === "once") {
    if (r.fired === r.date) return null;
    const n = asUTC(r.date + "T" + r.time);
    return Number.isFinite(n) ? n : null;
  }
  const day = localStamp(new Date(now)).slice(0, 10);
  let n = asUTC(day + "T" + r.time);
  if (n < now || r.fired === day) n += 86400000;
  return n;
}
export async function schedule(key, rows) {
  for (const r of rows) {
    const due = nextDue(r);
    const member = key + ":" + r.id;
    await redis("ZREM", "karman:queue", member);
    if (due !== null) await redis("ZADD", "karman:queue", due, member);
  }
}
export function configurePush() {
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT,
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY,
  );
  return webpush;
}
