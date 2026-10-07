import { getMedia } from "./store";
import { api, getUser, supabase } from "./cloud";
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
export async function showNotification(title, body, tag, url = "/events") {
  if (!("Notification" in window) || Notification.permission !== "granted")
    return false;
  try {
    const reg = await navigator.serviceWorker.ready;
    await reg.showNotification(title, {
      body,
      icon: "/icon-192.png",
      tag,
      data: { url },
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
  const uid = getUser()?.id;
  return uid && localStorage.getItem(key) === uid ? uid : null;
}
export async function enablePush() {
  if (!getUser()) throw Error("Сначала настрой Supabase и войди через Google");
  const { publicKey } = await api("/api/push?action=key");
  const reg = await navigator.serviceWorker.ready;
  if (!reg.pushManager) throw Error("Этот браузер не поддерживает Push");
  const bytes = Uint8Array.from(
    atob(publicKey.replace(/-/g, "+").replace(/_/g, "/")),
    (c) => c.charCodeAt(0),
  );
  let subscription = await reg.pushManager.getSubscription();
  if (subscription) {
    const old = subscription.options.applicationServerKey;
    const oldBytes = old ? new Uint8Array(old) : null;
    if (
      !oldBytes ||
      oldBytes.length !== bytes.length ||
      !oldBytes.every((value, i) => value === bytes[i])
    ) {
      await subscription.unsubscribe();
      subscription = null;
    }
  }
  const subscribe = () =>
    reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: bytes,
    });
  subscription ||= await subscribe();
  const register = () =>
    api("/api/push", {
      method: "POST",
      body: JSON.stringify({ subscription }),
    });
  try {
    await register();
  } catch (e) {
    if (e.status !== 409) throw e;
    await subscription.unsubscribe();
    subscription = await subscribe();
    await register();
  }
  localStorage.setItem(key, getUser().id);
  return getUser().id;
}
export async function syncPush() {
  /* Reminder schedules are saved atomically in PostgreSQL. */
}
export async function disablePush() {
  const reg = await navigator.serviceWorker.ready,
    sub = await reg.pushManager.getSubscription();
  if (sub && getUser())
    await api("/api/push", {
      method: "DELETE",
      body: JSON.stringify({ endpoint: sub.endpoint }),
    });
  if (sub) await sub.unsubscribe();
  localStorage.removeItem(key);
}
