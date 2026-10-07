import React from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import App from "./App";
import { AuthProvider, AuthGate, useAuth } from "./Auth";
import Admin from "./social/Admin";
import "./style.css";
import "./social.css";
import "leaflet/dist/leaflet.css";
window.addEventListener("beforeinstallprompt", (e) => {
  e.preventDefault();
  window.karmanInstallPrompt = e;
});
function Diary() {
  const { user } = useAuth();
  return (
    <AuthGate>
      <App key={user?.id || "local"} />
    </AuthGate>
  );
}
createRoot(document.getElementById("root")).render(
  <BrowserRouter>
    <AuthProvider>
      <Routes>
        <Route path="/admin" element={<Admin />} />
        <Route path="*" element={<Diary />} />
      </Routes>
    </AuthProvider>
  </BrowserRouter>,
);
if ("serviceWorker" in navigator)
  navigator.serviceWorker.register("/sw.js").catch(console.error);
