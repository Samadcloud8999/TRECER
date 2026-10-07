import { readFileSync, existsSync } from "node:fs";
const vars = { ...process.env };
for (const path of [".env", ".env.local"])
  if (existsSync(path)) {
    for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
      const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
      if (match) vars[match[1]] = match[2].replace(/^['"]|['"]$/g, "");
    }
  }
const publicNames = ["VITE_SUPABASE_URL", "VITE_SUPABASE_ANON_KEY"];
const privateNames = [
  "SUPABASE_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
  "VAPID_PUBLIC_KEY",
  "VAPID_PRIVATE_KEY",
  "VAPID_SUBJECT",
  "CRON_SECRET",
  "ADMIN_PASSWORD",
  "ADMIN_SESSION_SECRET",
];
const missing = publicNames.filter((k) => !vars[k]);
if (missing.length)
  console.log(
    "Облако пока не настроено. Будет открыт локальный дневник. Не хватает: " +
      missing.join(", "),
  );
else console.log("Клиентские настройки облака найдены.");
const server = privateNames.filter((k) => !vars[k]);
if (server.length)
  console.log("Для Vercel Functions проверь: " + server.join(", "));
if (vars.ADMIN_SESSION_SECRET && vars.ADMIN_SESSION_SECRET.length < 32)
  console.log(
    "ADMIN_SESSION_SECRET должен содержать не меньше 32 случайных символов.",
  );
if (
  vars.VITE_SUPABASE_ANON_KEY === vars.SUPABASE_SERVICE_ROLE_KEY &&
  vars.SUPABASE_SERVICE_ROLE_KEY
) {
  console.error(
    "Нельзя использовать service-role ключ в VITE_SUPABASE_ANON_KEY!",
  );
  process.exitCode = 1;
}
console.log("Полная инструкция: SETUP.md. Значения секретов не выводятся.");
