import { useState, useEffect, useMemo, useRef } from "react";
import { NavLink, Routes, Route, useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Wallet,
  LayoutDashboard,
  Receipt,
  Landmark,
  MapPin,
  Heart,
  CalendarDays,
  CloudSun,
  Settings,
  Plus,
  ArrowUpRight,
  ArrowDownLeft,
  Camera,
  ImagePlus,
  X,
  Pencil,
  Trash2,
  Bell,
  Check,
  Download,
  Upload,
  Volume2,
  LocateFixed,
  Menu,
  ChevronRight,
  Search,
  Target,
} from "lucide-react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import {
  today,
  localStamp,
  money,
  totals,
  categories,
  dueReminder,
} from "./core";
import {
  readData,
  saveData,
  saveMedia,
  getMedia,
  dropMedia,
  backup,
  restore,
} from "./store";
import {
  requestNotifications,
  playSound,
  showNotification,
  unlockAudio,
  stopSound,
  enablePush,
  syncPush,
  pushToken,
  disablePush,
} from "./notifications";
import Orbit from "./Orbit";
import Map from "./Map";
import Weather from "./Weather";
const nav = [
  ["/", "Обзор", LayoutDashboard],
  ["/expenses", "Расходы", Receipt],
  ["/savings", "Накопления", Landmark],
  ["/map", "Карта", MapPin],
  ["/places", "Мои места", Heart],
  ["/events", "События", CalendarDays],
  ["/weather", "Погода", CloudSun],
  ["/settings", "Настройки", Settings],
];
const colors = [
  "#203b31",
  "#b9d879",
  "#ecad70",
  "#7699ba",
  "#b7abd0",
  "#83baa9",
  "#d7dbe0",
];
function Photo({ id, className = "", alt = "Фото" }) {
  const [url, setUrl] = useState();
  useEffect(() => {
    let active = true,
      created;
    getMedia(id).then((blob) => {
      if (blob && active) {
        created = URL.createObjectURL(blob);
        setUrl(created);
      }
    });
    return () => {
      active = false;
      if (created) URL.revokeObjectURL(created);
    };
  }, [id]);
  return url ? <img className={className} src={url} alt={alt} /> : null;
}
function Modal({ title, children, onClose }) {
  useEffect(() => {
    const key = (e) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", key);
    const old = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = old;
      document.removeEventListener("keydown", key);
    };
  }, []);
  return (
    <motion.div
      className="overlay"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
    >
      <motion.section
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        initial={{ y: 24, scale: 0.98 }}
        animate={{ y: 0, scale: 1 }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="section-head">
          <h2>{title}</h2>
          <button className="icon-btn" aria-label="Закрыть" onClick={onClose}>
            <X />
          </button>
        </div>
        {children}
      </motion.section>
    </motion.div>
  );
}
function Empty({
  icon: Icon = Receipt,
  title = "Пока нет записей",
  text = "Добавь первую запись — здесь появится твоя история.",
}) {
  return (
    <div className="empty">
      <Icon size={34} />
      <h3>{title}</h3>
      <p>{text}</p>
    </div>
  );
}
function EntryForm({ initial, kind, onSave, onClose, notify }) {
  const [d, setD] = useState(
    initial || {
      kind,
      amount: "",
      title: "",
      category: categories[0],
      date: today(),
      time: localStamp().slice(11, 16),
    },
  );
  const [file, setFile] = useState();
  const [preview, setPreview] = useState();
  const [busy, setBusy] = useState(false);
  const [geoBusy, setGeoBusy] = useState(false);
  const [geoError, setGeoError] = useState("");
  const camera = useRef(),
    gallery = useRef();
  useEffect(() => {
    if (!file) return;
    const u = URL.createObjectURL(file);
    setPreview(u);
    return () => URL.revokeObjectURL(u);
  }, [file]);
  const set = (key, value) => setD((x) => ({ ...x, [key]: value }));
  function locate() {
    setGeoBusy(true);
    setGeoError("");
    if (!navigator.geolocation) {
      setGeoError("Геолокация недоступна");
      setGeoBusy(false);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (p) => {
        set("location", {
          lat: p.coords.latitude,
          lng: p.coords.longitude,
          accuracy: p.coords.accuracy,
          capturedAt: new Date().toISOString(),
        });
        setGeoBusy(false);
      },
      () => {
        setGeoError(
          "Не удалось получить точку. Разреши геолокацию или укажи координаты вручную.",
        );
        setGeoBusy(false);
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
    );
  }
  function choose(e) {
    const f = e.target.files?.[0];
    if (!f) return;
    if (!f.type.startsWith("image/")) return notify("Выбери изображение");
    if (f.size > 20 * 1024 * 1024)
      return notify("Фото должно быть меньше 20 МБ");
    setFile(f);
    if (!d.location) locate();
  }
  async function submit(e) {
    e.preventDefault();
    const amount = Number(String(d.amount).replace(",", "."));
    if (kind !== "place" && (!Number.isFinite(amount) || amount <= 0))
      return notify("Введи сумму больше нуля");
    if (kind === "place" && !file && !d.photo)
      return notify("Добавь фотографию места");
    if (
      d.location &&
      (!Number.isFinite(d.location.lat) ||
        !Number.isFinite(d.location.lng) ||
        Math.abs(d.location.lat) > 90 ||
        Math.abs(d.location.lng) > 180)
    )
      return notify("Проверь координаты");
    setBusy(true);
    let photo = d.photo;
    try {
      if (file) photo = await saveMedia(file);
      await onSave({
        ...d,
        id: d.id || crypto.randomUUID(),
        kind,
        amount: kind === "place" ? 0 : amount,
        photo,
        title:
          d.title.trim() ||
          (kind === "place"
            ? "Новое место"
            : kind === "saving"
              ? "Пополнение"
              : "Покупка"),
      });
      if (file && d.photo) await dropMedia(d.photo);
      onClose();
    } catch {
      if (file && photo) await dropMedia(photo);
      notify("Не удалось сохранить. Возможно, память устройства заполнена.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <form onSubmit={submit} className="form">
      {kind !== "place" && (
        <label>
          Сумма, сом
          <input
            autoFocus
            className="amount-input"
            required
            inputMode="decimal"
            placeholder="0"
            value={d.amount}
            onChange={(e) => set("amount", e.target.value)}
          />
        </label>
      )}
      <label>
        {kind === "place" ? "Название места" : "Что записать?"}
        <input
          autoFocus={kind === "place"}
          placeholder={
            kind === "saving"
              ? "Например, на поездку"
              : kind === "place"
                ? "Например, любимая кофейня"
                : "Название необязательно"
          }
          value={d.title}
          maxLength={180}
          onChange={(e) => set("title", e.target.value)}
        />
      </label>
      <div className="form-row">
        <label>
          Дата
          <input
            type="date"
            required
            value={d.date}
            onChange={(e) => set("date", e.target.value)}
          />
        </label>
        <label>
          Время в Бишкеке
          <input
            type="time"
            required
            value={d.time}
            onChange={(e) => set("time", e.target.value)}
          />
        </label>
      </div>
      {kind === "expense" && (
        <label>
          Категория
          <select
            value={d.category}
            onChange={(e) => set("category", e.target.value)}
          >
            {categories.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </label>
      )}
      {
        <>
          <div className="photo-input">
            {preview ? (
              <img src={preview} alt="Выбранная фотография" />
            ) : d.photo ? (
              <Photo id={d.photo} />
            ) : (
              <ImagePlus size={30} />
            )}
            <div>
              <b>{file?.name || "Сохрани момент"}</b>
              <span>Фото и точка на карте</span>
              <div className="inline">
                <button
                  type="button"
                  className="small-btn"
                  onClick={() => camera.current.click()}
                >
                  <Camera size={16} />
                  Снять
                </button>
                <button
                  type="button"
                  className="small-btn"
                  onClick={() => gallery.current.click()}
                >
                  <Upload size={16} />
                  Загрузить
                </button>
              </div>
            </div>
          </div>
          <input
            ref={camera}
            hidden
            type="file"
            accept="image/*"
            capture="environment"
            onChange={choose}
          />
          <input
            ref={gallery}
            hidden
            type="file"
            accept="image/*"
            onChange={choose}
          />
          <button
            type="button"
            className="location-btn"
            disabled={geoBusy}
            onClick={locate}
          >
            <LocateFixed size={18} />
            {geoBusy
              ? "Определяем точку…"
              : d.location
                ? "Обновить геопозицию"
                : "Записать текущую геопозицию"}
          </button>
          {d.location && (
            <div className="location-info">
              {d.location.lat.toFixed(5)}, {d.location.lng.toFixed(5)}
              {d.location.accuracy &&
                ` · точность ±${Math.round(d.location.accuracy)} м`}
              <button
                type="button"
                className="text-btn"
                onClick={() => set("location", null)}
              >
                Убрать
              </button>
            </div>
          )}
          {geoError && <p className="error">{geoError}</p>}
          <details>
            <summary>Указать координаты вручную</summary>
            <div className="form-row">
              <label>
                Широта
                <input
                  type="number"
                  step="any"
                  placeholder="42.8746"
                  value={d.location?.lat ?? ""}
                  onChange={(e) =>
                    set("location", {
                      ...d.location,
                      lat: e.target.value === "" ? NaN : Number(e.target.value),
                    })
                  }
                />
              </label>
              <label>
                Долгота
                <input
                  type="number"
                  step="any"
                  placeholder="74.5698"
                  value={d.location?.lng ?? ""}
                  onChange={(e) =>
                    set("location", {
                      ...d.location,
                      lng: e.target.value === "" ? NaN : Number(e.target.value),
                    })
                  }
                />
              </label>
            </div>
          </details>
          <p className="hint">
            Геопозиция относится к моменту записи. При загрузке старого фото
            укажи место вручную — координаты из фото не извлекаются.
          </p>
        </>
      }
      <button className="primary wide" disabled={busy || geoBusy}>
        {busy
          ? "Сохраняем…"
          : initial
            ? "Сохранить изменения"
            : "Добавить запись"}
        <Check size={18} />
      </button>
    </form>
  );
}
function ReminderForm({ initial, onSave, onClose, notify }) {
  const [d, setD] = useState(
    initial || {
      title: "",
      body: "",
      date: today(),
      time: "21:00",
      repeat: "once",
      enabled: true,
    },
  );
  const [file, setFile] = useState();
  const [busy, setBusy] = useState(false);
  const set = (k, v) => setD((x) => ({ ...x, [k]: v }));
  return (
    <form
      className="form"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        let sound = d.sound;
        try {
          if (file) sound = await saveMedia(file);
          await onSave({
            ...d,
            id: d.id || crypto.randomUUID(),
            sound,
            fired: undefined,
          });
          if (file && d.sound) await dropMedia(d.sound);
          onClose();
        } catch {
          if (file && sound) await dropMedia(sound);
          notify("Не удалось сохранить событие");
        } finally {
          setBusy(false);
        }
      }}
    >
      <label>
        Название
        <input
          autoFocus
          required
          maxLength={120}
          placeholder="Записать расходы за день"
          value={d.title}
          onChange={(e) => set("title", e.target.value)}
        />
      </label>
      <label>
        Текст уведомления
        <textarea
          maxLength={400}
          placeholder="Что ты сегодня купил?"
          value={d.body}
          onChange={(e) => set("body", e.target.value)}
        />
      </label>
      <label>
        Повтор
        <select
          value={d.repeat}
          onChange={(e) => set("repeat", e.target.value)}
        >
          <option value="once">Один раз</option>
          <option value="daily">Каждый день</option>
        </select>
      </label>
      <div className="form-row">
        {d.repeat === "once" && (
          <label>
            Дата
            <input
              required
              type="date"
              value={d.date}
              onChange={(e) => set("date", e.target.value)}
            />
          </label>
        )}
        <label>
          Время в Бишкеке
          <input
            required
            type="time"
            value={d.time}
            onChange={(e) => set("time", e.target.value)}
          />
        </label>
      </div>
      <label className="upload-sound">
        <Volume2 size={21} />
        <span>
          {file?.name ||
            (d.sound ? "Своя мелодия сохранена" : "Своя мелодия · до 10 МБ")}
          <input
            type="file"
            accept="audio/*"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (
                f &&
                f.type.startsWith("audio/") &&
                f.size <= 10 * 1024 * 1024
              )
                setFile(f);
              else if (f) notify("Выбери аудио до 10 МБ");
            }}
          />
        </span>
      </label>
      {d.sound && (
        <button
          type="button"
          className="text-btn"
          onClick={() => set("sound", undefined)}
        >
          Вернуть стандартный звук
        </button>
      )}
      <p className="hint">
        Своя мелодия играет в открытом приложении после включения звука. Фоновое
        push-уведомление использует системный звук телефона.
      </p>
      <button className="primary wide" disabled={busy}>
        {busy ? "Сохраняем…" : "Сохранить событие"}
        <Check size={18} />
      </button>
    </form>
  );
}
function Chart({ records }) {
  const points = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(today() + "T12:00:00+06:00");
    d.setUTCDate(d.getUTCDate() - 6 + i);
    const date = localStamp(d).slice(0, 10);
    return {
      date,
      label: date.slice(8) + "." + date.slice(5, 7),
      ...totals(records, date),
    };
  });
  return (
    <div className="chart">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart
          data={points}
          margin={{ top: 12, right: 10, left: -18, bottom: 0 }}
        >
          <defs>
            <linearGradient id="fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#aaca76" stopOpacity={0.5} />
              <stop offset="100%" stopColor="#aaca76" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} stroke="#edf0ee" />
          <XAxis
            dataKey="label"
            axisLine={false}
            tickLine={false}
            tick={{ fill: "#828984", fontSize: 12 }}
          />
          <YAxis
            axisLine={false}
            tickLine={false}
            tick={{ fill: "#828984", fontSize: 12 }}
          />
          <Tooltip
            formatter={(v) => money(v)}
            labelFormatter={(_, payload) => payload?.[0]?.payload?.date || ""}
            contentStyle={{ borderRadius: 12, border: "1px solid #eee" }}
          />
          <Area
            name="Расходы"
            type="monotone"
            dataKey="expense"
            stroke="#779646"
            strokeWidth={3}
            fill="url(#fill)"
          />
          <Area
            name="Накопления"
            type="monotone"
            dataKey="saving"
            stroke="#829bc0"
            strokeWidth={2}
            fill="transparent"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
