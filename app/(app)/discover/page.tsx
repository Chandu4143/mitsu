"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api, type Gallery, type MetadataSource } from "@/lib/api";
import { Icon } from "@/components/Icon";
import { EmptyState, Skeleton } from "@/components/ui";

type ImportState = {
  status: "queued" | "running" | "completed" | "failed" | "cancelled";
  jobId: string;
  message?: string;
};

type RemoteItem = {
  id: string;
  title: string;
  cover_url?: string | null;
  thumbnail_url?: string | null;
  page_count?: number | null;
  source?: string;
  source_url?: string;
};

type ImportJob = {
  id: string;
  status: ImportState["status"];
  error_message?: string | null;
};

export default function Discover() {
  const [q, setQ] = useState("");
  const [debounced, setDebounced] = useState("");
  const [local, setLocal] = useState<Gallery[]>([]);
  const [loading, setLoading] = useState(false);
  const [sources, setSources] = useState<MetadataSource[]>([]);
  const [remote, setRemote] = useState<RemoteItem[]>([]);
  const [remoteLoading, setRemoteLoading] = useState(false);
  const [importingId, setImportingId] = useState<string | null>(null);
  const [importStates, setImportStates] = useState<Record<string, ImportState>>({});
  const [importMessage, setImportMessage] = useState<string | null>(null);
  const [tracked, setTracked] = useState<Record<string, string>>({});

  useEffect(() => {
    const handle = setTimeout(() => setDebounced(q), 300);
    return () => clearTimeout(handle);
  }, [q]);

  useEffect(() => {
    api.listMetadataSources().then(setSources).catch(() => setSources([]));
  }, []);

  useEffect(() => {
    if (!debounced.trim()) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setLocal([]);
      return;
    }
    setLoading(true);
    api
      .listGalleries({ q: debounced.trim(), page_size: 12 })
      .then((response) => setLocal(response.items || []))
      .catch(() => setLocal([]))
      .finally(() => setLoading(false));
  }, [debounced]);

  useEffect(() => {
    if (!debounced.trim()) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setRemote([]);
      return;
    }
    setRemoteLoading(true);
    api
      .searchNhentai(debounced.trim(), 1)
      .then((response) => setRemote(response.items || []))
      .catch(() => setRemote([]))
      .finally(() => setRemoteLoading(false));
  }, [debounced]);

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
            if (next[remoteId]?.status !== status) {
              next[remoteId] = {
                status,
                jobId: job.id,
                message: job.error_message || undefined,
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

  return (
    <>
      <header className="pt-1 md:pt-0">
        <h1 className="text-[34px] font-extrabold leading-none tracking-[-0.045em] text-text md:text-[40px]">
          Discover
        </h1>
        <p className="mt-2 max-w-[54ch] text-[13px] leading-relaxed text-text-secondary">
          Search your own shelves, or look up a gallery code. Remote sources stay opt-in.
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
          onChange={(event) => setQ(event.target.value)}
          placeholder="Title, artist, tag, or gallery code"
          aria-label="Search discover"
          className="h-12 w-full rounded-2xl border border-border bg-surface py-2 pl-11 pr-11 text-[16px] text-text outline-none transition placeholder:text-text-muted focus:border-primary md:h-11 md:text-[14px]"
        />
        {q && (
          <button
            type="button"
            onClick={() => setQ("")}
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
          {local.length > 0 && <span className="text-[11px] text-text-muted">{local.length} matches</span>}
        </div>
        {loading ? (
          <div className="grid grid-cols-2 gap-2.5 md:grid-cols-3">
            {Array.from({ length: 4 }).map((_, index) => (
              <Skeleton key={index} className="h-[86px] w-full rounded-[18px]" />
            ))}
          </div>
        ) : !debounced.trim() ? (
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
                href={`/gallery/${gallery.id}`}
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
        <div className="flex items-baseline justify-between gap-4">
          <h2 className="text-[20px] font-bold tracking-[-0.03em] md:text-[22px]">nhentai</h2>
          <span className="text-[11px] text-text-muted">Optional</span>
        </div>
        {remoteLoading ? (
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-5">
            {Array.from({ length: 4 }).map((_, index) => (
              <Skeleton key={index} className="aspect-[3/4] w-full rounded-[18px]" />
            ))}
          </div>
        ) : !debounced.trim() ? (
          <div className="rounded-[22px] border border-border/80 bg-surface px-4 py-5 text-[13px] leading-relaxed text-text-secondary">
            Search a title or gallery code to preview remote results and import in one tap.
          </div>
        ) : remote.length === 0 ? (
          <div className="rounded-[22px] border border-border/80 bg-surface px-4 py-5 text-[13px] text-text-secondary">
            No remote results for this search.
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-5">
            {remote.map((item) => {
              const state = importStates[item.id];
              const isDone = state?.status === "completed";
              const isFailed = state?.status === "failed";
              const isActive = state?.status === "queued" || state?.status === "running";
              const busy = importingId === item.id || isActive;
              return (
                <article
                  key={item.id}
                  className={`flex flex-col overflow-hidden rounded-[18px] border bg-surface transition ${
                    isDone
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
                        <span className="absolute bottom-1.5 right-1.5 rounded-full bg-black/45 px-1.5 py-0.5 text-[9px] font-semibold text-white backdrop-blur-sm">
                          {item.page_count} pages
                        </span>
                      ) : null}
                    </div>
                  </Link>
                  <div className="flex flex-1 flex-col gap-2 p-2.5">
                    <div className="line-clamp-2 text-[11px] font-semibold leading-snug text-text" title={item.title}>
                      {item.title}
                    </div>
                    {isDone ? (
                      <div className="mt-auto flex items-center gap-1 text-[10px] font-semibold text-success">
                        <Icon name="check" size={12} /> Imported
                      </div>
                    ) : isFailed ? (
                      <div className="mt-auto flex items-center gap-1 text-[10px] font-semibold text-danger">
                        <Icon name="alert" size={12} /> Failed
                      </div>
                    ) : (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={async () => {
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
                            setImportMessage((err as Error).message);
                          } finally {
                            setImportingId(null);
                          }
                        }}
                        className="mt-auto inline-flex min-h-8 items-center justify-center gap-1 rounded-full bg-primary-soft px-3 text-[10px] font-bold text-primary transition active:scale-[0.98] disabled:opacity-50"
                      >
                        {busy && <Icon name="refresh" size={11} className="animate-spin" />}
                        {busy ? "Importing…" : "Import"}
                      </button>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
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
