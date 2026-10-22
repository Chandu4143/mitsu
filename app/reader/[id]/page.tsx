"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { api } from "@/lib/api";
import { Icon } from "@/components/Icon";
import { Button } from "@/components/ui";

type FitMode = "width" | "screen";
type ReaderMode = "single" | "continuous";
type Direction = "ltr" | "rtl";

function useDebouncedCallback(callback: (value: number) => void, delay: number) {
  const timer = useRef<any>(null);
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

  const [gallery, setGallery] = useState<any>(null);
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
        setGallery(g);
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

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen?.();
    } else {
      document.exitFullscreen?.();
    }
  };

  const backgroundClass =
    background === "warm"
      ? "bg-[#2A211F] text-[#F0E3DD]"
      : background === "black"
      ? "bg-black text-[#E8DCE2]"
      : "bg-reader-bg text-reader-text";

  const fitClass =
    fit === "screen"
      ? "max-h-[calc(100vh-180px)] max-w-[calc(100vw-96px)] object-contain"
      : "w-full max-w-[900px] object-contain";

  const pageUrl = (index: number) => `/api/v1/galleries/${id}/pages/${index - 1}/content`;

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-reader-bg text-reader-text">
        <div className="text-center">
          <div className="text-[16px] font-semibold">{error}</div>
          <button onClick={() => router.refresh()} className="mt-3 text-primary">
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen ${backgroundClass} flex flex-col`}>
      {showControls && (
        <div className="flex items-center justify-between gap-3 border-b border-white/5 bg-reader-surface px-6 py-4">
          <div className="flex items-center gap-3">
            <Link
              href={`/gallery/${id}`}
              className="flex h-8 w-8 items-center justify-center rounded-full bg-white/8 text-[14px]"
            >
              <Icon name="arrow-left" size={16} />
            </Link>
            <div className="flex flex-col gap-0.5">
              <div className="line-clamp-1 text-[14px] font-semibold">{title}</div>
              <div className="text-[12px] opacity-60">
                Page {page} of {total}
                {saving ? " · saving" : ""}
              </div>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
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
                { label: "Fit width", value: "width" },
                { label: "Fit screen", value: "screen" },
              ]}
              value={fit}
              onChange={(value) => updateFit(value as FitMode)}
            />
            <button
              onClick={() => updateDirection(direction === "ltr" ? "rtl" : "ltr")}
              className="rounded-full bg-white/8 px-3 py-1.5 text-[12px] font-semibold"
            >
              {direction === "ltr" ? "LTR" : "RTL"}
            </button>
            <select
              value={background}
              onChange={(event) => updateBackground(event.target.value)}
              className="rounded-full bg-white/8 px-3 py-1.5 text-[12px] font-semibold outline-none"
            >
              <option value="dark">Dark</option>
              <option value="warm">Warm</option>
              <option value="black">Black</option>
            </select>
            <button
              onClick={toggleFullscreen}
              className="rounded-full bg-white/8 px-3 py-1.5 text-[12px] font-semibold"
            >
              Fullscreen
            </button>
            <div className="flex items-center gap-2 rounded-full bg-white/8 px-3 py-1">
              <input
                type="number"
                min={1}
                max={total || 1}
                value={page}
                onChange={(event) => {
                  const next = Number(event.target.value);
                  if (!Number.isNaN(next)) setPage(Math.min(total, Math.max(1, next)));
                }}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    debouncedSave(page);
                  }
                }}
                className="w-12 bg-transparent text-[12px] outline-none"
              />
              <span className="text-[12px] opacity-60">/ {total}</span>
            </div>
          </div>
        </div>
      )}

      {mode === "single" ? (
        <div
          ref={containerRef}
          className="relative flex flex-1 items-center justify-center px-6 py-6"
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
          <div className="relative flex items-center justify-center overflow-hidden rounded-md border border-white/10 bg-white/5">
            <img
              src={pageUrl(page)}
              alt=""
              className={fitClass}
              onError={() => setError("This page could not be loaded.")}
            />
          </div>
          <button
            onClick={() => go(-1)}
            className="absolute left-6 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/8 text-[18px]"
            aria-label="Previous page"
          >
            ‹
          </button>
          <button
            onClick={() => go(1)}
            className="absolute right-6 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/8 text-[18px]"
            aria-label="Next page"
          >
            ›
          </button>
        </div>
      ) : (
        <div ref={continuousRef} className="flex-1 overflow-y-auto px-6 py-6">
          <div className="mx-auto flex max-w-3xl flex-col gap-6">
            {Array.from({ length: total }, (_, index) => index + 1).map((pageNumber) => (
              <div
                key={pageNumber}
                ref={(node) => {
                  pageRefs.current[pageNumber] = node;
                }}
                data-page={pageNumber}
                className="flex flex-col items-center gap-2"
              >
                <div className="text-[12px] opacity-50">Page {pageNumber}</div>
                <div className="overflow-hidden rounded-md border border-white/10 bg-white/5">
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
        <div className="flex flex-col gap-2.5 border-t border-white/5 bg-reader-surface px-6 py-3">
          <div className="flex gap-2 overflow-x-auto pb-1">
            {Array.from({ length: total }, (_, index) => index + 1).map((pageNumber) => (
              <button
                key={pageNumber}
                onClick={() => {
                  setPage(pageNumber);
                  debouncedSave(pageNumber);
                  if (mode === "continuous") {
                    pageRefs.current[pageNumber]?.scrollIntoView({ behavior: "smooth", block: "start" });
                  }
                }}
                className={`h-16 w-12 shrink-0 overflow-hidden rounded-md border ${
                  pageNumber === page ? "border-primary bg-primary/40" : "border-white/8 bg-white/5"
                }`}
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
          <div className="flex items-center gap-4">
            <span className="text-[12px] opacity-60">
              {page} / {total}
            </span>
            <div className="h-1 flex-1 overflow-hidden rounded-full bg-white/10">
              <div className="h-full bg-primary" style={{ width: `${total ? (page / total) * 100 : 0}%` }} />
            </div>
            <span className="text-[12px] opacity-60">
              {mode === "single" ? "Single page" : "Continuous scroll"}
              {direction === "rtl" ? " · RTL" : ""}
            </span>
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
    <div className="flex rounded-full bg-white/8 p-1">
      {options.map((option) => (
        <button
          key={option.value}
          onClick={() => onChange(option.value)}
          className={`rounded-full px-3 py-1 text-[12px] font-semibold ${
            value === option.value ? "bg-primary text-white" : "text-reader-text/80"
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
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center bg-reader-bg text-reader-text">Loading…</div>}>
      <ReaderInner />
    </Suspense>
  );
}
