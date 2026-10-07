import { createClient } from "@supabase/supabase-js";
import { createHash, timingSafeEqual, createHmac } from "node:crypto";
export function database() {
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY)
    throw Error("Настрой Supabase на сервере");
  return createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}
export function check(r) {
  if (r.error) throw r.error;
  return r.data;
}
export function equal(a, b) {
  return timingSafeEqual(
    createHash("sha256").update(String(a)).digest(),
    createHash("sha256").update(String(b)).digest(),
  );
}
export function sameOrigin(req) {
  if (!req.headers.origin) return true;
  try {
    return new URL(req.headers.origin).host === req.headers.host;
  } catch {
    return false;
  }
}
export async function authenticate(req) {
  const token = req.headers.authorization?.replace(/^Bearer /, "");
  if (!token) throw Error("Требуется вход");
  const db = database(),
    { data, error } = await db.auth.getUser(token);
  if (error || !data.user) throw Error("Сессия истекла");
  return { db, user: data.user };
}
export function body(req) {
  return typeof req.body === "string" ? JSON.parse(req.body) : req.body || {};
}
export const UUID =
  /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
export function makeAdminCookie(now = Date.now()) {
  if (
    !process.env.ADMIN_SESSION_SECRET ||
    process.env.ADMIN_SESSION_SECRET.length < 32
  )
    throw Error("Настрой ADMIN_SESSION_SECRET");
  const payload = Buffer.from(
    JSON.stringify({ exp: now + 3600000, role: "admin" }),
  ).toString("base64url");
  return (
    payload +
    "." +
    createHmac("sha256", process.env.ADMIN_SESSION_SECRET)
      .update(payload)
      .digest("base64url")
  );
}
export function validAdminCookie(token, now = Date.now()) {
  if (!process.env.ADMIN_SESSION_SECRET || !token) return false;
  try {
    const [p, s] = token.split(".");
    const expected = createHmac("sha256", process.env.ADMIN_SESSION_SECRET)
      .update(p)
      .digest("base64url");
    if (!equal(s, expected)) return false;
    const d = JSON.parse(Buffer.from(p, "base64url").toString());
    return d.role === "admin" && Number.isFinite(d.exp) && d.exp > now;
  } catch {
    return false;
  }
}
export async function limit(db, req, scope, max) {
  const ip = String(req.headers["x-forwarded-for"] || "local").split(",")[0];
  const key = createHash("sha256")
    .update(scope + ":" + ip)
    .digest("hex");
  if (check(await db.rpc("admin_rate", { key_hash: key })) > max)
    throw Error("Слишком много попыток. Подожди 15 минут.");
}
