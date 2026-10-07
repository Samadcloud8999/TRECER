import {
  database,
  check,
  body,
  sameOrigin,
  equal,
  limit,
  makeAdminCookie,
  validAdminCookie,
  UUID,
} from "../server/cloud.js";
export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("X-Content-Type-Options", "nosniff");
  if (!sameOrigin(req))
    return res.status(403).json({ error: "Недопустимый источник" });
  const action = req.query.action || "users";
  try {
    const db = database();
    if (action === "login" && req.method === "POST") {
      await limit(db, req, "admin-login", 10);
      const data = body(req);
      if (!process.env.ADMIN_PASSWORD)
        throw Error("Настрой пароль администратора на Vercel");
      if (
        !equal(data.username, process.env.ADMIN_USERNAME || "ADMIN") ||
        !equal(data.password, process.env.ADMIN_PASSWORD)
      )
        return res.status(401).json({ error: "Неверный логин или пароль" });
      res.setHeader(
        "Set-Cookie",
        `karman_admin=${makeAdminCookie()}; HttpOnly; Secure; SameSite=Strict; Path=/api; Max-Age=3600`,
      );
      return res.json({ ok: true });
    }
    if (action === "logout" && req.method === "POST") {
      res.setHeader(
        "Set-Cookie",
        "karman_admin=; HttpOnly; Secure; SameSite=Strict; Path=/api; Max-Age=0",
      );
      return res.json({ ok: true });
    }
    const token = req.headers.cookie
      ?.split(";")
      .map((x) => x.trim())
      .find((x) => x.startsWith("karman_admin="))
      ?.slice(13);
    if (!validAdminCookie(token))
      return res.status(401).json({ error: "Войди в админку" });
    if (action === "users" && req.method === "GET") {
      const users = check(await db.rpc("admin_users"));
      const stats = check(await db.rpc("admin_stats"));
      return res.json({ users, ...stats });
    }
    if (action === "photos" && req.method === "GET") {
      const uid = req.query.user;
      if (!UUID.test(uid || "")) return res.status(400).end();
      const entries = check(
        await db
          .from("entries")
          .select("id,kind,payload")
          .eq("owner_id", uid)
          .order("created_at", { ascending: false })
          .limit(200),
      );
      const photos = [];
      for (const row of entries) {
        const path = row.payload.photo;
        if (typeof path === "string" && path.startsWith("cloud:")) {
          const url = check(
            await db.storage.from("media").createSignedUrl(path.slice(6), 120),
          ).signedUrl;
          photos.push({
            id: row.id,
            title: row.payload.title,
            date: row.payload.date,
            kind: row.kind,
            url,
          });
        }
      }
      return res.json({ photos });
    }
    return res.status(405).end();
  } catch (e) {
    return res.status(400).json({ error: e.message });
  }
}
