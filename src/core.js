export const TZ = "Asia/Bishkek";
export function localStamp(now = new Date()) {
  const p = new Intl.DateTimeFormat("sv-SE", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(now);
  return p.replace(" ", "T");
}
export const today = () => localStamp().slice(0, 10);
export const money = (n) =>
  new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 2 }).format(n || 0) +
  " сом";
export function asUTC(local) {
  return new Date(local + "+06:00").getTime();
}
export function occurrence(r, now = new Date()) {
  const stamp = localStamp(now);
  if (!r.enabled) return null;
  if (r.repeat === "daily") {
    const key = stamp.slice(0, 10);
    return { key, due: asUTC(key + "T" + r.time) };
  }
  return { key: r.date, due: asUTC(r.date + "T" + r.time) };
}
export function dueReminder(r, now = new Date()) {
  const o = occurrence(r, now);
  return o && r.fired !== o.key && now.getTime() >= o.due ? o : null;
}
export function totals(records, date) {
  const rows = records.filter((r) => !date || r.date === date);
  return {
    expense: rows
      .filter((r) => r.kind === "expense")
      .reduce((s, r) => s + r.amount, 0),
    saving: rows
      .filter((r) => r.kind === "saving")
      .reduce((s, r) => s + r.amount, 0),
  };
}
export const categories = [
  "Продукты",
  "Кафе",
  "Транспорт",
  "Покупки",
  "Дом",
  "Здоровье",
  "Другое",
];
