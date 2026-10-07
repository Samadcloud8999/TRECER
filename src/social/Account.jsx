import { useState, useEffect } from "react";
import {
  LogOut,
  CloudUpload,
  UserRound,
  RefreshCw,
  ShieldCheck,
} from "lucide-react";
import { supabase, cloudConfigured, check, friendlyError, api } from "../cloud";
import { useAuth, InstallApp } from "../Auth";
import { Avatar } from "./Friends";
export default function Account({ notify, reload, onMigrate }) {
  const { user, profile, refreshProfile } = useAuth();
  const [nick, setNick] = useState(""),
    [name, setName] = useState(""),
    [busy, setBusy] = useState(false),
    [confirm, setConfirm] = useState(false);
  useEffect(() => {
    setNick(profile?.nickname || "");
    setName(profile?.display_name || "");
  }, [profile]);
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
            Мой аккаунт<span className="heading-dot">.</span>
          </h1>
          <p>Один Google-аккаунт — один дневник на всех устройствах.</p>
        </div>
      </div>
      {user ? (
        <div className="account-grid">
          <section className="card">
            <div className="account-head">
              <Avatar profile={profile} />
              <div>
                <h2>{profile?.display_name || "Мой профиль"}</h2>
                <p className="muted">{user.email}</p>
              </div>
            </div>
            <form
              className="form"
              onSubmit={(e) => {
                e.preventDefault();
                run(async () => {
                  check(
                    await supabase.rpc("update_profile", {
                      nick: nick.trim().toLowerCase(),
                      display: name.trim(),
                    }),
                  );
                  await refreshProfile();
                  notify("Профиль обновлён");
                });
              }}
            >
              <label>
                Никнейм
                <input
                  required
                  pattern="[a-z][a-z0-9_]{2,23}"
                  minLength={3}
                  maxLength={24}
                  value={nick}
                  onChange={(e) => setNick(e.target.value.toLowerCase())}
                  placeholder="samandar"
                />
              </label>
              <p className="hint">
                3–24 символа: латинские буквы, цифры и _. Регистр, подчёркивания
                и замены o/0, l/1, e/3, s/5, t/7 не создают отдельный никнейм.
                Имя с одной заменой, вставкой или удалением символа относительно
                занятого также не допускается.
              </p>
              <label>
                Имя
                <input
                  maxLength={80}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </label>
              <button className="primary" disabled={busy}>
                Сохранить профиль
              </button>
            </form>
            <button
              className="secondary signout"
              disabled={busy}
              onClick={() =>
                run(async () => {
                  try {
                    const reg = await navigator.serviceWorker?.ready;
                    const sub = await reg?.pushManager?.getSubscription();
                    if (sub) {
                      try {
                        await api("/api/push", {
                          method: "DELETE",
                          body: JSON.stringify({ endpoint: sub.endpoint }),
                        });
                      } finally {
                        await sub.unsubscribe();
                      }
                    }
                  } catch {}
                  localStorage.removeItem("karman-push-token");
                  check(await supabase.auth.signOut());
                })
              }
            >
              <LogOut size={17} />
              Выйти из аккаунта
            </button>
          </section>
          <section className="card">
            <CloudUpload className="account-symbol" />
            <h2>Перенести старый дневник</h2>
            <p className="muted">
              Локальные покупки, места, фото и мелодии останутся в этом
              браузере. Можно скопировать их в пустой облачный аккаунт — другие
              устройства увидят их после входа.
            </p>
            <button
              className="secondary"
              disabled={busy}
              onClick={() => setConfirm(true)}
            >
              Перенести записи в аккаунт
            </button>
            <div className="privacy-note">
              <ShieldCheck />
              <p>
                Покупки и накопления личные. Друзьям доступны только отмеченные
                места с их координатами. Администратор видит профили и
                загруженные фотографии для управления сервисом.
              </p>
            </div>
          </section>
        </div>
      ) : (
        <section className="card">
          <h2>Google-вход пока не настроен</h2>
          <p className="muted">
            Добавь переменные Supabase и настройки Google OAuth по SETUP.md,
            затем пересобери проект на Vercel. Старый локальный дневник
            продолжает работать.
          </p>
        </section>
      )}
      <InstallApp />
      {confirm && (
        <div className="overlay">
          <section
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-label="Перенести дневник"
          >
            <h2>Скопировать локальные записи?</h2>
            <p>
              Этот перенос работает только в пустой аккаунт и не удаляет старый
              дневник в браузере.
            </p>
            <div className="inline">
              <button
                className="primary"
                disabled={busy}
                onClick={() =>
                  run(async () => {
                    await onMigrate();
                    await reload();
                    setConfirm(false);
                    notify("Записи перенесены в облако");
                  })
                }
              >
                Перенести
              </button>
              <button className="secondary" onClick={() => setConfirm(false)}>
                Отмена
              </button>
            </div>
          </section>
        </div>
      )}
    </>
  );
}
