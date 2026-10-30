"use client";

import { useEffect, useState } from "react";
import { Icon } from "@/components/Icon";
import { Button } from "@/components/ui";

declare global {
  interface Window {
    /** Injected by the Tauri shell before the app boots. Empty in a browser. */
    __MITSU_API_BASE__?: string;
    /** Set by the Tauri shell when the bundled API could not be started. */
    __MITSU_BACKEND_ERROR__?: string;
  }
}

function isDesktop() {
  if (typeof window === "undefined") return false;
  // The shell always defines the base (an empty string when the backend could
  // not start), so the property itself is the marker.
  return "__MITSU_API_BASE__" in window || "__TAURI_INTERNALS__" in window;
}

function isExternalHref(href: string) {
  try {
    const url = new URL(href, window.location.href);
    if (url.protocol !== "http:" && url.protocol !== "https:") return false;
    // Downloads and the local API stay inside the webview.
    return !["tauri.localhost", "localhost", "127.0.0.1"].includes(url.hostname);
  } catch {
    return false;
  }
}

/**
 * Desktop-only shell behaviour that the browser build does not need:
 *
 * - links to other sites open in the user's browser instead of replacing the app
 * - a failed backend start is explained instead of leaving every page broken
 */
export function DesktopShell() {
  const [backendError, setBackendError] = useState("");

  useEffect(() => {
    if (!isDesktop()) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setBackendError(window.__MITSU_BACKEND_ERROR__ || "");
  }, []);

  useEffect(() => {
    if (!isDesktop()) return;

    const onClick = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;

      const anchor = (event.target as Element | null)?.closest?.("a[href]") as
        | HTMLAnchorElement
        | null;
      if (!anchor) return;

      const href = anchor.href;
      if (!isExternalHref(href)) return;

      // The webview has no browser chrome, so following the link in place would
      // strand the user on a site with no way back.
      event.preventDefault();
      event.stopPropagation();

      import("@tauri-apps/api/core")
        .then(({ invoke }) => invoke("open_external", { url: href }))
        .catch(() => undefined);
    };

    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, []);

  if (!backendError) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-bg/95 p-6 backdrop-blur-xl"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="desktop-backend-error-title"
    >
      <div className="w-full max-w-md rounded-[28px] border border-border bg-surface p-6 shadow-float">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-danger/10 text-danger">
          <Icon name="alert" size={22} />
        </div>
        <h1
          id="desktop-backend-error-title"
          className="mt-4 text-[20px] font-bold tracking-[-0.03em] text-text"
        >
          Mitsu could not start its local library
        </h1>
        <p className="mt-2 text-[13px] leading-relaxed text-text-secondary">
          The window opened, but the bundled API did not answer, so your files were
          left untouched. Restart the app to try again.
        </p>
        <pre className="mt-3 max-h-32 overflow-auto whitespace-pre-wrap rounded-2xl bg-surface-soft p-3 text-[11px] leading-relaxed text-text-muted">
          {backendError}
        </pre>
        <div className="mt-5 flex gap-2">
          <Button onClick={() => window.location.reload()}>Try again</Button>
        </div>
        <p className="mt-4 text-[11px] leading-relaxed text-text-muted">
          Details are written to <code>logs/backend.log</code> in the Mitsu data folder.
        </p>
      </div>
    </div>
  );
}
