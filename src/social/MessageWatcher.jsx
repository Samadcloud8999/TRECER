import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { supabase } from "../cloud";
import { useAuth } from "../Auth";
import { playSound, showNotification, pushToken } from "../notifications";
export default function MessageWatcher({ notify, audio, onUnread }) {
  const { user } = useAuth();
  const location = useLocation();
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel("inbox-" + user.id)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: "recipient_id=eq." + user.id,
        },
        ({ new: r }) => {
          onUnread?.();
          const active =
            location.pathname === "/chats" &&
            new URLSearchParams(location.search).get("friend") ===
              r.sender_id &&
            document.visibilityState === "visible";
          if (!active) {
            notify(
              r.media_type === "video"
                ? "Новое видео от друга"
                : r.media_type === "image"
                  ? "Новое фото от друга"
                  : "Друг: " + r.body.slice(0, 100),
            );
            if (audio) playSound();
            if (!pushToken())
              showNotification(
                "Сообщение от друга",
                r.body || "Новое вложение",
                "message-" + r.id,
                "/chats?friend=" + r.sender_id,
              );
          }
        },
      )
      .subscribe();
    return () => supabase.removeChannel(channel);
  }, [user, location.pathname, location.search, audio]);
  return null;
}
