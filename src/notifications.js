import { getMedia } from "./store";
let ctx;
let current;
export async function unlockAudio() {
  const C = window.AudioContext || window.webkitAudioContext;
  if (C) {
    ctx ||= new C();
    await ctx.resume();
  }
}
export function stopSound() {
  if (current) {
    current.pause();
    current = null;
  }
}
export async function playSound(id) {
  stopSound();
  if (id) {
    const blob = await getMedia(id);
    if (blob) {
      const url = URL.createObjectURL(blob);
      current = new Audio(url);
      current.onended = () => URL.revokeObjectURL(url);
      try {
        await current.play();
        return true;
      } catch {
        URL.revokeObjectURL(url);
        return false;
      }
    }
  }
  try {
    await unlockAudio();
    for (let i = 0; i < 3; i++) {
      const oscillator = ctx.createOscillator(),
        gain = ctx.createGain();
      oscillator.type = "sine";
      oscillator.frequency.value = i % 2 ? 660 : 880;
      gain.gain.setValueAtTime(0, ctx.currentTime + i * 0.3);
      gain.gain.linearRampToValueAtTime(0.12, ctx.currentTime + i * 0.3 + 0.02);
      gain.gain.exponentialRampToValueAtTime(
        0.001,
        ctx.currentTime + i * 0.3 + 0.25,
      );
      oscillator.connect(gain);
      gain.connect(ctx.destination);
      oscillator.start(ctx.currentTime + i * 0.3);
      oscillator.stop(ctx.currentTime + i * 0.3 + 0.3);
    }
    return true;
  } catch {
    return false;
  }
}
export async function showNotification(title, body, tag) {
  if (!("Notification" in window) || Notification.permission !== "granted")
    return false;
  try {
    const reg = await navigator.serviceWorker.ready;
    await reg.showNotification(title, {
      body,
      icon: "/icon.svg",
      tag,
      data: { url: "/events" },
    });
    return true;
  } catch {
    return false;
  }
}
export async function requestNotifications() {
  if (!("Notification" in window))
    throw Error(
      "Этот браузер не поддерживает уведомления. На iPhone установи приложение на экран «Домой».",
    );
  await unlockAudio();
  return Notification.requestPermission();
}
const key = "karman-push-token";
export function pushToken() {
  return localStorage.getItem(key);
}
export async function enablePush(reminders) {
  const r = await fetch("/api/push?action=key");
  if (!r.ok)
    throw Error(
      "Фоновые уведомления требуют настройки сервера. Инструкция находится в README.",
    );
  const { publicKey } = await r.json();
  const reg = await navigator.serviceWorker.ready;
  const bytes = Uint8Array.from(
    atob(publicKey.replace(/-/g, "+").replace(/_/g, "/")),
    (c) => c.charCodeAt(0),
  );
  const subscription = await reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: bytes,
  });
  let token = pushToken() || crypto.randomUUID() + crypto.randomUUID();
  const response = await fetch("/api/push", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token, subscription, reminders }),
  });
  if (!response.ok) throw Error("Не удалось подключить сервер уведомлений");
  localStorage.setItem(key, token);
  return token;
}
export async function syncPush(reminders) {
  const token = pushToken();
  if (!token) return;
  const r = await fetch("/api/push", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token, reminders }),
  });
  if (!r.ok)
    throw Error("Фоновые напоминания не синхронизированы. Проверь сервер.");
}

export async function disablePush() {
  const token = pushToken();
  if (token) {
    const r = await fetch("/api/push", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    });
    if (!r.ok)
      throw Error("Не удалось отключить фоновые уведомления на сервере");
  }
  const reg = await navigator.serviceWorker.ready;
  const sub = await reg.pushManager.getSubscription();
  if (sub) await sub.unsubscribe();
  localStorage.removeItem(key);
}
