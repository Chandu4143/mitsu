"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  api,
  type Gallery,
  type MetadataSource,
  type RemoteSearchResult,
} from "@/lib/api";
import { Icon } from "@/components/Icon";
import { Button, EmptyState, Skeleton } from "@/components/ui";

type ImportState = {
  status: "queued" | "running" | "completed" | "failed" | "cancelled";
  jobId: string;
  message?: string;
  libraryId?: string;
};

type ImportJob = {
  id: string;
  status: ImportState["status"];
  error_message?: string | null;
  result_id?: string | null;
};

type RemoteMeta = {
  total: number;
  per_page: number;
  num_pages: number;
};

type Sort = "date" | "popular" | "popular-week" | "popular-month";

const SORTS: { value: Sort; label: string }[] = [
  { value: "date", label: "Recent" },
  { value: "popular", label: "Popular" },
  { value: "popular-week", label: "This week" },
  { value: "popular-month", label: "This month" },
];

const LANGUAGES = [
  { value: "", label: "Any language" },
  { value: "en", label: "English" },
  { value: "ja", label: "Japanese" },
  { value: "zh", label: "Chinese" },
];

function compactNumber(value: number) {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}m`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}k`;
  return String(value);
}

export default function Discover() {
  const [q, setQ] = useState("");
  const [localQuery, setLocalQuery] = useState("");
  const [remoteQuery, setRemoteQuery] = useState("");
  const [local, setLocal] = useState<Gallery[]>([]);
  const [loadingLocal, setLoadingLocal] = useState(false);
  const [sources, setSources] = useState<MetadataSource[]>([]);

  const [sort, setSort] = useState<Sort>("date");
  const [language, setLanguage] = useState("");
  const [browse, setBrowse] = useState(false);
  const [remote, setRemote] = useState<RemoteSearchResult[]>([]);
  const [remoteMeta, setRemoteMeta] = useState<RemoteMeta | null>(null);
  const [remotePage, setRemotePage] = useState(1);
  const [loadingRemote, setLoadingRemote] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [remoteError, setRemoteError] = useState("");
  const [importingId, setImportingId] = useState<string | null>(null);
  const [importStates, setImportStates] = useState<Record<string, ImportState>>({});
  const [importMessage, setImportMessage] = useState<string | null>(null);
  const [tracked, setTracked] = useState<Record<string, string>>({});
  const requestId = useRef(0);
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const handle = setTimeout(() => setLocalQuery(q.trim()), 250);
    return () => clearTimeout(handle);
  }, [q]);

  useEffect(() => {
    const handle = setTimeout(() => setRemoteQuery(q.trim()), 650);
    return () => clearTimeout(handle);
  }, [q]);

  useEffect(() => {
    api.listMetadataSources().then(setSources).catch(() => setSources([]));
  }, []);

  useEffect(() => {
    if (!localQuery) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setLocal([]);
      return;
    }
    setLoadingLocal(true);
    api
      .listGalleries({ q: localQuery, page_size: 12 })
      .then((response) => setLocal(response.items || []))
      .catch(() => setLocal([]))
      .finally(() => setLoadingLocal(false));
  }, [localQuery]);

  const loadRemote = useCallback(
    async (targetPage: number, replace: boolean) => {
      const query = browse ? "" : remoteQuery;
      if (!browse && query.length < 2) return;

      const currentRequest = ++requestId.current;
      if (replace) {
        setLoadingRemote(true);
        setLoadingMore(false);
        setRemoteError("");
        setRemote([]);
        setRemoteMeta(null);
        setRemotePage(1);
      } else {
        setRemoteError("");
        setLoadingMore(true);
      }

      try {
        const response = await api.searchNhentai(query, targetPage, sort, language);
        if (currentRequest !== requestId.current) return;
        setRemote((current) => {
          if (replace) return response.items;
          const seen = new Set(current.map((item) => item.id));
          return [...current, ...response.items.filter((item) => !seen.has(item.id))];
        });
        setRemoteMeta({
          total: response.total ?? 0,
          per_page: response.per_page ?? 25,
          num_pages: response.num_pages ?? 0,
        });
        setRemotePage(response.page || targetPage);
      } catch (err) {
        if (currentRequest !== requestId.current) return;
        setRemoteError(err instanceof Error ? err.message : String(err));
      } finally {
        if (currentRequest === requestId.current) {
          setLoadingRemote(false);
          setLoadingMore(false);
        }
      }
    },
    [browse, language, remoteQuery, sort]
  );

  useEffect(() => {
    // Invalidate any in-flight request and start from page one whenever the
    // query, sort, language, or browse state changes.
    requestId.current += 1;
    if (browse || remoteQuery.length >= 2) {
      // Fetching in response to query/sort changes is the point of this effect.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      void loadRemote(1, true);
    }
  }, [browse, remoteQuery, sort, language, loadRemote]);

  const hasMore = Boolean(remoteMeta && remoteMeta.num_pages > remotePage);

  useEffect(() => {
    const node = sentinelRef.current;
    if (!node || !hasMore || loadingRemote || loadingMore) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) void loadRemote(remotePage + 1, false);
      },
      { rootMargin: "600px 0px" }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [hasMore, loadingMore, loadingRemote, loadRemote, remotePage]);

  useEffect(() => {
    const keys = Object.keys(tracked);
    if (keys.length === 0) return;
    let cancelled = false;
    const poll = async () => {
      try {
        const jobs: ImportJob[] = await api.listImports();
        if (cancelled) return;
        setImportStates((current) => {
          const next = { ...current };
          let changed = false;
          jobs.forEach((job) => {
            const remoteId = keys.find((key) => tracked[key] === job.id);
            if (!remoteId) return;
            const status = job.status as ImportState["status"];
            const libraryId = job.result_id || undefined;
            if (next[remoteId]?.status !== status || next[remoteId]?.libraryId !== libraryId) {
              next[remoteId] = {
                status,
                jobId: job.id,
                message: job.error_message || undefined,
                libraryId,
              };
              changed = true;
            }
          });
          return changed ? next : current;
        });
      } catch {
        // Polling is best effort.
      }
    };
    poll();
    const timer = setInterval(poll, 1500);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [tracked]);

  const trackedSummary = (() => {
    const states = Object.values(importStates);
    if (states.length === 0) return null;
    const active = states.filter(
      (state) => state.status === "queued" || state.status === "running"
    ).length;
    const failed = states.filter((state) => state.status === "failed").length;
    const done = states.filter((state) => state.status === "completed").length;
    const galleries = (count: number) => (count === 1 ? "gallery" : "galleries");
    if (active > 0) {
      return {
        tone: "info" as const,
        text: `Importing ${active} ${galleries(active)}…`,
      };
    }
    if (failed > 0) {
      return {
        tone: "error" as const,
        text: `${failed} import${failed === 1 ? "" : "s"} failed.`,
      };
    }
    if (done > 0) {
      return {
        tone: "success" as const,
        text: `Added ${done} ${galleries(done)} to your library.`,
      };
    }
    return null;
  })();

  const importRemote = async (item: RemoteSearchResult) => {
    setImportingId(item.id);
    setImportMessage(null);
    try {
      const job = await api.importNhentai(item.id);
      setTracked((current) => ({ ...current, [item.id]: job.id }));
      setImportStates((current) => ({
        ...current,
        [item.id]: { status: "queued", jobId: job.id },
      }));
      setImportMessage(`Import queued: ${job.id.slice(0, 8)}.`);
    } catch (err) {
      setImportMessage(err instanceof Error ? err.message : String(err));
    } finally {
      setImportingId(null);
    }
  };

  const remoteActive = browse || remoteQuery.length >= 2;
  const showToolbar = !browse && remoteQuery.length >= 2;
  const showEmptyRemote = !browse && remoteQuery.length < 2;
  const providerEnabled = sources.find((source) => source.id === "nhentai")?.enabled;

  return (
    <>
      <header className="pt-1 md:pt-0">
        <h1 className="text-[34px] font-extrabold leading-none tracking-[-0.045em] text-text md:text-[40px]">
          Discover
        </h1>
        <p className="mt-2 max-w-[54ch] text-[13px] leading-relaxed text-text-secondary">
          Search your own shelves, or browse nhentai by title, tag, or code. Remote
          sources stay opt-in.
        </p>
      </header>

      <div className="relative">
        <Icon
          name="search"
          size={18}
          className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-text-muted"
        />
        <input
          value={q}
          onChange={(event) => {
            setQ(event.target.value);
            if (event.target.value.trim()) setBrowse(false);
          }}
          placeholder="Title, artist, tag, or gallery code"
          aria-label="Search discover"
          className="h-12 w-full rounded-2xl border border-border bg-surface py-2 pl-11 pr-11 text-[16px] text-text outline-none transition placeholder:text-text-muted focus:border-primary md:h-11 md:text-[14px]"
        />
        {q && (
          <button
            type="button"
            onClick={() => {
              setQ("");
              setBrowse(false);
            }}
            className="absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full text-text-muted"
            aria-label="Clear search"
          >
            <Icon name="x" size={15} />
          </button>
        )}
      </div>

      <section className="flex flex-col gap-3">
        <div className="flex items-baseline justify-between gap-4">
          <h2 className="text-[20px] font-bold tracking-[-0.03em] md:text-[22px]">On your shelves</h2>
          {local.length > 0 && (
            <span className="text-[11px] text-text-muted">
              {local.length} {local.length === 1 ? "match" : "matches"}
            </span>
          )}
        </div>
        {loadingLocal ? (
          <div className="grid grid-cols-2 gap-2.5 md:grid-cols-3">
            {Array.from({ length: 4 }).map((_, index) => (
              <Skeleton key={index} className="h-[86px] w-full rounded-[18px]" />
            ))}
          </div>
        ) : !localQuery ? (
          <div className="rounded-[22px] border border-border/80 bg-surface px-4 py-5 text-[13px] leading-relaxed text-text-secondary">
            Start typing to search your library. Everything stays on this device.
          </div>
        ) : local.length === 0 ? (
          <EmptyState
            icon="search"
            title="No local matches"
            description="Try another title, artist, tag, or language."
          />
        ) : (
          <div className="grid grid-cols-2 gap-2.5 md:grid-cols-3">
            {local.map((gallery) => (
              <Link
                key={gallery.id}
                href={`/gallery?id=${gallery.id}`}
                className="flex items-center gap-2.5 rounded-[18px] border border-border/80 bg-surface p-2 transition hover:border-border-strong"
              >
                <div className="h-[62px] w-[46px] shrink-0 overflow-hidden rounded-xl bg-primary-soft">
                  {gallery.cover_url && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={gallery.cover_url} alt="" className="h-full w-full object-cover" />
                  )}
                </div>
                <div className="min-w-0">
                  <div className="line-clamp-2 text-[12px] font-semibold leading-snug text-text">
                    {gallery.title}
                  </div>
                  <div className="mt-1 text-[10px] text-text-muted">{gallery.page_count} pages</div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <div className="flex items-baseline gap-2">
            <h2 className="text-[20px] font-bold tracking-[-0.03em] md:text-[22px]">nhentai</h2>
            <span className="text-[11px] text-text-muted">Optional</span>
          </div>
          {remoteMeta && remoteActive && (
            <span className="text-[11px] text-text-muted">
              {remoteMeta.total.toLocaleString()}{" "}
              {remoteMeta.total === 1 ? "result" : "results"}
            </span>
          )}
        </div>

        {showToolbar && (
          <div className="flex flex-wrap items-center gap-2">
            <div className="no-scrollbar flex max-w-full gap-1 overflow-x-auto rounded-full border border-border bg-surface p-1">
              {SORTS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setSort(option.value)}
                  aria-pressed={sort === option.value}
                  className={`min-h-8 shrink-0 rounded-full px-3 text-[11px] font-semibold transition ${
                    sort === option.value
                      ? "bg-primary-soft text-primary"
                      : "text-text-muted hover:text-text-secondary"
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
            <div className="relative">
              <select
                value={language}
                onChange={(event) => setLanguage(event.target.value)}
                aria-label="Language filter"
                className="h-10 appearance-none rounded-full border border-border bg-surface pl-3.5 pr-9 text-[11px] font-semibold text-text-secondary outline-none focus:border-primary"
              >
                {LANGUAGES.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <Icon
                name="chevron-down"
                size={12}
                className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-text-muted"
              />
            </div>
          </div>
        )}

        {browse && (
          <div className="flex items-center gap-2 rounded-2xl border border-border/70 bg-surface-soft px-3.5 py-2 text-[11px] text-text-secondary">
            <Icon name="clock" size={13} className="text-primary" />
            Recently uploaded galleries
            <button
              type="button"
              onClick={() => setBrowse(false)}
              className="ml-auto inline-flex items-center gap-1 font-semibold text-primary"
            >
              <Icon name="x" size={12} />
              Close
            </button>
          </div>
        )}

        {providerEnabled === false && (
          <div className="rounded-2xl border border-border/70 bg-surface px-4 py-3 text-[12px] text-text-secondary">
            The nhentai provider is disabled. Install <code>cloudscraper</code> to search it.
          </div>
        )}

        {remoteError && remote.length > 0 && (
          <div className="flex items-center gap-2 rounded-2xl border border-danger/20 bg-danger/5 px-4 py-2.5 text-[12px] text-danger">
            {remoteError}
            <button
              type="button"
              onClick={() => void loadRemote(remotePage + 1, false)}
              className="ml-auto rounded-full border border-danger/30 px-3 py-1 text-[11px] font-semibold"
            >
              Retry
            </button>
          </div>
        )}

        {showEmptyRemote ? (
          <div className="flex flex-col items-start gap-3 rounded-[22px] border border-border/80 bg-surface px-4 py-5 text-[13px] leading-relaxed text-text-secondary">
            <p>
              Search by title, tag, or gallery code for paged results with sort and
              language filters — or start with what is new.
            </p>
            <Button variant="soft" onClick={() => setBrowse(true)}>
              <Icon name="clock" size={14} />
              Browse recent uploads
            </Button>
          </div>
        ) : loadingRemote ? (
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-5">
            {Array.from({ length: 10 }).map((_, index) => (
              <Skeleton key={index} className="aspect-[3/4] w-full rounded-[18px]" />
            ))}
          </div>
        ) : remoteError && remote.length === 0 ? (
          <div className="flex flex-col items-start gap-2 rounded-2xl border border-danger/20 bg-danger/5 px-4 py-3 text-[13px] text-danger">
            <span>{remoteError}</span>
            <button
              type="button"
              onClick={() => void loadRemote(1, true)}
              className="rounded-full border border-danger/30 px-3 py-1 text-[11px] font-semibold"
            >
              Try again
            </button>
          </div>
        ) : remote.length === 0 ? (
          <div className="rounded-[22px] border border-border/80 bg-surface px-4 py-5 text-[13px] text-text-secondary">
            No remote results for this search. Try a shorter query or another language.
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-5">
              {remote.map((item) => {
                const state = importStates[item.id];
                const isDone = state?.status === "completed";
                const isFailed = state?.status === "failed";
                const isActive = state?.status === "queued" || state?.status === "running";
                const busy = importingId === item.id || isActive;
                const libraryId = state?.libraryId || item.library_id;
                return (
                  <article
                    key={item.id}
                    className={`flex flex-col overflow-hidden rounded-[18px] border bg-surface transition ${
                      libraryId
                        ? "border-success/35"
                        : isFailed
                        ? "border-danger/35"
                        : "border-border/80"
                    }`}
                  >
                    <Link
                      href={item.source_url || "#"}
                      target="_blank"
                      rel="noreferrer"
                      className="group relative block"
                    >
                      <div className="relative aspect-[3/4] w-full overflow-hidden bg-primary-soft">
                        {(item.cover_url || item.thumbnail_url) && (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={item.cover_url || item.thumbnail_url || ""}
                            alt=""
                            loading="lazy"
                            className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.03]"
                          />
                        )}
                        {item.page_count ? (
                          <span className="absolute left-1.5 top-1.5 rounded-full bg-black/45 px-1.5 py-0.5 text-[9px] font-semibold text-white backdrop-blur-sm">
                            {item.page_count}p
                          </span>
                        ) : null}
                        {libraryId && (
                          <span className="absolute right-1.5 top-1.5 inline-flex items-center gap-1 rounded-full bg-success/90 px-1.5 py-0.5 text-[9px] font-bold text-white">
                            <Icon name="check" size={10} />
                            Library
                          </span>
                        )}
                      </div>
                    </Link>
                    <div className="flex flex-1 flex-col gap-2 p-2.5">
                      <div
                        className="line-clamp-2 text-[11px] font-semibold leading-snug text-text"
                        title={item.title}
                      >
                        {item.title}
                      </div>
                      <div className="flex items-center gap-2 text-[10px] text-text-muted">
                        <span className="inline-flex items-center gap-0.5">
                          <Icon name="heart" size={10} />
                          {compactNumber(item.num_favorites || 0)}
                        </span>
                        <span>{item.page_count ?? "?"} pages</span>
                      </div>
                      {libraryId ? (
                        <Link
                          href={`/gallery?id=${libraryId}`}
                          className="mt-auto inline-flex min-h-8 items-center justify-center gap-1 rounded-full bg-success/10 px-3 text-[10px] font-bold text-success transition hover:bg-success/15"
                        >
                          <Icon name="play" size={10} /> Open
                        </Link>
                      ) : isDone ? (
                        <div className="mt-auto flex items-center gap-1 text-[10px] font-semibold text-success">
                          <Icon name="check" size={12} /> Imported
                        </div>
                      ) : (
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => importRemote(item)}
                          className={`mt-auto inline-flex min-h-8 items-center justify-center gap-1 rounded-full px-3 text-[10px] font-bold transition active:scale-[0.98] disabled:opacity-50 ${
                            isFailed
                              ? "bg-danger/10 text-danger hover:bg-danger/15"
                              : "bg-primary-soft text-primary"
                          }`}
                        >
                          {busy && <Icon name="refresh" size={11} className="animate-spin" />}
                          {isFailed ? "Retry import" : busy ? "Importing…" : "Import"}
                        </button>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>

            <div ref={sentinelRef} className="flex flex-col items-center gap-2 py-2">
              {hasMore ? (
                <Button
                  variant="ghost"
                  onClick={() => void loadRemote(remotePage + 1, false)}
                  disabled={loadingMore}
                >
                  {loadingMore && <Icon name="refresh" size={13} className="animate-spin" />}
                  {loadingMore ? "Loading…" : "Load more"}
                </Button>
              ) : (
                <span className="text-[11px] text-text-muted">
                  {remoteMeta
                    ? `Showing all ${remote.length.toLocaleString()} of ${remoteMeta.total.toLocaleString()}`
                    : "No more results"}
                </span>
              )}
              {hasMore && remoteMeta && (
                <span className="text-[11px] text-text-muted">
                  {remote.length.toLocaleString()} of {remoteMeta.total.toLocaleString()} loaded
                </span>
              )}
            </div>
          </>
        )}

        {importMessage && (
          <div className="text-[11px] text-text-muted">
            {importMessage}{" "}
            <Link href="/imports" className="font-semibold text-primary">
              View imports
            </Link>
          </div>
        )}
        {trackedSummary && (
          <div
            className={`flex items-center gap-2 rounded-[18px] border px-3.5 py-2.5 text-[11px] font-semibold ${
              trackedSummary.tone === "success"
                ? "border-success/25 bg-success/5 text-success"
                : trackedSummary.tone === "error"
                ? "border-danger/25 bg-danger/5 text-danger"
                : "border-primary/20 bg-primary-soft text-primary"
            }`}
            role="status"
            aria-live="polite"
          >
            {trackedSummary.tone === "success" ? (
              <Icon name="check" size={14} />
            ) : trackedSummary.tone === "error" ? (
              <Icon name="alert" size={14} />
            ) : (
              <Icon name="refresh" size={14} className="animate-spin" />
            )}
            {trackedSummary.text}
            <Link href="/imports" className="ml-auto shrink-0 underline">
              View
            </Link>
          </div>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-[20px] font-bold tracking-[-0.03em] md:text-[22px]">Metadata sources</h2>
        <div className="grid gap-2.5 md:grid-cols-2">
          {sources.map((source) => (
            <div key={source.id} className="rounded-[22px] border border-border/80 bg-surface p-4">
              <div className="flex items-center justify-between gap-3">
                <div className="text-[14px] font-bold tracking-[-0.02em] text-text">{source.name}</div>
                <span
                  className={`rounded-full px-2.5 py-1 text-[10px] font-semibold ${
                    source.enabled ? "bg-success/10 text-success" : "bg-border/60 text-text-muted"
                  }`}
                >
                  {source.enabled ? "Enabled" : "Disabled"}
                </span>
              </div>
              <div className="mt-1.5 text-[12px] leading-relaxed text-text-secondary">
                {source.description}
              </div>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {(source.capabilities || []).map((capability: string) => (
                  <span
                    key={capability}
                    className="rounded-full bg-primary-soft px-2 py-0.5 text-[10px] font-semibold text-primary"
                  >
                    {capability}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}
