import { useState, useEffect } from "react";
import { useNavigate, NavLink } from "react-router-dom";
import {
  Users,
  Copy,
  KeyRound,
  Search,
  Heart,
  Route as RouteIcon,
  Bell,
  MessageCircle,
  Trash2,
  RefreshCw,
  Check,
  MapPin,
} from "lucide-react";
import { supabase, check, friendlyError } from "../cloud";
import { useAuth } from "../Auth";
import { today, localStamp } from "../core";
import Media from "./Media";
import Map from "../Map";
export function CloudRequired() {
  return (
    <section className="card cloud-needed">
      <Users />
      <h2>Подключи облачный аккаунт</h2>
      <p>
        Друзья и чат появятся после настройки Supabase и входа через Google.
        Пошаговая инструкция есть в SETUP.md.
      </p>
    </section>
  );
}
export async function loadFriends(uid) {
  const links = check(
    await supabase
      .from("friendships")
      .select("*")
      .or(`user_a.eq.${uid},user_b.eq.${uid}`),
  );
  const ids = links.map((l) => (l.user_a === uid ? l.user_b : l.user_a));
  return ids.length
    ? check(await supabase.from("profiles").select("*").in("id", ids))
    : [];
}
export const online = (p) =>
  !!p.last_seen && Date.now() - new Date(p.last_seen).getTime() < 75000;
