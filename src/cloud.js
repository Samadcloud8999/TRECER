import { createClient } from "@supabase/supabase-js";
const env = import.meta.env || {};
export const cloudConfigured = !!(
  env.VITE_SUPABASE_URL && env.VITE_SUPABASE_ANON_KEY
);
export const supabase = cloudConfigured
  ? createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY, {
      auth: {
        flowType: "pkce",
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  : null;
let user;
export const getUser = () => user;
export const setUser = (u) => {
  user = u;
};
export function check(result) {
  if (result.error) throw result.error;
  return result.data;
}
export async function api(path, options = {}) {
  const session = supabase
    ? check(await supabase.auth.getSession())?.session
    : null;
  const response = await fetch(path, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(session ? { Authorization: "Bearer " + session.access_token } : {}),
      ...options.headers,
    },
  });
  const d = await response.json().catch(() => ({}));
  if (!response.ok) {
    const e = Error(d.error || "Ошибка сервера");
    e.status = response.status;
    throw e;
  }
  return d;
}
export const friendlyError = (e) =>
  e?.code === "23505"
    ? "Этот никнейм или похожий на него уже занят."
    : e?.message || "Не удалось выполнить действие";
