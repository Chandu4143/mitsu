"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { api, type Bookmark } from "@/lib/api";
import { Icon } from "@/components/Icon";
import { Button } from "@/components/ui";

type FitMode = "width" | "screen";
type ReaderMode = "single" | "continuous";
type Direction = "ltr" | "rtl";
type Spread = "single" | "double";

const MIN_ZOOM = 1;
const MAX_ZOOM = 5;

function clampZoom(value: number) {
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, Math.round(value * 100) / 100));
}

// Continuous mode mounts a window of pages and replaces the rest with exact
// height spacers, so a 5,000-page gallery keeps the same DOM cost as a 20-page
// one while the scrollbar and jump-to-page stay truthful.
const DEFAULT_PAGE_RATIO = 1.45;
const CONTINUOUS_GAP = 20;
const PAGE_LABEL_HEIGHT = 18;
const PAGE_WINDOW_BACK = 3;
const PAGE_WINDOW_FORWARD = 12;

const STRIP_SLOT_WIDTH = 48;
const STRIP_GAP = 8;
const STRIP_WINDOW = 24;

function pageHeight(ratio: number, width: number) {
  return PAGE_LABEL_HEIGHT + 8 + Math.max(40, width * ratio) + CONTINUOUS_GAP;
}

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
  const [spread, setSpread] = useState<Spread>("single");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [bookmarksOpen, setBookmarksOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);
  const [bookmarkNote, setBookmarkNote] = useState("");
  const [bookmarkBusy, setBookmarkBusy] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [pageRatios, setPageRatios] = useState<Record<number, number>>({});
  const [columnWidth, setColumnWidth] = useState(0);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const continuousRef = useRef<HTMLDivElement | null>(null);
  const columnRef = useRef<HTMLDivElement | null>(null);
  const stripRef = useRef<HTMLDivElement | null>(null);
  const pageRefs = useRef<Record<number, HTMLDivElement | null>>({});
  const pendingScrollRef = useRef<number | null>(null);
  const lastSavedPage = useRef(0);
  const dragRef = useRef<{ x: number; y: number; px: number; py: number } | null>(null);
  const pinchRef = useRef<{ distance: number; zoom: number } | null>(null);
  const touchStartRef = useRef<number | null>(null);

  // Every page's laid-out height, as a prefix sum. The continuous column renders
  // real pages only near the current page and replaces the rest with spacers of
  // exactly these heights, so this same table maps scroll offsets to pages.
  const column = columnWidth || 720;
  const prefix = useMemo(() => {
    const sums = new Float64Array(total + 1);
    for (let index = 1; index <= total; index += 1) {
      sums[index] =
        sums[index - 1] +
        pageHeight(pageRatios[index] ?? DEFAULT_PAGE_RATIO, column);
    }
    return sums;
  }, [total, pageRatios, column]);

  // Scroll so the requested page sits in the middle of the viewport, which is
  // also how the scroll tracker decides which page is current.
  const scrollToPage = (value: number) => {
    const root = continuousRef.current;
    if (!root) return;
    if (value <= 1) {
      root.scrollTo({ top: 0 });
      return;
    }
    if (value >= total) {
      root.scrollTo({ top: root.scrollHeight });
      return;
    }
    const height = pageHeight(pageRatios[value] ?? DEFAULT_PAGE_RATIO, column);
    const top = prefix[value - 1] + height / 2 - root.clientHeight / 2;
    const max = Math.max(0, root.scrollHeight - root.clientHeight);
    root.scrollTo({ top: Math.min(Math.max(0, top), max) });
  };

  const queryPage = Number(searchParams.get("page") || 0);
  const isSpread = mode === "single" && spread === "double" && total > 1;
  const spreadStart = isSpread ? (page % 2 === 1 ? page : Math.max(1, page - 1)) : page;
  const spreadEnd = isSpread ? Math.min(total, spreadStart + 1) : spreadStart;
  const currentIndex = spreadStart - 1;
  const currentBookmark = bookmarks.find((bookmark) => bookmark.page_index === currentIndex);

  useEffect(() => {
    if (!id) return;
    let active = true;
    Promise.all([
      api.getGallery(id),
      api.getProgress(id),
      api.getSettings().catch(() => null),
      api.getBookmarks(id).catch(() => []),
    ])
      .then(([g, progress, settings, savedBookmarks]) => {
        if (!active) return;
        setTitle(g.title);
        setTotal(g.page_count || 0);
        const ratios: Record<number, number> = {};
        for (const item of g.pages || []) {
          if (item.width && item.height) {
            ratios[item.page_index + 1] = item.height / item.width;
          }
        }
        setPageRatios(ratios);
        setBookmarks(savedBookmarks);
        const prefs = settings?.preferences || {};
        setMode(prefs.reader_mode === "continuous" ? "continuous" : "single");
        setFit(prefs.fit_mode === "screen" ? "screen" : "width");
        setDirection(prefs.reading_direction === "rtl" ? "rtl" : "ltr");
        setBackground(prefs.reader_background || "dark");
        setSpread(prefs.reader_spread === "double" ? "double" : "single");
        const initial =
          queryPage > 0
            ? Math.min(g.page_count || 1, Math.max(1, queryPage))
            : (progress?.current_page || 0) + 1;
        setPage(initial);
        if (prefs.reader_mode === "continuous") pendingScrollRef.current = initial;
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
    const visibleEnd =
      mode === "single" && spread === "double"
        ? Math.min(total, (currentPage % 2 === 1 ? currentPage : currentPage - 1) + 1)
        : currentPage;
    const status = visibleEnd >= total ? "completed" : "reading";
    setSaving(true);
    api
      .setProgress(id, { current_page: currentPage - 1, status })
      .catch(() => {})
      .finally(() => setSaving(false));
    lastSavedPage.current = currentPage - 1;
  };

  const debouncedSave = useDebouncedCallback(saveProgressNow, 600);

  const go = (delta: number) => {
    const step = mode === "single" && spread === "double" ? 2 : 1;
    setPage((current) => {
      let raw = current + delta * step * (direction === "rtl" ? -1 : 1);
      raw = Math.min(total, Math.max(1, raw));
      if (mode === "single" && spread === "double" && total > 1) {
        raw = Math.min(total, raw % 2 === 1 ? raw : Math.max(1, raw - 1));
      }
      if (raw !== current) debouncedSave(raw);
      return raw;
    });
    setZoom(1);
    setPan({ x: 0, y: 0 });
  };

  const jumpTo = (next: number) => {
    const value = Math.min(total, Math.max(1, next));
    setPage(value);
    debouncedSave(value);
    setZoom(1);
    setPan({ x: 0, y: 0 });
    if (mode === "continuous") {
      scrollToPage(value);
    }
  };

  const persistPrefs = (patch: Record<string, string>) => {
    api.saveSettings(patch).catch(() => {});
  };

  const updateMode = (next: ReaderMode) => {
    setMode(next);
    setZoom(1);
    setPan({ x: 0, y: 0 });
    if (next === "continuous") pendingScrollRef.current = page;
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
  const updateSpread = (next: Spread) => {
    setSpread(next);
    setZoom(1);
    setPan({ x: 0, y: 0 });
    persistPrefs({ reader_spread: next });
  };

  const updateZoom = (next: number) => {
    const value = clampZoom(next);
    setZoom(value);
    if (value === 1) setPan({ x: 0, y: 0 });
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen?.();
    } else {
      document.exitFullscreen?.();
    }
  };

  const toggleCurrentBookmark = async () => {
    if (!id || bookmarkBusy) return;
    setBookmarkBusy(true);
    try {
      if (currentBookmark) {
        await api.removeBookmark(id, currentBookmark.id);
        setBookmarks((list) => list.filter((item) => item.id !== currentBookmark.id));
      } else {
        const created = await api.addBookmark(id, currentIndex);
        setBookmarks((list) =>
          [...list, created].sort((a, b) => a.page_index - b.page_index)
        );
      }
    } catch {
      // Keep the previous state when the request fails.
    } finally {
      setBookmarkBusy(false);
    }
  };

  const addBookmarkWithNote = async () => {
    if (!id || bookmarkBusy) return;
    setBookmarkBusy(true);
    try {
      if (currentBookmark) {
        const created = await api.addBookmark(id, currentIndex, bookmarkNote);
        setBookmarks((list) =>
          list.map((item) => (item.id === created.id ? created : item))
        );
      } else {
        const created = await api.addBookmark(id, currentIndex, bookmarkNote);
        setBookmarks((list) =>
          [...list, created].sort((a, b) => a.page_index - b.page_index)
        );
      }
      setBookmarkNote("");
    } catch {
      // Keep the previous state when the request fails.
    } finally {
      setBookmarkBusy(false);
    }
  };

  const removeBookmark = async (bookmark: Bookmark) => {
    if (!id) return;
    setBookmarks((list) => list.filter((item) => item.id !== bookmark.id));
    await api.removeBookmark(id, bookmark.id).catch(() => {
      setBookmarks((list) => [...list, bookmark].sort((a, b) => a.page_index - b.page_index));
    });
  };

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target && ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName)) return;
      if (event.key === "Escape") {
        if (settingsOpen || bookmarksOpen || shortcutsOpen) {
          setSettingsOpen(false);
          setBookmarksOpen(false);
          setShortcutsOpen(false);
          return;
        }
        setShowControls((value) => !value);
        return;
      }
      if (settingsOpen || bookmarksOpen || shortcutsOpen) return;
      if (event.key === "ArrowRight") {
        event.preventDefault();
        if (mode === "continuous") jumpTo(page + 1);
        else go(1);
      }
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        if (mode === "continuous") jumpTo(page - 1);
        else go(-1);
      }
      if (event.key === " " || event.key === "Spacebar") {
        event.preventDefault();
        if (mode === "continuous") jumpTo(page + 1);
        else go(1);
      }
      if (event.key === "Home") {
        event.preventDefault();
        jumpTo(1);
      }
      if (event.key === "End") {
        event.preventDefault();
        jumpTo(total);
      }
      if (event.key.toLowerCase() === "f") {
        event.preventDefault();
        toggleFullscreen();
      }
      if (event.key === "+" || event.key === "=") {
        event.preventDefault();
        if (mode === "single") updateZoom(zoom + 0.5);
      }
      if (event.key === "-") {
        event.preventDefault();
        if (mode === "single") updateZoom(zoom - 0.5);
      }
      if (event.key === "0") {
        event.preventDefault();
        if (mode === "single") updateZoom(1);
      }
      if (event.key.toLowerCase() === "d") {
        event.preventDefault();
        updateDirection(direction === "ltr" ? "rtl" : "ltr");
      }
      if (event.key.toLowerCase() === "s" && mode === "single") {
        event.preventDefault();
        updateSpread(spread === "single" ? "double" : "single");
      }
      if (event.key === "?" || (event.key === "/" && event.shiftKey)) {
        event.preventDefault();
        setShortcutsOpen(true);
      }
      if (event.key.toLowerCase() === "b") {
        event.preventDefault();
        toggleCurrentBookmark();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    mode,
    page,
    total,
    direction,
    zoom,
    spread,
    settingsOpen,
    bookmarksOpen,
    shortcutsOpen,
    currentBookmark,
    currentIndex,
  ]);

  useEffect(() => {
    return () => {
      if (page !== lastSavedPage.current + 1) saveProgressNow(page);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  useEffect(() => {
    if (!id || total <= 0) return;
    const candidates = [page + 1, page + 2, page - 1, page - 2];
    candidates.forEach((candidate) => {
      if (candidate >= 1 && candidate <= total) {
        const image = new Image();
        image.src = `/api/v1/galleries/${id}/pages/${candidate - 1}/content`;
      }
    });
  }, [id, page, total]);

  // Track which page crosses the middle of the viewport by mapping the scroll
  // offset through the same prefix table that lays the column out. This stays
  // correct even when a flick jumps far past the mounted window, where a
  // geometry-based reader would have nothing to observe.
  useEffect(() => {
    if (mode !== "continuous") return;
    const root = continuousRef.current;
    if (!root) return;
    let frame = 0;
    const update = () => {
      frame = 0;
      if (pendingScrollRef.current) return;
      const center = root.scrollTop + root.clientHeight / 2;
      let low = 1;
      let high = total;
      if (root.scrollTop <= 1) {
        low = 1;
      } else if (root.scrollTop + root.clientHeight >= root.scrollHeight - 2) {
        low = total;
      } else {
        while (low < high) {
          const mid = Math.ceil((low + high) / 2);
          if (prefix[mid] <= center) low = mid;
          else high = mid - 1;
        }
      }
      if (low !== page) {
        setPage(low);
        debouncedSave(low);
      }
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    root.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      root.removeEventListener("scroll", onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, total, page, prefix]);

  // ResizeObserver fires once on observe, so the measured width arrives without
  // a synchronous setState inside the effect.
  useEffect(() => {
    const node = columnRef.current;
    if (!node) return;
    const observer = new ResizeObserver(() => setColumnWidth(node.clientWidth));
    observer.observe(node);
    return () => observer.disconnect();
  }, [mode, total]);

  useEffect(() => {
    const target = pendingScrollRef.current;
    if (mode !== "continuous" || !target || columnWidth <= 0) return;
    pendingScrollRef.current = null;
    scrollToPage(target);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, total, columnWidth, prefix]);

  useEffect(() => {
    const strip = stripRef.current;
    if (!strip) return;
    const active = strip.querySelector<HTMLElement>(`[data-strip-page="${page}"]`);
    if (!active) return;
    strip.scrollTo({
      left: Math.max(0, active.offsetLeft - strip.clientWidth / 2 + active.clientWidth / 2),
      behavior: "smooth",
    });
  }, [page, mode]);

  useEffect(() => {
    const node = containerRef.current;
    if (!node || mode !== "single") return;
    const onWheel = (event: WheelEvent) => {
      if (!event.ctrlKey && !event.metaKey) return;
      event.preventDefault();
      const next = clampZoom(zoom - event.deltaY * 0.0025);
      setZoom(next);
      if (next === 1) setPan({ x: 0, y: 0 });
    };
    node.addEventListener("wheel", onWheel, { passive: false });
    return () => node.removeEventListener("wheel", onWheel);
  }, [mode, zoom]);

  const backgroundClass =
    background === "warm"
      ? "bg-[#29201e] text-[#F0E3DD]"
      : background === "black"
      ? "bg-black text-[#E8DCE2]"
      : "bg-reader-bg text-reader-text";

  const singleFit =
    fit === "screen"
      ? "max-h-[calc(100dvh-200px)] max-w-full object-contain md:max-h-[calc(100dvh-186px)] md:max-w-[calc(100vw-96px)]"
      : "w-full max-w-[900px] object-contain";

  const spreadFit =
    fit === "screen"
      ? "max-h-[calc(100dvh-200px)] w-auto max-w-[49%] object-contain md:max-h-[calc(100dvh-186px)]"
      : "w-full max-w-[49%] object-contain";

  const pageUrl = (index: number) => `/api/v1/galleries/${id}/pages/${index - 1}/content`;

  const ratioFor = (index: number) => pageRatios[index] ?? DEFAULT_PAGE_RATIO;
  const windowStart = Math.max(1, page - PAGE_WINDOW_BACK);
  const windowEnd = Math.min(total, page + PAGE_WINDOW_FORWARD);
  const windowPages = useMemo(() => {
    const pages: number[] = [];
    for (let index = windowStart; index <= windowEnd; index += 1) pages.push(index);
    return pages;
  }, [windowStart, windowEnd]);
  const beforeHeight = prefix[Math.min(windowStart - 1, total)];
  const afterHeight = Math.max(0, prefix[total] - prefix[Math.min(windowEnd, total)]);

  const stripStart = Math.max(1, page - STRIP_WINDOW);
  const stripEnd = Math.min(total, page + STRIP_WINDOW);
  const stripBefore = (stripStart - 1) * (STRIP_SLOT_WIDTH + STRIP_GAP);
  const stripAfter = Math.max(0, total - stripEnd) * (STRIP_SLOT_WIDTH + STRIP_GAP);

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

  const spreadPages = [spreadStart, spreadStart + 1].filter(
    (value) => value >= 1 && value <= total
  );

  return (
    <div className={`flex h-dvh flex-col overflow-hidden ${backgroundClass}`}>
      {showControls && (
        <header className="relative z-20 flex items-center gap-2 border-b border-white/[0.06] bg-reader-surface/92 px-3 pb-3 pt-[max(0.65rem,env(safe-area-inset-top))] backdrop-blur-xl md:gap-3 md:px-6 md:py-4">
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
              {isSpread ? `Pages ${spreadStart}–${spreadEnd}` : `Page ${spreadStart}`} of {total}
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
            {mode === "single" && (
              <ButtonGroup
                options={[
                  { label: "1 page", value: "single" },
                  { label: "2 pages", value: "double" },
                ]}
                value={spread}
                onChange={(value) => updateSpread(value as Spread)}
              />
            )}
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
            <button
              type="button"
              onClick={() => setShortcutsOpen(true)}
              className="flex h-8 w-8 items-center justify-center rounded-full bg-white/[0.08]"
              aria-label="Keyboard shortcuts"
            >
              <Icon name="keyboard" size={14} />
            </button>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setBookmarksOpen(true)}
              className={`relative flex h-10 w-10 items-center justify-center rounded-full ${
                currentBookmark ? "bg-primary/25 text-white" : "bg-white/[0.08] text-reader-text"
              }`}
              aria-label="Bookmarks"
            >
              <Icon
                name="bookmark"
                size={17}
                fill={currentBookmark ? "currentColor" : "none"}
              />
              {bookmarks.length > 0 && (
                <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[9px] font-bold text-white">
                  {bookmarks.length}
                </span>
              )}
            </button>
            <button
              type="button"
              onClick={toggleFullscreen}
              className="hidden h-10 w-10 items-center justify-center rounded-full bg-white/[0.08] text-reader-text md:flex xl:hidden"
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
          className={`reader-stage relative flex flex-1 items-center justify-center overflow-hidden px-2 py-3 md:px-6 md:py-6 ${
            zoom > 1 ? "is-zoomed" : ""
          }`}
          onClick={(event) => {
            if (event.target === event.currentTarget && zoom === 1) {
              setShowControls((value) => !value);
            }
          }}
          onPointerDown={(event) => {
            if (zoom <= 1) return;
            dragRef.current = {
              x: event.clientX,
              y: event.clientY,
              px: pan.x,
              py: pan.y,
            };
            (event.target as HTMLElement).setPointerCapture?.(event.pointerId);
          }}
          onPointerMove={(event) => {
            const drag = dragRef.current;
            if (!drag) return;
            setPan({
              x: drag.px + event.clientX - drag.x,
              y: drag.py + event.clientY - drag.y,
            });
          }}
          onPointerUp={() => {
            dragRef.current = null;
          }}
          onPointerCancel={() => {
            dragRef.current = null;
          }}
          onTouchStart={(event) => {
            if (event.touches.length === 2) {
              const [a, b] = [event.touches[0], event.touches[1]];
              pinchRef.current = {
                distance: Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY),
                zoom,
              };
              touchStartRef.current = null;
              return;
            }
            if (zoom <= 1) touchStartRef.current = event.touches[0].clientX;
          }}
          onTouchMove={(event) => {
            if (event.touches.length === 2 && pinchRef.current) {
              const [a, b] = [event.touches[0], event.touches[1]];
              const distance = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
              if (pinchRef.current.distance > 0) {
                updateZoom(
                  pinchRef.current.zoom * (distance / pinchRef.current.distance)
                );
              }
            }
          }}
          onTouchEnd={(event) => {
            pinchRef.current = null;
            const start = touchStartRef.current;
            touchStartRef.current = null;
            if (zoom > 1 || start === null) return;
            const end = event.changedTouches[0].clientX;
            if (Math.abs(end - start) > 50) {
              if (end < start) go(1);
              else go(-1);
            }
          }}
        >
          <div
            className="flex max-h-full items-center justify-center gap-1 overflow-hidden transition-transform duration-150 md:gap-2"
            style={{
              transform: `translate3d(${pan.x}px, ${pan.y}px, 0) scale(${zoom})`,
            }}
          >
            {isSpread ? (
              <div
                className={`flex max-h-full items-center justify-center ${
                  direction === "rtl" ? "flex-row-reverse" : ""
                }`}
              >
                {spreadPages.map((pageNumber) => (
                  <div
                    key={pageNumber}
                    className="overflow-hidden rounded-[10px] border border-white/[0.08] bg-white/[0.03] md:rounded-md"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={pageUrl(pageNumber)}
                      alt=""
                      className={`reader-page-in ${spreadFit}`}
                      onError={() => setError("This page could not be loaded.")}
                    />
                  </div>
                ))}
              </div>
            ) : (
              <div className="overflow-hidden rounded-[10px] border border-white/[0.08] bg-white/[0.03] md:rounded-md">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  key={page}
                  src={pageUrl(page)}
                  alt=""
                  className={`reader-page-in ${singleFit}`}
                  onError={() => setError("This page could not be loaded.")}
                />
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={() => go(-1)}
            className="absolute left-3 top-1/2 hidden h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/[0.08] text-[20px] backdrop-blur-md md:left-6 md:flex"
            aria-label="Previous page"
          >
            ‹
          </button>
          <button
            type="button"
            onClick={() => go(1)}
            className="absolute right-3 top-1/2 hidden h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/[0.08] text-[20px] backdrop-blur-md md:right-6 md:flex"
            aria-label="Next page"
          >
            ›
          </button>

          {zoom > 1 && (
            <button
              type="button"
              onClick={() => updateZoom(1)}
              className="absolute bottom-4 right-4 rounded-full bg-white/15 px-3 py-1.5 text-[11px] font-semibold text-reader-text backdrop-blur-md"
            >
              {Math.round(zoom * 100)}% · reset
            </button>
          )}
        </div>
      ) : (
        <div ref={continuousRef} className="min-h-0 flex-1 overflow-y-auto px-3 py-4 md:px-6 md:py-6">
          <div ref={columnRef} className="mx-auto flex w-full max-w-3xl flex-col">
            {beforeHeight > 0 && <div aria-hidden style={{ height: beforeHeight }} />}
            {windowPages.map((pageNumber) => {
              const marked = bookmarks.some(
                (bookmark) => bookmark.page_index === pageNumber - 1
              );
              const ratio = ratioFor(pageNumber);
              return (
                <div
                  key={pageNumber}
                  ref={(node) => {
                    pageRefs.current[pageNumber] = node;
                  }}
                  data-page={pageNumber}
                  className="flex flex-col items-center"
                  style={{ marginBottom: CONTINUOUS_GAP }}
                >
                  <div
                    className="text-[10px] tabular-nums leading-none text-reader-text/35"
                    style={{ height: PAGE_LABEL_HEIGHT }}
                  >
                    <span className="flex h-full items-center gap-1.5">
                      {marked && <Icon name="bookmark" size={10} className="text-primary" />}
                      Page {pageNumber}
                    </span>
                  </div>
                  <div
                    className="mt-2 w-full overflow-hidden rounded-[10px] border border-white/[0.08] bg-white/[0.03] md:rounded-md"
                    style={{ aspectRatio: `1 / ${ratio}` }}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={pageUrl(pageNumber)}
                      alt=""
                      loading="lazy"
                      className="h-full w-full object-contain"
                      onError={() => setError("This page could not be loaded.")}
                    />
                  </div>
                </div>
              );
            })}
            {afterHeight > 0 && <div aria-hidden style={{ height: afterHeight }} />}
          </div>
        </div>
      )}

      {showControls && (
        <div className="relative z-20 border-t border-white/[0.06] bg-reader-surface/92 backdrop-blur-xl">
          {mode === "single" && (
            <div className="flex items-center gap-2 px-3 py-3 md:hidden">
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
                value={spreadStart}
                onChange={(event) => jumpTo(Number(event.target.value))}
                aria-label="Page"
                className="h-1.5 flex-1 accent-[#c06a90]"
              />
              <button
                type="button"
                onClick={() => go(1)}
                disabled={spreadStart >= total}
                className="flex h-10 w-10 items-center justify-center rounded-full bg-white/[0.08] text-reader-text disabled:opacity-30"
                aria-label="Next page"
              >
                <Icon name="arrow-right" size={17} />
              </button>
            </div>
          )}

          <div
            ref={stripRef}
            className="no-scrollbar hidden gap-2 overflow-x-auto px-6 pt-3 md:flex"
          >
            {stripBefore > 0 && (
              <div aria-hidden className="shrink-0" style={{ width: stripBefore }} />
            )}
            {Array.from(
              { length: Math.max(0, stripEnd - stripStart + 1) },
              (_, offset) => stripStart + offset
            ).map((pageNumber) => {
              const marked = bookmarks.some(
                (bookmark) => bookmark.page_index === pageNumber - 1
              );
              const active =
                mode === "single" && spread === "double"
                  ? pageNumber >= spreadStart && pageNumber <= spreadEnd
                  : pageNumber === page;
              return (
                <button
                  key={pageNumber}
                  type="button"
                  data-strip-page={pageNumber}
                  onClick={() => jumpTo(pageNumber)}
                  className={`relative h-16 w-12 shrink-0 overflow-hidden rounded-md border ${
                    active ? "border-primary bg-primary/40" : "border-white/[0.08] bg-white/5"
                  }`}
                  aria-label={`Go to page ${pageNumber}`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={pageUrl(pageNumber)}
                    alt=""
                    loading="lazy"
                    className="h-full w-full object-cover"
                  />
                  {marked && (
                    <span className="absolute right-0.5 top-0.5 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-primary text-white">
                      <Icon name="bookmark" size={8} fill="currentColor" />
                    </span>
                  )}
                </button>
              );
            })}
            {stripAfter > 0 && (
              <div aria-hidden className="shrink-0" style={{ width: stripAfter }} />
            )}
          </div>

          <div className="hidden items-center gap-3 px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-2 md:flex md:px-6 md:py-3">
            <span className="text-[11px] tabular-nums text-reader-text/50">
              {spreadStart} / {total}
            </span>
            <div className="h-1 flex-1 overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full rounded-full bg-primary transition-[width] duration-300"
                style={{ width: `${total ? (spreadEnd / total) * 100 : 0}%` }}
              />
            </div>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => updateZoom(zoom - 0.5)}
                className="flex h-7 w-7 items-center justify-center rounded-full bg-white/[0.08] text-reader-text/70"
                aria-label="Zoom out"
              >
                <Icon name="zoom-out" size={13} />
              </button>
              <button
                type="button"
                onClick={() => updateZoom(1)}
                className="min-w-10 text-center text-[11px] font-semibold tabular-nums text-reader-text/60"
                aria-label="Reset zoom"
              >
                {Math.round(zoom * 100)}%
              </button>
              <button
                type="button"
                onClick={() => updateZoom(zoom + 0.5)}
                className="flex h-7 w-7 items-center justify-center rounded-full bg-white/[0.08] text-reader-text/70"
                aria-label="Zoom in"
              >
                <Icon name="zoom-in" size={13} />
              </button>
            </div>
            <span className="hidden text-[11px] text-reader-text/45 lg:block">
              {mode === "single"
                ? spread === "double"
                  ? "Double page"
                  : "Single page"
                : "Continuous"}
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
        <Sheet title="Reader" onClose={() => setSettingsOpen(false)}>
          <div className="flex flex-col gap-5">
            <div>
              <div className="mb-2 text-[12px] font-semibold text-reader-text/55">Layout</div>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { label: "Single page", value: "single" as ReaderMode },
                  { label: "Continuous", value: "continuous" as ReaderMode },
                ].map((option) => (
                  <OptionButton
                    key={option.value}
                    active={mode === option.value}
                    onClick={() => updateMode(option.value)}
                  >
                    {option.label}
                  </OptionButton>
                ))}
              </div>
            </div>

            {mode === "single" && (
              <div>
                <div className="mb-2 text-[12px] font-semibold text-reader-text/55">
                  Pages per view
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { label: "One page", value: "single" as Spread },
                    { label: "Two pages", value: "double" as Spread },
                  ].map((option) => (
                    <OptionButton
                      key={option.value}
                      active={spread === option.value}
                      onClick={() => updateSpread(option.value)}
                    >
                      {option.label}
                    </OptionButton>
                  ))}
                </div>
              </div>
            )}

            <div>
              <div className="mb-2 text-[12px] font-semibold text-reader-text/55">Image fit</div>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { label: "Fit width", value: "width" as FitMode },
                  { label: "Fit screen", value: "screen" as FitMode },
                ].map((option) => (
                  <OptionButton
                    key={option.value}
                    active={fit === option.value}
                    onClick={() => updateFit(option.value)}
                  >
                    {option.label}
                  </OptionButton>
                ))}
              </div>
            </div>

            {mode === "single" && (
              <div className="flex items-center justify-between gap-4">
                <div>
                  <div className="text-[13px] font-semibold">Zoom</div>
                  <div className="mt-0.5 text-[11px] text-reader-text/45">
                    Ctrl + scroll, pinch, or + and −.
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => updateZoom(zoom - 0.5)}
                    className="flex h-9 w-9 items-center justify-center rounded-full bg-white/[0.08]"
                    aria-label="Zoom out"
                  >
                    <Icon name="zoom-out" size={15} />
                  </button>
                  <span className="min-w-12 text-center text-[12px] font-semibold tabular-nums">
                    {Math.round(zoom * 100)}%
                  </span>
                  <button
                    type="button"
                    onClick={() => updateZoom(zoom + 0.5)}
                    className="flex h-9 w-9 items-center justify-center rounded-full bg-white/[0.08]"
                    aria-label="Zoom in"
                  >
                    <Icon name="zoom-in" size={15} />
                  </button>
                </div>
              </div>
            )}

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
              <Button
                variant="ghost"
                onClick={() => setShortcutsOpen(true)}
                className="flex-1 border-white/10 bg-white/[0.06] text-reader-text hover:text-white"
              >
                <Icon name="keyboard" size={15} />
                Shortcuts
              </Button>
              <Button onClick={() => setSettingsOpen(false)} className="flex-1">
                Done
              </Button>
            </div>
          </div>
        </Sheet>
      )}

      {bookmarksOpen && (
        <Sheet title="Bookmarks" onClose={() => setBookmarksOpen(false)}>
          <div className="flex flex-col gap-4">
            <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-[13px] font-semibold">
                    {isSpread ? `Pages ${spreadStart}–${spreadEnd}` : `Page ${spreadStart}`}
                  </div>
                  <div className="mt-0.5 text-[11px] text-reader-text/45">
                    {currentBookmark ? "Already bookmarked." : "Save this spot for later."}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={toggleCurrentBookmark}
                  disabled={bookmarkBusy}
                  className={`flex min-h-9 items-center gap-1.5 rounded-full px-3 text-[11px] font-semibold ${
                    currentBookmark ? "bg-primary/25 text-white" : "bg-primary text-white"
                  }`}
                >
                  <Icon
                    name="bookmark"
                    size={13}
                    fill={currentBookmark ? "currentColor" : "none"}
                  />
                  {currentBookmark ? "Remove" : "Mark"}
                </button>
              </div>
              <div className="mt-2.5 flex gap-2">
                <input
                  value={bookmarkNote}
                  onChange={(event) => setBookmarkNote(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") addBookmarkWithNote();
                  }}
                  placeholder="Add a note (optional)"
                  className="h-9 min-w-0 flex-1 rounded-xl border border-white/10 bg-white/[0.05] px-3 text-[13px] text-reader-text outline-none placeholder:text-reader-text/35 focus:border-primary"
                />
                <button
                  type="button"
                  onClick={addBookmarkWithNote}
                  disabled={bookmarkBusy}
                  className="rounded-xl bg-white/[0.08] px-3 text-[11px] font-semibold text-reader-text"
                >
                  Save
                </button>
              </div>
            </div>

            {bookmarks.length === 0 ? (
              <div className="rounded-2xl bg-white/[0.04] px-4 py-6 text-center text-[12px] text-reader-text/50">
                No bookmarks yet. Press <span className="font-semibold text-reader-text/80">B</span>{" "}
                while reading to mark a page.
              </div>
            ) : (
              <div className="flex max-h-[45vh] flex-col gap-1.5 overflow-auto">
                {bookmarks.map((bookmark) => (
                  <div
                    key={bookmark.id}
                    className="flex items-center gap-2 rounded-xl bg-white/[0.05] p-2 pl-3"
                  >
                    <button
                      type="button"
                      onClick={() => {
                        jumpTo(bookmark.page_index + 1);
                        setBookmarksOpen(false);
                      }}
                      className="min-w-0 flex-1 text-left"
                    >
                      <div className="text-[12px] font-semibold">
                        Page {bookmark.page_index + 1}
                      </div>
                      {bookmark.note && (
                        <div className="mt-0.5 line-clamp-1 text-[11px] text-reader-text/45">
                          {bookmark.note}
                        </div>
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() => removeBookmark(bookmark)}
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-reader-text/45 hover:text-danger"
                      aria-label={`Remove bookmark on page ${bookmark.page_index + 1}`}
                    >
                      <Icon name="x" size={13} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Sheet>
      )}

      {shortcutsOpen && (
        <Sheet title="Keyboard shortcuts" onClose={() => setShortcutsOpen(false)}>
          <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
            {[
              ["→ / ←", "Next / previous page"],
              ["Space", "Next page"],
              ["Home / End", "First / last page"],
              ["F", "Fullscreen"],
              ["D", "Reading direction"],
              ["S", "Single / double page"],
              ["B", "Bookmark this page"],
              ["+ / − / 0", "Zoom in / out / reset"],
              ["Esc", "Hide controls"],
              ["?", "This list"],
            ].map(([keys, label]) => (
              <div
                key={keys}
                className="flex items-center justify-between gap-3 rounded-xl bg-white/[0.04] px-3 py-2"
              >
                <span className="text-[11px] text-reader-text/55">{label}</span>
                <kbd className="rounded-md border border-white/10 bg-white/[0.06] px-1.5 py-0.5 text-[10px] font-semibold text-reader-text/80">
                  {keys}
                </kbd>
              </div>
            ))}
          </div>
          <div className="mt-3 text-center text-[11px] text-reader-text/35">
            On touch screens, swipe to turn pages and pinch to zoom.
          </div>
        </Sheet>
      )}
    </div>
  );
}

function Sheet({
  title,
  children,
  onClose,
}: {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/45 backdrop-blur-[3px] md:items-center md:p-4"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(event) => event.stopPropagation()}
        className="sheet-in w-full rounded-t-[30px] border border-white/10 bg-reader-surface px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-3 text-reader-text shadow-float md:max-w-md md:rounded-[26px] md:p-6"
      >
        <div className="mx-auto mb-5 h-1 w-9 rounded-full bg-white/20 md:hidden" />
        <div className="flex items-center justify-between">
          <h2 className="text-[18px] font-bold tracking-[-0.025em]">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-white/[0.08]"
            aria-label="Close"
          >
            <Icon name="x" size={17} />
          </button>
        </div>
        <div className="mt-5">{children}</div>
      </div>
    </div>
  );
}

function OptionButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`min-h-11 rounded-2xl border text-[13px] font-semibold transition ${
        active
          ? "border-primary/50 bg-primary/20 text-white"
          : "border-white/10 bg-white/[0.05] text-reader-text/70"
      }`}
    >
      {children}
    </button>
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
