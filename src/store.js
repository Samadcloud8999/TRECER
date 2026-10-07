import * as local from "./local-store.js";
import { supabase, getUser, check } from "./cloud.js";
const empty = () => ({
  records: [],
  places: [],
  reminders: [],
  settings: { goal: 50000 },
});
let baseline = empty();
let baselineUser;
export async function readData() {
  const u = getUser();
  if (!u) return local.readData();
  const [entries, reminders, settings] = await Promise.all([
    supabase.from("entries").select("payload,kind").eq("owner_id", u.id),
    supabase
      .from("reminders")
      .select("payload,created_by,enabled")
      .eq("owner_id", u.id),
    supabase
      .from("diary_settings")
      .select("payload")
      .eq("owner_id", u.id)
      .single(),
  ]);
  const rows = check(entries),
    rs = check(reminders);
  const data = {
    records: rows.filter((r) => r.kind !== "place").map((r) => r.payload),
    places: rows.filter((r) => r.kind === "place").map((r) => r.payload),
    reminders: rs.map((r) => ({
      ...r.payload,
      enabled: r.enabled,
      fromFriend: r.created_by !== u.id ? r.created_by : undefined,
    })),
    settings: check(settings)?.payload || { goal: 50000 },
  };
  baseline = structuredClone(data);
  baselineUser = u.id;
  return data;
}
export async function saveData(s) {
  const u = getUser();
  if (!u) return local.saveData(s);
  if (baselineUser !== u.id) throw Error("Обнови страницу перед сохранением");
  const rows = [...s.records, ...s.places],
    old = [...baseline.records, ...baseline.places];
  const removed = old
    .filter((r) => !rows.some((x) => x.id === r.id))
    .map((r) => r.id);
  const changed = rows.filter(
    (r) => JSON.stringify(r) !== JSON.stringify(old.find((x) => x.id === r.id)),
  );
  const reminders = s.reminders
    .filter(
      (r) =>
        JSON.stringify(r) !==
        JSON.stringify(baseline.reminders.find((x) => x.id === r.id)),
    )
    .map((r) => {
      const payload = { ...r };
      delete payload.fromFriend;
      return payload;
    });
  const deleted = baseline.reminders
    .filter((r) => !s.reminders.some((x) => x.id === r.id))
    .map((r) => r.id);
  check(
    await supabase.rpc("save_diary_delta", {
      changed_entries: changed,
      deleted_entries: removed,
      changed_reminders: reminders,
      deleted_reminders: deleted,
      settings_payload:
        JSON.stringify(s.settings) !== JSON.stringify(baseline.settings)
          ? s.settings
          : null,
    }),
  );
  baseline = structuredClone(s);
  return s;
}
export async function saveMedia(file, folder = "diary") {
  const u = getUser();
  if (!u) return local.saveMedia(file);
  const path = u.id + "/" + folder + "/" + crypto.randomUUID();
  check(
    await supabase.storage
      .from("media")
      .upload(path, file, { contentType: file.type, upsert: false }),
  );
  return "cloud:" + path;
}
export async function getMedia(id) {
  if (!id) return null;
  if (id.startsWith("cloud:"))
    return check(await supabase.storage.from("media").download(id.slice(6)));
  return local.getMedia(id);
}
export async function mediaURL(path) {
  return check(
    await supabase.storage
      .from("media")
      .createSignedUrl(path.startsWith("cloud:") ? path.slice(6) : path, 300),
  ).signedUrl;
}
export async function dropMedia(id) {
  if (!id) return;
  if (id.startsWith("cloud:"))
    check(await supabase.storage.from("media").remove([id.slice(6)]));
  else await local.dropMedia(id);
}
export async function backup(state) {
  if (!getUser()) return local.backup(state);
  const ids = new Set(
      [...state.records, ...state.places]
        .map((r) => r.photo)
        .concat(state.reminders.map((r) => r.sound))
        .filter(Boolean),
    ),
    media = {};
  for (const id of ids) {
    const blob = await getMedia(id);
    if (blob)
      media[id] = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
  }
  return { version: 1, state, media };
}
async function validateBackup(p) {
  if (
    p.version !== 1 ||
    !Array.isArray(p.state?.records) ||
    !Array.isArray(p.state?.places) ||
    !Array.isArray(p.state?.reminders) ||
    !Number.isFinite(p.state.settings?.goal) ||
    p.state.settings.goal <= 0
  )
    throw Error("Неверная резервная копия");
  for (const r of [...p.state.records, ...p.state.places])
    if (
      !r.id ||
      !r.title ||
      !Number.isFinite(r.amount) ||
      !["expense", "saving", "place"].includes(r.kind)
    )
      throw Error("Неверная запись");
  for (const url of Object.values(p.media || {}))
    if (typeof url !== "string" || !/^data:(image\/|audio\/)/.test(url))
      throw Error("Неверный медиафайл");
}
export async function restore(payload) {
  if (!getUser()) return local.restore(payload);
  await validateBackup(payload);
  const mapped = structuredClone(payload.state),
    uploaded = [];
  for (const r of [...mapped.records, ...mapped.places, ...mapped.reminders]) {
    r.id = crypto.randomUUID();
    delete r.fromFriend;
  }
  try {
    for (const [id, url] of Object.entries(payload.media || {})) {
      const blob = await fetch(url).then((r) => r.blob()),
        next = await saveMedia(blob);
      uploaded.push(next);
      for (const r of [...mapped.records, ...mapped.places])
        if (r.photo === id) r.photo = next;
      for (const r of mapped.reminders) if (r.sound === id) r.sound = next;
    }
    await saveData(mapped);
    return mapped;
  } catch (e) {
    for (const id of uploaded) await dropMedia(id).catch(() => {});
    throw e;
  }
}
export async function migrateLocal() {
  const state = await local.readData();
  if (!getUser()) throw Error("Сначала войди");
  if (
    baseline.records.length ||
    baseline.places.length ||
    baseline.reminders.length
  )
    throw Error(
      "Перенос доступен в пустой аккаунт. Используй резервную копию для замены.",
    );
  const mapped = structuredClone(state),
    ids = new Set(
      [...mapped.records, ...mapped.places]
        .map((r) => r.photo)
        .concat(mapped.reminders.map((r) => r.sound))
        .filter(Boolean),
    ),
    uploads = [];
  try {
    for (const id of ids) {
      const blob = await local.getMedia(id);
      if (!blob) continue;
      const next = await saveMedia(blob);
      uploads.push(next);
      for (const r of [...mapped.records, ...mapped.places])
        if (r.photo === id) r.photo = next;
      for (const r of mapped.reminders) if (r.sound === id) r.sound = next;
    }
    await saveData(mapped);
    return mapped;
  } catch (e) {
    for (const id of uploads) await dropMedia(id).catch(() => {});
    throw e;
  }
}
