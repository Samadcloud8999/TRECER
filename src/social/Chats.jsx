import { useState, useEffect, useRef } from "react";
import { useSearchParams, NavLink } from "react-router-dom";
import {
  MessageCircle,
  Send,
  Paperclip,
  X,
  CheckCheck,
  Bell,
  Users,
} from "lucide-react";
import { supabase, check, friendlyError, api } from "../cloud";
import { useAuth } from "../Auth";
import { loadFriends, Avatar, online, CloudRequired } from "./Friends";
import { saveMedia, dropMedia } from "../store";
import Media from "./Media";
export default function Chats({ notify }) {
  const { user } = useAuth();
  const [params, setParams] = useSearchParams();
  const candidate = params.get("friend");
  const selected =
    /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(
      candidate || "",
    )
      ? candidate
      : null;
  const [friends, setFriends] = useState([]),
    [messages, setMessages] = useState([]),
    [text, setText] = useState(""),
    [file, setFile] = useState(null),
    [busy, setBusy] = useState(false),
    [loading, setLoading] = useState(false),
    [unread, setUnread] = useState({});
  const attachment = useRef(),
    bottom = useRef();
  const active = friends.find((p) => p.id === selected);
  async function refreshFriends() {
    setFriends(await loadFriends(user.id));
  }
  async function countUnread() {
    const rows = check(
      await supabase
        .from("messages")
        .select("sender_id")
        .eq("recipient_id", user.id)
        .is("read_at", null),
    );
    const counts = {};
    rows.forEach((r) => (counts[r.sender_id] = (counts[r.sender_id] || 0) + 1));
    setUnread(counts);
  }
  useEffect(() => {
    if (!user) return;
    refreshFriends().catch((e) => notify(friendlyError(e)));
    countUnread().catch(() => {});
    const id = setInterval(() => {
      refreshFriends().catch(() => {});
      countUnread().catch(() => {});
    }, 15000);
    return () => clearInterval(id);
  }, [user]);
  useEffect(() => {
    if (!user || !selected) {
      setMessages([]);
      return;
    }
    let alive = true;
    setText("");
    setFile(null);
    setLoading(true);
    const load = async () => {
      const rows = check(
        await supabase
          .from("messages")
          .select("*")
          .or(
            `and(sender_id.eq.${user.id},recipient_id.eq.${selected}),and(sender_id.eq.${selected},recipient_id.eq.${user.id})`,
          )
          .order("created_at", { ascending: false })
          .limit(200),
      );
      if (alive) {
        setMessages(rows.reverse());
        setLoading(false);
      }
      if (document.visibilityState === "visible")
        await supabase.rpc("mark_read", { friend_id: selected });
      await countUnread();
    };
    load().catch((e) => {
      notify(friendlyError(e));
      setLoading(false);
    });
    const channel = supabase
      .channel("chat-" + user.id + "-" + selected)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "messages" },
        () => load().catch(() => {}),
      )
      .subscribe();
    const timer = setInterval(() => load().catch(() => {}), 10000);
    const visible = () => {
      if (document.visibilityState === "visible") load().catch(() => {});
    };
    document.addEventListener("visibilitychange", visible);
    return () => {
      alive = false;
      clearInterval(timer);
      document.removeEventListener("visibilitychange", visible);
      supabase.removeChannel(channel);
    };
  }, [selected, user]);
  useEffect(() => {
    bottom.current?.scrollIntoView?.({
      behavior: matchMedia("(prefers-reduced-motion: reduce)").matches
        ? "instant"
        : "smooth",
      block: "end",
    });
  }, [messages.length, selected]);
  if (!user) return <CloudRequired />;
  async function send(e) {
    e.preventDefault();
    if (!active || (!text.trim() && !file)) return;
    setBusy(true);
    let path;
    try {
      if (file) path = (await saveMedia(file, "chat")).slice(6);
      const id = crypto.randomUUID();
      check(
        await supabase.from("messages").insert({
          id,
          sender_id: user.id,
          recipient_id: selected,
          body: text.trim(),
          media_path: path || null,
          media_type: file
            ? file.type.startsWith("video/")
              ? "video"
              : "image"
            : null,
        }),
      );
      setMessages((m) =>
        m.some((x) => x.id === id)
          ? m
          : [
              ...m,
              {
                id,
                sender_id: user.id,
                recipient_id: selected,
                body: text.trim(),
                media_path: path,
                media_type: file
                  ? file.type.startsWith("video/")
                    ? "video"
                    : "image"
                  : null,
                created_at: new Date().toISOString(),
              },
            ],
      );
      setText("");
      setFile(null);
      api("/api/notify", {
        method: "POST",
        body: JSON.stringify({ messageId: id }),
      }).catch(() => {
        /* cron fallback sends queued notifications */
      });
    } catch (e) {
      if (path) await dropMedia("cloud:" + path).catch(() => {});
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
            Разговоры<span className="heading-dot">.</span>
          </h1>
          <p>Фото, видео и сообщения — рядом с друзьями.</p>
        </div>
        <NavLink className="secondary" to="/friends">
          <Users size={17} />К друзьям
        </NavLink>
      </div>
      <div className="chat-shell">
        <aside className="chat-sidebar">
          <div className="chat-list-title">
            <MessageCircle size={19} />
            <b>Чаты</b>
          </div>
          {friends.length ? (
            friends.map((p) => (
              <button
                className={
                  "friend-row " + (selected === p.id ? "selected" : "")
                }
                key={p.id}
                onClick={() => setParams({ friend: p.id })}
              >
                <Avatar profile={p} />
                <span>
                  <b>@{p.nickname}</b>
                  <small className={online(p) ? "online-label" : ""}>
                    {online(p) ? "В приложении" : "Не в сети"}
                  </small>
                </span>
                {unread[p.id] > 0 && (
                  <i className="unread-badge">{unread[p.id]}</i>
                )}
              </button>
            ))
          ) : (
            <div className="empty">
              <MessageCircle />
              <p>Добавь друга по коду, чтобы начать чат.</p>
            </div>
          )}
        </aside>
        <section className="chat-main">
          {active ? (
            <>
              <header className="chat-header">
                <Avatar profile={active} />
                <div>
                  <h3>{active.display_name || active.nickname}</h3>
                  <p>
                    @{active.nickname} ·{" "}
                    {online(active) ? "В приложении" : "Не в сети"}
                  </p>
                </div>
                <NavLink
                  className="icon-btn"
                  to="/friends"
                  aria-label="Напомнить другу"
                >
                  <Bell size={19} />
                </NavLink>
              </header>
              <div className="chat-messages">
                {loading ? (
                  <div className="empty">Загружаем сообщения…</div>
                ) : !messages.length ? (
                  <div className="empty">
                    <MessageCircle />
                    <h3>Первое «привет» — за тобой</h3>
                  </div>
                ) : (
                  messages.map((m) => (
                    <div
                      className={
                        "message " + (m.sender_id === user.id ? "mine" : "")
                      }
                      key={m.id}
                    >
                      {m.media_path && (
                        <Media
                          path={m.media_path}
                          type={m.media_type}
                          alt="Вложение в чате"
                          className="chat-media"
                        />
                      )}
                      {m.body && <p>{m.body}</p>}
                      <span className="message-meta">
                        {new Date(m.created_at).toLocaleString("ru-RU", {
                          timeZone: "Asia/Bishkek",
                          day: "numeric",
                          month: "short",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                        {m.sender_id === user.id && (
                          <CheckCheck
                            size={14}
                            className={m.read_at ? "read" : ""}
                          />
                        )}
                      </span>
                    </div>
                  ))
                )}
                <div ref={bottom} />
              </div>
              <form className="chat-composer" onSubmit={send}>
                {file && (
                  <div className="attachment-preview">
                    <Paperclip size={16} />
                    <span>{file.name}</span>
                    <button
                      type="button"
                      className="icon-btn"
                      aria-label="Убрать вложение"
                      onClick={() => setFile(null)}
                    >
                      <X size={16} />
                    </button>
                  </div>
                )}
                <div className="composer-row">
                  <button
                    type="button"
                    className="icon-btn"
                    aria-label="Прикрепить фото или видео"
                    onClick={() => attachment.current.click()}
                    disabled={busy}
                  >
                    <Paperclip size={21} />
                  </button>
                  <input
                    ref={attachment}
                    hidden
                    type="file"
                    accept="image/*,video/mp4,video/webm,video/quicktime"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      e.target.value = "";
                      if (!f) return;
                      if (
                        !f.type.startsWith("image/") &&
                        !f.type.startsWith("video/")
                      )
                        return notify("Выбери фото или видео");
                      if (f.size > 50 * 1024 * 1024)
                        return notify("Размер файла не должен превышать 50 МБ");
                      setFile(f);
                    }}
                  />
                  <textarea
                    aria-label="Сообщение"
                    rows={1}
                    maxLength={4000}
                    placeholder="Напиши сообщение…"
                    value={text}
                    disabled={busy}
                    onChange={(e) => setText(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        if (!busy) send(e);
                      }
                    }}
                  />
                  <button
                    className="send-button"
                    aria-label="Отправить сообщение"
                    disabled={busy || (!text.trim() && !file)}
                  >
                    <Send size={20} />
                  </button>
                </div>
                <small>
                  {busy
                    ? "Отправляем…"
                    : "Enter — отправить · Shift + Enter — новая строка · фото и видео до 50 МБ"}
                </small>
              </form>
            </>
          ) : (
            <div className="chat-empty">
              <MessageCircle size={44} />
              <h2>Выбери разговор</h2>
              <p>Личное общение с теми, кто рядом.</p>
            </div>
          )}
        </section>
      </div>
    </>
  );
}
