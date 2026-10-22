"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { Icon } from "@/components/Icon";
import { Button, EmptyState, Skeleton } from "@/components/ui";

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
  const [local, setLocal] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [sources, setSources] = useState<any[]>([]);
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
      setLocal([]);
      return;
    }
    setLoading(true);
    api
      .listGalleries({ q: debounced.trim(), page_size: 12 })
      .then((response: any) => setLocal(response.items || []))
      .catch(() => setLocal([]))
      .finally(() => setLoading(false));
  }, [debounced]);

  useEffect(() => {
    if (!debounced.trim()) {
      setRemote([]);
      return;
    }
    setRemoteLoading(true);
    api
      .searchNhentai(debounced.trim(), 1)
      .then((response: any) => setRemote(response.items || []))
      .catch(() => setRemote([]))
      .finally(() => setRemoteLoading(false));
  }, [debounced]);

  // Poll the import jobs started from this page so each card can show real progress.
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
        // ignore polling errors
      }
    };
    poll();
    const timer = setInterval(poll, 1500);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [tracked]);

  // Summarize the live state of every import started from this page.
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
        text: `Importing ${active} ${galleries(active)}… this can take a moment.`,
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
        text: `Import complete — ${done} ${galleries(done)} added to your library.`,
      };
    }
    return null;
  })();

  return (
    <>
      <h1 className="text-[32px] font-extrabold tracking-[-0.02em] text-text">Discover</h1>
      <p className="text-[13px] text-text-secondary">
        Search your local library instantly. Remote metadata sources stay optional and disabled by default.
      </p>

      <div className="flex flex-col gap-3 md:flex-row md:items-center">
        <div className="relative flex-1">
          <Icon name="search" size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
          <input
            value={q}
            onChange={(event) => setQ(event.target.value)}
            placeholder="Search titles, artists, tags… or enter a gallery code like 689735"
            className="w-full rounded-full border border-border bg-surface py-2.5 pl-9 pr-4 text-[14px] text-text outline-none transition focus:border-primary placeholder:text-text-muted"
          />
        </div>
        <Button variant="ghost" onClick={() => setQ("")}>
          Clear
        </Button>
      </div>

      <div className="flex flex-col gap-3">
        <div className="text-[12px] font-semibold uppercase tracking-[0.04em] text-text-muted">
          Local matches
        </div>
        {loading ? (
          <div className="flex flex-wrap gap-3">
            {Array.from({ length: 4 }).map((_, index) => (
              <Skeleton key={index} className="h-[78px] w-[260px]" />
            ))}
          </div>
        ) : !debounced.trim() ? (
          <div className="rounded-lg border border-border bg-surface px-5 py-4 text-[13px] text-text-secondary">
            Start typing to search your library. Local search works fully offline.
          </div>
        ) : local.length === 0 ? (
          <EmptyState
            icon="search"
            title="No local matches"
            description="Try another title, artist, tag, or language."
          />
        ) : (
          <div className="flex flex-wrap gap-3">
            {local.map((gallery) => (
              <Link
                key={gallery.id}
                href={`/gallery/${gallery.id}`}
                className="flex w-[260px] items-center gap-2.5 rounded-md border border-border bg-surface px-3 py-2.5 transition hover:border-primary"
              >
                <div className="h-[70px] w-[54px] shrink-0 overflow-hidden rounded-md bg-primary-soft">
                  {gallery.cover_url && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={gallery.cover_url} alt="" className="h-full w-full object-cover" />
                  )}
                </div>
                <div className="min-w-0">
                  <div className="line-clamp-2 text-[13px] font-semibold text-text">{gallery.title}</div>
                  <div className="text-[11px] text-text-secondary">{gallery.page_count} pages</div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      <div className="flex flex-col gap-3">
        <div className="text-[12px] font-semibold uppercase tracking-[0.04em] text-text-muted">
          nhentai results
        </div>
        {remoteLoading ? (
          <div className="flex flex-wrap gap-4">
            {Array.from({ length: 4 }).map((_, index) => (
              <Skeleton key={index} className="h-[340px] w-[240px]" />
            ))}
          </div>
        ) : !debounced.trim() ? (
          <div className="rounded-lg border border-border bg-surface px-5 py-4 text-[13px] text-text-secondary">
            Search nhentai to preview and import galleries with one click.
          </div>
        ) : remote.length === 0 ? (
          <div className="rounded-lg border border-border bg-surface px-5 py-4 text-[13px] text-text-secondary">
            No remote results.
          </div>
        ) : (
          <div className="flex flex-wrap gap-4">
            {remote.map((item: RemoteItem) => {
              const state = importStates[item.id];
              const isDone = state?.status === "completed";
              const isFailed = state?.status === "failed";
              const isActive =
                state?.status === "queued" || state?.status === "running";
              const busy = importingId === item.id || isActive;
              return (
                <div
                  key={item.id}
                  className={`flex w-[240px] flex-col overflow-hidden rounded-lg border bg-surface transition ${
                    isDone
                      ? "border-success/40"
                      : isFailed
                      ? "border-danger/40"
                      : isActive
                      ? "border-primary/40"
                      : "border-border hover:border-primary"
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
                          className="h-full w-full object-cover transition group-hover:scale-105"
                        />
                      )}
                      {item.page_count ? (
                        <span className="absolute bottom-2 right-2 rounded-full bg-white/90 px-2 py-0.5 text-[10px] font-semibold text-text">
                          {item.page_count} pages
                        </span>
                      ) : null}
                    </div>
                  </Link>
                  <div className="flex flex-1 flex-col gap-2 px-3 py-3">
                    <div className="line-clamp-2 text-[13px] font-semibold text-text" title={item.title}>
                      {item.title}
                    </div>
                    <div className="text-[11px] text-text-secondary">#{item.id}</div>
                    {isDone ? (
                      <div className="mt-auto flex items-center gap-1 text-[12px] font-semibold text-success">
                        <Icon name="check" size={13} /> Imported
                      </div>
                    ) : isFailed ? (
                      <div className="mt-auto flex items-center gap-1 text-[12px] font-semibold text-danger">
                        <Icon name="alert" size={13} /> Import failed
                      </div>
                    ) : (
                      <button
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
                            setImportMessage(`Import queued: ${job.id.slice(0, 8)}. Track it on Imports.`);
                          } catch (err) {
                            setImportMessage((err as Error).message);
                          } finally {
                            setImportingId(null);
                          }
                        }}
                        className="mt-auto inline-flex items-center justify-center gap-1.5 rounded-full bg-primary px-3 py-1.5 text-[12px] font-semibold text-white transition hover:bg-primary-hover disabled:opacity-50"
                      >
                        {busy && <Icon name="refresh" size={12} className="animate-spin" />}
                        {busy ? "Importing…" : "Import"}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
        {importMessage && (
          <div className="text-[12px] text-text-muted">
            {importMessage} <Link href="/imports" className="text-primary">View imports</Link>
          </div>
        )}
        {trackedSummary && (
          <div
            className={`flex items-center gap-2 rounded-lg border px-4 py-2.5 text-[12px] font-semibold ${
              trackedSummary.tone === "success"
                ? "border-success/30 bg-success/5 text-success"
                : trackedSummary.tone === "error"
                ? "border-danger/30 bg-danger/5 text-danger"
                : "border-primary/30 bg-primary-soft text-primary"
            }`}
            role="status"
            aria-live="polite"
          >
            {trackedSummary.tone === "success" ? (
              <Icon name="check" size={15} />
            ) : trackedSummary.tone === "error" ? (
              <Icon name="alert" size={15} />
            ) : (
              <Icon name="refresh" size={15} className="animate-spin" />
            )}
            {trackedSummary.text}
            <Link href="/imports" className="ml-auto shrink-0 underline">
              View imports
            </Link>
          </div>
        )}
      </div>

      <div className="flex flex-col gap-3">
        <div className="text-[12px] font-semibold uppercase tracking-[0.04em] text-text-muted">
          Metadata sources
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          {sources.map((source) => (
            <div
              key={source.id}
              className="rounded-lg border border-border bg-surface p-5"
            >
              <div className="flex items-center justify-between">
                <div className="text-[15px] font-bold text-text">{source.name}</div>
                <span
                  className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                    source.enabled
                      ? "bg-success/10 text-success"
                      : "bg-border text-text-muted"
                  }`}
                >
                  {source.enabled ? "Enabled" : "Disabled"}
                </span>
              </div>
              <div className="mt-2 text-[13px] text-text-secondary">{source.description}</div>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {(source.capabilities || []).map((capability: string) => (
                  <span
                    key={capability}
                    className="rounded-full bg-primary-soft px-2 py-0.5 text-[11px] font-semibold text-primary"
                  >
                    {capability}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
