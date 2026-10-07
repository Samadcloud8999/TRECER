import { useState, useEffect } from "react";
import { ImageOff } from "lucide-react";
import { mediaURL } from "../store";
export default function Media({
  path,
  type = "image",
  alt = "",
  className = "",
}) {
  const [url, setUrl] = useState("");
  const [error, setError] = useState(false);
  useEffect(() => {
    let active = true;
    const load = () =>
      mediaURL(path)
        .then((u) => {
          if (active) {
            setUrl(u);
            setError(false);
          }
        })
        .catch(() => active && setError(true));
    load();
    const id = setInterval(load, 240000);
    return () => {
      active = false;
      clearInterval(id);
    };
  }, [path]);
  return error ? (
    <div className="media-error">
      <ImageOff />
      Файл недоступен
    </div>
  ) : !url ? (
    <div className="media-loading">Загрузка…</div>
  ) : type === "video" ? (
    <video
      className={className}
      controls
      playsInline
      preload="metadata"
      src={url}
    />
  ) : (
    <img className={className} alt={alt} src={url} />
  );
}
