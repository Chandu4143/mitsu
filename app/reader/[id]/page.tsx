"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { api } from "@/lib/api";
import { Icon } from "@/components/Icon";
import { Button } from "@/components/ui";

type FitMode = "width" | "screen";
type ReaderMode = "single" | "continuous";
type Direction = "ltr" | "rtl";

function useDebouncedCallback(callback: (value: number) => void, delay: number) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  return (value: number) => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => callback(value), delay);
  };
}

function ReaderInner() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const id = params?.id as string;

  const [total, setTotal] = useState(0);
  const [title, setTitle] = useState("Loading…");
  const [page, setPage] = useState(1);
  const [mode, setMode] = useState<ReaderMode>("single");
  const [fit, setFit] = useState<FitMode>("width");
  const [direction, setDirection] = useState<Direction>("ltr");
  const [background, setBackground] = useState("dark");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const continuousRef = useRef<HTMLDivElement | null>(null);
  const pageRefs = useRef<Record<number, HTMLDivElement | null>>({});
  const lastSavedPage = useRef(0);

  const queryPage = Number(searchParams.get("page") || 0);

  useEffect(() => {
    if (!id) return;
    let active = true;
    Promise.all([api.getGallery(id), api.getProgress(id), api.getSettings().catch(() => null)])
      .then(([g, progress, settings]) => {
        if (!active) return;
        setTitle(g.title);
        setTotal(g.page_count || 0);
        const prefs = settings?.preferences || {};
        setMode(prefs.reader_mode === "continuous" ? "continuous" : "single");
        setFit(prefs.fit_mode === "screen" ? "screen" : "width");
        setDirection(prefs.reading_direction === "rtl" ? "rtl" : "ltr");
        setBackground(prefs.reader_background || "dark");
        const initial =
          queryPage > 0
            ? Math.min(g.page_count || 1, Math.max(1, queryPage))
            : (progress?.current_page || 0) + 1;
        setPage(initial);
        lastSavedPage.current = initial - 1;
      })
      .catch(() => {
        if (active) setError("Unable to load this gallery.");
      });
    return () => {
      active = false;
    };
  }, [id, queryPage]);

  const saveProgressNow = (pageNumber: number) => {
    if (!id || total <= 0) return;
    const currentPage = Math.min(total, Math.max(1, pageNumber));
    const status = currentPage >= total ? "completed" : "reading";
    setSaving(true);
    api
      .setProgress(id, { current_page: currentPage - 1, status })
      .catch(() => {})
      .finally(() => setSaving(false));
    lastSavedPage.current = currentPage - 1;
  };

  const debouncedSave = useDebouncedCallback(saveProgressNow, 600);

  const go = (delta: number) => {
    setPage((current) => {
      const next = Math.min(total, Math.max(1, current + delta * (direction === "rtl" ? -1 : 1)));
      if (next !== current) debouncedSave(next);
      return next;
    });
  };

  const persistPrefs = (patch: Record<string, string>) => {
    api.saveSettings(patch).catch(() => {});
  };

  const updateMode = (next: ReaderMode) => {
    setMode(next);
    persistPrefs({ reader_mode: next });
  };
  const updateFit = (next: FitMode) => {
    setFit(next);
    persistPrefs({ fit_mode: next });
  };
  const updateDirection = (next: Direction) => {
    setDirection(next);
    persistPrefs({ reading_direction: next });
  };
  const updateBackground = (next: string) => {
    setBackground(next);
    persistPrefs({ reader_background: next });
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen?.();
    } else {
      document.exitFullscreen?.();
    }
  };

  useEffect(() => {
    if (mode !== "single") return;
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target && ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName)) return;
      if (event.key === "ArrowRight") {
        event.preventDefault();
        go(1);
      }
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        go(-1);
      }
      if (event.key === " " || event.key === "Spacebar") {
        event.preventDefault();
        go(1);
      }
      if (event.key === "Home") {
        event.preventDefault();
        setPage(1);
        debouncedSave(1);
      }
      if (event.key === "End") {
        event.preventDefault();
        setPage(total);
        debouncedSave(total);
      }
      if (event.key.toLowerCase() === "f") {
        event.preventDefault();
        toggleFullscreen();
      }
      if (event.key === "Escape") {
        setShowControls((value) => !value);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [mode, total, direction]);

  useEffect(() => {
    if (mode !== "continuous" || total <= 0) return;
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (!visible) return;
        const index = Number(visible.target.getAttribute("data-page"));
        if (!index || index === page) return;
        setPage(index);
        debouncedSave(index);
      },
      {
        root: continuousRef.current,
        threshold: [0.35, 0.6],
      }
    );
    Object.values(pageRefs.current).forEach((node) => {
      if (node) observer.observe(node);
    });
    return () => observer.disconnect();
  }, [mode, total, page]);

  useEffect(() => {
    return () => {
      if (page !== lastSavedPage.current + 1) saveProgressNow(page);
    };
  }, [page]);

  const backgroundClass =
    background === "warm"
      ? "bg-[#29201e] text-[#F0E3DD]"
      : background === "black"
      ? "bg-black text-[#E8DCE2]"
      : "bg-reader-bg text-reader-text";

  const fitClass =
    fit === "screen"
      ? "max-h-[calc(100dvh-190px)] max-w-full object-contain md:max-h-[calc(100dvh-176px)] md:max-w-[calc(100vw-96px)]"
      : "w-full max-w-[900px] object-contain";

  const pageUrl = (index: number) => `/api/v1/galleries/${id}/pages/${index - 1}/content`;

  if (error) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-reader-bg px-6 text-reader-text">
        <div className="text-center">
          <div className="text-[16px] font-semibold">{error}</div>
          <button
            type="button"
            onClick={() => router.refresh()}
            className="mt-4 min-h-11 rounded-full bg-white/10 px-5 text-[13px] font-semibold"
          >
            Try again
          </button>
        </div>
      </div>
    );
  }

  const visibleThumbnails = Array.from({ length: total }, (_, index) => index + 1);

  return (
    <div className={`flex min-h-dvh flex-col ${backgroundClass}`}>
      {showControls && (
        <header className="relative z-20 flex items-center gap-3 border-b border-white/[0.06] bg-reader-surface/92 px-3 pb-3 pt-[max(0.65rem,env(safe-area-inset-top))] backdrop-blur-xl md:px-6 md:py-4">
          <Link
            href={`/gallery/${id}`}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/[0.08] text-reader-text transition active:scale-95"
            aria-label="Back to gallery"
          >
            <Icon name="arrow-left" size={18} />
          </Link>
          <div className="min-w-0 flex-1">
            <div className="line-clamp-1 text-[13px] font-semibold md:text-[14px]">{title}</div>
            <div className="mt-0.5 text-[11px] tabular-nums text-reader-text/50">
              Page {page} of {total}
              {saving ? " · saving" : ""}
            </div>
          </div>

          <div className="hidden flex-wrap items-center gap-2 xl:flex">
            <ButtonGroup
              options={[
                { label: "Single", value: "single" },
                { label: "Scroll", value: "continuous" },
              ]}
              value={mode}
              onChange={(value) => updateMode(value as ReaderMode)}
            />
            <ButtonGroup
              options={[
                { label: "Width", value: "width" },
                { label: "Screen", value: "screen" },
              ]}
              value={fit}
              onChange={(value) => updateFit(value as FitMode)}
            />
            <button
              type="button"
              onClick={() => updateDirection(direction === "ltr" ? "rtl" : "ltr")}
              className="min-h-8 rounded-full bg-white/[0.08] px-3 text-[11px] font-semibold"
            >
              {direction.toUpperCase()}
            </button>
            <select
              value={background}
              onChange={(event) => updateBackground(event.target.value)}
              aria-label="Reader background"
              className="min-h-8 rounded-full bg-white/[0.08] px-3 text-[11px] font-semibold text-reader-text outline-none"
            >
              <option value="dark">Dark</option>
              <option value="warm">Warm</option>
              <option value="black">Black</option>
            </select>
            <button
              type="button"
              onClick={toggleFullscreen}
              className="min-h-8 rounded-full bg-white/[0.08] px-3 text-[11px] font-semibold"
            >
              Fullscreen
            </button>
          </div>

          <div className="flex items-center gap-1.5 xl:hidden">
            <button
              type="button"
              onClick={toggleFullscreen}
              className="flex h-10 w-10 items-center justify-center rounded-full bg-white/[0.08] text-reader-text"
              aria-label="Toggle fullscreen"
            >
              <Icon name="expand" size={18} />
            </button>
            <button
              type="button"
              onClick={() => setSettingsOpen(true)}
              className="flex h-10 w-10 items-center justify-center rounded-full bg-white/[0.08] text-reader-text"
              aria-label="Reader settings"
            >
              <Icon name="sliders" size={18} />
            </button>
          </div>
        </header>
      )}

      {mode === "single" ? (
        <div
          ref={containerRef}
          className="relative flex flex-1 items-center justify-center overflow-hidden px-2 py-3 md:px-6 md:py-6"
          onClick={(event) => {
            if (event.target === event.currentTarget) setShowControls((value) => !value);
          }}
          onTouchStart={(event) => {
            containerRef.current?.setAttribute("data-touch", String(event.touches[0].clientX));
          }}
          onTouchEnd={(event) => {
            const start = Number(containerRef.current?.getAttribute("data-touch") || 0);
            const end = event.changedTouches[0].clientX;
            if (Math.abs(end - start) > 50) {
              if (end < start) go(1);
              else go(-1);
            }
          }}
        >
          <div className="relative flex max-h-full items-center justify-center overflow-hidden rounded-[10px] border border-white/[0.08] bg-white/[0.03] md:rounded-md">
            <img
              src={pageUrl(page)}
              alt=""
              className={fitClass}
              onError={() => setError("This page could not be loaded.")}
            />
          </div>
          <button
            type="button"
            onClick={() => go(-1)}
            className="absolute left-6 top-1/2 hidden h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/[0.08] text-[20px] backdrop-blur-md md:flex"
            aria-label="Previous page"
          >
            ‹
          </button>
          <button
            type="button"
            onClick={() => go(1)}
            className="absolute right-6 top-1/2 hidden h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/[0.08] text-[20px] backdrop-blur-md md:flex"
            aria-label="Next page"
          >
            ›
          </button>
        </div>
      ) : (
        <div ref={continuousRef} className="min-h-0 flex-1 overflow-y-auto px-3 py-4 md:px-6 md:py-6">
          <div className="mx-auto flex max-w-3xl flex-col gap-4 md:gap-6">
            {visibleThumbnails.map((pageNumber) => (
              <div
                key={pageNumber}
                ref={(node) => {
                  pageRefs.current[pageNumber] = node;
                }}
                data-page={pageNumber}
                className="flex flex-col items-center gap-2"
              >
                <div className="text-[10px] tabular-nums text-reader-text/35">Page {pageNumber}</div>
                <div className="overflow-hidden rounded-[10px] border border-white/[0.08] bg-white/[0.03] md:rounded-md">
                  <img
                    src={pageUrl(pageNumber)}
                    alt=""
                    loading="lazy"
                    className="max-w-full object-contain"
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {showControls && (
        <div className="relative z-20 border-t border-white/[0.06] bg-reader-surface/92 backdrop-blur-xl">
          {mode === "single" && (
            <div className="flex items-center gap-3 px-3 py-3 md:hidden">
              <button
                type="button"
                onClick={() => go(-1)}
                disabled={page <= 1}
                className="flex h-10 w-10 items-center justify-center rounded-full bg-white/[0.08] text-reader-text disabled:opacity-30"
                aria-label="Previous page"
              >
                <Icon name="arrow-left" size={17} />
              </button>
              <input
                type="range"
                min={1}
                max={total || 1}
                value={page}
                onChange={(event) => {
                  const next = Number(event.target.value);
                  setPage(next);
                  debouncedSave(next);
                }}
                aria-label="Page"
                className="h-1.5 flex-1 accent-[#c06a90]"
              />
              <button
                type="button"
                onClick={() => go(1)}
                disabled={page >= total}
                className="flex h-10 w-10 items-center justify-center rounded-full bg-white/[0.08] text-reader-text disabled:opacity-30"
                aria-label="Next page"
              >
                <Icon name="arrow-right" size={17} />
              </button>
            </div>
          )}

          <div className="hidden gap-2 overflow-x-auto px-6 pt-3 md:flex">
            {visibleThumbnails.map((pageNumber) => (
              <button
                key={pageNumber}
                type="button"
                onClick={() => {
                  setPage(pageNumber);
                  debouncedSave(pageNumber);
                  if (mode === "continuous") {
                    pageRefs.current[pageNumber]?.scrollIntoView({ behavior: "smooth", block: "start" });
                  }
                }}
                className={`h-16 w-12 shrink-0 overflow-hidden rounded-md border ${
                  pageNumber === page ? "border-primary bg-primary/40" : "border-white/[0.08] bg-white/5"
                }`}
                aria-label={`Go to page ${pageNumber}`}
              >
                <img
                  src={pageUrl(pageNumber)}
                  alt=""
                  loading="lazy"
                  className="h-full w-full object-cover"
                />
              </button>
            ))}
          </div>

          <div className="hidden items-center gap-3 px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-2 md:flex md:px-6 md:py-3">
            <span className="text-[11px] tabular-nums text-reader-text/50">
              {page} / {total}
            </span>
            <div className="h-1 flex-1 overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full rounded-full bg-primary"
                style={{ width: `${total ? (page / total) * 100 : 0}%` }}
              />
            </div>
            <span className="hidden text-[11px] text-reader-text/45 md:block">
              {mode === "single" ? "Single page" : "Continuous"}
              {direction === "rtl" ? " · RTL" : ""}
            </span>
          </div>
        </div>
      )}

      {!showControls && (
        <button
          type="button"
          onClick={() => setShowControls(true)}
          className="fixed inset-x-0 bottom-4 mx-auto w-fit rounded-full bg-white/10 px-4 py-2 text-[11px] font-semibold text-reader-text/70 backdrop-blur-md"
        >
          Show controls
        </button>
      )}

      {settingsOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 backdrop-blur-[3px] md:items-center md:p-4" onClick={() => setSettingsOpen(false)}>
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Reader settings"
            onClick={(event) => event.stopPropagation()}
            className="sheet-in w-full rounded-t-[30px] border border-white/10 bg-reader-surface px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-3 text-reader-text shadow-float md:max-w-md md:rounded-[26px] md:p-6"
          >
            <div className="mx-auto mb-5 h-1 w-9 rounded-full bg-white/20 md:hidden" />
            <div className="flex items-center justify-between">
              <h2 className="text-[18px] font-bold tracking-[-0.025em]">Reader</h2>
              <button
                type="button"
                onClick={() => setSettingsOpen(false)}
                className="flex h-9 w-9 items-center justify-center rounded-full bg-white/[0.08]"
                aria-label="Close settings"
              >
                <Icon name="x" size={17} />
              </button>
            </div>

            <div className="mt-5 flex flex-col gap-5">
              <div>
                <div className="mb-2 text-[12px] font-semibold text-reader-text/55">Layout</div>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { label: "Single page", value: "single" as ReaderMode },
                    { label: "Continuous", value: "continuous" as ReaderMode },
                  ].map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => updateMode(option.value)}
                      className={`min-h-11 rounded-2xl border text-[13px] font-semibold transition ${
                        mode === option.value
                          ? "border-primary/50 bg-primary/20 text-white"
                          : "border-white/10 bg-white/[0.05] text-reader-text/70"
                      }`}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <div className="mb-2 text-[12px] font-semibold text-reader-text/55">Image fit</div>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { label: "Fit width", value: "width" as FitMode },
                    { label: "Fit screen", value: "screen" as FitMode },
                  ].map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => updateFit(option.value)}
                      className={`min-h-11 rounded-2xl border text-[13px] font-semibold transition ${
                        fit === option.value
                          ? "border-primary/50 bg-primary/20 text-white"
                          : "border-white/10 bg-white/[0.05] text-reader-text/70"
                      }`}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-between gap-4">
                <div>
                  <div className="text-[13px] font-semibold">Reading direction</div>
                  <div className="mt-0.5 text-[11px] text-reader-text/45">
                    Right to left is common for manga.
                  </div>
                </div>
                <div className="flex rounded-full bg-white/[0.08] p-1">
                  {(["ltr", "rtl"] as Direction[]).map((value) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => updateDirection(value)}
                      className={`min-h-8 rounded-full px-3 text-[11px] font-semibold ${
                        direction === value ? "bg-primary text-white" : "text-reader-text/60"
                      }`}
                    >
                      {value.toUpperCase()}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <div className="mb-2 text-[12px] font-semibold text-reader-text/55">Background</div>
                <div className="flex gap-2">
                  {[
                    { label: "Dark", value: "dark", color: "bg-reader-bg" },
                    { label: "Warm", value: "warm", color: "bg-[#29201e]" },
                    { label: "Black", value: "black", color: "bg-black" },
                  ].map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => updateBackground(option.value)}
                      className={`flex min-h-11 flex-1 items-center gap-2 rounded-2xl border px-3 text-[12px] font-semibold ${
                        background === option.value
                          ? "border-primary/50 bg-primary/15"
                          : "border-white/10 bg-white/[0.04]"
                      }`}
                    >
                      <span className={`h-5 w-5 rounded-full border border-white/20 ${option.color}`} />
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex gap-2 pt-1">
                <Button variant="ghost" onClick={toggleFullscreen} className="flex-1 border-white/10 bg-white/[0.06] text-reader-text hover:text-white">
                  <Icon name="expand" size={15} />
                  Fullscreen
                </Button>
                <Button onClick={() => setSettingsOpen(false)} className="flex-1">
                  Done
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ButtonGroup({
  options,
  value,
  onChange,
}: {
  options: { label: string; value: string }[];
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="flex rounded-full bg-white/[0.08] p-1">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => onChange(option.value)}
          className={`min-h-7 rounded-full px-3 text-[11px] font-semibold ${
            value === option.value ? "bg-primary text-white" : "text-reader-text/70"
          }`}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

export default function Reader() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-dvh items-center justify-center bg-reader-bg text-reader-text">
          Loading…
        </div>
      }
    >
      <ReaderInner />
    </Suspense>
  );
}
