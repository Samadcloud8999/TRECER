import { openDB } from "idb";
const db = openDB("karman-v1", 1, {
  upgrade(d) {
    d.createObjectStore("data");
    d.createObjectStore("media");
  },
});
export const readData = async () =>
  (await (await db).get("data", "state")) || {
    records: [],
    places: [],
    reminders: [],
    settings: { goal: 50000 },
  };
export const saveData = async (s) => (await db).put("data", s, "state");
export const saveMedia = async (file) => {
  const id = crypto.randomUUID();
  await (await db).put("media", file, id);
  return id;
};
export const getMedia = async (id) => (await db).get("media", id);
export const dropMedia = async (id) => id && (await db).delete("media", id);
export async function backup(state) {
  const entries = await (await db).getAllKeys("media");
  const media = {};
  for (const id of entries) {
    const blob = await getMedia(id);
    media[id] = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }
  return { version: 1, state, media };
}
export async function restore(payload) {
  if (
    payload.version !== 1 ||
    !Array.isArray(payload.state?.records) ||
    !Array.isArray(payload.state?.places) ||
    !Array.isArray(payload.state?.reminders) ||
    !Number.isFinite(payload.state?.settings?.goal) ||
    payload.state.settings.goal <= 0
  )
    throw Error("Неверный формат резервной копии");
  const all = [...payload.state.records, ...payload.state.places];
  for (const r of all) {
    if (
      typeof r.id !== "string" ||
      typeof r.title !== "string" ||
      !["expense", "saving", "place"].includes(r.kind) ||
      !Number.isFinite(r.amount) ||
      (r.kind !== "place" && r.amount <= 0) ||
      !/^\d{4}-\d{2}-\d{2}$/.test(r.date)
    )
      throw Error("Некорректные записи");
    if (
      r.location &&
      (!Number.isFinite(r.location.lat) ||
        !Number.isFinite(r.location.lng) ||
        Math.abs(r.location.lat) > 90 ||
        Math.abs(r.location.lng) > 180)
    )
      throw Error("Некорректная геопозиция");
  }
  for (const r of payload.state.reminders) {
    if (
      typeof r.id !== "string" ||
      typeof r.title !== "string" ||
      !["daily", "once"].includes(r.repeat) ||
      !/^([01]\d|2[0-3]):[0-5]\d$/.test(r.time) ||
      !/^\d{4}-\d{2}-\d{2}$/.test(r.date)
    )
      throw Error("Некорректное событие");
  }
  const media = [];
  for (const [id, url] of Object.entries(payload.media || {})) {
    if (typeof url !== "string" || !/^data:(image\/|audio\/)/.test(url))
      throw Error("Некорректный медиафайл");
    media.push([id, await fetch(url).then((r) => r.blob())]);
  }
  const database = await db;
  const tx = database.transaction(["data", "media"], "readwrite");
  await tx.objectStore("media").clear();
  for (const [id, blob] of media) await tx.objectStore("media").put(blob, id);
  await tx.objectStore("data").put(payload.state, "state");
  await tx.done;
  return payload.state;
}