export function Avatar({ profile }) {
  return profile?.avatar_url ? (
    <img
      className="friend-avatar"
      src={profile.avatar_url}
      alt=""
      referrerPolicy="no-referrer"
    />
  ) : (
    <span className="friend-avatar fallback">
      {(profile?.display_name || profile?.nickname || "?")[0].toUpperCase()}
    </span>
  );
}
export default function Friends({ notify }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [friends, setFriends] = useState([]),
    [search, setSearch] = useState(""),
    [results, setResults] = useState([]),
    [code, setCode] = useState(""),
    [invite, setInvite] = useState(""),
    [selected, setSelected] = useState(null),
    [places, setPlaces] = useState([]),
    [tab, setTab] = useState("moments"),
    [busy, setBusy] = useState(false),
    [remove, setRemove] = useState(null),
    [spot, setSpot] = useState(null);
  async function reload() {
    if (user) {
      const rows = await loadFriends(user.id);
      setFriends(rows);
      setSelected((previous) =>
        previous ? rows.find((x) => x.id === previous.id) || null : null,
      );
    }
  }
  useEffect(() => {
    if (!user) return;
    reload().catch((e) => notify(friendlyError(e)));
    const id = setInterval(() => reload().catch(() => {}), 30000);
    return () => clearInterval(id);
  }, [user]);
  useEffect(() => {
    if (!selected || !user) return;
    setSpot(null);
    supabase
      .from("entries")
      .select("payload")
      .eq("owner_id", selected.id)
      .eq("kind", "place")
      .then((r) => setPlaces(check(r).map((x) => x.payload)))
      .catch((e) => notify(friendlyError(e)));
  }, [selected]);
  if (!user) return <CloudRequired />;
  async function run(fn) {
    setBusy(true);
    try {
      await fn();
    } catch (e) {
      notify(friendlyError(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <div className="page-heading">
        <div>
          <h1>
            Рядом с друзьями<span className="heading-dot">.</span>
          </h1>
          <p>Лучшие моменты, планы и разговоры.</p>
        </div>
        <NavLink className="primary" to="/chats">
          <MessageCircle size={18} />
          Все чаты
        </NavLink>
      </div>
      <div className="friends-connect">
        <section className="card">
          <div className="section-head">
            <h2>
              <KeyRound size={19} />
              Пригласить друга
            </h2>
          </div>
          <p className="muted">
            Код действует 24 часа и используется один раз. Друг увидит места,
            которые ты отметил для друзей. После подключения вы сможете общаться
            и напоминать друг другу.
          </p>
          <button
            className="secondary"
            disabled={busy}
            onClick={() =>
              run(async () =>
                setInvite(check(await supabase.rpc("create_invite"))),
              )
            }
          >
            Сгенерировать код
          </button>
          {invite && (
            <div className="invite-code">
              <code>{invite}</code>
              <button
                className="icon-btn"
                aria-label="Скопировать код"
                onClick={() =>
                  navigator.clipboard
                    .writeText(invite)
                    .then(() => notify("Код скопирован"))
                    .catch(() => notify("Выдели код и скопируй вручную"))
                }
              >
                <Copy size={18} />
              </button>
            </div>
          )}
        </section>
        <section className="card">
          <h2>Войти к другу</h2>
          <form
            className="form"
            onSubmit={(e) => {
              e.preventDefault();
              run(async () => {
                const id = check(
                  await supabase.rpc("join_friend", { code: code.trim() }),
                );
                setCode("");
                const rows = await loadFriends(user.id);
                setFriends(rows);
                setSelected(rows.find((x) => x.id === id));
                notify("Друг добавлен");
              });
            }}
          >
            <label>
              Код приглашения
              <input
                placeholder="Код от друга"
                required
                maxLength={40}
                value={code}
                onChange={(e) => setCode(e.target.value)}
              />
            </label>
            <button className="primary" disabled={busy}>
              Подключиться <Check size={18} />
            </button>
          </form>
        </section>
      </div>
      <section className="card friend-search">
        <h2>Найти по никнейму</h2>
        <form
          className="inline"
          onSubmit={(e) => {
            e.preventDefault();
            run(async () =>
              setResults(
                check(
                  await supabase.rpc("search_profiles", {
                    term: search.trim().toLowerCase().replace("@", ""),
                  }),
                ),
              ),
            );
          }}
        >
          <label className="search">
            <Search size={18} />
            <input
              aria-label="Никнейм друга"
              minLength={3}
              maxLength={24}
              placeholder="@nickname"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </label>
          <button
            className="secondary"
            disabled={busy || search.trim().length < 3}
          >
            Найти
          </button>
        </form>
        {results.map((p) => (
          <div className="search-result" key={p.id}>
            <Avatar profile={p} />
            <div>
              <b>@{p.nickname}</b>
              <p>{p.display_name}</p>
            </div>
            {friends.some((f) => f.id === p.id) ? (
              <button
                className="small-btn"
                onClick={() => {
                  setSelected(p);
                  setTab("moments");
                }}
              >
                Открыть
              </button>
            ) : (
              <span className="muted">Попроси у него код приглашения</span>
            )}
          </div>
        ))}
      </section>
      <div className="friends-layout">
        <section className="card friends-list">
          <div className="section-head">
            <h2>Мои друзья</h2>
            <span className="count-badge">{friends.length}</span>
          </div>
          {friends.length ? (
            friends.map((p) => (
              <button
                key={p.id}
                className={
                  "friend-row " + (selected?.id === p.id ? "selected" : "")
                }
                onClick={() => {
                  setSelected(p);
                  setTab("moments");
                }}
              >
                <Avatar profile={p} />
                <span>
                  <b>@{p.nickname}</b>
                  <small className={online(p) ? "online-label" : ""}>
                    {online(p) ? "Сейчас в приложении" : "Не в сети"}
                  </small>
                </span>
              </button>
            ))
          ) : (
            <div className="empty">
              <Users />
              <h3>Начни с приглашения</h3>
              <p>Подключитесь по коду, чтобы открыть чат и моменты.</p>
            </div>
          )}
        </section>
        <section className="friend-detail">
          {selected ? (
            <>
              <div className="card friend-header">
                <Avatar profile={selected} />
                <div>
                  <h2>{selected.display_name}</h2>
                  <span className="muted">@{selected.nickname}</span>
                </div>
                <button
                  className="icon-btn"
                  aria-label="Удалить друга"
                  onClick={() => setRemove(selected)}
                >
                  <Trash2 size={18} />
                </button>
              </div>
              <div className="segmented friend-tabs">
                {[
                  ["moments", "Моменты", Heart],
                  ["remind", "Напомнить", Bell],
                  ["chat", "Чат", MessageCircle],
                ].map(([key, title, I]) => (
                  <button
                    key={key}
                    className={tab === key ? "active" : ""}
                    onClick={() =>
                      key === "chat"
                        ? navigate("/chats?friend=" + selected.id)
                        : setTab(key)
                    }
                  >
                    <I size={16} />
                    {title}
                  </button>
                ))}
              </div>
              {tab === "remind" ? (
                <FriendReminder friend={selected} notify={notify} />
              ) : (
                <>
                  {places.length ? (
                    <>
                      <div className="friend-map">
                        <Map points={places} onSelect={setSpot} />
                      </div>
                      <div className="moments-grid">
                        {places.map((p) => (
                          <article
                            className={
                              "place-card " +
                              (spot?.id === p.id ? "highlighted" : "")
                            }
                            key={p.id}
                          >
                            <Media
                              path={p.photo}
                              alt={p.title}
                              className="moment-photo"
                            />
                            <div className="place-content">
                              <h3>{p.title}</h3>
                              <p>
                                <MapPin size={14} />
                                {p.location
                                  ? "Место на карте"
                                  : "Без геопозиции"}{" "}
                                · {p.date}
                              </p>
                              {p.location && (
                                <a
                                  className="secondary"
                                  target="_blank"
                                  rel="noreferrer"
                                  href={`https://www.google.com/maps/dir/?api=1&destination=${p.location.lat},${p.location.lng}&travelmode=walking`}
                                >
                                  <RouteIcon size={16} />
                                  Построить маршрут
                                </a>
                              )}
                            </div>
                          </article>
                        ))}
                      </div>
                    </>
                  ) : (
                    <section className="card">
                      <div className="empty">
                        <Heart />
                        <h3>Моменты ещё не открыты</h3>
                        <p>
                          Друг может отметить любимое место «Показывать
                          друзьям».
                        </p>
                      </div>
                    </section>
                  )}
                </>
              )}
            </>
          ) : (
            <section className="card">
              <div className="empty">
                <Heart />
                <h3>Выбери друга</h3>
                <p>Здесь появятся его открытые моменты.</p>
              </div>
            </section>
          )}
        </section>
      </div>
      {remove && (
        <div className="overlay" onClick={() => setRemove(null)}>
          <section
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-label="Удалить друга"
            onClick={(e) => e.stopPropagation()}
          >
            <h2>Отключить @{remove.nickname}?</h2>
            <p>
              Доступ к вашим моментам закроется. Новые сообщения и напоминания
              отправить будет нельзя. Старый чат сохранится.
            </p>
            <div className="inline">
              <button
                className="danger"
                disabled={busy}
                onClick={() =>
                  run(async () => {
                    check(
                      await supabase.rpc("remove_friend", {
                        target: remove.id,
                      }),
                    );
                    setRemove(null);
                    setSelected(null);
                    await reload();
                  })
                }
              >
                Отключить
              </button>
              <button className="secondary" onClick={() => setRemove(null)}>
                Отмена
              </button>
            </div>
          </section>
        </div>
      )}
    </>
  );
}
function FriendReminder({ friend, notify }) {
  const [title, setTitle] = useState(""),
    [body, setBody] = useState(""),
    [date, setDate] = useState(today()),
    [time, setTime] = useState(localStamp().slice(11, 16)),
    [busy, setBusy] = useState(false);
  return (
    <section className="card">
      <h2>Напомнить @{friend.nickname}</h2>
      <form
        className="form"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          try {
            check(
              await supabase.rpc("remind_friend", {
                target: friend.id,
                title,
                body,
                day: date,
                at_time: time,
              }),
            );
            setTitle("");
            setBody("");
            notify("Напоминание сохранено у друга");
          } catch (e) {
            notify(friendlyError(e));
          } finally {
            setBusy(false);
          }
        }}
      >
        <label>
          Что напомнить
          <input
            required
            maxLength={120}
            placeholder="Не забудь про встречу"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </label>
        <label>
          Сообщение
          <textarea
            maxLength={400}
            value={body}
            onChange={(e) => setBody(e.target.value)}
          />
        </label>
        <div className="form-row">
          <label>
            Дата
            <input
              type="date"
              min={today()}
              required
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </label>
          <label>
            Время Бишкека
            <input
              type="time"
              required
              value={time}
              onChange={(e) => setTime(e.target.value)}
            />
          </label>
        </div>
        <p className="hint">
          Друг увидит событие в своём разделе и сможет изменить или отключить
          его. Для доставки при закрытом сайте он должен разрешить фоновые
          уведомления.
        </p>
        <button className="primary" disabled={busy}>
          <Bell size={17} />
          {busy ? "Сохраняем…" : "Напомнить другу"}
        </button>
      </form>
    </section>
  );
}
