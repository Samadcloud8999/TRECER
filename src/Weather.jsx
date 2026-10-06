import { useEffect, useState } from "react";
import { CloudSun, RefreshCw, CloudRain, Sun, Snowflake } from "lucide-react";
import { localStamp } from "./core";
const Icon = ({ code, ...rest }) => {
  const C =
    code >= 71 && code <= 77
      ? Snowflake
      : code >= 51
        ? CloudRain
        : code <= 1
          ? Sun
          : CloudSun;
  return <C {...rest} />;
};
export default function Weather({ full = false }) {
  const [data, setData] = useState();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function load(signal) {
    setBusy(true);
    setError("");
    try {
      const r = await fetch(
        "https://api.open-meteo.com/v1/forecast?latitude=42.8746&longitude=74.5698&current=temperature_2m,weather_code,wind_speed_10m&hourly=temperature_2m,precipitation_probability,weather_code&daily=temperature_2m_max,temperature_2m_min,weather_code&timezone=Asia%2FBishkek&forecast_days=5",
        { signal },
      );
      if (!r.ok) throw Error();
      const d = await r.json();
      if (!d.current || !d.hourly) throw Error();
      setData(d);
    } catch (e) {
      if (e.name !== "AbortError")
        setError("Не удалось загрузить погоду. Проверь интернет.");
    } finally {
      setBusy(false);
    }
  }
  useEffect(() => {
    const c = new AbortController();
    load(c.signal);
    const id = setInterval(() => load(c.signal), 30 * 60 * 1000);
    return () => {
      c.abort();
      clearInterval(id);
    };
  }, []);
  const start =
    data?.hourly.time.findIndex(
      (t) => t >= localStamp().slice(0, 13) + ":00",
    ) ?? 0;
  return (
    <section className={"card weather " + (full ? "full-weather" : "")}>
      <div className="section-head">
        <div>
          <span className="eyebrow">БИШКЕК</span>
          <h2>Погода рядом</h2>
        </div>
        <button
          className="icon-btn"
          onClick={() => load()}
          disabled={busy}
          aria-label="Обновить погоду"
        >
          <RefreshCw size={18} className={busy ? "spin" : ""} />
        </button>
      </div>
      {error ? (
        <p className="muted">{error}</p>
      ) : !data ? (
        <p className="muted">Загружаем прогноз…</p>
      ) : (
        <>
          <div className="weather-current">
            <Icon code={data.current.weather_code} size={52} />
            <strong>{Math.round(data.current.temperature_2m)}°</strong>
            <div>
              <b>Сейчас в городе</b>
              <span>Ветер {data.current.wind_speed_10m} км/ч</span>
            </div>
          </div>
          <div className="weather-hours">
            {data.hourly.time
              .slice(Math.max(start, 0), Math.max(start, 0) + 6)
              .map((time, i) => {
                const k = Math.max(start, 0) + i;
                return (
                  <div key={time}>
                    <span>{time.slice(11, 16)}</span>
                    <Icon code={data.hourly.weather_code[k]} size={22} />
                    <b>{Math.round(data.hourly.temperature_2m[k])}°</b>
                    <small>
                      {data.hourly.precipitation_probability[k]}% дождя
                    </small>
                  </div>
                );
              })}
          </div>
          {full && (
            <div className="forecast">
              {data.daily.time.map((d, i) => (
                <div key={d}>
                  <b>
                    {new Date(d + "T12:00:00").toLocaleDateString("ru-RU", {
                      weekday: "long",
                      day: "numeric",
                      month: "short",
                    })}
                  </b>
                  <Icon code={data.daily.weather_code[i]} size={24} />
                  <span>
                    {Math.round(data.daily.temperature_2m_max[i])}° /{" "}
                    {Math.round(data.daily.temperature_2m_min[i])}°
                  </span>
                </div>
              ))}
            </div>
          )}
          <a
            className="attribution"
            href="https://open-meteo.com/"
            target="_blank"
            rel="noreferrer"
          >
            Прогноз Open-Meteo · обновлён {data.current.time.slice(11, 16)}
          </a>
        </>
      )}
    </section>
  );
}
