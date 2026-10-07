import { useState, useEffect } from "react";
import { NavLink } from "react-router-dom";
import {
  Shield,
  Users,
  Activity,
  Image,
  LogOut,
  Search,
  RefreshCw,
  Wallet,
  LockKeyhole,
  X,
} from "lucide-react";
import { api } from "../cloud";
import { Avatar, online } from "./Friends";
export default function Admin() {
  const [data, setData] = useState(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [login, setLogin] = useState("ADMIN"),
    [password, setPassword] = useState(""),
    [search, setSearch] = useState(""),
    [selected, setSelected] = useState(null),
    [photos, setPhotos] = useState([]);
  async function load() {
    try {
      setData(await api("/api/admin?action=users"));
      setError("");
    } catch (e) {
      setData(null);
      if (e.message !== "Войди в админку") setError(e.message);
    }
  }
  useEffect(() => {
    load();
    const id = setInterval(load, 30000);
    return () => clearInterval(id);
  }, []);
  async function run(fn) {
    setBusy(true);
    setError("");
    try {
      await fn();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="admin-shell">
      <header className="admin-top">
        <NavLink className="brand" to="/">
          <span>
            <Wallet size={22} />
          </span>
          карман.
        </NavLink>
        <span>
          <Shield size={18} />
          Управление
        </span>
        {data && (
          <button
            className="secondary"
            onClick={() =>
              run(async () => {
                await api("/api/admin?action=logout", { method: "POST" });
                setData(null);
              })
            }
          >
            <LogOut size={16} />
            Выйти
          </button>
        )}
      </header>
      <main>
        {!data ? (
          <section className="admin-login card">
            <div className="admin-lock">
              <LockKeyhole size={27} />
            </div>
            <h1>Вход в управление</h1>
            <p className="muted">Доступ только для владельца сервиса.</p>
            <form
              className="form"
              onSubmit={(e) => {
                e.preventDefault();
                run(async () => {
                  await api("/api/admin?action=login", {
                    method: "POST",
                    body: JSON.stringify({ username: login, password }),
                  });
                  setPassword("");
                  await load();
                });
              }}
            >
              <label>
                Логин
                <input
                  autoComplete="username"
                  required
                  value={login}
                  onChange={(e) => setLogin(e.target.value)}
                />
              </label>
              <label>
                Пароль
                <input
                  type="password"
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </label>
              <button className="primary" disabled={busy}>
                {busy ? "Проверяем…" : "Войти"}
              </button>
            </form>
            {error && <p className="error">{error}</p>}
            <NavLink className="text-link" to="/">
              Вернуться в приложение
            </NavLink>
          </section>
        ) : (
          <>
            <div className="page-heading">
              <div>
                <span className="eyebrow">ПАНЕЛЬ ВЛАДЕЛЬЦА</span>
                <h1>
                  Люди в Кармане<span className="heading-dot">.</span>
                </h1>
                <p>
                  Профили и загруженные фото. Онлайн-статус обновляется каждые
                  30 секунд.
                </p>
              </div>
              <button className="secondary" onClick={load}>
                <RefreshCw size={17} />
                Обновить
              </button>
            </div>
            <div className="admin-stats">
              <section className="card">
                <Users />
                <span>Пользователей</span>
                <strong>{data.total}</strong>
              </section>
              <section className="card">
                <Activity />
                <span>Сейчас в приложении</span>
                <strong>{data.online}</strong>
              </section>
              <section className="card">
                <Image />
                <span>Фото в дневниках</span>
                <strong>{data.photos}</strong>
              </section>
            </div>
            <p className="hint">
              «Сейчас в приложении» — активная видимая вкладка в последние 75
              секунд. Это приблизительный статус, а не непрерывное отслеживание
              человека. В списке отображаются до 1000 последних аккаунтов.
            </p>
            <section className="card">
              <label className="search">
                <Search size={18} />
                <input
                  aria-label="Найти пользователя"
                  placeholder="Никнейм, имя или email"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </label>
              <div className="admin-users">
                {data.users
                  .filter((u) =>
                    [u.email, u.nickname, u.display_name].some((s) =>
                      String(s).toLowerCase().includes(search.toLowerCase()),
                    ),
                  )
                  .map((u) => (
                    <button
                      className="admin-user"
                      key={u.id}
                      onClick={() =>
                        run(async () => {
                          setSelected(u);
                          setPhotos([]);
                          setPhotos(
                            (await api("/api/admin?action=photos&user=" + u.id))
                              .photos,
                          );
                        })
                      }
                    >
                      <Avatar profile={u} />
                      <div>
                        <b>{u.display_name || u.nickname}</b>
                        <span>
                          @{u.nickname} · {u.email}
                        </span>
                        <small>
                          Аккаунт с{" "}
                          {new Date(u.created_at).toLocaleDateString("ru-RU")}
                        </small>
                      </div>
                      <span
                        className={
                          online(u) ? "status-online" : "status-offline"
                        }
                      >
                        {online(u) ? "В приложении" : "Не в сети"}
                      </span>
                      <span>{u.photos} фото</span>
                    </button>
                  ))}
              </div>
            </section>
            {error && <p className="error">{error}</p>}
            {selected && (
              <div className="overlay" onClick={() => setSelected(null)}>
                <section
                  className="modal admin-photo-modal"
                  role="dialog"
                  aria-modal="true"
                  aria-label="Фото пользователя"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="section-head">
                    <h2>Фото @{selected.nickname}</h2>
                    <button
                      className="icon-btn"
                      aria-label="Закрыть"
                      onClick={() => setSelected(null)}
                    >
                      <X />
                    </button>
                  </div>
                  {busy ? (
                    <p>Загружаем…</p>
                  ) : !photos.length ? (
                    <div className="empty">
                      <Image />
                      <h3>Фотографий пока нет</h3>
                    </div>
                  ) : (
                    <div className="admin-photo-grid">
                      {photos.map((p) => (
                        <div key={p.id}>
                          <img src={p.url} alt={p.title} />
                          <b>{p.title}</b>
                          <small>
                            {p.date} · {p.kind === "place" ? "Место" : "Запись"}
                          </small>
                        </div>
                      ))}
                    </div>
                  )}
                  <p className="hint">
                    Ссылки на фото действуют две минуты. Закрой и открой
                    карточку, если изображение перестало загружаться.
                  </p>
                </section>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
