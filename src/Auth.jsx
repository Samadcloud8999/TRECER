import { createContext, useContext, useState, useEffect } from "react";
import { Wallet, Download, Cloud, AlertCircle } from "lucide-react";
import {
  supabase,
  cloudConfigured,
  setUser,
  check,
  friendlyError,
} from "./cloud";
const Auth = createContext({
  user: null,
  profile: null,
  refreshProfile: async () => {},
});
export const useAuth = () => useContext(Auth);
export function AuthProvider({ children }) {
  const [user, setSessionUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(cloudConfigured);
  const [error, setError] = useState("");
  async function refreshProfile() {
    if (!supabase) return;
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (session)
      setProfile(
        check(
          await supabase
            .from("profiles")
            .select("*")
            .eq("id", session.user.id)
            .single(),
        ),
      );
  }
  useEffect(() => {
    if (!supabase) return;
    let active = true;
    function update(session) {
      if (!active) return;
      setUser(session?.user || null);
      setSessionUser(session?.user || null);
      setLoading(false);
      if (!session) setProfile(null);
      if (session)
        setTimeout(
          () => refreshProfile().catch((e) => setError(friendlyError(e))),
          0,
        );
    }
    supabase.auth.getSession().then(({ data, error }) => {
      if (error) setError(error.message);
      update(data.session);
    });
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_, session) => update(session));
    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);
  useEffect(() => {
    if (!user || !supabase) return;
    const beat = () => {
      if (document.visibilityState === "visible")
        supabase.rpc("heartbeat").then(({ error }) => {
          if (error) console.warn("Presence unavailable");
        });
    };
    beat();
    const id = setInterval(beat, 25000);
    document.addEventListener("visibilitychange", beat);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", beat);
    };
  }, [user]);
  return (
    <Auth.Provider value={{ user, profile, refreshProfile, loading, error }}>
      {children}
    </Auth.Provider>
  );
}
export function AuthGate({ children }) {
  const { user, loading, error } = useAuth();
  const [message, setMessage] = useState("");
  if (loading)
    return (
      <div className="loading">
        <Wallet />
        <h2>Проверяем аккаунт…</h2>
      </div>
    );
  if (!cloudConfigured) return children;
  if (user) return children;
  return (
    <div className="auth-screen">
      <div className="auth-art">
        <Wallet size={54} />
        <h1>
          Твой карман.
          <br />
          Твои моменты.
        </h1>
        <p>
          Расходы, любимые места и друзья — вместе с тобой на любом устройстве.
        </p>
        <div className="auth-feature">
          <Cloud />
          Сохраняется в твоём аккаунте
        </div>
      </div>
      <section className="auth-panel">
        <span className="eyebrow">ЛИЧНОЕ ПРОСТРАНСТВО</span>
        <h1>Рады видеть тебя</h1>
        <p>
          Войди через Google. Если аккаунт уже существует, откроется твой
          дневник.
        </p>
        <button
          className="google-button"
          onClick={async () => {
            try {
              check(
                await supabase.auth.signInWithOAuth({
                  provider: "google",
                  options: {
                    redirectTo: window.location.origin + "/",
                    queryParams: { prompt: "select_account" },
                  },
                }),
              );
            } catch (e) {
              setMessage(e.message);
            }
          }}
        >
          <span className="google-g">G</span>Продолжить с Google
        </button>
        {(message || error) && <p className="error">{message || error}</p>}
        <div className="auth-note">
          <AlertCircle size={18} />
          <span>
            Места видны друзьям только после твоего разрешения. Администратор
            может видеть профили и загруженные фото для управления сервисом.
          </span>
        </div>
        <InstallApp />
      </section>
    </div>
  );
}
export function InstallApp() {
  const [prompt, setPrompt] = useState(window.karmanInstallPrompt);
  const [installed, setInstalled] = useState(
    matchMedia("(display-mode: standalone)").matches,
  );
  useEffect(() => {
    const on = (e) => {
        e.preventDefault();
        window.karmanInstallPrompt = e;
        setPrompt(e);
      },
      done = () => {
        setInstalled(true);
        setPrompt(null);
      };
    window.addEventListener("beforeinstallprompt", on);
    window.addEventListener("appinstalled", done);
    return () => {
      window.removeEventListener("beforeinstallprompt", on);
      window.removeEventListener("appinstalled", done);
    };
  }, []);
  return (
    <div className="install-box">
      <div>
        <b>
          {installed ? "Приложение установлено" : "Карман на главном экране"}
        </b>
        <p>
          Логотип, быстрый запуск и уведомления. В Chrome нажми «Установить
          приложение». На iPhone: «Поделиться» → «На экран Домой».
        </p>
      </div>
      {prompt && !installed && (
        <button
          className="secondary"
          onClick={async () => {
            await prompt.prompt();
            await prompt.userChoice;
            setPrompt(null);
            window.karmanInstallPrompt = null;
          }}
        >
          <Download size={17} />
          Установить
        </button>
      )}
    </div>
  );
}
