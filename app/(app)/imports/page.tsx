"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { api, type Job, type LibraryRoot } from "@/lib/api";
import { Icon } from "@/components/Icon";
import { Button, EmptyState, IconButton } from "@/components/ui";

const filters = ["All", "Running", "Completed", "Failed"];

type Notice = {
  tone: "info" | "success" | "error";
  title: string;
  detail?: string;
  galleryId?: string;
};

const statusMeta: Record<
  string,
  {
    label: string;
    color: string;
    text: string;
    icon: "check" | "alert" | "clock" | "refresh" | "x";
  }
> = {
  queued: { label: "Queued", color: "bg-warning", text: "text-warning", icon: "clock" },
  running: { label: "Importing", color: "bg-primary", text: "text-primary", icon: "refresh" },
  completed: { label: "Completed", color: "bg-success", text: "text-success", icon: "check" },
  failed: { label: "Failed", color: "bg-danger", text: "text-danger", icon: "alert" },
  cancelled: { label: "Cancelled", color: "bg-text-muted", text: "text-text-muted", icon: "x" },
};

export default function Imports() {
  const [path, setPath] = useState("");
  const [rootPath, setRootPath] = useState("");
  const [jobs, setJobs] = useState<Job[]>([]);
  const [roots, setRoots] = useState<LibraryRoot[]>([]);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState("All");
  const [notice, setNotice] = useState<Notice | null>(null);
  const trackedIdRef = useRef<string | null>(null);
  const trackedLabelRef = useRef("");
  const jobsRef = useRef<HTMLDivElement>(null);

  const refresh = async (): Promise<Job[]> => {
    try {
      const nextJobs: Job[] = await api.listImports();
      setJobs(nextJobs);
      setRoots(await api.listLibraryRoots());
      return nextJobs;
    } catch (err) {
      setError((err as Error).message);
      return [];
    }
  };

  useEffect(() => {
    let cancelled = false;
    const poll = async () => {
      const nextJobs = await refresh();
      if (cancelled) return;
      if (!trackedIdRef.current) return;
      const job = nextJobs.find((item) => item.id === trackedIdRef.current);
      if (!job) return;
      const label = trackedLabelRef.current;
      const progress = job.progress_total
        ? `${job.progress_current}/${job.progress_total} pages`
        : "Preparing files…";
      if (job.status === "queued") {
        setNotice({ tone: "info", title: "Import queued", detail: label });
      } else if (job.status === "running") {
        setNotice({ tone: "info", title: "Importing…", detail: `${label} · ${progress}` });
      } else if (job.status === "completed") {
        setNotice({
          tone: "success",
          title: "Import complete",
          detail:
            job.error_code === "DUPLICATE"
              ? `${label} is already in your library.`
              : `${label} · ${progress}`,
          galleryId: job.result_id || undefined,
        });
        trackedIdRef.current = null;
      } else if (job.status === "failed") {
        setNotice({
          tone: "error",
          title: "Import failed",
          detail: job.error_message || `Could not import ${label}.`,
        });
        trackedIdRef.current = null;
      } else if (job.status === "cancelled") {
        setNotice({ tone: "info", title: "Import cancelled", detail: label });
        trackedIdRef.current = null;
      }
    };
    poll();
    const timer = setInterval(poll, 1500);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, []);

  const doImport = async () => {
    if (!path.trim()) return;
    const target = path.trim();
    setImporting(true);
    setError("");
    setNotice({ tone: "info", title: "Starting import…", detail: target });
    try {
      const job = await api.startImport({ path: target });
      trackedIdRef.current = job.id;
      trackedLabelRef.current = target;
      setPath("");
      await refresh();
      jobsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    } catch (err) {
      setNotice(null);
      setError((err as Error).message);
    } finally {
      setImporting(false);
    }
  };

  const addRoot = async () => {
    if (!rootPath.trim()) return;
    setError("");
    try {
      await api.createLibraryRoot(rootPath.trim());
      setRootPath("");
      await refresh();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const retry = async (job: Job) => {
    try {
      await api.retryImport(job.id);
      trackedIdRef.current = job.id;
      trackedLabelRef.current = `Job ${job.id.slice(0, 8)}`;
      setNotice({ tone: "info", title: "Retrying import…", detail: `Job ${job.id.slice(0, 8)}` });
      await refresh();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const cancel = async (job: Job) => {
    try {
      await api.cancelImport(job.id);
      await refresh();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const visibleJobs = jobs.filter((job) => {
    if (filter === "All") return true;
    if (filter === "Running") return job.status === "queued" || job.status === "running";
    return job.status === filter.toLowerCase();
  });

  const activeCount = jobs.filter(
    (job) => job.status === "queued" || job.status === "running"
  ).length;

  return (
    <>
      <header className="pt-1 md:pt-0">
        <h1 className="text-[34px] font-extrabold leading-none tracking-[-0.045em] text-text md:text-[40px]">
          Imports
        </h1>
        <p className="mt-2 max-w-[52ch] text-[13px] leading-relaxed text-text-secondary">
          Bring in a CBZ, ZIP, image, or folder. Mitsu copies files into its library and keeps
          originals untouched.
        </p>
      </header>

      <section className="rounded-[26px] border border-border/80 bg-surface p-4 shadow-card md:p-5">
        <div className="flex flex-col gap-2.5 md:flex-row">
          <div className="relative flex-1">
            <Icon
              name="folder"
              size={17}
              className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-text-muted"
            />
            <input
              value={path}
              onChange={(event) => setPath(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") doImport();
              }}
              placeholder="Path to a file or folder"
              aria-label="Import path"
              className="h-12 w-full rounded-2xl border border-border bg-surface-soft py-2 pl-10 pr-4 text-[16px] text-text outline-none transition placeholder:text-text-muted focus:border-primary md:text-[14px]"
            />
          </div>
          <Button onClick={doImport} disabled={importing || !path.trim()} className="md:min-w-28">
            {importing ? "Starting…" : "Import"}
          </Button>
        </div>
        <div className="mt-2.5 flex items-center gap-1.5 text-[11px] text-text-muted">
          <Icon name="check" size={12} />
          Originals are never moved. Duplicates are detected by content.
        </div>
        {error && <div className="mt-3 text-[12px] text-danger">{error}</div>}
      </section>

      {notice && (
        <div
          className={`flex items-start gap-3 rounded-[22px] border px-4 py-3.5 ${
            notice.tone === "success"
              ? "border-success/25 bg-success/5"
              : notice.tone === "error"
              ? "border-danger/25 bg-danger/5"
              : "border-primary/20 bg-primary-soft"
          }`}
          role="status"
          aria-live="polite"
        >
          <div
            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-white ${
              notice.tone === "success"
                ? "bg-success"
                : notice.tone === "error"
                ? "bg-danger"
                : "bg-primary"
            }`}
          >
            {notice.tone === "success" ? (
              <Icon name="check" size={17} />
            ) : notice.tone === "error" ? (
              <Icon name="alert" size={17} />
            ) : (
              <Icon name="refresh" size={17} className="animate-spin" />
            )}
          </div>
          <div className="min-w-0 flex-1 pt-0.5">
            <div
              className={`text-[13px] font-bold ${
                notice.tone === "success"
                  ? "text-success"
                  : notice.tone === "error"
                  ? "text-danger"
                  : "text-primary"
              }`}
            >
              {notice.title}
            </div>
            {notice.detail && (
              <div className="mt-0.5 line-clamp-2 text-[12px] leading-relaxed text-text-secondary" title={notice.detail}>
                {notice.detail}
              </div>
            )}
          </div>
          {notice.galleryId && (
            <Link
              href={`/gallery/${notice.galleryId}`}
              className="shrink-0 self-center rounded-full bg-primary px-3 py-1.5 text-[11px] font-semibold text-white"
            >
              Open
            </Link>
          )}
          {notice.tone !== "info" && (
            <button
              type="button"
              onClick={() => setNotice(null)}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-text-muted"
              aria-label="Dismiss"
            >
              <Icon name="x" size={14} />
            </button>
          )}
        </div>
      )}

      <div ref={jobsRef} className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
        <section className="flex min-w-0 flex-col gap-3">
          <div className="flex items-end justify-between gap-3">
            <div>
              <h2 className="text-[20px] font-bold tracking-[-0.03em] md:text-[22px]">Recent jobs</h2>
              <p className="mt-0.5 text-[11px] text-text-muted">
                {activeCount > 0 ? `${activeCount} running now` : "Nothing running"}
              </p>
            </div>
          </div>

          <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 md:mx-0 md:px-0">
            {filters.map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => setFilter(item)}
                className={`min-h-9 shrink-0 rounded-full px-3.5 text-[12px] font-semibold transition ${
                  filter === item
                    ? "bg-text text-white"
                    : "border border-border bg-surface text-text-secondary"
                }`}
              >
                {item}
              </button>
            ))}
          </div>

          {jobs.length === 0 ? (
            <EmptyState
              icon="upload"
              title="No import jobs yet"
              description="Paste a path above to bring your first gallery in."
            />
          ) : visibleJobs.length === 0 ? (
            <div className="rounded-[22px] border border-border bg-surface px-5 py-8 text-center text-[13px] text-text-secondary">
              No jobs match this filter.
            </div>
          ) : (
            <div className="flex flex-col gap-2.5">
              {visibleJobs.map((job) => {
                const meta = statusMeta[job.status] || statusMeta.queued;
                const isActive = job.status === "queued" || job.status === "running";
                const percent = job.progress_total
                  ? Math.round((job.progress_current / job.progress_total) * 100)
                  : 0;
                return (
                  <div
                    key={job.id}
                    className={`flex items-start gap-3 rounded-[22px] border bg-surface p-3.5 transition ${
                      isActive ? "border-primary/25" : "border-border/80"
                    }`}
                  >
                    <div
                      className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-white ${meta.color}`}
                    >
                      <Icon
                        name={meta.icon}
                        size={18}
                        className={job.status === "running" ? "animate-spin" : ""}
                      />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="truncate text-[13px] font-semibold capitalize text-text">
                            {job.type} · {job.id.slice(0, 8)}
                          </div>
                          <div className="mt-0.5 text-[11px] text-text-muted">
                            {job.progress_current}/{job.progress_total} pages
                            {job.error_message ? ` · ${job.error_message}` : ""}
                          </div>
                        </div>
                        <div className={`shrink-0 text-[11px] font-semibold ${meta.text}`}>
                          {meta.label}
                          {job.status === "running" ? ` ${percent}%` : ""}
                        </div>
                      </div>
                      <div className="mt-2.5 h-1 overflow-hidden rounded-full bg-border">
                        <div
                          className={`h-full rounded-full transition-[width] duration-500 ${meta.color}`}
                          style={{ width: `${job.status === "completed" ? 100 : percent}%` }}
                        />
                      </div>
                    </div>
                    <div className="flex shrink-0 gap-0.5">
                      {job.status === "failed" && (
                        <IconButton
                          icon="refresh"
                          label="Retry import"
                          onClick={() => retry(job)}
                          className="!h-9 !w-9 !border-transparent !bg-transparent"
                        />
                      )}
                      {isActive && (
                        <IconButton
                          icon="x"
                          label="Cancel import"
                          onClick={() => cancel(job)}
                          className="!h-9 !w-9 !border-transparent !bg-transparent hover:text-danger"
                        />
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        <section className="flex flex-col gap-3">
          <div className="rounded-[24px] border border-border/80 bg-surface p-4">
            <h2 className="text-[16px] font-bold tracking-[-0.02em] text-text">Library roots</h2>
            <p className="mt-1 text-[12px] leading-relaxed text-text-secondary">
              Folders that Mitsu is allowed to scan or serve.
            </p>
            <div className="mt-3 flex gap-2">
              <input
                value={rootPath}
                onChange={(event) => setRootPath(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") addRoot();
                }}
                placeholder="/path/to/manga"
                aria-label="Library root path"
                className="h-10 min-w-0 flex-1 rounded-xl border border-border bg-surface-soft px-3 text-[16px] text-text outline-none focus:border-primary md:text-[13px]"
              />
              <Button variant="soft" onClick={addRoot} disabled={!rootPath.trim()} className="min-h-10 px-4 text-[12px]">
                Add
              </Button>
            </div>
            <div className="mt-3 flex flex-col gap-2">
              {roots.length === 0 && (
                <div className="rounded-xl bg-surface-soft px-3 py-2.5 text-[12px] text-text-muted">
                  No roots configured.
                </div>
              )}
              {roots.map((root) => (
                <div
                  key={root.id}
                  className="flex items-center justify-between gap-2 rounded-xl bg-surface-soft px-3 py-2.5"
                >
                  <div className="min-w-0">
                    <div className="truncate text-[12px] font-semibold text-text">{root.path}</div>
                    <div className="mt-0.5 text-[10px] text-text-muted">
                      {root.is_enabled ? "Enabled" : "Disabled"}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={async () => {
                      await api.deleteLibraryRoot(root.id);
                      await refresh();
                    }}
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-text-muted transition hover:bg-danger/10 hover:text-danger"
                    aria-label="Remove root"
                  >
                    <Icon name="trash" size={14} />
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-[24px] bg-[#352a32] p-4 text-white">
            <div className="flex items-center gap-2 text-[13px] font-semibold">
              <Icon name="bookmark" size={15} className="text-[#f0b7cc]" />
              Safe by default
            </div>
            <p className="mt-1.5 text-[12px] leading-relaxed text-white/60">
              Imports are validated against size, entry count, and pixel limits before anything is
              written to your library.
            </p>
          </div>
        </section>
      </div>
    </>
  );
}
