"use client";

import { useEffect } from "react";

const RELOAD_KEY = "mitsu-sw-cleared";

export function ServiceWorkerRegister() {
  useEffect(() => {
    if (typeof navigator === "undefined") return;

    // The Tauri shell always defines this property, even when the backend
    // failed to start (its value is then empty).
    const desktop = typeof window !== "undefined" && "__MITSU_API_BASE__" in window;

    if (desktop) {
      // An earlier shell build could have registered the PWA worker while the
      // backend was unavailable. That worker caches the shell and would keep
      // serving stale chunks after an update, so remove it and its caches.
      if ("serviceWorker" in navigator) {
        navigator.serviceWorker
          .getRegistrations()
          .then(async (registrations) => {
            if (registrations.length === 0) return;
            const controlled = Boolean(navigator.serviceWorker.controller);
            await Promise.all(
              registrations.map((registration) => registration.unregister())
            );
            if (!controlled) return;
            if (sessionStorage.getItem(RELOAD_KEY)) return;
            sessionStorage.setItem(RELOAD_KEY, "1");
            const url = new URL(window.location.href);
            url.searchParams.set("clean", Date.now().toString(36));
            window.location.replace(url.toString());
          })
          .catch(() => undefined);
      }
      if ("caches" in window) {
        window.caches
          .keys()
          .then((keys) =>
            Promise.all(
              keys
                .filter((key) => key.startsWith("mitsu-"))
                .map((key) => window.caches.delete(key))
            )
          )
          .catch(() => undefined);
      }
      return;
    }

    if (!("serviceWorker" in navigator)) return;
    // A dev server rebuilds constantly; the service worker is for the packaged app.
    if (process.env.NODE_ENV !== "production") return;

    const register = () => {
      navigator.serviceWorker
        .register("/sw.js", { scope: "/" })
        .catch(() => undefined);
    };

    if (document.readyState === "complete") register();
    else window.addEventListener("load", register, { once: true });
  }, []);

  return null;
}