function RecordList({ rows, onEdit, onDelete, onView, compact = false }) {
  return rows.length ? (
    <div className="record-list">
      {rows.map((r) => (
        <div className="record" key={r.id}>
          <button
            className={
              "record-icon " + (r.kind === "saving" ? "saving-icon" : "")
            }
            onClick={() => onView(r)}
            aria-label={"Открыть " + r.title}
          >
            {r.photo ? (
              <Photo id={r.photo} />
            ) : r.kind === "saving" ? (
              <Landmark size={21} />
            ) : (
              <Receipt size={21} />
            )}
          </button>
          <button className="record-copy" onClick={() => onView(r)}>
            <b>{r.title}</b>
            <span>
              {r.kind === "saving" ? "Накопления" : r.category} ·{" "}
              {r.date === today()
                ? "Сегодня"
                : r.date.split("-").reverse().join(".")}{" "}
              {r.time}
            </span>
          </button>
          <strong>
            {r.kind === "saving" ? "+" : ""}
            {money(r.amount)}
          </strong>
          {!compact && (
            <div className="record-actions">
              <button
                className="icon-btn"
                onClick={() => onEdit(r)}
                aria-label={"Изменить " + r.title}
              >
                <Pencil size={16} />
              </button>
              <button
                className="icon-btn"
                onClick={() => onDelete(r)}
                aria-label={"Удалить " + r.title}
              >
                <Trash2 size={16} />
              </button>
            </div>
          )}
        </div>
      ))}
    </div>
  ) : (
    <Empty />
  );
}
export default function App() {
  const [state, setState] = useState();
  const [modal, setModal] = useState();
  const [toast, setToast] = useState("");
  const [clock, setClock] = useState(localStamp());
  const [mobile, setMobile] = useState(false);
  const [alert, setAlert] = useState();
  const [permission, setPermission] = useState(
    typeof Notification !== "undefined"
      ? Notification.permission
      : "unsupported",
  );
  const [audio, setAudio] = useState(false);
  const [push, setPush] = useState(!!pushToken());
  const location = useLocation();
  const latest = useRef();
  const saving = useRef(Promise.resolve());
  latest.current = state;
  useEffect(() => {
    readData()
      .then(setState)
      .catch(() =>
        setToast(
          "Не удалось открыть память устройства. Попробуй обычный режим браузера.",
        ),
      );
  }, []);
  useEffect(() => {
    const id = setInterval(() => setClock(localStamp()), 1000);
    return () => clearInterval(id);
  }, []);
  useEffect(() => {
    setMobile(false);
  }, [location.pathname]);
  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(""), 5000);
    return () => clearTimeout(id);
  }, [toast]);
  async function commit(next) {
    await saveData(next);
    setState(next);
    latest.current = next;
  }
  function mutate(fn) {
    const task = saving.current.then(() => commit(fn(latest.current)));
    saving.current = task.catch(() => {});
    return task;
  }
  const notify = setToast;
  useEffect(() => {
    if (!state) return;
    const check = () => {
      if (!latest.current) return;
      const due = latest.current.reminders
        .map((r) => [r, dueReminder(r)])
        .filter(([, o]) => o);
      if (!due.length) return;
      mutate((s) => ({
        ...s,
        reminders: s.reminders.map((r) => {
          const found = due.find(([x]) => x.id === r.id);
          return found ? { ...r, fired: found[1].key } : r;
        }),
      }))
        .then(() => {
          for (const [r, o] of due) {
            setAlert(r);
            if (audio) playSound(r.sound);
            if (!pushToken())
              showNotification(
                r.title,
                r.body || "Пора записать расходы",
                r.id + o.key,
              );
          }
        })
        .catch(() => notify("Не удалось отметить напоминание"));
    };
    const id = setInterval(check, 2000);
    check();
    return () => clearInterval(id);
  }, [!!state, audio]);
  useEffect(() => {
    const handler = (e) => {
      if (e.data?.type === "reminder") {
        const r = latest.current?.reminders.find((x) => x.id === e.data.id);
        if (r) {
          setAlert(r);
          if (audio) playSound(r.sound);
        }
      }
    };
    navigator.serviceWorker?.addEventListener("message", handler);
    return () =>
      navigator.serviceWorker?.removeEventListener("message", handler);
  }, [audio]);
  async function saveEntry(r) {
    await mutate((s) => {
      const key = r.kind === "place" ? "places" : "records";
      return { ...s, [key]: [r, ...s[key].filter((x) => x.id !== r.id)] };
    });
    notify("Запись сохранена");
  }
  async function saveReminder(r) {
    await mutate((s) => ({
      ...s,
      reminders: [r, ...s.reminders.filter((x) => x.id !== r.id)],
    }));
    if (pushToken())
      await syncPush(latest.current.reminders).catch((e) => notify(e.message));
    else notify("Событие сохранено");
  }
  function remove(r, type) {
    setModal({ type: "delete", entry: r, key: type });
  }
  async function performDelete() {
    const r = modal.entry,
      key = modal.key;
    await mutate((s) => ({ ...s, [key]: s[key].filter((x) => x.id !== r.id) }));
    if (r.photo) await dropMedia(r.photo);
    if (r.sound) await dropMedia(r.sound);
    if (key === "reminders" && pushToken())
      await syncPush(latest.current.reminders).catch((e) => notify(e.message));
    setModal(null);
    notify("Запись удалена");
  }
  async function enable() {
    try {
      const p = await requestNotifications();
      setPermission(p);
      setAudio(true);
      notify(
        p === "granted"
          ? "Уведомления и звук включены"
          : p === "denied"
            ? "Уведомления запрещены. Измени разрешение в настройках браузера."
            : "Разрешение не выдано",
      );
    } catch (e) {
      notify(e.message);
    }
  }
  const newEntry = (kind) => setModal({ type: "entry", kind });
  const edit = (r) => setModal({ type: "entry", kind: r.kind, entry: r });
  const view = (r) => setModal({ type: "view", entry: r });
  if (!state)
    return (
      <div className="loading">
        <Wallet size={40} />
        <h2>Открываем Карман…</h2>
        {toast && <p>{toast}</p>}
      </div>
    );
  const day = totals(state.records, today()),
    all = totals(state.records);
  const month = totals(
    state.records.filter((r) => r.date.startsWith(today().slice(0, 7))),
  );
  const sorted = [...state.records].sort((a, b) =>
    (b.date + b.time).localeCompare(a.date + a.time),
  );
  const actions = {
    onEdit: edit,
    onDelete: (r) => remove(r, "records"),
    onView: view,
  };
  const active =
    nav.find(([path]) => path === location.pathname)?.[1] || "Карман";
  return (
    <div className="app">
      <aside className={"sidebar " + (mobile ? "open" : "")}>
        <NavLink className="brand" to="/">
          <span>
            <Wallet size={24} />
          </span>
          карман<span className="brand-dot">.</span>
        </NavLink>
        <div className="nav-label">МОЁ ПРОСТРАНСТВО</div>
        <nav>
          {nav.map(([path, label, Icon]) => (
            <NavLink key={path} to={path} end={path === "/"}>
              <Icon size={20} />
              {label}
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="city-chip">
            <MapPin size={16} />
            <span>
              Бишкек<small>Кыргызстан · UTC+6</small>
            </span>
          </div>
          <div className="profile">
            <span>С</span>
            <div>
              <b>Мой дневник</b>
              <small>Личное пространство</small>
            </div>
          </div>
        </div>
      </aside>
      {mobile && (
        <div className="sidebar-scrim" onClick={() => setMobile(false)} />
      )}
      <div className="workspace">
        <header className="topbar">
          <div className="inline">
            <button
              className="icon-btn menu"
              onClick={() => setMobile(!mobile)}
              aria-label="Открыть меню"
            >
              <Menu />
            </button>
            <span>{active}</span>
          </div>
          <div className="header-right">
            <span className="live-time">
              {clock.slice(11, 16)}
              <small>Бишкек</small>
            </span>
            <button
              className="icon-btn"
              onClick={() => {
                if (permission !== "granted") enable();
                else setModal({ type: "reminder" });
              }}
              aria-label="Уведомления"
            >
              <Bell size={20} />
              {state.reminders.some((r) => r.enabled) && <i />}
            </button>
            <div className="avatar">С</div>
          </div>
        </header>
        <main>
          <AnimatePresence mode="wait">
            <motion.div
              key={location.pathname}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -5 }}
              transition={{ duration: 0.2 }}
            >
              <Routes>
                <Route
                  path="/"
                  element={
                    <>
                      <div className="page-heading">
                        <div>
                          <span className="eyebrow">
                            {new Date(
                              today() + "T12:00:00+06:00",
                            ).toLocaleDateString("ru-RU", {
                              day: "numeric",
                              month: "long",
                              weekday: "long",
                              timeZone: "Asia/Bishkek",
                            })}
                          </span>
                          <h1>
                            Всё под контролем
                            <span className="heading-dot">.</span>
                          </h1>
                          <p>
                            Твои расходы, планы и маленькие шаги к большому.
                          </p>
                        </div>
                        <button
                          className="primary"
                          onClick={() => newEntry("expense")}
                        >
                          <Plus size={19} />
                          Записать расход
                        </button>
                      </div>
                      <div className="stats-grid">
                        <section className="balance-card">
                          <span className="eyebrow">РАСХОДЫ СЕГОДНЯ</span>
                          <strong>{money(day.expense)}</strong>
                          <div className="balance-foot">
                            <span>
                              <ArrowUpRight size={16} />{" "}
                              {
                                state.records.filter(
                                  (r) =>
                                    r.kind === "expense" && r.date === today(),
                                ).length
                              }{" "}
                              покупок за день
                            </span>
                            <span className="pill">
                              {today().slice(8)}.{today().slice(5, 7)}
                            </span>
                          </div>
                          <Orbit />
                        </section>
                        <section className="card stat-card">
                          <div className="stat-title">
                            <span>За этот месяц</span>
                            <div className="stat-symbol">
                              <Receipt size={21} />
                            </div>
                          </div>
                          <strong>{money(month.expense)}</strong>
                          <p>
                            Все расходы за {today().slice(5, 7)}.
                            {today().slice(0, 4)}
                          </p>
                        </section>
                        <section className="card stat-card">
                          <div className="stat-title">
                            <span>На накопительном</span>
                            <div className="stat-symbol lime">
                              <Landmark size={21} />
                            </div>
                          </div>
                          <strong>{money(all.saving)}</strong>
                          <p>
                            <span className="green">+{money(day.saving)}</span>{" "}
                            сегодня
                          </p>
                        </section>
                      </div>
                      <div className="dashboard-grid">
                        <div className="dashboard-main">
                          <section className="card">
                            <div className="section-head">
                              <div>
                                <h2>Ритм расходов</h2>
                                <p className="muted">Последние 7 дней · сом</p>
                              </div>
                              <div className="chart-legend">
                                <span>Расходы</span>
                                <span>Накопления</span>
                              </div>
                            </div>
                            <Chart records={state.records} />
                          </section>
                          <section className="card">
                            <div className="section-head">
                              <h2>Последние записи</h2>
                              <NavLink className="text-link" to="/expenses">
                                Все расходы <ChevronRight size={16} />
                              </NavLink>
                            </div>
                            <RecordList
                              rows={sorted.slice(0, 5)}
                              {...actions}
                              compact
                            />
                          </section>
                        </div>
                        <div className="dashboard-side">
                          <Weather />
                          <section className="card goal-card">
                            <div className="section-head">
                              <h2>Шаг к мечте</h2>
                              <Target size={20} />
                            </div>
                            <span className="muted">Цель накоплений</span>
                            <div className="goal-total">
                              {money(all.saving)}{" "}
                              <small>/ {money(state.settings.goal)}</small>
                            </div>
                            <div className="progress">
                              <span
                                style={{
                                  width:
                                    Math.min(
                                      (all.saving / state.settings.goal) * 100,
                                      100,
                                    ) + "%",
                                }}
                              />
                            </div>
                            <div className="goal-label">
                              <span>
                                {Math.round(
                                  (all.saving / state.settings.goal) * 100,
                                )}
                                % собрано
                              </span>
                              <button
                                className="text-btn"
                                onClick={() => setModal({ type: "goal" })}
                              >
                                Изменить цель
                              </button>
                            </div>
                            <button
                              className="secondary wide"
                              onClick={() => newEntry("saving")}
                            >
                              <Plus size={17} />
                              Пополнить накопления
                            </button>
                          </section>
                          <section className="reminder-card">
                            <div className="reminder-bell">
                              <Bell size={22} />
                            </div>
                            <h3>Не теряй мелочи</h3>
                            <p>
                              Напоминание поможет записать покупки в конце дня.
                            </p>
                            <button
                              className="text-link"
                              onClick={() => setModal({ type: "reminder" })}
                            >
                              Настроить напоминание <ChevronRight size={16} />
                            </button>
                          </section>
                        </div>
                      </div>
                      <section className="day-summary">
                        <div>
                          <CalendarDays size={22} />
                          <div>
                            <h3>Итог дня</h3>
                            <span>Обновляется после каждой записи</span>
                          </div>
                        </div>
                        <span>
                          Потрачено <b>{money(day.expense)}</b>
                        </span>
                        <span>
                          Отложено <b>{money(day.saving)}</b>
                        </span>
                        <span>
                          Всего распределено{" "}
                          <b>{money(day.expense + day.saving)}</b>
                        </span>
                      </section>
                    </>
                  }
                />
                <Route
                  path="/expenses"
                  element={
                    <Expenses
                      records={sorted.filter((r) => r.kind === "expense")}
                      newEntry={() => newEntry("expense")}
                      actions={actions}
                    />
                  }
                />
                <Route
                  path="/savings"
                  element={
                    <>
                      <PageHeading
                        title="Накопления"
                        subtitle="Каждое пополнение приближает тебя к цели."
                        action={() => newEntry("saving")}
                        actionText="Пополнить"
                      />
                      <div className="savings-banner">
                        <div>
                          <span className="eyebrow">
                            ТВОЙ НАКОПИТЕЛЬНЫЙ СЧЁТ
                          </span>
                          <h1>{money(all.saving)}</h1>
                          <p>Сегодня отложено {money(day.saving)}</p>
                          <button
                            className="secondary"
                            onClick={() => setModal({ type: "goal" })}
                          >
                            Цель: {money(state.settings.goal)}{" "}
                            <Pencil size={16} />
                          </button>
                        </div>
                        <Orbit />
                      </div>
                      <div className="two-columns">
                        <section className="card">
                          <h2>Движение за неделю</h2>
                          <Chart
                            records={state.records.filter(
                              (r) => r.kind === "saving",
                            )}
                          />
                        </section>
                        <section className="card">
                          <h2>Твоя цель</h2>
                          <div className="big-percent">
                            {Math.round(
                              (all.saving / state.settings.goal) * 100,
                            )}
                            <span>%</span>
                          </div>
                          <div className="progress">
                            <span
                              style={{
                                width:
                                  Math.min(
                                    (all.saving / state.settings.goal) * 100,
                                    100,
                                  ) + "%",
                              }}
                            />
                          </div>
                          <p className="muted">
                            Осталось{" "}
                            {money(
                              Math.max(0, state.settings.goal - all.saving),
                            )}
                          </p>
                        </section>
                      </div>
                      <section className="card">
                        <div className="section-head">
                          <h2>История пополнений</h2>
                          <span className="muted">
                            {
                              state.records.filter((r) => r.kind === "saving")
                                .length
                            }{" "}
                            записей
                          </span>
                        </div>
                        <RecordList
                          rows={sorted.filter((r) => r.kind === "saving")}
                          {...actions}
                        />
                      </section>
                    </>
                  }
                />
                <Route
                  path="/map"
                  element={<MapPage state={state} view={view} />}
                />
                <Route
                  path="/places"
                  element={
                    <>
                      <PageHeading
                        title="Мои места"
                        subtitle="Сохрани то, куда хочется вернуться."
                        action={() => newEntry("place")}
                        actionText="Добавить место"
                      />
                      {state.places.length ? (
                        <div className="places-grid">
                          {state.places.map((p) => (
                            <article className="place-card" key={p.id}>
                              <button
                                className="place-photo"
                                onClick={() => view(p)}
                              >
                                <Photo id={p.photo} alt={p.title} />
                                <span>
                                  <Heart size={16} />
                                  Моё место
                                </span>
                              </button>
                              <div className="place-content">
                                <h3>{p.title}</h3>
                                <p>
                                  <MapPin size={14} />
                                  {p.location
                                    ? "Точка сохранена"
                                    : "Без геопозиции"}{" "}
                                  · {p.date}
                                </p>
                                <div className="inline">
                                  <button
                                    className="small-btn"
                                    onClick={() => edit(p)}
                                  >
                                    <Pencil size={15} />
                                    Изменить
                                  </button>
                                  <button
                                    className="icon-btn"
                                    aria-label="Удалить место"
                                    onClick={() => remove(p, "places")}
                                  >
                                    <Trash2 size={16} />
                                  </button>
                                </div>
                              </div>
                            </article>
                          ))}
                        </div>
                      ) : (
                        <section className="card">
                          <Empty
                            icon={Heart}
                            title="Здесь будут твои любимые места"
                            text="Сфотографируй место или загрузи снимок и сохрани точку на карте."
                          />
                        </section>
                      )}
                    </>
                  }
                />
                <Route
                  path="/events"
                  element={
                    <>
                      <PageHeading
                        title="События и напоминания"
                        subtitle="Твои планы по времени Бишкека — UTC+6."
                        action={() => setModal({ type: "reminder" })}
                        actionText="Новое событие"
                      />
                      <div className="notice">
                        <Bell size={22} />
                        <div>
                          <b>
                            {permission === "granted"
                              ? "Системные уведомления разрешены"
                              : "Включи уведомления"}
                          </b>
                          <p>
                            {push
                              ? "Фоновые push-уведомления подключены."
                              : "Без сервера напоминания работают, пока приложение открыто."}
                          </p>
                        </div>
                        <button className="secondary" onClick={enable}>
                          Включить звук и уведомления
                        </button>
                      </div>
                      {state.reminders.length ? (
                        <div className="events-grid">
                          {state.reminders.map((r) => (
                            <section className="card event-card" key={r.id}>
                              <div className="event-time">
                                {r.time}
                                <span>
                                  {r.repeat === "daily"
                                    ? "Каждый день"
                                    : r.date.split("-").reverse().join(".")}
                                </span>
                              </div>
                              <div className="event-copy">
                                <h3>{r.title}</h3>
                                <p>{r.body || "Без дополнительного текста"}</p>
                                <span className="muted">
                                  {r.sound
                                    ? "Своя мелодия"
                                    : "Стандартный звук"}
                                  {r.fired && r.repeat === "once"
                                    ? " · Выполнено"
                                    : ""}
                                </span>
                              </div>
                              <div className="event-actions">
                                <button
                                  className={
                                    "switch " + (r.enabled ? "on" : "")
                                  }
                                  role="switch"
                                  aria-checked={r.enabled}
                                  aria-label="Включить событие"
                                  onClick={async () => {
                                    await mutate((s) => ({
                                      ...s,
                                      reminders: s.reminders.map((x) =>
                                        x.id === r.id
                                          ? { ...x, enabled: !x.enabled }
                                          : x,
                                      ),
                                    }));
                                    syncPush(latest.current.reminders).catch(
                                      (e) => notify(e.message),
                                    );
                                  }}
                                >
                                  <span />
                                </button>
                                <button
                                  className="icon-btn"
                                  aria-label="Изменить событие"
                                  onClick={() =>
                                    setModal({ type: "reminder", entry: r })
                                  }
                                >
                                  <Pencil size={17} />
                                </button>
                                <button
                                  className="icon-btn"
                                  aria-label="Удалить событие"
                                  onClick={() => remove(r, "reminders")}
                                >
                                  <Trash2 size={17} />
                                </button>
                                <button
                                  className="icon-btn"
                                  aria-label="Проверить мелодию"
                                  onClick={() =>
                                    playSound(r.sound).then(
                                      (ok) =>
                                        !ok && notify("Нажми «Включить звук»"),
                                    )
                                  }
                                >
                                  <Volume2 size={17} />
                                </button>
                              </div>
                            </section>
                          ))}
                        </div>
                      ) : (
                        <section className="card">
                          <Empty
                            icon={CalendarDays}
                            title="Есть о чём напомнить?"
                            text="Выбери день, время, текст и мелодию. Можно повторять каждый день."
                          />
                        </section>
                      )}
                    </>
                  }
                />
                <Route
                  path="/weather"
                  element={
                    <>
                      <PageHeading
                        title="Погода в Бишкеке"
                        subtitle="Сейчас, в ближайшие часы и на пять дней."
                      />
                      <Weather full />
                    </>
                  }
                />
                <Route
                  path="/settings"
                  element={
                    <SettingsPage
                      state={state}
                      setState={setState}
                      mutate={mutate}
                      notify={notify}
                      enable={enable}
                      audio={audio}
                      setAudio={setAudio}
                      push={push}
                      setPush={setPush}
                    />
                  }
                />
                <Route
                  path="*"
                  element={
                    <section className="card">
                      <Empty
                        title="Страница не найдена"
                        text="Открой нужный раздел в меню."
                      />
                      <NavLink className="primary" to="/">
                        На главную
                      </NavLink>
                    </section>
                  }
                />
              </Routes>
            </motion.div>
          </AnimatePresence>
        </main>
        <footer>
          карман. <span>Личный дневник · Суммы в сомах · Бишкек</span>
        </footer>
      </div>
      <AnimatePresence>
        {modal && (
          <Modal
            title={
              modal.type === "entry"
                ? modal.entry
                  ? "Изменить запись"
                  : modal.kind === "place"
                    ? "Новое место"
                    : modal.kind === "saving"
                      ? "Пополнить накопления"
                      : "Новый расход"
                : modal.type === "reminder"
                  ? "Событие и напоминание"
                  : modal.type === "goal"
                    ? "Цель накоплений"
                    : modal.type === "delete"
                      ? "Удалить запись?"
                      : "Детали записи"
            }
            onClose={() => setModal(null)}
          >
            {modal.type === "entry" ? (
              <EntryForm
                initial={modal.entry}
                kind={modal.kind}
                onSave={saveEntry}
                onClose={() => setModal(null)}
                notify={notify}
              />
            ) : modal.type === "reminder" ? (
              <ReminderForm
                initial={modal.entry}
                onSave={saveReminder}
                onClose={() => setModal(null)}
                notify={notify}
              />
            ) : modal.type === "goal" ? (
              <GoalForm
                goal={state.settings.goal}
                onSave={async (goal) => {
                  await mutate((s) => ({
                    ...s,
                    settings: { ...s.settings, goal },
                  }));
                  setModal(null);
                }}
              />
            ) : modal.type === "delete" ? (
              <>
                <p>
                  «{modal.entry.title}» будет удалена вместе с прикреплённым
                  фото или звуком.
                </p>
                <div className="inline">
                  <button
                    className="danger"
                    onClick={() =>
                      performDelete().catch(() =>
                        notify("Не удалось удалить запись"),
                      )
                    }
                  >
                    Удалить
                  </button>
                  <button className="secondary" onClick={() => setModal(null)}>
                    Отмена
                  </button>
                </div>
              </>
            ) : (
              <div className="entry-detail">
                {modal.entry.photo && (
                  <Photo id={modal.entry.photo} alt={modal.entry.title} />
                )}
                <h3>{modal.entry.title}</h3>
                {modal.entry.kind !== "place" && (
                  <strong>{money(modal.entry.amount)}</strong>
                )}
                <p>
                  {modal.entry.date} · {modal.entry.time} · Бишкек
                </p>
                {modal.entry.location && (
                  <a
                    className="text-link"
                    target="_blank"
                    rel="noreferrer"
                    href={`https://www.openstreetmap.org/?mlat=${modal.entry.location.lat}&mlon=${modal.entry.location.lng}#map=17/${modal.entry.location.lat}/${modal.entry.location.lng}`}
                  >
                    <MapPin size={17} />
                    Открыть точку на карте
                  </a>
                )}
                <button className="secondary" onClick={() => edit(modal.entry)}>
                  <Pencil size={17} />
                  Изменить
                </button>
              </div>
            )}
          </Modal>
        )}
      </AnimatePresence>
      {toast && (
        <div className="toast" role="status">
          {toast}
          <button aria-label="Закрыть" onClick={() => notify("")}>
            <X size={16} />
          </button>
        </div>
      )}
      {alert && (
        <div className="reminder-alert" role="alert">
          <Bell />
          <div>
            <b>{alert.title}</b>
            <p>{alert.body || "Пора записать расходы за день"}</p>
          </div>
          <button
            className="icon-btn"
            aria-label="Остановить напоминание"
            onClick={() => {
              stopSound();
              setAlert(null);
            }}
          >
            <X />
          </button>
        </div>
      )}
    </div>
  );
}
function PageHeading({ title, subtitle, action, actionText }) {
  return (
    <div className="page-heading">
      <div>
        <h1>
          {title}
          <span className="heading-dot">.</span>
        </h1>
        <p>{subtitle}</p>
      </div>
      {action && (
        <button className="primary" onClick={action}>
          <Plus size={18} />
          {actionText}
        </button>
      )}
    </div>
  );
}
function Expenses({ records, newEntry, actions }) {
  const [date, setDate] = useState(today());
  const [cat, setCat] = useState("all");
  const [q, setQ] = useState("");
  const rows = records.filter(
    (r) =>
      (!date || r.date === date) &&
      (cat === "all" || r.category === cat) &&
      r.title.toLowerCase().includes(q.toLowerCase()),
  );
  const sum = rows.reduce((s, r) => s + r.amount, 0);
  const pie = categories
    .map((name, i) => ({
      name,
      value: rows
        .filter((r) => r.category === name)
        .reduce((s, r) => s + r.amount, 0),
      color: colors[i],
    }))
    .filter((c) => c.value);
  return (
    <>
      <PageHeading
        title="Расходы"
        subtitle="Все покупки в одном месте. Любую запись можно изменить."
        action={newEntry}
        actionText="Записать расход"
      />
      <div className="filters">
        <label className="search">
          <Search size={18} />
          <input
            placeholder="Найти покупку"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </label>
        <label>
          Дата
          <input
            aria-label="Фильтр по дате"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </label>
        <select
          aria-label="Категория"
          value={cat}
          onChange={(e) => setCat(e.target.value)}
        >
          <option value="all">Все категории</option>
          {categories.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
        <button
          className="small-btn"
          onClick={() => {
            setDate("");
            setCat("all");
            setQ("");
          }}
        >
          За всё время
        </button>
      </div>
      <div className="two-columns expense-stats">
        <section className="card">
          <span className="muted">Расходы за выбранный период</span>
          <h1>{money(sum)}</h1>
          <p className="muted">{rows.length} покупок</p>
        </section>
        <section className="card categories-card">
          {pie.length ? (
            <>
              <div className="donut">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={pie}
                      dataKey="value"
                      innerRadius={42}
                      outerRadius={60}
                      stroke="none"
                    >
                      {pie.map((p) => (
                        <Cell key={p.name} fill={p.color} />
                      ))}
                    </Pie>
                    <Tooltip formatter={money} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="category-legend">
                {pie.map((p) => (
                  <div key={p.name}>
                    <i style={{ background: p.color }} />
                    <span>{p.name}</span>
                    <b>{money(p.value)}</b>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <p className="muted">
              Категории появятся после добавления расходов.
            </p>
          )}
        </section>
      </div>
      <section className="card">
        <div className="section-head">
          <h2>История покупок</h2>
          <span className="muted">{date || "За всё время"}</span>
        </div>
        <RecordList rows={rows} {...actions} />
      </section>
    </>
  );
}
function MapPage({ state, view }) {
  const [filter, setFilter] = useState("all");
  const points = useMemo(
    () =>
      [
        ...state.records.filter((r) => r.kind === "expense" && r.photo),
        ...state.places,
      ].filter((r) => filter === "all" || r.kind === filter),
    [state, filter],
  );
  const located = points.filter((p) => p.location);
  return (
    <>
      <PageHeading
        title="Карта воспоминаний"
        subtitle="Покупки и любимые места, у которых сохранена геопозиция."
      />
      <div className="map-toolbar">
        <div className="segmented">
          {[
            ["all", "Все фото"],
            ["expense", "Покупки"],
            ["place", "Любимые места"],
          ].map(([key, title]) => (
            <button
              key={key}
              className={filter === key ? "active" : ""}
              onClick={() => setFilter(key)}
            >
              {title}
            </button>
          ))}
        </div>
        <span className="muted">
          {located.length} точек · {points.length - located.length} фото без
          точки
        </span>
      </div>
      <div className="map-layout">
        <section className="card map-card">
          <Map points={points} onSelect={view} />
          <div className="map-key">
            <span>
              <i />
              Покупки
            </span>
            <span>
              <i />
              Любимые места
            </span>
          </div>
        </section>
        <section className="card map-list">
          <h2>На карте</h2>
          {located.length ? (
            located.map((p) => (
              <button
                key={p.id}
                className="map-list-item"
                onClick={() => view(p)}
              >
                {p.photo ? <Photo id={p.photo} /> : <MapPin />}
                <span>
                  <b>{p.title}</b>
                  <small>
                    {p.kind === "place" ? "Любимое место" : money(p.amount)}
                  </small>
                </span>
                <ChevronRight size={16} />
              </button>
            ))
          ) : (
            <Empty
              icon={MapPin}
              title="Точек пока нет"
              text="Прикрепи фото и разреши геолокацию при добавлении записи."
            />
          )}
        </section>
      </div>
    </>
  );
}
function GoalForm({ goal, onSave }) {
  const [value, setValue] = useState(goal);
  return (
    <form
      className="form"
      onSubmit={(e) => {
        e.preventDefault();
        onSave(Number(value));
      }}
    >
      <label>
        Сколько хочешь накопить, сом
        <input
          type="number"
          min="1"
          step=".01"
          required
          value={value}
          onChange={(e) => setValue(e.target.value)}
        />
      </label>
      <button className="primary">Сохранить цель</button>
    </form>
  );
}
function SettingsPage({
  state,
  setState,
  mutate,
  notify,
  enable,
  audio,
  setAudio,
  push,
  setPush,
}) {
  const [busy, setBusy] = useState(false);
  const [input, setInput] = useState(null);
  const file = useRef();
  async function exportData() {
    setBusy(true);
    try {
      const data = await backup(state);
      const url = URL.createObjectURL(
        new Blob([JSON.stringify(data)], { type: "application/json" }),
      );
      const a = document.createElement("a");
      a.href = url;
      a.download = "karman-backup-" + today() + ".json";
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 5000);
      notify("Резервная копия скачана");
    } catch {
      notify("Не удалось создать копию");
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <PageHeading
        title="Настройки"
        subtitle="Уведомления, звук и сохранность твоих записей."
      />
      <div className="settings-grid">
        <section className="card">
          <h2>Уведомления и звук</h2>
          <div className="setting-row">
            <div>
              <b>Разрешить уведомления</b>
              <p>Системные сообщения на этом устройстве</p>
            </div>
            <button className="secondary" onClick={enable}>
              Включить
            </button>
          </div>
          <div className="setting-row">
            <div>
              <b>Звук в приложении</b>
              <p>
                {audio
                  ? "Звук активен в этой сессии"
                  : "Нужно включать после открытия браузера"}
              </p>
            </div>
            <button
              className="switch"
              role="switch"
              aria-checked={audio}
              aria-label="Звук"
              style={{ background: audio ? "#294435" : undefined }}
              onClick={async () => {
                await unlockAudio();
                setAudio(!audio);
                if (!audio) playSound();
              }}
            >
              <span
                style={{ transform: audio ? "translateX(19px)" : undefined }}
              />
            </button>
          </div>
          <button
            className="small-btn"
            onClick={() =>
              playSound().then((ok) => !ok && notify("Включи звук в браузере"))
            }
          >
            <Volume2 size={16} />
            Проверить звук
          </button>
          <div className="setting-row">
            <div>
              <b>Фоновые push-уведомления</b>
              <p>
                {push
                  ? "Подключены к серверу"
                  : "Нужны ключи push, Redis и запуск планировщика"}
              </p>
            </div>
            <button
              className="secondary"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                try {
                  const p = await requestNotifications();
                  if (p !== "granted")
                    throw Error("Разреши системные уведомления");
                  await enablePush(state.reminders);
                  setPush(true);
                  notify("Фоновые уведомления подключены");
                } catch (e) {
                  notify(e.message);
                } finally {
                  setBusy(false);
                }
              }}
            >
              {push ? "Переподключить" : "Подключить"}
            </button>
          </div>
          {push && (
            <button
              className="text-btn"
              onClick={async () => {
                try {
                  await disablePush();
                  setPush(false);
                  notify("Фоновые уведомления отключены");
                } catch (e) {
                  notify(e.message);
                }
              }}
            >
              Отключить фоновые уведомления
            </button>
          )}
          <p className="hint">
            Закрытая вкладка не может сама отслеживать время или проигрывать
            загруженную мелодию. Фоновые уведомления отправляет сервер; звук
            выбирает система телефона. Настройка сервера описана в README.
          </p>
        </section>
        <section className="card">
          <h2>Твои данные</h2>
          <p className="muted">
            Записи, фото и аудио хранятся в этом браузере. Они не
            синхронизируются между устройствами. Очистка данных сайта удалит их
            — сохрани резервную копию.
          </p>
          <div className="backup-actions">
            <button className="secondary" onClick={exportData} disabled={busy}>
              <Download size={18} />
              Скачать резервную копию
            </button>
            <button
              className="secondary"
              onClick={() => file.current.click()}
              disabled={busy}
            >
              <Upload size={18} />
              Восстановить из копии
            </button>
            <input
              hidden
              ref={file}
              type="file"
              accept="application/json"
              onChange={(e) => {
                setInput(e.target.files?.[0]);
                e.target.value = "";
              }}
            />
          </div>
          <div className="storage-stats">
            <span>
              {state.records.length}
              <small>записей</small>
            </span>
            <span>
              {state.places.length}
              <small>мест</small>
            </span>
            <span>
              {state.reminders.length}
              <small>событий</small>
            </span>
          </div>
          <div className="setting-row">
            <div>
              <b>Часовой пояс</b>
              <p>Asia/Bishkek · UTC+6 · Кыргызский сом</p>
            </div>
            <MapPin size={22} />
          </div>
          <p className="hint">
            Карта и погода требуют интернета. Геолокация и уведомления доступны
            на HTTPS или localhost. Добавь приложение на экран «Домой» через
            меню браузера.
          </p>
        </section>
      </div>
      {input && (
        <Modal
          title="Восстановить резервную копию?"
          onClose={() => setInput(null)}
        >
          <p>
            Текущие записи будут заменены данными из {input.name}. Сначала
            скачай копию текущих данных.
          </p>
          <div className="inline">
            <button
              className="primary"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                try {
                  const payload = JSON.parse(await input.text());
                  await restore(payload);
                  setState(payload.state);
                  if (pushToken()) await syncPush(payload.state.reminders);
                  notify("Данные восстановлены");
                  setInput(null);
                } catch (e) {
                  notify(e.message || "Неверный файл");
                } finally {
                  setBusy(false);
                }
              }}
            >
              Восстановить
            </button>
            <button className="secondary" onClick={() => setInput(null)}>
              Отмена
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}
